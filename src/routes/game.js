// src/routes/game.js
const express = require('express');
const router = express.Router();
const { query, databaseReady } = require('../db/database');

// GET current in‑memory game state – placeholder (frontend may use later)
router.get('/state', (req, res) => {
  // As we don't keep a global server‑side state, just return a stub.
  res.json({ message: 'No server‑side state – UI maintains its own.' });
});

// POST endpoint to store a finished game
router.post('/end', async (req, res) => {
  const { winnerColor, bet, log } = req.body; // log is expected as an array
  const now = new Date().toISOString();
  try {
    await databaseReady;
    const result = await query(`
      INSERT INTO games ("winnerColor", bet, "startTime", "endTime", "logJSON")
      VALUES ($1, $2, $3, $4, $5) RETURNING id
    `, [winnerColor || null, bet || 0, now, now, JSON.stringify(log || [])]);
    res.json({ gameId: result.rows[0].id, message: 'Game recorded' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
