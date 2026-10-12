import express from 'express';
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { db, tx, toPoll, pollsOf, result, castVote } from './db.js';
import { validate } from './results.js';

const PORT = process.env.PORT || 3001;
const PASSWORD = process.env.ADMIN_PASSWORD;
const PUBLIC_URL = process.env.PUBLIC_URL || '';
const SECRET = process.env.SESSION_SECRET || randomBytes(32).toString('hex');
if (!PASSWORD) {
  console.error('ADMIN_PASSWORD ayarlı değil. .env.example dosyasına bak.');
  process.exit(1);
}

const TYPES = { single: 'Tek seçim', multi: 'Çoklu seçim', rating: 'Puan', ranked: 'Sıralı seçim' };
const CODE_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // 0/O, 1/I karışmaz

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '20kb' }));

const bad = (res, error, status = 400) => res.status(status).json({ error });
const hash = (t) => createHash('sha256').update(String(t)).digest('hex');
const safeEq = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

// --- basit hız sınırı (bellekte, süreç başına) ---
const hits = new Map();
setInterval(() => hits.clear(), 10 * 60_000).unref();
const limit = (name, max, ms = 60_000) => (req, res, next) => {
  const k = name + req.ip;
  const now = Date.now();
  const h = (hits.get(k) || []).filter((t) => now - t < ms);
  if (h.length >= max) return bad(res, 'Çok fazla istek. Biraz bekleyip tekrar dene.', 429);
  h.push(now);
  hits.set(k, h);
  next();
};

// --- canlı güncelleme (SSE): istemciler "değişti" sinyali alır, durumu kendisi çeker ---
const subs = new Map(); // "v:<roomId>" seçmenler, "a:<roomId>" admin
const timers = new Map();
setInterval(() => subs.forEach((set) => set.forEach((r) => r.write(': \n\n'))), 25_000).unref();

function subscribe(req, res, key) {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders();
  res.write('retry: 3000\n\n');
  if (!subs.has(key)) subs.set(key, new Set());
  subs.get(key).add(res);
  req.on('close', () => subs.get(key).delete(res));
}
function ping(key) {
  if (timers.has(key)) return;
  timers.set(key, setTimeout(() => {
    timers.delete(key);
    subs.get(key)?.forEach((r) => r.write('data: 1\n\n'));
  }, 250));
}
const notify = (roomId, voters) => {
  ping('a:' + roomId);
  if (voters) ping('v:' + roomId);
};

// --- seçmen ---
const roomByCode = (code) => db.prepare('SELECT * FROM rooms WHERE code = ?').get(String(code).toUpperCase());
const isVoter = (roomId, th) => !!db.prepare('SELECT 1 FROM voters WHERE room_id = ? AND token_hash = ?').get(roomId, th);

app.post('/api/rooms/:code/join', limit('join', 120), (req, res) => {
  const room = roomByCode(req.params.code);
  if (!room) return bad(res, 'Bu kodla bir oda bulunamadı. Kodu kontrol et.', 404);
  let token = req.get('x-token');
  if (!token || !isVoter(room.id, hash(token))) {
    token = randomBytes(16).toString('hex');
    db.prepare('INSERT INTO voters(room_id, token_hash) VALUES (?, ?)').run(room.id, hash(token));
    notify(room.id, false);
  }
  res.json({ token, title: room.title });
});

app.get('/api/rooms/:code/state', (req, res) => {
  const room = roomByCode(req.params.code);
  if (!room) return bad(res, 'Bu kodla bir oda bulunamadı. Kodu kontrol et.', 404);
  const th = hash(req.get('x-token') || '');
  if (!isVoter(room.id, th)) return bad(res, 'Oturum bulunamadı.', 401);
  const polls = pollsOf(room.id);
  const open = polls.find((p) => p.status === 'open');
  res.json({
    title: room.title,
    poll: open && { id: open.id, type: open.type, question: open.question, options: open.options, max_n: open.max_n },
    voted: open ? !!db.prepare('SELECT 1 FROM receipts WHERE poll_id = ? AND token_hash = ?').get(open.id, th) : false,
    closed: polls.filter((p) => p.status === 'closed').reverse()
      .map((p) => ({ id: p.id, type: p.type, question: p.question, result: result(p) })),
  });
});

