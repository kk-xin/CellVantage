const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');

// ── Role-based permissions ──────────────────────────────

// Which states each role can transition TO (and FROM)
const allowedTransitions = {
  quality_engineer: {
    'Received':  ['Incoming QC', 'Failed']
  },
  warehouse_staff: {
    'Incoming QC': ['Storage']
  },
  lab_operator: {
    'Storage':    ['Under Test'],
    'Under Test': ['Passed', 'Failed']
  },
  disposal_manager: {
    'Failed': ['Disposed']
  }
};

// Which states each role can SEE
const visibleStates = {
  quality_engineer:  ['Received'],
  warehouse_staff:   ['Incoming QC'],
  lab_operator:      ['Storage', 'Under Test'],
  disposal_manager:  ['Failed', 'Disposed'],
  admin:             null  // null = see everything
};

// ── GET /api/cells ──────────────────────────────────────
// Get cells — each role only sees their relevant states
router.get('/', verifyToken, async (req, res) => {
  try {
    const role = req.user.role;
    const stateFilter = visibleStates[role];

    // If role has no defined visibility rule, they see nothing
    if (stateFilter === undefined) {
      return res.json({ success: true, data: [] });
    }

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

// ── PATCH /api/cells/:id ────────────────────────────────
// Update cell's basic info (model, capacity, voltage, manufacture_date)
// quality_engineer only — used to fill in missing data after import
router.patch('/:id', verifyToken, requireRole('quality_engineer'), async (req, res) => {
  try {
    const { model, capacity_rated, voltage_nominal, manufacture_date } = req.body;

    // Get the cell's current state first, so changed_to has a valid value
    const [cells] = await db.query('SELECT current_state FROM cells WHERE id = ?', [req.params.id]);
    if (cells.length === 0) {
      return res.status(404).json({ success: false, message: 'Cell not found' });
    }
    const currentState = cells[0].current_state;

    const [result] = await db.query(
      `UPDATE cells 
       SET model = ?, capacity_rated = ?, voltage_nominal = ?, manufacture_date = ?
       WHERE id = ?`,
      [model, capacity_rated, voltage_nominal, manufacture_date, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Cell not found' });
    }

    await db.query(
      `INSERT INTO cell_audit_logs (cell_id, operator_id, event_type, changed_from, changed_to, notes)
       VALUES (?, ?, 'Correction', ?, ?, 'Cell information updated/corrected')`,
      [req.params.id, req.user.id, currentState, currentState]
    );

    res.json({ success: true, message: 'Cell info updated' });

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
// Create batch + bulk import cells via CSV — quality_engineer only
router.post('/import', verifyToken, requireRole('quality_engineer'), async (req, res) => {
  try {
    const { batch_number, supplier, delivery_date, cells } = req.body;

    if (!batch_number || !supplier || !delivery_date) {
      return res.status(400).json({
        success: false,
        message: 'batch_number, supplier and delivery_date are required'
      });
    }

    if (!cells || cells.length === 0) {
      return res.status(400).json({ success: false, message: 'No cells data provided' });
    }

    const [existingBatch] = await db.query(
      'SELECT id FROM batches WHERE batch_number = ?',
      [batch_number]
    );

    let batchId;

    if (existingBatch.length > 0) {
      batchId = existingBatch[0].id;
    } else {
      // Create batch with total_quantity = 0 for now, we'll update it after processing
      const [batchResult] = await db.query(
        `INSERT INTO batches (batch_number, supplier, total_quantity, delivery_date)
         VALUES (?, ?, ?, ?)`,
        [batch_number, supplier, 0, delivery_date]
      );
      batchId = batchResult.insertId;
    }

    const results = {
      success: [],
      errors: []
    };

    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      const rowNum = i + 1;

      if (!cell.cell_code) {
        results.errors.push({
          row: rowNum,
          cell_code: 'N/A',
          reason: 'Missing required field: cell_code'
        });
        continue;
      }

      try {
        const [result] = await db.query(
          `INSERT INTO cells (cell_code, batch_id, model, capacity_rated, voltage_nominal, manufacture_date)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [cell.cell_code, batchId, cell.model, cell.capacity_rated, cell.voltage_nominal, cell.manufacture_date]
        );

        await db.query(
          `INSERT INTO cell_audit_logs (cell_id, operator_id, event_type, changed_from, changed_to, notes)
           VALUES (?, ?, 'Create', NULL, 'Received', 'Cell imported via CSV')`,
          [result.insertId, req.user.id]
        );

        results.success.push({ row: rowNum, cell_code: cell.cell_code, id: result.insertId });

      } catch (rowError) {
        results.errors.push({
          row: rowNum,
          cell_code: cell.cell_code,
          reason: rowError.message.includes('Duplicate') ? 'cell_code already exists' : rowError.message
        });
      }
    }

    // Now that we know exactly how many succeeded, update the batch's total_quantity
    // If reusing an existing batch, add to its current total instead of overwriting
    await db.query(
      `UPDATE batches 
       SET total_quantity = total_quantity + ? 
       WHERE id = ?`,
      [results.success.length, batchId]
    );

    res.status(207).json({
      success: true,
      message: `Import complete: ${results.success.length} succeeded, ${results.errors.length} failed`,
      batch_id: batchId,
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
    const operator_id = req.user.id;
    const role = req.user.role;

    if (!new_state || !notes) {
      return res.status(400).json({ success: false, message: 'new_state and notes are required' });
    }

    // Get current state first — we need it to check the FROM → TO rule
    const [cells] = await db.query('SELECT current_state FROM cells WHERE id = ?', [req.params.id]);
    if (cells.length === 0) {
      return res.status(404).json({ success: false, message: 'Cell not found' });
    }
    const previous_state = cells[0].current_state;

    // Check if this role is allowed to move FROM the current state TO the new state
    const roleRules = allowedTransitions[role];
    const allowedTargets = roleRules ? roleRules[previous_state] : undefined;

    if (!allowedTargets || !allowedTargets.includes(new_state)) {
      return res.status(403).json({
        success: false,
        message: `${role} cannot change state from ${previous_state} to ${new_state}`
      });
    }

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