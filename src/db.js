const path = require('path');
const fs   = require('fs');

const DB_PATH  = path.join(__dirname, '..', 'library.db');
const TEST_MODE = process.env.NODE_ENV === 'test';

let _db = null;

function getDb() {
  if (!_db) throw new Error('Database not initialised — call initDb() first');
  return _db;
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS books (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    isbn            TEXT    NOT NULL UNIQUE,
    title           TEXT    NOT NULL,
    author          TEXT    NOT NULL,
    genre           TEXT    NOT NULL DEFAULT '',
    year            INTEGER NOT NULL,
    totalCopies     INTEGER NOT NULL DEFAULT 1,
    availableCopies INTEGER NOT NULL DEFAULT 1,
    createdAt       TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS members (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT    NOT NULL,
    email        TEXT    NOT NULL UNIQUE,
    memberNumber TEXT    NOT NULL UNIQUE,
    status       TEXT    NOT NULL DEFAULT 'active',
    createdAt    TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS loans (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    bookId     INTEGER NOT NULL REFERENCES books(id),
    memberId   INTEGER NOT NULL REFERENCES members(id),
    borrowDate TEXT    NOT NULL DEFAULT (date('now')),
    dueDate    TEXT    NOT NULL,
    returnDate TEXT,
    status     TEXT    NOT NULL DEFAULT 'active',
    fee        REAL    NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS reservations (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    bookId    INTEGER NOT NULL REFERENCES books(id),
    memberId  INTEGER NOT NULL REFERENCES members(id),
    createdAt TEXT    NOT NULL DEFAULT (datetime('now')),
    status    TEXT    NOT NULL DEFAULT 'pending'
  );
`;

async function initDb() {
  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs();

  if (TEST_MODE) {
    _db = new SQL.Database();
  } else {
    const fileBuffer = fs.existsSync(DB_PATH) ? fs.readFileSync(DB_PATH) : null;
    _db = fileBuffer ? new SQL.Database(fileBuffer) : new SQL.Database();
  }

  _db.run('PRAGMA foreign_keys = ON');
  _db.run(SCHEMA);
  persist();
  return _db;
}

function clearAllTables() {
  const d = getDb();
  d.run('DELETE FROM reservations');
  d.run('DELETE FROM loans');
  d.run('DELETE FROM members');
  d.run('DELETE FROM books');
  d.run("DELETE FROM sqlite_sequence WHERE name IN ('reservations','loans','members','books')");
  persist();
}

function persist() {
  if (TEST_MODE || !_db) return;
  const data = _db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// ── thin synchronous wrapper ──────────────────────────────────────────────────

function rowsToObjects(result) {
  if (!result || !result[0]) return [];
  const { columns, values } = result[0];
  return values.map(row => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
}

const db = {
  prepare(sql) {
    return {
      all(...params) {
        return rowsToObjects(getDb().exec(bindParams(sql, params)));
      },
      get(...params) {
        return rowsToObjects(getDb().exec(bindParams(sql, params)))[0] ?? null;
      },
      run(...params) {
        getDb().run(bindParams(sql, params));
        const lastId = rowsToObjects(getDb().exec('SELECT last_insert_rowid() as id'))[0]?.id;
        persist();
        return { lastInsertRowid: lastId };
      }
    };
  },
  exec(sql) {
    getDb().run(sql);
    persist();
  }
};

function bindParams(sql, params) {
  let i = 0;
  return sql.replace(/\?/g, () => {
    const v = params[i++];
    if (v === null || v === undefined) return 'NULL';
    if (typeof v === 'number') return String(v);
    return `'${String(v).replace(/'/g, "''")}'`;
  });
}

module.exports = { db, initDb, persist, clearAllTables };
