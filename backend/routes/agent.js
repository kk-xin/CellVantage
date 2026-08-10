const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const path = require('path');
const { verifyToken, requireRole } = require('../middleware/auth');
const db = require('../db');
const { detectAnomalies } = require('../agent/anomalyDetection');
const { checkStateTransition } = require('../guardrails/stateTransition');

const QUERY_SCRIPT = path.join(__dirname, '../rag/query.py');
const RAG_DIR = path.join(__dirname, '../rag');
const PYTHON_BIN = '/home/kerstin/miniconda3/envs/CellVantage/bin/python';

function queryRAG(question) {
  return new Promise((resolve, reject) => {
    const process = spawn(PYTHON_BIN, [QUERY_SCRIPT, question], { cwd: RAG_DIR });
    let stdout = '', stderr = '';
    process.stdout.on('data', d => stdout += d.toString());
    process.stderr.on('data', d => stderr += d.toString());
    process.on('close', (code) => {
      if (code !== 0 && !stdout) return reject(new Error(`Python script failed: ${stderr}`));
      try { resolve(JSON.parse(stdout)); }
      catch (e) { reject(new Error(`Failed to parse Python output: ${stdout}`)); }
    });
    process.on('error', err => reject(new Error(`Failed to spawn Python process: ${err.message}`)));
  });
}

