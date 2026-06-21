const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');


// ── GET /api/batches ────────────────────────────────────
// Get all batches — all roles can view
/*
  "batch_number": "CATL-20260608-01A",
  "supplier": "CATL",
  "cell_count": 50
*/
router.get('/', verifyToken, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT b.*, COUNT(c.id) as cell_count
       FROM batches b
       LEFT JOIN cells c ON b.id = c.batch_id
       GROUP BY b.id
       ORDER BY b.delivery_date DESC`
    );
    res.json({ success: true, data: rows });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


// ── GET /api/batches/:id ────────────────────────────────
// Get single batch with all its cells
router.get('/:id', verifyToken, async (req, res) => {
  try {
    // Get batch info
    const [batches] = await db.query(
      'SELECT * FROM batches WHERE id = ?',
      [req.params.id]
    );

    if (batches.length === 0) {
      return res.status(404).json({ success: false, message: 'Batch not found' });
    }

    // Get all cells belonging to this batch
    const [cells] = await db.query(
      'SELECT * FROM v_cells_with_batch WHERE batch_id = ?',
      [req.params.id]
    );

    res.json({
      success: true,
      data: {
        batch: batches[0],
        cells: cells
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


// ── POST /api/batches ───────────────────────────────────
// Create a new batch — quality_engineer only
router.post('/', verifyToken, requireRole('quality_engineer'), async (req, res) => {
  try {
    const { batch_number, supplier, total_quantity, delivery_date, notes } = req.body;

    // Validate required fields
    if (!batch_number || !supplier || !total_quantity || !delivery_date) {
      return res.status(400).json({
        success: false,
        message: 'batch_number, supplier, total_quantity and delivery_date are required'
      });
    }

    // Check if batch_number already exists
    const [existing] = await db.query(
      'SELECT id FROM batches WHERE batch_number = ?',
      [batch_number]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Batch number already exists'
      });
    }

    const [result] = await db.query(
      `INSERT INTO batches (batch_number, supplier, total_quantity, delivery_date, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [batch_number, supplier, total_quantity, delivery_date, notes]
    );

    res.status(201).json({
      success: true,
      message: 'Batch created',
      id: result.insertId
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


// ── PATCH /api/batches/:id ──────────────────────────────
// Update batch notes — quality_engineer only
router.patch('/:id', verifyToken, requireRole('quality_engineer'), async (req, res) => {
  try {
    const { notes } = req.body;

    if (!notes) {
      return res.status(400).json({ success: false, message: 'notes is required' });
    }

    const [result] = await db.query(
      'UPDATE batches SET notes = ? WHERE id = ?',
      [notes, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Batch not found' });
    }

    res.json({ success: true, message: 'Batch updated' });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── GET /api/batches/:id/cells-by-state ─────────────────
// disposal_manager only — see all cells in a batch grouped by state
router.get('/:id/cells-by-state', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const [batch] = await db.query('SELECT * FROM batches WHERE id = ?', [req.params.id]);
    if (batch.length === 0) {
      return res.status(404).json({ success: false, message: 'Batch not found' });
    }

    const [cells] = await db.query(
      'SELECT * FROM v_cells_with_batch WHERE batch_id = ? ORDER BY current_state',
      [req.params.id]
    );

    // Group cells by their current_state
    const grouped = {};
    cells.forEach((cell) => {
      if (!grouped[cell.current_state]) {
        grouped[cell.current_state] = [];
      }
      grouped[cell.current_state].push(cell);
    });

    res.json({
      success: true,
      data: {
        batch: batch[0],
        grouped
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;