app.get('/api/rooms/:code/events', (req, res) => {
  const room = roomByCode(req.params.code);
  if (!room) return res.sendStatus(404);
  subscribe(req, res, 'v:' + room.id);
});

app.post('/api/polls/:id/vote', limit('vote', 60), (req, res) => {
  const row = db.prepare('SELECT * FROM polls WHERE id = ?').get(req.params.id);
  if (!row || row.status !== 'open') return bad(res, 'Bu soru artık oya açık değil.', 409);
  const poll = toPoll(row);
  const th = hash(req.get('x-token') || '');
  if (!isVoter(poll.room_id, th)) return bad(res, 'Oturum bulunamadı. Sayfayı yenile.', 401);
  const payload = req.body?.payload;
  if (!validate(poll, payload)) return bad(res, 'Oy geçersiz. Seçimini kontrol et.');
  try {
    castVote(poll.id, th, payload);
  } catch (e) {
    if (/UNIQUE|constraint/i.test(e.message)) return bad(res, 'Bu soruya zaten oy verdin.', 409);
    throw e;
  }
  notify(poll.room_id, false);
  res.sendStatus(204);
});

// --- admin ---
const sign = (v) => createHmac('sha256', SECRET).update(v).digest('base64url');
const isAdmin = (req) => {
  const m = /(?:^|; )admin=([^;]+)/.exec(req.headers.cookie || '');
  const [exp, sig] = m ? m[1].split('.') : [];
  return !!sig && Number(exp) > Date.now() && safeEq(sig, sign(exp));
};
const cookie = (value, maxAge) =>
  `admin=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${PUBLIC_URL.startsWith('https') ? '; Secure' : ''}`;

app.post('/api/admin/login', limit('login', 10), (req, res) => {
  const given = String(req.body?.password ?? '');
  if (!safeEq(hash(given), hash(PASSWORD))) return bad(res, 'Parola yanlış.', 401);
  const exp = String(Date.now() + 12 * 3600_000);
  res.set('Set-Cookie', cookie(`${exp}.${sign(exp)}`, 12 * 3600)).sendStatus(204);
});
app.post('/api/admin/logout', (req, res) => res.set('Set-Cookie', cookie('', 0)).sendStatus(204));

app.use('/api/admin', (req, res, next) => (isAdmin(req) ? next() : bad(res, 'Giriş gerekli.', 401)));

app.get('/api/admin/rooms', (req, res) => {
  res.json(db.prepare(`
    SELECT r.id, r.code, r.title,
      (SELECT COUNT(*) FROM voters v WHERE v.room_id = r.id) AS voters,
      (SELECT COUNT(*) FROM polls p WHERE p.room_id = r.id) AS polls
    FROM rooms r ORDER BY r.id DESC`).all());
});

app.post('/api/admin/rooms', (req, res) => {
  const title = String(req.body?.title ?? '').trim();
  if (!title || title.length > 100) return bad(res, 'Oda adı 1-100 karakter olmalı.');
  for (let i = 0; i < 5; i++) {
    const code = Array.from({ length: 6 }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join('');
    try {
      const { lastInsertRowid } = db.prepare('INSERT INTO rooms(code, title) VALUES (?, ?)').run(code, title);
      return res.status(201).json({ id: Number(lastInsertRowid), code, title });
    } catch (e) {
      if (!/UNIQUE/i.test(e.message)) throw e;
    }
  }
  bad(res, 'Oda kodu üretilemedi, tekrar dene.', 500);
});

app.delete('/api/admin/rooms/:id', (req, res) => {
  db.prepare('DELETE FROM rooms WHERE id = ?').run(req.params.id);
  res.sendStatus(204);
});

const roomById = (id) => db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);

app.get('/api/admin/rooms/:id', (req, res) => {
  const room = roomById(req.params.id);
  if (!room) return bad(res, 'Oda bulunamadı.', 404);
  res.json({
    room,
    publicUrl: PUBLIC_URL,
    voters: db.prepare('SELECT COUNT(*) AS n FROM voters WHERE room_id = ?').get(room.id).n,
    polls: pollsOf(room.id).map((p) => ({ ...p, result: result(p) })),
  });
});

