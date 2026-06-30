const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');

// ── POST /api/metrics/import ──────────────────────────────
// Bulk import battery test telemetry (voltage, internal resistance,
// capacity, temperature, cycle_count...) — lab_operator only.
//
// 跟 cells/import 的设计完全一致：
// 前端用 PapaParse 把 CSV 解析成 JSON 数组，再 POST 过来，
// 后端只负责逐行写库，并把每一行的成功/失败结果收集起来返回。
router.post('/import', verifyToken, requireRole('lab_operator'), async (req, res) => {
  try {
    const { cell_code, rows } = req.body;

    if (!cell_code) {
      return res.status(400).json({ success: false, message: 'cell_code is required' });
    }

    if (!rows || rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No metrics data provided' });
    }

    // 先确认这个电池真的存在，拿到内部 id（CSV 里用的是人类可读的 cell_code）
    const [cells] = await db.query('SELECT id FROM cells WHERE cell_code = ?', [cell_code]);

    if (cells.length === 0) {
      return res.status(404).json({
        success: false,
        error_code: 'CELL_NOT_FOUND',
        message: `Cell with code "${cell_code}" does not exist`
      });
    }

    const cellId = cells[0].id;

    const results = {
      success: [],
      errors: []
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;

      // 这一行最基本的要求：至少要有一个数值字段，否则导入这一行没意义
      const hasAnyMetric = ['voltage', 'internal_resistance', 'capacity', 'temperature', 'cycle_count']
        .some((field) => row[field] !== undefined && row[field] !== '');

      if (!hasAnyMetric) {
        results.errors.push({ row: rowNum, reason: 'No metric values provided in this row' });
        continue;
      }

      try {
        const [result] = await db.query(
          `INSERT INTO cell_metrics_data
             (cell_id, voltage, internal_resistance, capacity, temperature, cycle_count, test_type, test_duration_hours, notes, test_timestamp)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            cellId,
            row.voltage || null,
            row.internal_resistance || null,
            row.capacity || null,
            row.temperature || null,
            row.cycle_count || null,
            row.test_type || null,
            row.test_duration_hours || null,
            row.notes || null,
            row.test_timestamp || null   // 没给的话用数据库默认值 CURRENT_TIMESTAMP
          ]
        );

        results.success.push({ row: rowNum, id: result.insertId });

      } catch (rowError) {
        results.errors.push({ row: rowNum, reason: rowError.message });
      }
    }

    res.json({
      success: true,
      message: `Imported ${results.success.length} of ${rows.length} metric rows for ${cell_code}`,
      data: results
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── GET /api/metrics/:cellCode ──────────────────────────────
// 查看某个电池的全部测试历史（按时间排序），方便人工确认导入是否成功，
// 以后异常检测模块也会复用这条查询逻辑。
router.get('/:cellCode', verifyToken, async (req, res) => {
  try {
    const [cells] = await db.query('SELECT id FROM cells WHERE cell_code = ?', [req.params.cellCode]);

    if (cells.length === 0) {
      return res.status(404).json({ success: false, message: 'Cell not found' });
    }

    const [rows] = await db.query(
      `SELECT * FROM cell_metrics_data WHERE cell_id = ? ORDER BY test_timestamp ASC`,
      [cells[0].id]
    );

    res.json({ success: true, data: rows });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
