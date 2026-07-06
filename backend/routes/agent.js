const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const path = require('path');
const { verifyToken } = require('../middleware/auth');
const db = require('../db');
const { detectAnomalies } = require('../agent/anomalyDetection');
const { checkStateTransition } = require('../guardrails/stateTransition');

// Python 脚本的绝对路径（相对于这个文件找，不管从哪里启动 node 都能找到）
const QUERY_SCRIPT = path.join(__dirname, '../rag/query.py');
const RAG_DIR = path.join(__dirname, '../rag');
const PYTHON_BIN = '/home/kerstin/miniconda3/envs/CellVantage/bin/python';

/**
 * 调用 Python RAG 脚本，返回检索结果。
 *
 * 类比 Spring：这相当于一个 @Service 方法，
 * 通过 Runtime.exec() 调外部脚本，结果通过 stdout 拿回来。
 *
 * @param {string} question - 要检索的问题
 * @returns {Promise<Object>} - query.py 返回的 JSON 结果
 */
function queryRAG(question) {
  return new Promise((resolve, reject) => {
    // 用 conda 环境里的 python 运行 query.py
    // cwd 设成 rag/ 目录，这样 query.py 里的相对路径（./chroma_db）能正确找到
    const process = spawn(PYTHON_BIN, [QUERY_SCRIPT, question], {
      cwd: RAG_DIR
    });

    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      if (code !== 0) {
        // 有些 warning（比如 onnxruntime 的 cpuid 警告）会走 stderr 但不影响结果
        // 只有在 stdout 为空时才算真正失败
        if (!stdout) {
          return reject(new Error(`Python script failed: ${stderr}`));
        }
      }

      try {
        // query.py 的输出是纯 JSON，直接解析
        const result = JSON.parse(stdout);
        resolve(result);
      } catch (e) {
        reject(new Error(`Failed to parse Python output: ${stdout}`));
      }
    });

    process.on('error', (err) => {
      reject(new Error(`Failed to spawn Python process: ${err.message}`));
    });
  });
}

// ── POST /api/agent/query ──────────────────────────────────
// 让前端或 Agent 编排层调用 RAG 检索。
// 任何已登录用户都可以查询说明书（不限角色）。
//
// 请求体：{ "question": "What is the cutoff voltage?" }
// 响应：  { "success": true, "question": "...", "results": [...] }
router.post('/query', verifyToken, async (req, res) => {
  try {
    const { question } = req.body;

    if (!question || question.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'question is required'
      });
    }

    const result = await queryRAG(question.trim());

    res.json(result);

  } catch (error) {
    res.status(500).json({
      success: false,
      message: `RAG query failed: ${error.message}`
    });
  }
});

