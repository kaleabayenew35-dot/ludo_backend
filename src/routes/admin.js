// src/routes/admin.js
const express = require('express');
const router = express.Router();
const { query, databaseReady } = require('../db/database');
const auth = require('../middleware/auth');

// Apply auth middleware to all admin routes
router.use(auth);

// GET /api/admin/players – list all players
router.get('/players', async (req, res) => {
  try {
    await databaseReady;
    const result = await query('SELECT * FROM players ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/games – recent games, optional ?limit=10
router.get('/games', async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 20;
  try {
    await databaseReady;
    const result = await query('SELECT * FROM games ORDER BY id DESC LIMIT $1', [limit]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/stats – aggregate statistics
router.get('/stats', async (req, res) => {
  try {
    await databaseReady;
    const result = await query(`
      SELECT COUNT(*)::INTEGER AS "totalGames",
             COALESCE(SUM(bet), 0)::INTEGER AS "totalBets",
             COALESCE(SUM(CASE WHEN "winnerColor" IS NOT NULL THEN bet ELSE 0 END), 0)::INTEGER AS wins,
             COALESCE(SUM(CASE WHEN "winnerColor" IS NULL THEN bet ELSE 0 END), 0)::INTEGER AS losses
      FROM games
    `);
    const row = result.rows[0];
    res.json({ totalGames: row.totalGames, totalBets: row.totalBets, totalWins: row.wins, totalLosses: row.losses });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/forfeit/:color – admin forces a player to lose
router.post('/forfeit/:color', async (req, res) => {
  const color = req.params.color;
  // Insert a game record with no winner, indicating admin forfeit
  const now = new Date().toISOString();
  const log = JSON.stringify([`Admin forced ${color} to forfeit`]);
  try {
    await databaseReady;
    const result = await query(`
      INSERT INTO games ("winnerColor", bet, "startTime", "endTime", "logJSON")
      VALUES (NULL, 0, $1, $2, $3) RETURNING id
    `, [now, now, log]);
    res.json({ message: `Player ${color} forfeited`, gameId: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
