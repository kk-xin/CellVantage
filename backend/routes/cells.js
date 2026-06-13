const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');

// ── Role-based permissions ──────────────────────────────

// Which states each role can transition TO
const allowedTransitions = {
  quality_engineer: ['Incoming QC', 'Failed'],
  warehouse_staff:  ['Storage'],
  lab_operator:     ['Under Test', 'Passed', 'Failed'],
  admin:            ['Disposed']
};

// Which states each role can SEE
const visibleStates = {
  quality_engineer: ['Received'],
  warehouse_staff:  ['Incoming QC'],
  lab_operator:     ['Storage', 'Under Test'],
  admin:            null  // null = see everything
};


// ── GET /api/cells ──────────────────────────────────────
// Get cells — each role only sees their relevant states
router.get('/', verifyToken, async (req, res) => {
  try {
    const role = req.user.role;
    const stateFilter = visibleStates[role];

    let query = 'SELECT * FROM v_cells_with_batch';
    let params = [];

    if (stateFilter) {
      const placeholders = stateFilter.map(() => '?').join(', ');
      query += ` WHERE current_state IN (${placeholders})`;
      params = stateFilter;
    }

    query += ' ORDER BY created_at DESC';

    const [rows] = await db.query(query, params);
    res.json({ success: true, data: rows });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


// ── GET /api/cells/dashboard/summary ───────────────────
// Get count of cells grouped by state
// Must be defined before /:id to avoid routing conflict
/*[
  { "current_state": "Received",  "count": 10 },
  { "current_state": "Passed",    "count": 5  },
  { "current_state": "Failed",    "count": 2  }
]*/

router.get('/dashboard/summary', verifyToken, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT current_state, COUNT(*) as count 
       FROM cells 
       GROUP BY current_state`
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


// ── GET /api/cells/:id ─────────────────────────────────
// Get single cell detail
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM v_cells_with_batch WHERE id = ?',
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Cell not found' });
    }

    res.json({ success: true, data: rows[0] });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


// ── POST /api/cells ─────────────────────────────────────
// Create a single cell — quality_engineer only
router.post('/', verifyToken, requireRole('quality_engineer'), async (req, res) => {
  try {
    const { cell_code, batch_id, model, capacity_rated, voltage_nominal, manufacture_date } = req.body;

    if (!cell_code || !batch_id) {
      return res.status(400).json({ success: false, message: 'cell_code and batch_id are required' });
    }

    const [result] = await db.query(
      `INSERT INTO cells (cell_code, batch_id, model, capacity_rated, voltage_nominal, manufacture_date)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [cell_code, batch_id, model, capacity_rated, voltage_nominal, manufacture_date]
    );

    await db.query(
      `INSERT INTO cell_audit_logs (cell_id, operator_id, event_type, changed_from, changed_to, notes)
       VALUES (?, ?, 'Create', NULL, 'Received', 'Cell registered into system')`,
      [result.insertId, req.user.id]
    );

    res.status(201).json({ success: true, message: 'Cell created', id: result.insertId });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


// ── POST /api/cells/import ──────────────────────────────
// Bulk import cells via CSV — quality_engineer and admin only
router.post('/import', verifyToken, requireRole('quality_engineer'), async (req, res) => {
  try {
    const { cells } = req.body;  // Array of cell objects parsed from CSV

    if (!cells || cells.length === 0) {
      return res.status(400).json({ success: false, message: 'No cells data provided' });
    }

    const results = {
      success: [],  // Successfully imported rows
      errors: []    // Failed rows with reasons
    };

    // Process each row individually — row-level error reporting
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      const rowNum = i + 1;

      // Validate required fields per row
      if (!cell.cell_code || !cell.batch_id) {
        results.errors.push({
          row: rowNum,
          cell_code: cell.cell_code || 'N/A',
          reason: 'Missing required fields: cell_code and batch_id'
        });
        continue;  // Skip to next row, don't stop entire import
      }

      try {
        const [result] = await db.query(
          `INSERT INTO cells (cell_code, batch_id, model, capacity_rated, voltage_nominal, manufacture_date)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [cell.cell_code, cell.batch_id, cell.model, cell.capacity_rated, cell.voltage_nominal, cell.manufacture_date]
        );

        // Write audit log for each imported cell
        await db.query(
          `INSERT INTO cell_audit_logs (cell_id, operator_id, event_type, changed_from, changed_to, notes)
           VALUES (?, ?, 'Create', NULL, 'Received', 'Cell imported via CSV')`,
          [result.insertId, req.user.id]
        );

        results.success.push({ row: rowNum, cell_code: cell.cell_code, id: result.insertId });

      } catch (rowError) {
        // Handle duplicate cell_code or other DB errors per row
        results.errors.push({
          row: rowNum,
          cell_code: cell.cell_code,
          reason: rowError.message.includes('Duplicate') ? 'cell_code already exists' : rowError.message
        });
      }
    }

    // Return row-level results — never a generic "import failed"
    res.status(207).json({
      success: true,
      message: `Import complete: ${results.success.length} succeeded, ${results.errors.length} failed`,
      data: results
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


// ── PATCH /api/cells/:id/state ──────────────────────────
// Update cell state — role-based permission
router.patch('/:id/state', verifyToken, async (req, res) => {
  try {
    const { new_state, notes } = req.body;
    const operator_id = req.user.id;    // Always from token, never from frontend
    const role = req.user.role;

    if (!new_state || !notes) {
      return res.status(400).json({ success: false, message: 'new_state and notes are required' });
    }

    // Check if this role can set this state
    const allowed = allowedTransitions[role];
    if (!allowed || !allowed.includes(new_state)) {
      return res.status(403).json({
        success: false,
        message: `${role} is not allowed to set state to ${new_state}`
      });
    }

    // Get current state
    const [cells] = await db.query('SELECT current_state FROM cells WHERE id = ?', [req.params.id]);
    if (cells.length === 0) {
      return res.status(404).json({ success: false, message: 'Cell not found' });
    }

    const previous_state = cells[0].current_state;

    // Update cell state
    await db.query('UPDATE cells SET current_state = ? WHERE id = ?', [new_state, req.params.id]);

    // Auto write audit log
    await db.query(
      `INSERT INTO cell_audit_logs (cell_id, operator_id, event_type, changed_from, changed_to, notes)
       VALUES (?, ?, 'Status_Change', ?, ?, ?)`,
      [req.params.id, operator_id, previous_state, new_state, notes]
    );

    res.json({ success: true, message: `State updated: ${previous_state} → ${new_state}` });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


// ── GET /api/cells/:id/history ──────────────────────────
// Get complete timeline for a cell — all roles can view
router.get('/:id/history', verifyToken, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM v_cell_complete_history WHERE cell_id = ? ORDER BY created_at ASC',
      [req.params.id]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


module.exports = router;