const { Pool } = require('pg');
require('dotenv').config();

const configuredDatabaseUrl = process.env.DATABASE_URL?.trim();
if (process.env.NODE_ENV === 'production' && !configuredDatabaseUrl) {
  throw new Error('DATABASE_URL is required in production. Add the PostgreSQL connection string to the Render environment variables.');
}
const DATABASE_URL = configuredDatabaseUrl || 'postgresql://postgres:password@localhost:5432/ludo';
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
  max: 10,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => console.error('PostgreSQL pool error:', err.message));

function convertParams(sql, params = []) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

async function query(text, params = []) {
  return pool.query(convertParams(text, params), params);
}

async function runMigrations() {
  await query(`
    CREATE TABLE IF NOT EXISTS players (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL UNIQUE,
      balance INTEGER NOT NULL DEFAULT 500,
      wins INTEGER NOT NULL DEFAULT 0,
      losses INTEGER NOT NULL DEFAULT 0,
      "totalWon" INTEGER NOT NULL DEFAULT 0,
      "totalLost" INTEGER NOT NULL DEFAULT 0
    )
  `);
  await query('ALTER TABLE players ADD COLUMN IF NOT EXISTS selected_bet_amount INTEGER');
  await query('ALTER TABLE players ADD COLUMN IF NOT EXISTS draws INTEGER NOT NULL DEFAULT 0');
  await query("ALTER TABLE players ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'online'");
  await query('ALTER TABLE players ADD COLUMN IF NOT EXISTS is_demo INTEGER NOT NULL DEFAULT 0');
  await query('ALTER TABLE players ADD COLUMN IF NOT EXISTS is_ai INTEGER NOT NULL DEFAULT 0');

  await query(`
    CREATE TABLE IF NOT EXISTS games (
      id SERIAL PRIMARY KEY,
      "winnerColor" TEXT,
      bet INTEGER NOT NULL DEFAULT 0,
      "startTime" TEXT,
      "endTime" TEXT,
      "logJSON" TEXT
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS ai_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      ai_enabled INTEGER NOT NULL DEFAULT 1
    )
  `);
  await query('INSERT INTO ai_config (id, ai_enabled) VALUES (1, 1) ON CONFLICT (id) DO NOTHING');
}

const databaseReady = runMigrations()
  .then(() => console.log('PostgreSQL migrations complete'))
  .catch((err) => {
    console.error('PostgreSQL migration failed:', err);
    throw err;
  });

async function getAiConfig() {
  await databaseReady;
  const { rows } = await query('SELECT id, ai_enabled FROM ai_config WHERE id = 1');
  return rows[0] || null;
}

async function updateAiConfig(enabled) {
  await databaseReady;
  await query('UPDATE ai_config SET ai_enabled = $1 WHERE id = 1', [enabled ? 1 : 0]);
  return getAiConfig();
}

async function adjustBalance(color, delta) {
  await databaseReady;
  const { rowCount } = await query(`
    UPDATE players
    SET balance = balance + $1,
        wins = wins + CASE WHEN $2 > 0 THEN 1 ELSE 0 END,
        losses = losses + CASE WHEN $3 < 0 THEN 1 ELSE 0 END,
        "totalWon" = "totalWon" + CASE WHEN $4 > 0 THEN $5 ELSE 0 END,
        "totalLost" = "totalLost" + CASE WHEN $6 < 0 THEN -$7 ELSE 0 END
    WHERE color = $8
  `, [delta, delta, delta, delta, delta, delta, delta, color]);
  return rowCount;
}

module.exports = { pool, query, databaseReady, getAiConfig, updateAiConfig, adjustBalance };
