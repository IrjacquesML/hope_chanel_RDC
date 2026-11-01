// Serveur Hope Chanel RDC : API d'administration + (en production) service du site compilé.
import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { Readable } from 'node:stream';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSitemap } from '../scripts/sitemap-lib.mjs';
import { createStats } from './stats.js';
import { createAuth } from './auth.js';
import { MEDIAMTX_HLS, pathReady, relayState, startMediamtx } from './mediamtx.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = path.join(ROOT, 'src', 'data');
const BACKUP_DIR = path.join(ROOT, 'backups');
const UPLOAD_DIR = path.join(ROOT, 'uploads');
const DIST_DIR = path.join(ROOT, 'dist');
const DB_DIR = path.join(ROOT, 'db');
// Réglages confidentiels (clés de diffusion, connexions OBS / vMix) : jamais servis au public.
const PRIVATE_FILE = path.join(DB_DIR, 'private.json');
const FILES = ['shows', 'schedule', 'content', 'settings'];

const PORT = Number(process.env.PORT) || 3001;
const ENV_EMAIL = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const ENV_PASSWORD = process.env.ADMIN_PASSWORD;
const PROD = process.env.NODE_ENV === 'production';
const MAX_BACKUPS_PER_FILE = 30;

for (const dir of [BACKUP_DIR, UPLOAD_DIR, DB_DIR]) if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

/* ---------- Réglages confidentiels ---------- */
const DEST_KEYS = ['selfhost', 'youtube', 'facebook', 'tiktok', 'jetstream', 'custom'];
const DEFAULT_PRIVATE = {
  streaming: {
    primary: 'youtube',
    destinations: {
      selfhost: { enabled: false, server: 'rtmp://localhost:1935', key: '' },
      youtube: { enabled: true, server: 'rtmp://a.rtmp.youtube.com/live2', key: '' },
      facebook: { enabled: false, server: 'rtmps://live-api-s.facebook.com:443/rtmp/', key: '' },
      tiktok: { enabled: false, server: '', key: '' },
      jetstream: { enabled: false, server: '', key: '' },
      custom: { enabled: false, label: 'Autre plateforme', server: '', key: '' },
    },
    obs: { host: 'localhost', port: 4455, password: '' },
    vmix: { host: '', port: 8088 },
  },
};

/** Lit db/private.json en complétant les valeurs manquantes par les valeurs par défaut. */
function readPrivateSync() {
  try {
    const saved = JSON.parse(readFileSync(PRIVATE_FILE, 'utf8'));
    const d = DEFAULT_PRIVATE.streaming;
    const st = saved.streaming || {};
    return {
      streaming: {
        ...d,
        ...st,
        destinations: Object.fromEntries(DEST_KEYS.map((k) => [k, { ...d.destinations[k], ...st.destinations?.[k] }])),
        obs: { ...d.obs, ...st.obs },
        vmix: { ...d.vmix, ...st.vmix },
      },
    };
  } catch {
    return structuredClone(DEFAULT_PRIVATE);
  }
}

let privateData = readPrivateSync();

/**
 * Direct auto-hébergé : vMix envoie vers rtmp://…:1935/live avec la clé comme « Stream Name ».
 * MediaMTX reçoit donc le flux sur le chemin live/<clé> ; les visiteurs le lisent sur /hls/live/ sans jamais voir la clé.
 */
const livePath = () => `live/${privateData.streaming.destinations.selfhost.key}`;
const sameSecret = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

// Ancien compte unique (identifiants modifiés depuis l'administration) : repris comme premier administrateur.
let legacyAdmin = null;
try {
  const admin = JSON.parse(readFileSync(PRIVATE_FILE, 'utf8')).admin;
  if (admin?.passwordHash) legacyAdmin = { email: admin.email || ENV_EMAIL, passwordHash: admin.passwordHash };
} catch {
  /* pas encore de fichier */
}

