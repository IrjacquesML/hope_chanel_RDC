// Serveur Hope Chanel RDC : API d'administration + (en production) service du site compilé.
import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSitemap } from '../scripts/sitemap-lib.mjs';
import { createStats } from './stats.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = path.join(ROOT, 'src', 'data');
const BACKUP_DIR = path.join(ROOT, 'backups');
const UPLOAD_DIR = path.join(ROOT, 'uploads');
const DIST_DIR = path.join(ROOT, 'dist');
const FILES = ['shows', 'schedule', 'content'];

const PORT = Number(process.env.PORT) || 3001;
const EMAIL = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const PASSWORD = process.env.ADMIN_PASSWORD;
const PROD = process.env.NODE_ENV === 'production';
const SESSION_HOURS = 8;
const MAX_BACKUPS_PER_FILE = 30;

if (!PASSWORD || PASSWORD.length < 8) {
  console.error('ADMIN_PASSWORD manquant ou trop court (8 caractères min.) : définissez-le dans le fichier .env');
  process.exit(1);
}
if (!EMAIL) {
  console.error('ADMIN_EMAIL manquant : définissez-le dans le fichier .env');
  process.exit(1);
}

for (const dir of [BACKUP_DIR, UPLOAD_DIR]) if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

const stats = createStats(ROOT);

const app = express();
app.disable('x-powered-by');
// Derrière un proxy (Nginx, hébergeur), TRUST_PROXY=1 permet de lire la vraie IP du visiteur.
app.set('trust proxy', process.env.TRUST_PROXY === '1');
app.use(express.json({ limit: '8mb' }));

/* ---------- Sessions (en mémoire) ---------- */
const sessions = new Map(); // token -> expiration (ms)
const COOKIE = 'hc_admin';

