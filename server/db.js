import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { tally } from './results.js';

export const db = new DatabaseSync(process.env.DB_FILE || 'data.db');

// Anonimlik: `ballots` token tutmaz, zaman damgası yok, id rastgele ve tablo WITHOUT ROWID
// → oy ile "kim oy verdi" kaydı (receipts) eklenme sırasından eşleştirilemez.
db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS rooms(
  id INTEGER PRIMARY KEY, code TEXT UNIQUE NOT NULL, title TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS polls(
  id INTEGER PRIMARY KEY, room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  type TEXT NOT NULL, question TEXT NOT NULL, options TEXT NOT NULL,
  max_n INTEGER NOT NULL DEFAULT 1, position INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'draft');
CREATE TABLE IF NOT EXISTS voters(
  room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE, token_hash TEXT NOT NULL,
  PRIMARY KEY(room_id, token_hash));
CREATE TABLE IF NOT EXISTS receipts(
  poll_id INTEGER NOT NULL REFERENCES polls(id) ON DELETE CASCADE, token_hash TEXT NOT NULL,
  PRIMARY KEY(poll_id, token_hash));
CREATE TABLE IF NOT EXISTS ballots(
  id TEXT PRIMARY KEY, poll_id INTEGER NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  payload TEXT NOT NULL) WITHOUT ROWID;
`);

export function tx(fn) {
  db.exec('BEGIN');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

export const toPoll = (r) => ({ ...r, options: JSON.parse(r.options) });

export const pollsOf = (roomId) =>
  db.prepare('SELECT * FROM polls WHERE room_id = ? ORDER BY position').all(roomId).map(toPoll);

export const result = (poll) =>
  tally(poll, db.prepare('SELECT payload FROM ballots WHERE poll_id = ?').all(poll.id).map((r) => JSON.parse(r.payload)));

// Aynı token ikinci kez gelirse receipts PK'si UNIQUE hatası fırlatır ve tüm işlem geri alınır.
export function castVote(pollId, tokenHash, payload) {
  tx(() => {
    db.prepare('INSERT INTO receipts(poll_id, token_hash) VALUES (?, ?)').run(pollId, tokenHash);
    db.prepare('INSERT INTO ballots(id, poll_id, payload) VALUES (?, ?, ?)').run(randomUUID(), pollId, JSON.stringify(payload));
  });
}