async function writePrivate(next) {
  const tmp = PRIVATE_FILE + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(next, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
  await fs.rename(tmp, PRIVATE_FILE);
  privateData = next;
}

const stats = createStats(ROOT);
const auth = await createAuth({ dbDir: DB_DIR, prod: PROD, envEmail: ENV_EMAIL, envPassword: ENV_PASSWORD, legacyAdmin });
const { requireAuth, requireRole, isAuthed, canWriteFile } = auth;

const app = express();
app.disable('x-powered-by');
// Derrière un proxy (Nginx, hébergeur), TRUST_PROXY=1 permet de lire la vraie IP du visiteur.
app.set('trust proxy', process.env.TRUST_PROXY === '1');
app.use(express.json({ limit: '8mb' }));

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
    if (d.contact.email && !EMAIL_RE.test(d.contact.email)) return 'Adresse e-mail de contact invalide';
    if (!Array.isArray(d.contact.phones)) return 'Les téléphones doivent être une liste';
    for (const [k, v] of Object.entries(d.social)) if (v && !/^https:\/\//.test(v)) return `Le lien « ${k} » doit commencer par https://`;
  }
  if (name === 'settings') {
    for (const k of ['site', 'appearance', 'announcement', 'maintenance', 'integrations']) if (!isObj(d[k])) return `Section « ${k} » manquante`;
    if (!String(d.site.name || '').trim()) return 'Le nom du site est obligatoire';
    if (!/^https?:\/\/[^\s/]+/.test(d.site.url || '')) return 'Adresse du site invalide (ex. : https://www.hopechanelrdc.org)';
    for (const [k, v] of Object.entries(d.appearance)) if (!/^#[\da-fA-F]{6}$/.test(v)) return `Couleur invalide : « ${k} »`;
    if (d.integrations.googleAnalyticsId && !/^G-[A-Z0-9]{4,}$/.test(d.integrations.googleAnalyticsId)) return 'Identifiant Google Analytics invalide (format G-XXXXXXX)';
    if (d.announcement.link && !/^(https:\/\/|\/)/.test(d.announcement.link)) return 'Le lien de l’annonce doit commencer par https:// ou /';
  }
  return null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HOST_RE = /^[a-zA-Z0-9.-]{1,253}$/;
const STREAM_URL_RE = /^(rtmps?|srt):\/\/\S+$/;

function validatePrivateStreaming(st) {
  if (!isObj(st) || !isObj(st.destinations) || !isObj(st.obs) || !isObj(st.vmix)) return 'Structure invalide';
  if (!DEST_KEYS.includes(st.primary)) return 'Destination principale inconnue';
  for (const k of DEST_KEYS) {
    const dest = st.destinations[k];
    if (!isObj(dest)) return `Destination « ${k} » manquante`;
    if (dest.server && !STREAM_URL_RE.test(dest.server.trim())) return `Serveur de « ${k} » invalide : il doit commencer par rtmp://, rtmps:// ou srt://`;
    if (typeof dest.key !== 'string' || dest.key.length > 500) return `Clé de « ${k} » invalide`;
  }
  for (const k of ['obs', 'vmix']) {
    const { host, port } = st[k];
    if (typeof host !== 'string' || (host && !HOST_RE.test(host.trim()))) return `Adresse ${k.toUpperCase()} invalide (nom ou IP, sans http://)`;
    if (!Number.isInteger(port) || port < 1 || port > 65535) return `Port ${k.toUpperCase()} invalide`;
  }
  return null;
}

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/**
 * Production : injecte dans index.html les paramètres du site (titre, description, favicon, partage, données structurées),
 * pour que moteurs de recherche et réseaux sociaux voient les valeurs définies dans l'administration.
 */
function renderIndex(html, settings, content, pathname) {
  const { site, appearance, integrations } = settings;
  const base = site.url.replace(/\/+$/, '');
  const abs = (u) => (/^https?:/.test(u) ? u : base + u);
  const title = site.tagline?.fr ? `${site.name} — ${site.tagline.fr}` : site.name;
  const description = site.description?.fr || '';
  const { contact } = content;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TelevisionChannel',
    name: site.name,
    url: base + '/',
    logo: abs(site.logo),
    broadcastServiceTier: 'Free',
    inLanguage: ['fr', 'en'],
    ...(contact.phones[0] && { telephone: contact.phones[0].replace(/\s/g, '') }),
    ...(contact.email && { email: contact.email }),
    ...(contact.address && { address: { '@type': 'PostalAddress', streetAddress: contact.address, addressCountry: 'CD' } }),
    ...(contact.map && { geo: { '@type': 'GeoCoordinates', latitude: contact.map.lat, longitude: contact.map.lon } }),
    sameAs: Object.values(content.social).filter(Boolean),
  };
  const extra = [
    integrations.googleSiteVerification && `<meta name="google-site-verification" content="${escapeHtml(integrations.googleSiteVerification)}" />`,
    integrations.bingSiteVerification && `<meta name="msvalidate.01" content="${escapeHtml(integrations.bingSiteVerification)}" />`,
  ].filter(Boolean);
  return html
    .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*/, `$1${escapeHtml(description)}`)
    .replace(/(<meta name="theme-color" content=")[^"]*/, `$1${escapeHtml(appearance.brand)}`)
    .replace(/(<link rel="icon"[^>]*href=")[^"]*/, `$1${escapeHtml(site.favicon)}`)
    .replace(/(<link rel="apple-touch-icon" href=")[^"]*/, `$1${escapeHtml(site.favicon)}`)
    .replace(/(<link rel="preload" as="image" href=")[^"]*("[^>]*type=")[^"]*/, `$1${escapeHtml(site.logo)}$2${site.logo.endsWith('.png') ? 'image/png' : site.logo.endsWith('.jpg') ? 'image/jpeg' : 'image/webp'}`)
    .replace(/(<link rel="canonical" href=")[^"]*/, `$1${escapeHtml(base + pathname)}`)
    .replace(/(<meta property="og:site_name" content=")[^"]*/, `$1${escapeHtml(site.name)}`)
    .replace(/(<meta property="og:title" content=")[^"]*/, `$1${escapeHtml(title)}`)
    .replace(/(<meta property="og:description" content=")[^"]*/, `$1${escapeHtml(description)}`)
    .replace(/(<meta property="og:url" content=")[^"]*/, `$1${escapeHtml(base + pathname)}`)
    .replace(/(<meta property="og:image" content=")[^"]*/, `$1${escapeHtml(abs(site.ogImage))}`)
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`)
    .replace('</head>', `${extra.join('\n    ')}\n  </head>`);
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
app.get('/api/data', async (req, res, next) => {
  try {
    const [shows, schedule, content, settings] = await Promise.all(FILES.map(readData));
    // viewer.admin : un membre de l'équipe connecté voit le site même en mode maintenance.
    res.set('Cache-Control', 'no-cache').json({ shows, schedule, content, settings, viewer: { admin: isAuthed(req) } });
  } catch (e) {
    next(e);
  }
});

/* ---------- Comptes, connexion, mot de passe : voir server/auth.js ---------- */
app.use('/api', auth.router);

/* ---------- Réglages confidentiels (administrateur et technicien régie) ---------- */
const streamingRoles = requireRole('admin', 'technician');

app.get('/api/private', streamingRoles, (_req, res) => {
  res.set('Cache-Control', 'no-store').json({ streaming: privateData.streaming });
});

app.put('/api/private/streaming', streamingRoles, async (req, res, next) => {
  const error = validatePrivateStreaming(req.body);
  if (error) return res.status(400).json({ error });
  const st = req.body;
  const streaming = {
    primary: st.primary,
    destinations: Object.fromEntries(
      DEST_KEYS.map((k) => {
        const d = st.destinations[k];
        const clean = { enabled: Boolean(d.enabled), server: String(d.server || '').trim(), key: d.key.trim() };
        if (k === 'selfhost') Object.assign(clean, { enabled: true, key: privateData.streaming.destinations.selfhost.key }); // clé créée par le serveur
        if (k === 'custom') clean.label = String(d.label || '').slice(0, 60);
        return [k, clean];
      }),
    ),
    obs: { host: st.obs.host.trim(), port: st.obs.port, password: String(st.obs.password || '') },
    vmix: { host: st.vmix.host.trim(), port: st.vmix.port },
  };
  try {
    await writePrivate({ streaming });
    liveCache.at = 0;
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

/* ---------- vMix (API web, port 8088) : relayée par le serveur, qui doit pouvoir joindre le PC vMix ---------- */
const VMIX_FUNCTIONS = new Set(['StartStreaming', 'StopStreaming', 'StartRecording', 'StopRecording', 'Cut', 'Fade', 'PreviewInput']);

async function vmixCall(query = '') {
  const { host, port } = privateData.streaming.vmix;
  if (!host) throw Object.assign(new Error('Adresse de vMix non configurée'), { status: 400 });
  let r;
  try {
    r = await fetch(`http://${host}:${port}/api/${query}`, { signal: AbortSignal.timeout(4000) });
  } catch {
    throw Object.assign(new Error(`vMix injoignable à ${host}:${port}. Vérifiez que vMix est ouvert, que l’API web est activée et que le pare-feu autorise le port.`), { status: 502 });
  }
  if (!r.ok) throw Object.assign(new Error(`vMix a répondu : erreur ${r.status}`), { status: 502 });
  return r.text();
}

const xmlDecode = (s) => s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const xmlTag = (xml, tag) => new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`).exec(xml)?.[1];
// <streaming>True</streaming> ou, selon les versions, <streaming channel1="True" …>
const xmlFlag = (xml, tag) => new RegExp(`<${tag}[^>]*>True<|<${tag}[^>]*="True"`).test(xml);

app.get('/api/vmix/status', streamingRoles, async (_req, res) => {
  try {
    const xml = await vmixCall();
    const inputs = [...xml.matchAll(/<input\s([^>]*)>/g)].map(([, attrs]) => {
      const attr = (n) => new RegExp(`\\b${n}="([^"]*)"`).exec(attrs)?.[1] || '';
      return { number: Number(attr('number')), title: xmlDecode(attr('title')), type: attr('type') };
    });
    res.json({
      version: xmlTag(xml, 'version'),
      edition: xmlTag(xml, 'edition'),
      streaming: xmlFlag(xml, 'streaming'),
      recording: xmlFlag(xml, 'recording'),
      active: Number(xmlTag(xml, 'active')),
      preview: Number(xmlTag(xml, 'preview')),
      inputs,
    });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

