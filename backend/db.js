const mysql = require('mysql2');      // Import MySQL2 driver (same as Python's mysql.connector)
require('dotenv').config();           // Load .env file (same as Python's load_dotenv())

// Create a connection pool instead of a single connection
// Pool keeps 10 connections ready — no need to reconnect on every request
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,           // Queue requests if all 10 connections are busy
  connectionLimit: 10,                // Maximum 10 simultaneous database connections
});

// Upgrade pool to support async/await syntax
// Without this, we'd need old-school callbacks instead of clean await calls
const promisePool = pool.promise();

// Export so every route file can import and use the same pool
module.exports = promisePool;