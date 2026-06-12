const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');        // Password hashing
const jwt = require('jsonwebtoken');       // Token generation
const db = require('../db');               // Database connection pool

// ── POST /api/auth/register ─────────────────────────────
// Create a new user (admin only in production)
router.post('/register', async (req, res) => {
  try {
    const { username, password, email, role } = req.body;

    // Validate required fields
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required' });
    }

    // Check if username already exists
    const [existing] = await db.query('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Username already exists' });
    }

    // Hash the password — never store plain text passwords
    const password_hash = await bcrypt.hash(password, 10);

    // Insert new user into database
    const [result] = await db.query(
      `INSERT INTO users (username, password_hash, email, role)
       VALUES (?, ?, ?, ?)`,
      [username, password_hash, email, role || 'system']
    );

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      id: result.insertId
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


// ── POST /api/auth/login ────────────────────────────────
// Login and receive JWT token
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate required fields
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required' });
    }

    // Find user by username
    const [users] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
    if (users.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }

    const user = users[0];

    // Check if account is active
    if (!user.is_active) {
      return res.status(403).json({ success: false, message: 'Account is deactivated' });
    }

    // Compare password with stored hash
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }

    // Generate JWT token — contains user identity and role
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        email: user.email
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


// ── GET /api/auth/me ────────────────────────────────────
// Get current logged-in user info (requires token)
router.get('/me', async (req, res) => {
  try {
    // Extract token from request header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // "Bearer <token>"

    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    // Verify and decode token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch fresh user data from database
    const [users] = await db.query(
      'SELECT id, username, email, role, created_at FROM users WHERE id = ?',
      [decoded.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, data: users[0] });

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── PATCH /api/auth/users/:id/role ──────────────────────
// Admin only: assign role to a user
router.patch('/users/:id/role', async (req, res) => {
  try {
    // Get token from header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    // Verify token and check if requester is admin
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only admin can assign roles' });
    }

    const { role } = req.body;

    // Validate role value
    const validRoles = ['admin', 'lab_operator', 'warehouse_staff', 'quality_engineer', 'system'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    // Update user role
    const [result] = await db.query(
      'UPDATE users SET role = ? WHERE id = ?',
      [role, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, message: `Role updated to ${role}` });

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});


module.exports = router;