// src/routes/game.js
const express = require('express');
const router = express.Router();
const db = require('../db/database').db;

// GET current in‑memory game state – placeholder (frontend may use later)
router.get('/state', (req, res) => {
  // As we don't keep a global server‑side state, just return a stub.
  res.json({ message: 'No server‑side state – UI maintains its own.' });
});

// POST endpoint to store a finished game
router.post('/end', async (req, res) => {
  const { winnerColor, bet, log } = req.body; // log is expected as an array
  const now = new Date().toISOString();
  const sql = `INSERT INTO games (winnerColor, bet, startTime, endTime, logJSON)
               VALUES (?,?,?,?,?)`;
  db.run(sql, [winnerColor, bet || 0, now, now, JSON.stringify(log || [])], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ gameId: this.lastID, message: 'Game recorded' });
  });
});

module.exports = router;