function readCookie(req, name) {
  const match = (req.headers.cookie || '').split(/;\s*/).find((c) => c.startsWith(name + '='));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

function isAuthed(req) {
  const token = readCookie(req, COOKIE);
  const exp = token && sessions.get(token);
  if (!exp) return false;
  if (exp < Date.now()) {
    sessions.delete(token);
    return false;
  }
  return true;
}

function requireAuth(req, res, next) {
  if (!isAuthed(req)) return res.status(401).json({ error: 'Non authentifié' });
  next();
}

function setSessionCookie(res, token, maxAgeSec) {
  const parts = [`${COOKIE}=${token}`, 'Path=/', 'HttpOnly', 'SameSite=Strict', `Max-Age=${maxAgeSec}`];
  if (PROD) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/* Limitation des tentatives : 5 échecs par IP => blocage 15 min */
const attempts = new Map();
function tooManyAttempts(ip) {
  const a = attempts.get(ip);
  return a && a.count >= 5 && Date.now() - a.first < 15 * 60_000;
}
function recordFailure(ip) {
  const a = attempts.get(ip);
  if (!a || Date.now() - a.first > 15 * 60_000) attempts.set(ip, { count: 1, first: Date.now() });
  else a.count++;
}

/* ---------- Données ---------- */
const filePath = (name) => path.join(DATA_DIR, `${name}.json`);

async function readData(name) {
  return JSON.parse(await fs.readFile(filePath(name), 'utf8'));
}

async function backup(name) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  await fs.copyFile(filePath(name), path.join(BACKUP_DIR, `${name}-${stamp}.json`));
  const old = (await fs.readdir(BACKUP_DIR)).filter((f) => f.startsWith(name + '-')).sort();
  for (const f of old.slice(0, Math.max(0, old.length - MAX_BACKUPS_PER_FILE))) await fs.unlink(path.join(BACKUP_DIR, f));
}

async function writeData(name, data) {
  await backup(name);
  const tmp = filePath(name) + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8');
  await fs.rename(tmp, filePath(name)); // écriture atomique
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

/** Validation minimale de la structure avant écriture. Renvoie un message d'erreur ou null. */
function validate(name, d) {
  if (!isObj(d)) return 'Format invalide';
  if (name === 'shows') {
    if (![d.categories, d.shows, d.episodes].every(Array.isArray)) return 'categories, shows et episodes doivent être des listes';
    const catIds = new Set(d.categories.map((c) => c.id));
    if (d.categories.some((c) => !SLUG.test(c.id || ''))) return 'Identifiant de catégorie invalide';
    const slugs = new Set();
    for (const s of d.shows) {
      if (!SLUG.test(s.slug || '')) return `Slug invalide : « ${s.slug} »`;
      if (slugs.has(s.slug)) return `Slug en double : « ${s.slug} »`;
      if (!s.title) return 'Chaque émission doit avoir un titre';
      if (!catIds.has(s.category)) return `Catégorie inconnue pour « ${s.title} »`;
      slugs.add(s.slug);
    }
    const ids = new Set();
    for (const e of d.episodes) {
      if (!e.id || ids.has(e.id)) return `Identifiant d'épisode manquant ou en double : « ${e.id} »`;
      if (!slugs.has(e.show)) return `L'épisode « ${e.id} » référence une émission inexistante`;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date || '')) return `Date invalide pour l'épisode « ${e.id} »`;
      ids.add(e.id);
    }
  }
  if (name === 'schedule') {
    if (!isObj(d.templates) || !Array.isArray(d.week) || d.week.length !== 7) return 'Structure du programme invalide';
    if (d.week.some((k) => !Array.isArray(d.templates[k]))) return 'Un jour de la semaine utilise un modèle inexistant';
    for (const [k, slots] of Object.entries(d.templates)) {
      for (const s of slots) {
        if (!TIME.test(s.start) || !(TIME.test(s.end) || s.end === '23:59')) return `Horaire invalide dans « ${k} »`;
        if (s.start >= s.end) return `Dans « ${k} », ${s.start} doit précéder ${s.end}`;
      }
    }
  }
  if (name === 'content') {
    for (const k of ['contact', 'social', 'live']) if (!isObj(d[k])) return `Section « ${k} » manquante`;
    for (const k of ['events', 'news', 'team', 'testimonials', 'network']) if (!Array.isArray(d[k])) return `La section « ${k} » doit être une liste`;
  }
  return null;
}

/** Le programme ne doit référencer que des émissions existantes. */
async function checkReferences(name, d) {
  if (name !== 'shows' && name !== 'schedule') return null;
  const shows = name === 'shows' ? d : await readData('shows');
  const schedule = name === 'schedule' ? d : await readData('schedule');
  const slugs = new Set(shows.shows.map((s) => s.slug));
  for (const [k, slots] of Object.entries(schedule.templates)) {
    const bad = slots.find((s) => s.show && !slugs.has(s.show));
    if (bad) return `Le programme (« ${k} », ${bad.start}) utilise une émission inexistante : « ${bad.show} »`;
  }
  return null;
}

/* ---------- Routes API ---------- */
app.get('/api/data', async (_req, res, next) => {
  try {
    const [shows, schedule, content] = await Promise.all(FILES.map(readData));
    res.set('Cache-Control', 'no-cache').json({ shows, schedule, content });
  } catch (e) {
    next(e);
  }
});

app.post('/api/login', (req, res) => {
  const ip = req.ip;
  if (tooManyAttempts(ip)) return res.status(429).json({ error: 'Trop de tentatives. Réessayez dans 15 minutes.' });
  // Les deux comparaisons sont toujours effectuées (pas d'indice sur le champ erroné).
  const emailOk = safeEqual(String(req.body?.email ?? '').trim().toLowerCase(), EMAIL);
  const passwordOk = safeEqual(req.body?.password ?? '', PASSWORD);
  if (!emailOk || !passwordOk) {
    recordFailure(ip);
    return res.status(401).json({ error: 'E-mail ou mot de passe incorrect' });
  }
  attempts.delete(ip);
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, Date.now() + SESSION_HOURS * 3600_000);
  setSessionCookie(res, token, SESSION_HOURS * 3600);
  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  sessions.delete(readCookie(req, COOKIE));
  setSessionCookie(res, '', 0);
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => res.json({ authenticated: isAuthed(req) }));

