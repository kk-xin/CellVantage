const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');
const { detectAnomalies } = require('../agent/anomalyDetection');

router.post('/import', verifyToken, requireRole('lab_operator'), async (req, res) => {
  try {
    const { cell_code, rows } = req.body;
    if (!cell_code) return res.status(400).json({ success: false, message: 'cell_code is required' });
    if (!rows || rows.length === 0) return res.status(400).json({ success: false, message: 'No metrics data provided' });

    const [cells] = await db.query('SELECT id FROM cells WHERE cell_code = ?', [cell_code]);
    if (cells.length === 0) return res.status(404).json({ success: false, error_code: 'CELL_NOT_FOUND', message: `Cell "${cell_code}" does not exist` });

    const cellId = cells[0].id;
    const results = { success: [], errors: [] };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const hasAnyMetric = ['voltage', 'internal_resistance', 'capacity', 'temperature', 'cycle_count']
        .some(f => row[f] !== undefined && row[f] !== '');
      if (!hasAnyMetric) { results.errors.push({ row: i + 1, reason: 'No metric values provided' }); continue; }

      try {
        const [result] = await db.query(
          `INSERT INTO cell_metrics_data
             (cell_id, voltage, internal_resistance, capacity, temperature, cycle_count, test_type, test_duration_hours, notes, test_timestamp)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [cellId, row.voltage||null, row.internal_resistance||null, row.capacity||null,
           row.temperature||null, row.cycle_count||null, row.test_type||null,
           row.test_duration_hours||null, row.notes||null, row.test_timestamp||null]
        );
        results.success.push({ row: i + 1, id: result.insertId });
      } catch (e) {
        results.errors.push({ row: i + 1, reason: e.message });
      }
    }

    res.json({ success: true, message: `Imported ${results.success.length} of ${rows.length} metric rows for ${cell_code}`, data: results });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:cellCode', verifyToken, async (req, res) => {
  try {
    const [cells] = await db.query('SELECT id FROM cells WHERE cell_code = ?', [req.params.cellCode]);
    if (cells.length === 0) return res.status(404).json({ success: false, message: 'Cell not found' });

    const [rows] = await db.query(
      `SELECT * FROM cell_metrics_data WHERE cell_id = ?
       ORDER BY COALESCE(cycle_count, 9999) ASC, test_timestamp ASC`,
      [cells[0].id]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:cellCode/anomalies', verifyToken, async (req, res) => {
  try {
    const [cells] = await db.query('SELECT id FROM cells WHERE cell_code = ?', [req.params.cellCode]);
    if (cells.length === 0) return res.status(404).json({ success: false, message: 'Cell not found' });

    const [rows] = await db.query(
      `SELECT * FROM cell_metrics_data WHERE cell_id = ?
       ORDER BY COALESCE(cycle_count, 9999) ASC, test_timestamp ASC`,
      [cells[0].id]
    );
    const anomalies = detectAnomalies(rows);
    res.json({ success: true, data: { cell_code: req.params.cellCode, total_records: rows.length, anomaly_count: anomalies.length, anomalies } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;