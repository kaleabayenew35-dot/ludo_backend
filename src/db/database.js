// src/db/database.js
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();

const dbPath = process.env.DB_PATH || path.resolve(__dirname, '../../db.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to open SQLite DB:', err);
  } else {
    console.log('Connected to SQLite DB at', dbPath);
    runMigrations();
  }
});

function runMigrations() {
  // Players table
  db.run(`CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    color TEXT NOT NULL UNIQUE,
    balance INTEGER DEFAULT 500,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    totalWon INTEGER DEFAULT 0,
    totalLost INTEGER DEFAULT 0
  )`);

  // Games table (basic columns)
  db.run(`CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    winnerColor TEXT,
    bet INTEGER DEFAULT 0,
    startTime TEXT,
    endTime TEXT,
    logJSON TEXT
  )`);
}

// Helper to adjust a player's balance and stats atomically
function adjustBalance(color, delta) {
  const sql = `UPDATE players SET balance = balance + ?,
               wins = wins + CASE WHEN ? > 0 THEN 1 ELSE 0 END,
               losses = losses + CASE WHEN ? < 0 THEN 1 ELSE 0 END,
               totalWon = totalWon + CASE WHEN ? > 0 THEN ? ELSE 0 END,
               totalLost = totalLost + CASE WHEN ? < 0 THEN -? ELSE 0 END
               WHERE color = ?`;
  const params = [delta, delta, delta, delta, delta, delta, delta, color];
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
}

module.exports = { db, adjustBalance };