app.put('/api/data/:file', requireAuth, async (req, res, next) => {
  const { file } = req.params;
  if (!FILES.includes(file)) return res.status(404).json({ error: 'Fichier inconnu' });
  let error = validate(file, req.body);
  if (!error) error = await checkReferences(file, req.body);
  if (error) return res.status(400).json({ error });
  try {
    await writeData(file, req.body);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

const MIME = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
app.post('/api/upload', requireAuth, async (req, res, next) => {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(req.body?.dataUrl || '');
  if (!m) return res.status(400).json({ error: 'Image JPEG, PNG ou WebP attendue' });
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 5 * 1024 * 1024) return res.status(413).json({ error: 'Image trop lourde (5 Mo max.)' });
  try {
    const name = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${MIME[m[1]]}`;
    await fs.writeFile(path.join(UPLOAD_DIR, name), buf);
    res.json({ url: `/uploads/${name}` });
  } catch (e) {
    next(e);
  }
});

app.get('/api/backups', requireAuth, async (_req, res) => {
  const files = (await fs.readdir(BACKUP_DIR)).filter((f) => f.endsWith('.json')).sort().reverse();
  res.json(files);
});

app.post('/api/backups/:name/restore', requireAuth, async (req, res, next) => {
  const m = /^(shows|schedule|content)-[\dTZ-]+\.json$/.exec(req.params.name);
  if (!m) return res.status(400).json({ error: 'Sauvegarde invalide' });
  try {
    const data = JSON.parse(await fs.readFile(path.join(BACKUP_DIR, req.params.name), 'utf8'));
    await writeData(m[1], data);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

/* ---------- Statistiques ---------- */
const trackHits = new Map(); // ip -> { count, since } : 300 événements / 10 min max.
app.post('/api/track', express.text({ type: 'text/plain', limit: '4kb' }), (req, res) => {
  const now = Date.now();
  const h = trackHits.get(req.ip);
  if (!h || now - h.since > 600_000) trackHits.set(req.ip, { count: 1, since: now });
  else if (++h.count > 300) return res.status(204).end();
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(204).end();
    }
  }
  try {
    stats.track(body, { ip: req.ip, ua: req.get('user-agent') || '', host: (req.get('host') || '').split(':')[0] });
  } catch (e) {
    console.error('track', e);
  }
  res.status(204).end();
});

app.get('/api/stats', requireAuth, (req, res) => res.json(stats.report(Number(req.query.days))));

app.get('/api/stats/export.csv', requireAuth, (req, res) => {
  const r = stats.report(Number(req.query.days));
  const lines = ['jour;visiteurs;pages vues;lancements de lecture;minutes regardees'];
  for (const d of r.daily) lines.push([d.day, d.visitors, d.pageviews, d.plays, Math.round(d.watchSeconds / 60)].join(';'));
  res
    .type('text/csv; charset=utf-8')
    .set('Content-Disposition', `attachment; filename="hope-chanel-stats-${r.from}_${r.to}.csv"`)
    .send('﻿' + lines.join('\r\n'));
});

app.get('/sitemap.xml', async (_req, res, next) => {
  try {
    res.type('application/xml').send(buildSitemap((await readData('shows')).shows).xml);
  } catch (e) {
    next(e);
  }
});

app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '30d', immutable: true }));
app.use('/api', (_req, res) => res.status(404).json({ error: 'Route inconnue' }));

/* ---------- Site compilé (production) ---------- */
if (existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR, { index: false, maxAge: '1h' }));
  app.get('*', (_req, res) => res.sendFile(path.join(DIST_DIR, 'index.html')));
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Erreur serveur' });
});

app.listen(PORT, () => console.log(`Serveur Hope Chanel RDC : http://localhost:${PORT}`));
