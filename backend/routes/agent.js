const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const path = require('path');
const { verifyToken } = require('../middleware/auth');

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

module.exports = { router, queryRAG };