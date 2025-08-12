const Database = require('better-sqlite3');

const db = new Database('players.db');

db.pragma('journal_mode = WAL');
db.prepare(`
  CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    village TEXT NOT NULL,
    team TEXT,
    ip TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )
`).run();

module.exports = db;