// ============================================================
// analyzeSingleCell — 核心分析逻辑，被单个分析和批量分析共用
// ------------------------------------------------------------
// 类比 Spring：这是从 Controller 里抽出来的 Service 方法，
// 不碰 req/res，只接收纯参数、返回纯数据，
// 这样单个调用和批量循环调用都能复用同一份逻辑，不用维护两份代码。
// ============================================================
async function analyzeSingleCell(cellCode, operatorId, role) {
  const report = {
    cell_code: cellCode,
    steps: [],
    anomalies: [],
    rag_references: [],
    action_taken: null,
    final_state: null
  };

  // ── Step 1: 查询电池基础信息 ──────────────────────────
  const [cells] = await db.query(
    'SELECT id, current_state FROM cells WHERE cell_code = ?',
    [cellCode]
  );

  if (cells.length === 0) {
    return { notFound: true, report };
  }

  const cell = cells[0];
  report.steps.push({ step: 1, description: 'Fetched cell info', result: { current_state: cell.current_state } });

  if (cell.current_state !== 'Under Test') {
    return {
      invalidState: true,
      currentState: cell.current_state,
      report
    };
  }

  // ── Step 2: 查询测试数据 ──────────────────────────────
  const [metricsRows] = await db.query(
    `SELECT * FROM cell_metrics_data WHERE cell_id = ?
     ORDER BY COALESCE(cycle_count, 9999) ASC, test_timestamp ASC`,
    [cell.id]
  );

  report.steps.push({ step: 2, description: 'Fetched metrics data', result: { record_count: metricsRows.length } });

  if (metricsRows.length === 0) {
    report.action_taken = 'No metrics data — nothing to analyze';
    report.final_state = cell.current_state;
    return { noData: true, report };
  }

  // ── Step 3: 跑异常检测 ────────────────────────────────
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

  // ── Step 4: 针对 critical 异常查 RAG 说明书 ──────────
  const criticalAnomalies = anomalies.filter(a => a.severity === 'critical');

  for (const anomaly of criticalAnomalies) {
    const ragQuestion = {
      CAPACITY_DROP:            'What is the acceptable capacity degradation rate and when should a cell be rejected?',
      HIGH_INTERNAL_RESISTANCE: 'What is the maximum acceptable internal resistance for lithium cells during testing?',
      OVER_TEMPERATURE:         'What are the safe temperature limits during battery cycle testing?'
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

  // ── Step 5: 决策 → 有 critical 异常则自动改为 Failed ──
  if (criticalAnomalies.length > 0) {
    const check = await checkStateTransition({ cellId: cell.id, role, newState: 'Failed' });

    if (check.allowed) {
      await db.query('UPDATE cells SET current_state = ? WHERE id = ?', ['Failed', cell.id]);

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
        [cell.id, operatorId, cell.current_state, 'Failed', auditNotes]
      );

      report.action_taken = `State changed from ${cell.current_state} to Failed`;
      report.final_state = 'Failed';
      report.steps.push({
        step: 5,
        description: 'Executed state transition + wrote audit log',
        result: { from: cell.current_state, to: 'Failed' }
      });

    } else {
      report.steps.push({
        step: 5,
        description: 'State transition blocked by Guardrail',
        result: check
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

  return { success: true, report };
}

// ── POST /api/agent/query ──────────────────────────────────
router.post('/query', verifyToken, async (req, res) => {
  try {
    const { question } = req.body;
    if (!question || question.trim() === '') {
      return res.status(400).json({ success: false, message: 'question is required' });
    }
    const result = await queryRAG(question.trim());
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: `RAG query failed: ${error.message}` });
  }
});

// ── POST /api/agent/analyze/:cellCode ─────────────────────
// 单个电池分析（保持原有行为不变）
router.post('/analyze/:cellCode', verifyToken, requireRole('lab_operator'), async (req, res) => {
  const { cellCode } = req.params;
  const operatorId = req.user.id;
  const role = req.user.role;

  try {
    const result = await analyzeSingleCell(cellCode, operatorId, role);

    if (result.notFound) {
      return res.status(404).json({ success: false, message: `Cell ${cellCode} not found` });
    }

    if (result.invalidState) {
      return res.status(400).json({
        success: false,
        error_code: 'INVALID_CELL_STATE',
        message: `Agent analysis requires cell to be in 'Under Test' state. Current state: '${result.currentState}'. Please advance the cell through the workflow first.`,
        report: result.report
      });
    }

    if (result.noData) {
      return res.json({
        success: true,
        message: 'No metrics data found for this cell. Please import test data first.',
        report: result.report
      });
    }

    res.json({ success: true, report: result.report });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── POST /api/agent/analyze-batch ─────────────────────────
// 批量分析：对一批电池逐个运行 analyzeSingleCell。
//
// 请求体：
//   { "cell_codes": ["SIM-0081", "SIM-0082", ...] }  → 分析指定的一批
//   { "state": "Under Test" }                         → 分析该状态下的全部电池
//
// 响应：每个电池的简要结果 + 汇总统计
router.post('/analyze-batch', verifyToken, requireRole('lab_operator'), async (req, res) => {
  const operatorId = req.user.id;
  const role = req.user.role;

  try {
    let cellCodes = req.body.cell_codes;

    // 如果没有直接给电池列表，就按状态查一批
    if (!cellCodes || cellCodes.length === 0) {
      const state = req.body.state || 'Under Test';
      const [cells] = await db.query('SELECT cell_code FROM cells WHERE current_state = ?', [state]);
      cellCodes = cells.map(c => c.cell_code);
    }

    if (cellCodes.length === 0) {
      return res.json({
        success: true,
        message: 'No cells found to analyze.',
        summary: { total: 0, analyzed: 0, flagged_failed: 0, no_anomalies: 0, skipped: 0, errors: 0 },
        results: []
      });
    }

    const results = [];
    const summary = { total: cellCodes.length, analyzed: 0, flagged_failed: 0, no_anomalies: 0, skipped: 0, errors: 0 };

    // 逐个跑，避免同时对数据库/RAG脚本发起过多并发请求
    for (const cellCode of cellCodes) {
      try {
        const result = await analyzeSingleCell(cellCode, operatorId, role);

        if (result.notFound) {
          summary.errors++;
          results.push({ cell_code: cellCode, outcome: 'not_found' });
          continue;
        }
        if (result.invalidState) {
          summary.skipped++;
          results.push({ cell_code: cellCode, outcome: 'skipped', reason: `Not in Under Test (currently ${result.currentState})` });
          continue;
        }
        if (result.noData) {
          summary.skipped++;
          results.push({ cell_code: cellCode, outcome: 'skipped', reason: 'No metrics data' });
          continue;
        }

        summary.analyzed++;
        const anomalyCount = result.report.anomalies.length;
        const flaggedFailed = result.report.final_state === 'Failed';

        if (flaggedFailed) summary.flagged_failed++;
        else summary.no_anomalies++;

        results.push({
          cell_code: cellCode,
          outcome: flaggedFailed ? 'flagged_failed' : 'ok',
          anomaly_count: anomalyCount,
          final_state: result.report.final_state
        });

      } catch (err) {
        summary.errors++;
        results.push({ cell_code: cellCode, outcome: 'error', reason: err.message });
      }
    }

    res.json({ success: true, summary, results });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = { router, queryRAG };