/**
 * Statut public du direct, pour le site : le flux de vMix arrive-t-il ? Aucune donnée confidentielle (ni adresse, ni clé). onAir = null si vMix n'est pas configuré ou injoignable.
 * vMix est interrogé au plus toutes les 10 s, quel que soit le nombre de visiteurs.
 */
let liveCache = { at: 0, value: null, pending: null };
async function liveStatus() {
  if (Date.now() - liveCache.at < 10_000) return liveCache.value;
  liveCache.pending ||= (async () => {
    // Le flux de vMix arrive-t-il sur MediaMTX ? Sans MediaMTX, on demande à vMix (même réseau local).
    let onAir = await pathReady(livePath());
    if (onAir === null && privateData.streaming.vmix.host) {
      try {
        onAir = xmlFlag(await vmixCall(), 'streaming');
      } catch {
        /* vMix éteint ou injoignable : statut inconnu */
      }
    }
    liveCache = { at: Date.now(), value: { onAir }, pending: null };
    return liveCache.value;
  })();
  return liveCache.pending;
}

app.get('/api/live', async (_req, res) => {
  res.set('Cache-Control', 'no-store').json(await liveStatus());
});

/**
 * MediaMTX demande ici si une connexion est autorisée (authMethod: http).
 * Lecture : libre (la vidéo n'est servie que sur 127.0.0.1, puis relayée par /hls/). Diffusion : seulement avec la bonne clé.
 */
