'use strict';
/**
 * settlement.js — Ludo bet settlement service
 *
 * Commission model (mirrors dama/xo):
 *   pot = bet × playerCount
 *   fee = round(pot × 0.10)          ← 10% house cut
 *   winnerPayout = pot - fee          ← winner receives
 *   losers receive nothing extra
 *
 * Examples:
 *   2 players × 10 ETB → pot=20, fee=2,  winner gets 18
 *   3 players × 10 ETB → pot=30, fee=3,  winner gets 27
 *   4 players × 10 ETB → pot=40, fee=4,  winner gets 36
 *
 * System backend endpoint: POST {SYSTEM_BACKEND_URL}/dama
 * Auth: LUDO_GAME_TOKEN sent as { token } in the request body
 */

const SYSTEM_BACKEND_URL = (process.env.SYSTEM_BACKEND_URL || '').replace(/\/$/, '');
const LUDO_GAME_TOKEN    = process.env.LUDO_GAME_TOKEN    || '';
const WIN_FEE_PCT        = 0.10;
const CALL_TIMEOUT_MS    = 8000;

// ── HTTP helper ───────────────────────────────────────────────────────────────
async function callSystemDama(action, { username, phone, amount, gameId, type } = {}) {
  if (!SYSTEM_BACKEND_URL || !LUDO_GAME_TOKEN) {
    console.warn('[settlement] skipped — SYSTEM_BACKEND_URL or LUDO_GAME_TOKEN not set');
    return null;
  }
  const payload = {
    action,
    token    : LUDO_GAME_TOKEN,
    username : username || '',
    phone    : phone    || '',
    amount   : Number(amount || 0),
    gameId   : String(gameId || ''),
    ...(type ? { type } : {}),
  };
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), CALL_TIMEOUT_MS);
    const res = await fetch(`${SYSTEM_BACKEND_URL}/dama`, {
      method  : 'POST',
      headers : { 'Content-Type': 'application/json' },
      body    : JSON.stringify(payload),
      signal  : controller.signal,
    });
    clearTimeout(tid);
    const data = await res.json().catch(() => null);
    if (!res.ok || data?.ok === false) {
      console.error(`[settlement] ${action} failed for ${username}:`, data?.error || res.status);
      return null;
    }
    console.log(`[settlement] ${action} ok for ${username} amount=${amount}`);
    return data;
  } catch (err) {
    console.error(`[settlement] ${action} error for ${username}:`, err.message);
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Deduct bet from every player when the game starts.
 * players = [{ username, phone }]
 */
async function deductBets(players, betAmount, gameId) {
  if (!betAmount || betAmount <= 0) return;
  await Promise.allSettled(
    players.map(p =>
      callSystemDama('deduct', {
        username : p.username || p.name || '',
        phone    : p.phone    || '',
        amount   : betAmount,
        gameId,
      })
    )
  );
}

/**
 * Settle the game result:
 *   - Credit winner with (pot - fee)
 *   - Record loss for each loser
 *   - Send owner_fee to admin balance
 *
 * players   = [{ username, phone }]        — all players in the game
 * winner    = { username, phone }          — the winning player
 * betAmount = number                       — per-player bet
 * gameId    = string
 */
async function settleGame({ players, winner, betAmount, gameId }) {
  if (!betAmount || betAmount <= 0) return { winnerPayout: 0, fee: 0 };

  const pot          = betAmount * players.length;
  const fee          = Math.round(pot * WIN_FEE_PCT);
  const winnerPayout = pot - fee;

  const losers = players.filter(
    p => (p.username || p.name || '') !== (winner.username || winner.name || '')
  );

  await Promise.allSettled([
    // Credit winner
    callSystemDama('credit', {
      username : winner.username || winner.name || '',
      phone    : winner.phone    || '',
      amount   : winnerPayout,
      gameId,
    }),
    // Record loss for each loser (amount=0, just a transaction record)
    ...losers.map(p =>
      callSystemDama('loss', {
        username : p.username || p.name || '',
        phone    : p.phone    || '',
        amount   : 0,
        gameId,
      })
    ),
    // Admin commission
    callSystemDama('owner_fee', {
      username : '',
      phone    : '',
      amount   : fee,
      gameId,
      type     : 'ludo_win_fee',
    }),
  ]);

  console.log(`[settlement] game ${gameId} settled — pot=${pot} fee=${fee} winner=${winner.username} payout=${winnerPayout}`);
  return { winnerPayout, fee, pot };
}

module.exports = { deductBets, settleGame };
