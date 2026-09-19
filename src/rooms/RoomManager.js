'use strict';

/**
 * RoomManager — authoritative server-side bet-room state.
 *
 * Per bet tier there are exactly ROOMS_PER_TIER rooms.
 * Each room: { id, betAmount, players: [], status, timer, countdown }
 *
 * Status values: 'waiting' | 'countdown' | 'started'
 */

const ROOMS_PER_TIER  = 5;
const COUNTDOWN_SECS  = 30;
const MIN_TO_START    = 2;
const MAX_PLAYERS     = 4;

class RoomManager {
  constructor(io) {
    this.io    = io;
    this.rooms = {}; // roomId → room object
    this._init();
  }

  // ── Initialise fixed rooms for every supported bet tier ──────────────────
  _init() {
    const BET_TIERS = [10, 50, 100, 250, 500];
    BET_TIERS.forEach(bet => {
      for (let i = 1; i <= ROOMS_PER_TIER; i++) {
        const id = `${bet}-${i}`;
        this.rooms[id] = {
          id,
          betAmount : bet,
          players   : [],
          status    : 'waiting',   // 'waiting' | 'countdown' | 'started'
          countdown : 0,
          _timer    : null,
        };
      }
    });
  }

  // ── Public helpers ────────────────────────────────────────────────────────

  /** Return all rooms for a given bet tier (safe copies). */
  getRoomsForBet(betAmount) {
    return Object.values(this.rooms)
      .filter(r => r.betAmount === betAmount)
      .map(r => this._safe(r));
  }

  /** Return a safe copy of one room. */
  getRoom(roomId) {
    const r = this.rooms[roomId];
    return r ? this._safe(r) : null;
  }

  /**
   * Add a player to a room.
   * Returns { ok, error?, room? }
   */
  joinRoom(roomId, player) {
    const room = this.rooms[roomId];
    if (!room) return { ok: false, error: 'Room not found' };
    if (room.status === 'started') return { ok: false, error: 'Game already started' };
    if (room.players.length >= MAX_PLAYERS) return { ok: false, error: 'Room is full' };

    // Prevent duplicate socket joins
    const already = room.players.find(p => p.socketId === player.socketId);
    if (already) return { ok: true, room: this._safe(room) }; // idempotent

    // Also prevent duplicate by name (one session per player)
    const nameClash = room.players.find(p => p.name === player.name);
    if (nameClash) return { ok: false, error: 'Already in room' };

    room.players.push({ ...player });

    if (room.players.length >= MIN_TO_START && room.status === 'waiting') {
      this._startCountdown(room);
    } else if (room.status === 'countdown') {
      // Reset timer on each new joiner
      this._resetCountdown(room);
    }

    this._broadcast(room);
    return { ok: true, room: this._safe(room) };
  }

  /**
   * Remove a player from their room (by socketId).
   * Returns the roomId they were in (or null).
   */
  leaveBySocket(socketId) {
    for (const room of Object.values(this.rooms)) {
      const idx = room.players.findIndex(p => p.socketId === socketId);
      if (idx === -1) continue;

      room.players.splice(idx, 1);

      if (room.players.length < MIN_TO_START && room.status === 'countdown') {
        this._stopCountdown(room);
        room.status    = 'waiting';
        room.countdown = 0;
      }

      this._broadcast(room);
      return room.id;
    }
    return null;
  }

  // ── Countdown machinery ───────────────────────────────────────────────────

  _startCountdown(room) {
    this._stopCountdown(room);
    room.status    = 'countdown';
    room.countdown = COUNTDOWN_SECS;

    room._timer = setInterval(() => {
      room.countdown--;

      if (room.countdown <= 0) {
        this._stopCountdown(room);

        if (room.players.length >= MIN_TO_START) {
          this._fireStart(room);
        } else {
          // Only 1 player — shouldn't happen but guard anyway
          room.status    = 'waiting';
          room.countdown = 0;
          this._broadcast(room);
        }
        return;
      }

      // Still counting — check if full
      if (room.players.length >= MAX_PLAYERS) {
        this._stopCountdown(room);
        this._fireStart(room);
        return;
      }

      this._broadcast(room);
    }, 1000);
  }

  _resetCountdown(room) {
    if (room.status !== 'countdown') return;
    this._stopCountdown(room);
    this._startCountdown(room);
  }

  _stopCountdown(room) {
    if (room._timer) {
      clearInterval(room._timer);
      room._timer = null;
    }
  }

  _fireStart(room) {
    room.status    = 'started';
    room.countdown = 0;
    const players  = room.players.map(p => ({ ...p }));

    // Broadcast start event to everyone watching this room's bet tier
    // and directly to players in the room
    const payload = { roomId: room.id, betAmount: room.betAmount, players };
    this.io.to(`bet-${room.betAmount}`).emit('room:started', payload);

    // Reset room for next game after a short delay
    setTimeout(() => {
      room.players   = [];
      room.status    = 'waiting';
      room.countdown = 0;
      this._broadcast(room);
    }, 5000);
  }

  // ── Emit helpers ──────────────────────────────────────────────────────────

  _broadcast(room) {
    const tierRoom = `bet-${room.betAmount}`;
    this.io.to(tierRoom).emit('room:update', this._safe(room));
  }

  _safe(room) {
    // Strip internal _timer reference from the object sent to clients
    const { _timer, ...safe } = room;
    return { ...safe, players: room.players.map(p => ({ ...p })) };
  }
}

module.exports = { RoomManager, ROOMS_PER_TIER, COUNTDOWN_SECS, MAX_PLAYERS, MIN_TO_START };
