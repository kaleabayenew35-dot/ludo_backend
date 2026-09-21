'use strict';
/**
 * POST /api/settlement/deduct   — deduct bets when game starts
 * POST /api/settlement/payout   — credit winner + record losses when game ends
 *
 * Called by the frontend game.js as fire-and-forget from endGame/persistResult.
 * No auth required (internal only, called from the game page with player identity
 * from sessionStorage).
 */
const express    = require('express');
const router     = express.Router();
const { deductBets, settleGame } = require('../services/settlement');

// POST /api/settlement/deduct
// Body: { players: [{username, phone}], betAmount, gameId }
router.post('/deduct', async (req, res) => {
  const { players, betAmount, gameId } = req.body;
  if (!Array.isArray(players) || !betAmount || !gameId) {
    return res.status(400).json({ ok: false, error: 'players[], betAmount, gameId required' });
  }
  try {
    await deductBets(players, Number(betAmount), String(gameId));
    res.json({ ok: true });
  } catch (err) {
    console.error('[settlement/deduct]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/settlement/payout
// Body: { players: [{username, phone}], winner: {username, phone}, betAmount, gameId }
router.post('/payout', async (req, res) => {
  const { players, winner, betAmount, gameId } = req.body;
  if (!Array.isArray(players) || !winner || !betAmount || !gameId) {
    return res.status(400).json({ ok: false, error: 'players[], winner, betAmount, gameId required' });
  }
  try {
    const result = await settleGame({ players, winner, betAmount: Number(betAmount), gameId: String(gameId) });
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[settlement/payout]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
