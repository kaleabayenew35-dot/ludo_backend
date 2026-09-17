// src/db/database.js
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();

const dbPath = process.env.DB_PATH || path.resolve(__dirname, '../../db.sqlite');

// Ensure the directory exists (required on Render where it may not be present)
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

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

  db.run(`CREATE TABLE IF NOT EXISTS ai_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    ai_enabled INTEGER NOT NULL DEFAULT 1
  )`);
  db.run('INSERT OR IGNORE INTO ai_config (id, ai_enabled) VALUES (1, 1)');
}

function getAiConfig() {
  return new Promise((resolve, reject) => {
    db.get('SELECT id, ai_enabled FROM ai_config WHERE id = 1', [], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function updateAiConfig(enabled) {
  return new Promise((resolve, reject) => {
    db.run('UPDATE ai_config SET ai_enabled = ? WHERE id = 1', [enabled ? 1 : 0], function (err) {
      if (err) return reject(err);
      getAiConfig().then(resolve, reject);
    });
  });
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

module.exports = { db, adjustBalance, getAiConfig, updateAiConfig };
