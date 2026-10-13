// DB_FILE=:memory: ile çalışır (npm test).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate, tally, podium } from './results.js';
import { db, castVote, result, toPoll } from './db.js';

const opts = ['A', 'B', 'C'];

test('validate: soru tipine göre oy yükü', () => {
  const single = { type: 'single', options: opts, max_n: 1 };
  assert.ok(validate(single, 2));
  assert.ok(!validate(single, 3));
  assert.ok(!validate(single, '1'));

  const multi = { type: 'multi', options: opts, max_n: 2 };
  assert.ok(validate(multi, [0, 2]));
  assert.ok(!validate(multi, [0, 1, 2]));
  assert.ok(!validate(multi, [1, 1]));
  assert.ok(!validate(multi, []));

  const rating = { type: 'rating', options: [], max_n: 5 };
  assert.ok(validate(rating, 5));
  assert.ok(!validate(rating, 0));
  assert.ok(!validate(rating, 6));

  const ranked = { type: 'ranked', options: opts, max_n: 1 };
  assert.ok(validate(ranked, [2, 0, 1]));
  assert.ok(!validate(ranked, [2, 0]));
  assert.ok(!validate(ranked, [0, 0, 1]));
});

test('tally: sayım, ortalama, Borda', () => {
  assert.deepEqual(tally({ type: 'single', options: opts, max_n: 1 }, [0, 0, 2]).values, [2, 0, 1]);
  assert.deepEqual(tally({ type: 'multi', options: opts, max_n: 2 }, [[0, 1], [1]]).values, [1, 2, 0]);
  const r = tally({ type: 'rating', options: [], max_n: 5 }, [5, 3]);
  assert.deepEqual(r.values, [0, 0, 1, 0, 1]);
  assert.equal(r.average, 4);
  assert.deepEqual(tally({ type: 'ranked', options: opts, max_n: 1 }, [[2, 0, 1], [2, 1, 0]]).values, [1, 1, 4]);
  assert.equal(tally({ type: 'rating', options: [], max_n: 5 }, []).average, null);
});

test('oy: tekrar oy reddedilir, ballots hiçbir kimlik tutmaz', () => {
  const { lastInsertRowid: roomId } = db.prepare("INSERT INTO rooms(code, title) VALUES ('TEST22', 't')").run();
  const { lastInsertRowid: pollId } = db.prepare(
    "INSERT INTO polls(room_id, type, question, options, max_n, position, status) VALUES (?, 'single', 'q', ?, 1, 1, 'open')",
  ).run(roomId, JSON.stringify(opts));

  castVote(pollId, 'hash-ali', 0);
  castVote(pollId, 'hash-veli', 1);
  assert.throws(() => castVote(pollId, 'hash-ali', 2), /UNIQUE|constraint/i);

  const poll = toPoll(db.prepare('SELECT * FROM polls WHERE id = ?').get(pollId));
  assert.deepEqual(result(poll).values, [1, 1, 0]); // tekrar denemesi sayıma girmedi

  const cols = db.prepare('PRAGMA table_info(ballots)').all().map((c) => c.name);
  assert.deepEqual(cols.sort(), ['id', 'payload', 'poll_id']);
  const dump = JSON.stringify(db.prepare('SELECT * FROM ballots').all());
  assert.ok(!dump.includes('hash-ali') && !dump.includes('hash-veli'));
});

test('podium: yalnız birincileri verir, sayı sızdırmaz', () => {
  assert.deepEqual(podium(tally({ type: 'single', options: opts, max_n: 1 }, [1, 1, 0])), { winners: ['B'] });
  assert.deepEqual(podium(tally({ type: 'single', options: opts, max_n: 1 }, [0, 1])), { winners: ['A', 'B'] });
  assert.deepEqual(podium(tally({ type: 'rating', options: [], max_n: 5 }, [4, 5])), { average: 4.5 });
});