const isLoopback = (ip = '') => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip);
app.post('/api/mediamtx/auth', (req, res) => {
  if (!isLoopback(req.socket.remoteAddress)) return res.status(403).end(); // seul MediaMTX, sur la même machine
  const { action, path: p = '' } = req.body || {};
  if (action === 'read' || action === 'playback') return res.status(200).end();
  const ok = action === 'publish' && sameSecret(p, livePath());
  if (ok) liveCache.at = 0;
  res.status(ok ? 200 : 401).end();
});

/** Check-liste de l'onglet Diffusion : relais démarré ? image de vMix reçue ? */
app.get('/api/selfhost/status', streamingRoles, async (_req, res) => {
  const { relay, paths } = await relayState();
  const mine = livePath();
  res.set('Cache-Control', 'no-store').json({
    relay,
    receiving: paths.some((p) => p.name === mine && p.ready),
    // vMix envoie ailleurs (ancienne adresse, mauvaise clé) : on l'indique sans révéler de clé
    elsewhere: paths.filter((p) => p.ready && p.name !== mine).map((p) => (p.name.startsWith('live/') ? 'live/(autre clé)' : p.name)),
    key: privateData.streaming.destinations.selfhost.key,
  });
});

/** Nouvelle clé (si l'ancienne a été divulguée) : à recopier ensuite dans vMix. */
app.post('/api/selfhost/key', streamingRoles, async (_req, res, next) => {
  try {
    const next_ = structuredClone(privateData);
    next_.streaming.destinations.selfhost.key = crypto.randomBytes(10).toString('hex');
    await writePrivate({ streaming: next_.streaming });
    res.json({ key: next_.streaming.destinations.selfhost.key });
  } catch (e) {
    next(e);
  }
});

