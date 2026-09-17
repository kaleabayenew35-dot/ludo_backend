// src/routes/admin.js
const express = require('express');
const router = express.Router();
const db = require('../db/database');
const auth = require('../middleware/auth');

// Apply auth middleware to all admin routes
router.use(auth);

// GET /api/admin/players – list all players
router.get('/players', (req, res) => {
  db.all('SELECT * FROM players ORDER BY id', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// GET /api/admin/games – recent games, optional ?limit=10
router.get('/games', (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 20;
  db.all('SELECT * FROM games ORDER BY id DESC LIMIT ?', [limit], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// GET /api/admin/stats – aggregate statistics
router.get('/stats', (req, res) => {
  const stats = {};
  db.get('SELECT COUNT(*) AS totalGames FROM games', [], (e1, r1) => {
    if (e1) return res.status(500).json({ error: e1.message });
    stats.totalGames = r1.totalGames;
    db.get('SELECT SUM(bet) AS totalBets FROM games', [], (e2, r2) => {
      stats.totalBets = r2.totalBets || 0;
      db.get('SELECT SUM(CASE WHEN winnerColor IS NOT NULL THEN bet ELSE 0 END) AS wins FROM games', [], (e3, r3) => {
        stats.totalWins = r3.wins || 0;
        db.get('SELECT SUM(CASE WHEN winnerColor IS NULL THEN bet ELSE 0 END) AS losses FROM games', [], (e4, r4) => {
          stats.totalLosses = r4.losses || 0;
          res.json(stats);
        });
      });
    });
  });
});

// POST /api/admin/forfeit/:color – admin forces a player to lose
router.post('/forfeit/:color', (req, res) => {
  const color = req.params.color;
  // Insert a game record with no winner, indicating admin forfeit
  const now = new Date().toISOString();
  const log = JSON.stringify([`Admin forced ${color} to forfeit`]);
  const sql = 'INSERT INTO games (winnerColor, bet, startTime, endTime, logJSON) VALUES (NULL, 0, ?, ?, ?)';
  db.run(sql, [now, now, log], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    // Mark player as eliminated in the in‑memory game state is not possible here – frontend will handle it.
    res.json({ message: `Player ${color} forfeited`, gameId: this.lastID });
  });
});

module.exports = router;
