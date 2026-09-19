// src/routes/player.js
const express = require('express');
const router = express.Router();
const { query, databaseReady, adjustBalance } = require('../db/database');

// Public lobby feed. Demo and AI rows are excluded at the database boundary.
router.get('/', async (req, res) => {
  try {
    await databaseReady;
    const values = [];
    const filters = ["COALESCE(is_demo, 0) = 0", "COALESCE(is_ai, 0) = 0", "COALESCE(status, 'online') = 'online'"];
    const bet = Number(req.query.bet);
    if (Number.isFinite(bet) && bet > 0) {
      values.push(bet);
      filters.push(`selected_bet_amount = $${values.length}`);
    }
    const result = await query(`
      SELECT id, name, color, wins, losses, COALESCE(draws, 0) AS draws,
             selected_bet_amount, status, is_demo, is_ai
      FROM players
      WHERE ${filters.join(' AND ')}
      ORDER BY id
    `, values);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET a single player's record by colour
router.get('/:color', async (req, res) => {
  const color = req.params.color;
  try {
    await databaseReady;
    const result = await query('SELECT * FROM players WHERE color = $1', [color]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Player not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST to adjust a player's balance after a game
// Body: { delta: number } – positive = win, negative = loss
router.post('/:color/bet', async (req, res) => {
  const color = req.params.color;
  const delta = Number(req.body.delta);
  if (isNaN(delta)) return res.status(400).json({ error: 'Invalid delta' });
  try {
    const changes = await adjustBalance(color, delta);
    if (changes === 0) return res.status(404).json({ error: 'Player not found' });
    // Return updated player
    const result = await query('SELECT * FROM players WHERE color = $1', [color]);
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
