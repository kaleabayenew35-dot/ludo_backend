// src/routes/player.js
const express = require('express');
const router = express.Router();
const db = require('../db/database');

// GET a single player's record by colour
router.get('/:color', (req, res) => {
  const color = req.params.color;
  db.db.get('SELECT * FROM players WHERE color = ?', [color], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Player not found' });
    res.json(row);
  });
});

// POST to adjust a player's balance after a game
// Body: { delta: number } – positive = win, negative = loss
router.post('/:color/bet', async (req, res) => {
  const color = req.params.color;
  const delta = Number(req.body.delta);
  if (isNaN(delta)) return res.status(400).json({ error: 'Invalid delta' });
  try {
    const changes = await db.adjustBalance(color, delta);
    if (changes === 0) return res.status(404).json({ error: 'Player not found' });
    // Return updated player
    db.db.get('SELECT * FROM players WHERE color = ?', [color], (e, row) => {
      if (e) return res.status(500).json({ error: e.message });
      res.json(row);
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
