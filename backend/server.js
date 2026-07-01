const express = require('express');        // Import Express framework
const cors = require('cors');              // Allow React frontend to call this API
require('dotenv').config();               // Load .env variables

const authRouter = require('./routes/auth');         // Authentication routes
const cellsRouter = require('./routes/cells');       // Cells routes
const batchesRouter = require('./routes/batches');   // Batches routes
const auditRouter = require('./routes/audit');       // Audit logs routes
const metricsRouter = require('./routes/metrics');   // Battery test telemetry routes
const { router: agentRouter } = require('./routes/agent'); // Agent & RAG routes

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──────────────────────────────────────────
app.use(cors());                    // Allow cross-origin requests from React
app.use(express.json());            // Parse incoming JSON request bodies

// ── Routes ─────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/cells', cellsRouter);
app.use('/api/batches', batchesRouter);
app.use('/api/audit', auditRouter);
app.use('/api/metrics', metricsRouter);
app.use('/api/agent', agentRouter);

// ── Health Check ────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'CellVantage API is running' });
});

// ── Start Server ────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});