// ── POST /api/agent/analyze/:cellCode ─────────────────────
// Agent 编排层：完整的多步决策链。
//
// Step 1: 查询该电池的全部测试数据
// Step 2: 跑异常检测，得到结构化异常列表
// Step 3: 针对每条 critical 异常，去 RAG 检索说明书
// Step 4: 如果有 critical 异常 → 通过 Guardrail 校验 → 自动改状态为 Failed
// Step 5: 把整个决策过程写入审计日志（包含说明书引用）
//
// 谁能触发：lab_operator（在 Under Test 状态下发现异常）
router.post('/analyze/:cellCode', verifyToken, async (req, res) => {
  const { cellCode } = req.params;
  const operatorId = req.user.id;
  const role = req.user.role;

  // Agent 分析报告，记录每一步的结果，最终整体返回
  const report = {
    cell_code: cellCode,
    steps: [],
    anomalies: [],
    rag_references: [],
    action_taken: null,
    final_state: null
  };

  try {
    // ── Step 1: 查询电池基础信息 + 测试数据 ──────────────
    const [cells] = await db.query(
      'SELECT id, current_state FROM cells WHERE cell_code = ?',
      [cellCode]
    );

    if (cells.length === 0) {
      return res.status(404).json({ success: false, message: `Cell ${cellCode} not found` });
    }

    const cell = cells[0];
    report.steps.push({ step: 1, description: 'Fetched cell info', result: { current_state: cell.current_state } });

    const [metricsRows] = await db.query(
      'SELECT * FROM cell_metrics_data WHERE cell_id = ? ORDER BY test_timestamp ASC',
      [cell.id]
    );

    report.steps.push({ step: 2, description: 'Fetched metrics data', result: { record_count: metricsRows.length } });

    if (metricsRows.length === 0) {
      return res.json({
        success: true,
        message: 'No metrics data found for this cell. Nothing to analyze.',
        report
      });
    }

    // ── Step 2: 跑异常检测 ────────────────────────────────
    const anomalies = detectAnomalies(metricsRows);
    report.anomalies = anomalies;
    report.steps.push({
      step: 3,
      description: 'Ran anomaly detection',
      result: {
        anomaly_count: anomalies.length,
        critical_count: anomalies.filter(a => a.severity === 'critical').length
      }
    });

    // ── Step 3: 针对 critical 异常去 RAG 查说明书 ─────────
    const criticalAnomalies = anomalies.filter(a => a.severity === 'critical');

    for (const anomaly of criticalAnomalies) {
      // 根据异常类型构造检索问题
      const ragQuestion = {
        CAPACITY_DROP: `What is the acceptable capacity degradation rate and when should a cell be rejected?`,
        HIGH_INTERNAL_RESISTANCE: `What is the maximum acceptable internal resistance for lithium cells during testing?`,
        OVER_TEMPERATURE: `What are the safe temperature limits during battery cycle testing?`
      }[anomaly.anomaly_type] || `What are the safety limits for ${anomaly.anomaly_type}?`;

      try {
        const ragResult = await queryRAG(ragQuestion);
        const topResult = ragResult.results?.[0];

        if (topResult) {
          report.rag_references.push({
            anomaly_type: anomaly.anomaly_type,
            question: ragQuestion,
            reference_text: topResult.text,
            similarity: topResult.similarity
          });
        }
      } catch (ragError) {
        // RAG 查询失败不影响整体流程，记录一下继续
        report.rag_references.push({
          anomaly_type: anomaly.anomaly_type,
          error: `RAG query failed: ${ragError.message}`
        });
      }
    }

    report.steps.push({
      step: 4,
      description: 'Queried RAG knowledge base for critical anomalies',
      result: { references_found: report.rag_references.length }
    });

    // ── Step 4: 决策 → 有 critical 异常则自动改为 Failed ──
    if (criticalAnomalies.length > 0) {
      const targetState = 'Failed';

      // 走 Guardrail 校验，确保这个角色能执行这个转移
      const check = await checkStateTransition({
        cellId: cell.id,
        role,
        newState: targetState
      });

      if (check.allowed) {
        // 执行状态更新
        await db.query('UPDATE cells SET current_state = ? WHERE id = ?', [targetState, cell.id]);

        // 构造审计日志（包含说明书引用，这就是"AI 审计日志"）
        const ragSummary = report.rag_references
          .map(r => r.reference_text
            ? `[${r.anomaly_type}] ${r.reference_text.substring(0, 100)}...`
            : `[${r.anomaly_type}] RAG unavailable`)
          .join(' | ');

        const auditNotes =
          `[AGENT] Auto-flagged ${criticalAnomalies.length} critical anomaly(s): ` +
          criticalAnomalies.map(a => `${a.anomaly_type}(${a.observed_value})`).join(', ') +
          `. Spec reference: ${ragSummary}`;

        await db.query(
          `INSERT INTO cell_audit_logs (cell_id, operator_id, event_type, changed_from, changed_to, notes)
           VALUES (?, ?, 'Agent_Decision', ?, ?, ?)`,
          [cell.id, operatorId, cell.current_state, targetState, auditNotes]
        );

        report.action_taken = `State changed from ${cell.current_state} to ${targetState}`;
        report.final_state = targetState;
        report.steps.push({
          step: 5,
          description: 'Executed state transition + wrote audit log',
          result: { from: cell.current_state, to: targetState }
        });

      } else {
        // Guardrail 拦截了（比如这个角色没权限改状态）
        report.action_taken = null;
        report.steps.push({
          step: 5,
          description: 'State transition blocked by Guardrail',
          result: check  // 返回结构化错误，方便调试
        });
      }

    } else {
      report.action_taken = 'No action taken — no critical anomalies detected';
      report.final_state = cell.current_state;
      report.steps.push({
        step: 5,
        description: 'No critical anomalies, no state change needed',
        result: null
      });
    }

    res.json({ success: true, report });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message, report });
  }
});

module.exports = { router, queryRAG };