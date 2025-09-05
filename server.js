const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Middleware for admin check
const adminId = "z0315123";

app.use(async (req, res, next) => {
  req.userId = req.headers['x-user-id'];
  if (!req.userId) {
    return res.status(401).json({ error: "Missing user ID" });
  }

  // Track last login
  await pool.query(
    `INSERT INTO users (user_id, is_admin, last_login)
     VALUES ($1, $2, NOW())
     ON CONFLICT (user_id)
     DO UPDATE SET last_login = NOW()`,
    [req.userId, req.userId === adminId]
  );

  next();
});

// Admin routes
app.get('/api/admin/users', async (req, res) => {
  if (req.userId !== adminId) return res.status(403).json({ error: "Forbidden" });
  const result = await pool.query("SELECT * FROM users");
  res.json(result.rows);
});

app.post('/api/admin/users', async (req, res) => {
  if (req.userId !== adminId) return res.status(403).json({ error: "Forbidden" });
  const { userId } = req.body;
  await pool.query(
    "INSERT INTO users (user_id, is_admin) VALUES ($1, false) ON CONFLICT (user_id) DO NOTHING",
    [userId]
  );
  res.json({ success: true });
});

app.delete('/api/admin/users/:id', async (req, res) => {
  if (req.userId !== adminId) return res.status(403).json({ error: "Forbidden" });
  const { id } = req.params;
  await pool.query("DELETE FROM users WHERE user_id=$1 AND is_admin=false", [id]);
  res.json({ success: true });
});

// Protected route
app.get('/api/files', async (req, res) => {
  const user = await pool.query("SELECT * FROM users WHERE user_id=$1", [req.userId]);
  if (user.rows.length === 0) {
    return res.status(403).json({ error: "Not allowed" });
  }
  res.json({ files: ["file1.txt", "file2.pdf"] });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