app.post('/api/vmix/function', streamingRoles, async (req, res) => {
  const { name, input } = req.body || {};
  if (!VMIX_FUNCTIONS.has(name)) return res.status(400).json({ error: 'Commande vMix non autorisée' });
  const params = new URLSearchParams({ Function: name });
  if (input !== undefined) {
    if (!Number.isInteger(input) || input < 1) return res.status(400).json({ error: 'Numéro d’entrée invalide' });
    params.set('Input', String(input));
  }
  try {
    await vmixCall(`?${params}`);
    liveCache.at = 0; // le site voit tout de suite le début ou la fin du direct
    res.json({ ok: true });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

app.put('/api/data/:file', requireAuth, async (req, res, next) => {
  const { file } = req.params;
  if (!FILES.includes(file)) return res.status(404).json({ error: 'Fichier inconnu' });
  let error = validate(file, req.body);
  if (!error) error = await checkReferences(file, req.body);
  if (error) return res.status(400).json({ error });
  try {
    // Chaque rôle ne peut modifier que ses sections (ex. : le technicien régie, uniquement le lecteur du direct).
    const forbidden = canWriteFile(req.user, file, await readData(file), req.body);
    if (forbidden) return res.status(403).json({ error: forbidden });
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

app.get('/api/backups', requireRole('admin'), async (_req, res) => {
  const files = (await fs.readdir(BACKUP_DIR)).filter((f) => f.endsWith('.json')).sort().reverse();
  res.json(files);
});

app.post('/api/backups/:name/restore', requireRole('admin'), async (req, res, next) => {
  const m = /^(shows|schedule|content|settings)-[\dTZ-]+\.json$/.exec(req.params.name);
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
    const [{ shows }, settings] = await Promise.all([readData('shows'), readData('settings')]);
    res.type('application/xml').send(buildSitemap(shows, process.env.SITE_URL || settings.site.url).xml);
  } catch (e) {
    next(e);
  }
});

app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '30d', immutable: true }));

/* ---------- Vidéo du direct : MediaMTX (HLS) relayé sur /hls/, même adresse et même HTTPS que le site ---------- */
app.get(/^\/hls\/live\/(\w[\w.-]*)$/, async (req, res) => {
  const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  let r;
  try {
    // Les listes de lecture LL-HLS peuvent attendre le segment suivant : délai large
    r = await fetch(`${MEDIAMTX_HLS}/${livePath()}/${req.params[0]}${query}`, { signal: AbortSignal.timeout(15000) });
  } catch {
    return res.status(502).type('text').send('Direct indisponible');
  }
  res.status(r.status);
  for (const h of ['content-type', 'cache-control']) if (r.headers.get(h)) res.set(h, r.headers.get(h));
  if (!r.body) return res.end();
  Readable.fromWeb(r.body).on('error', () => res.destroy()).pipe(res);
});
app.use('/api', (_req, res) => res.status(404).json({ error: 'Route inconnue' }));

/* ---------- Site compilé (production) ---------- */
if (existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR, { index: false, maxAge: '1h' }));
  app.get('*', async (req, res, next) => {
    try {
      const [html, settings, content] = await Promise.all([fs.readFile(path.join(DIST_DIR, 'index.html'), 'utf8'), readData('settings'), readData('content')]);
      res.set('Cache-Control', 'no-cache').type('html').send(renderIndex(html, settings, content, req.path));
    } catch (e) {
      next(e);
    }
  });
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Erreur serveur' });
});

// Première utilisation : clé du direct auto-hébergé créée automatiquement
if (!privateData.streaming.destinations.selfhost.key) {
  const streaming = structuredClone(privateData.streaming);
  streaming.destinations.selfhost = { ...streaming.destinations.selfhost, enabled: true, key: crypto.randomBytes(10).toString('hex') };
  await writePrivate({ streaming });
}

app.listen(PORT, () => {
  console.log(`Serveur Hope Chanel RDC : http://localhost:${PORT}`);
  startMediamtx({ root: ROOT, port: PORT });
});