app.get('/api/admin/rooms/:id/events', (req, res) => {
  const room = roomById(req.params.id);
  if (!room) return res.sendStatus(404);
  subscribe(req, res, 'a:' + room.id);
});

app.post('/api/admin/rooms/:id/polls', (req, res) => {
  const room = roomById(req.params.id);
  if (!room) return bad(res, 'Oda bulunamadı.', 404);
  const { type } = req.body ?? {};
  const question = String(req.body?.question ?? '').trim();
  if (!TYPES[type]) return bad(res, 'Soru tipi geçersiz.');
  if (!question || question.length > 200) return bad(res, 'Soru 1-200 karakter olmalı.');
  let options = [];
  let max_n = 1;
  if (type === 'rating') {
    max_n = Number(req.body.max_n);
    if (![5, 10].includes(max_n)) return bad(res, 'Puan ölçeği 5 ya da 10 olmalı.');
  } else {
    options = (Array.isArray(req.body.options) ? req.body.options : []).map((o) => String(o).trim());
    if (options.length < 2 || options.length > 12 || options.some((o) => !o || o.length > 100)) {
      return bad(res, '2 ile 12 arasında, boş olmayan seçenek gerekli.');
    }
    if (type === 'multi') {
      max_n = Number(req.body.max_n);
      if (!Number.isInteger(max_n) || max_n < 1 || max_n > options.length) return bad(res, 'En fazla seçim sayısı geçersiz.');
    }
  }
  const { n } = db.prepare('SELECT COALESCE(MAX(position), 0) + 1 AS n FROM polls WHERE room_id = ?').get(room.id);
  db.prepare('INSERT INTO polls(room_id, type, question, options, max_n, position) VALUES (?, ?, ?, ?, ?, ?)')
    .run(room.id, type, question, JSON.stringify(options), max_n, n);
  notify(room.id, true);
  res.sendStatus(204);
});

const pollRow = (id) => db.prepare('SELECT * FROM polls WHERE id = ?').get(id);

app.post('/api/admin/polls/:id/status', (req, res) => {
  const poll = pollRow(req.params.id);
  const status = req.body?.status;
  if (!poll) return bad(res, 'Soru bulunamadı.', 404);
  if (!['open', 'closed'].includes(status)) return bad(res, 'Durum geçersiz.');
  tx(() => {
    // Odada aynı anda tek soru açık: yenisi açılınca öncekini kapat.
    if (status === 'open') db.prepare("UPDATE polls SET status = 'closed' WHERE room_id = ? AND status = 'open'").run(poll.room_id);
    db.prepare('UPDATE polls SET status = ? WHERE id = ?').run(status, poll.id);
  });
  notify(poll.room_id, true);
  res.sendStatus(204);
});

app.delete('/api/admin/polls/:id', (req, res) => {
  const poll = pollRow(req.params.id);
  if (poll) {
    db.prepare('DELETE FROM polls WHERE id = ?').run(poll.id);
    notify(poll.room_id, true);
  }
  res.sendStatus(204);
});

// Excel'de formül olarak çalışmasın diye = + - @ ile başlayan hücrelere ' eklenir.
const cell = (c) => {
  let s = String(c);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
};

app.get('/api/admin/rooms/:id/export.csv', (req, res) => {
  const room = roomById(req.params.id);
  if (!room) return bad(res, 'Oda bulunamadı.', 404);
  const rows = [['Soru', 'Tip', 'Seçenek', 'Değer']];
  for (const p of pollsOf(room.id)) {
    const r = result(p);
    r.labels.forEach((l, i) => rows.push([p.question, TYPES[p.type], l, r.values[i]]));
    rows.push([p.question, TYPES[p.type], 'Toplam oy', r.total]);
    if (r.average != null) rows.push([p.question, TYPES[p.type], 'Ortalama', r.average.toFixed(2)]);
  }
  res.type('text/csv; charset=utf-8')
    .set('Content-Disposition', `attachment; filename="${room.code}.csv"`)
    .send('﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n'));
});

// --- arayüz (üretimde web/dist) ---
app.use('/api', (req, res) => res.sendStatus(404));
const dist = fileURLToPath(new URL('../web/dist/', import.meta.url));
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.use((req, res) => res.sendFile(dist + 'index.html'));
}

app.listen(PORT, () => console.log(`Anonim oylama: http://localhost:${PORT}`));
