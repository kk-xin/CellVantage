const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');


// ── GET /api/audit ──────────────────────────────────────
// Get all audit logs — admin only
router.get('/', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT * FROM v_cell_complete_history
       ORDER BY created_at DESC`
    );
    res.json({ success: true, data: rows });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


// ── GET /api/audit/cell/:identifier ────────────────────────
// Get audit logs for a specific cell — all roles can view
// :identifier 支持两种格式：数字 cell_id 或 cell_code 字符串（如 LGES-2026-0003）
router.get('/cell/:identifier', verifyToken, async (req, res) => {
  try {
    const { identifier } = req.params;

    // 判断是数字 ID 还是 cell_code 字符串
    const isNumericId = /^\d+$/.test(identifier);

    let cellId;

    if (isNumericId) {
      cellId = identifier;
    } else {
      // 用 cell_code 查出对应的 cell_id
      const [cells] = await db.query(
        'SELECT id FROM cells WHERE cell_code = ?',
        [identifier]
      );
      if (cells.length === 0) {
        return res.status(404).json({ success: false, message: `Cell "${identifier}" not found` });
      }
      cellId = cells[0].id;
    }

    const [rows] = await db.query(
      `SELECT * FROM v_cell_complete_history
       WHERE cell_id = ?
       ORDER BY created_at ASC`,
      [cellId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'No audit logs found for this cell' });
    }

    res.json({ success: true, data: rows });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


// ── GET /api/audit/operator/:operator_id ────────────────
// Get all actions performed by a specific operator — admin only
router.get('/operator/:operator_id', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT * FROM v_cell_complete_history
       WHERE operator_id = ?
       ORDER BY created_at DESC`,
      [req.params.operator_id]
    );

    res.json({ success: true, data: rows });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


// ── GET /api/audit/summary ──────────────────────────────
// Get audit statistics — admin only
/*
  "by_event_type": [
    { "event_type": "Create", "count": 50 },
    { "event_type": "Status_Change", "count": 120 }
  ],
  "by_operator": [
    { "username": "kerstin", "count": 45 }
  ],
  "last_7_days": [
    { "date": "2026-06-08", "count": 23 }
  ]
*/
router.get('/summary', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    // Count by event type
    const [byEventType] = await db.query(
      `SELECT event_type, COUNT(*) as count
       FROM cell_audit_logs
       GROUP BY event_type`
    );

    // Count by operator
    const [byOperator] = await db.query(
      `SELECT u.username, COUNT(*) as count
       FROM cell_audit_logs cal
       JOIN users u ON cal.operator_id = u.id
       GROUP BY cal.operator_id, u.username
       ORDER BY count DESC`
    );

    // Count by date (last 7 days)
    const [byDate] = await db.query(
      `SELECT DATE(created_at) as date, COUNT(*) as count
       FROM cell_audit_logs
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
       GROUP BY DATE(created_at)
       ORDER BY date ASC`
    );

    res.json({
      success: true,
      data: {
        by_event_type: byEventType,
        by_operator:   byOperator,
        last_7_days:   byDate
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


module.exports = router;