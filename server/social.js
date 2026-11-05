/**
 * Synchronisation automatique des réseaux sociaux → site.
 *
 * - YouTube : flux public de la chaîne (aucune clé nécessaire). L'adresse de la chaîne est reprise
 *   de Paramètres → Réseaux sociaux si elle n'est pas saisie ici.
 * - Facebook (page) et Instagram (compte professionnel) : API Graph de Meta, avec un jeton d'accès.
 *
 * Réglages, jetons et contenus importés sont dans db/social.json (jamais sur GitHub, jamais envoyé aux visiteurs).
 * Chaque contenu importé est « publié » (visible sur le site), « à valider » ou « masqué ».
 */
import express from 'express';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

export const NETWORKS = ['youtube', 'facebook', 'instagram'];
const GRAPH = 'https://graph.facebook.com/v21.0';
const MAX_ITEMS = 300;
const STATUSES = ['published', 'pending', 'hidden'];

const DEFAULT_CONFIG = {
  intervalMinutes: 30,
  youtube: { enabled: false, channel: '', channelId: '', mode: 'published' },
  facebook: { enabled: false, pageId: '', token: '', mode: 'pending' },
  instagram: { enabled: false, userId: '', token: '', mode: 'pending' },
};

const decodeXml = (s = '') =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

const firstLine = (text = '', max = 120) => {
  const line = text.split('\n').map((l) => l.trim()).find(Boolean) || '';
  return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line;
};

const isHttps = (u) => typeof u === 'string' && /^https:\/\/\S+$/.test(u);

async function fetchText(url, init = {}) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
  const body = await res.text();
  if (!res.ok) {
    let msg = `Erreur ${res.status}`;
    try {
      msg = JSON.parse(body).error?.message || msg; // message de l'API Graph de Meta
    } catch {
      /* réponse non JSON */
    }
    throw new Error(msg);
  }
  return body;
}

/* ---------------------------------------------------------------- YouTube */

/** Identifiant de chaîne (UC…) à partir d'une adresse : /channel/UC…, /@nom, /c/nom, /user/nom. */
async function resolveYoutubeChannel(url) {
  const direct = /youtube\.com\/channel\/(UC[\w-]{22})/.exec(url)?.[1];
  if (direct) return direct;
  if (!/^https:\/\/(www\.|m\.)?youtube\.com\/(@[\w.-]+|c\/[\w.-]+|user\/[\w.-]+)/.test(url)) {
    throw new Error('Adresse de chaîne YouTube non reconnue (ex. : https://www.youtube.com/@MaChaine)');
  }
  // Le cookie SOCS évite la page de consentement servie aux serveurs situés en Europe.
  const html = await fetchText(url, { headers: { 'Accept-Language': 'fr', Cookie: 'SOCS=CAI', 'User-Agent': 'Mozilla/5.0' } });
  const id = /"externalId":"(UC[\w-]{22})"/.exec(html)?.[1] || /<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})"/.exec(html)?.[1] || /"channelId":"(UC[\w-]{22})"/.exec(html)?.[1];
  if (!id) throw new Error('Chaîne YouTube introuvable à cette adresse');
  return id;
}

async function fetchYoutube(channelId) {
  const xml = await fetchText(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`);
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, e]) => {
    const tag = (name) => decodeXml(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`).exec(e)?.[1] || '').trim();
    const videoId = tag('yt:videoId');
    return {
      id: videoId,
      type: 'video',
      videoId,
      title: tag('title'),
      text: tag('media:description'),
      url: `https://www.youtube.com/watch?v=${videoId}`,
      remoteImage: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      date: tag('published'),
    };
  }).filter((v) => /^[\w-]{11}$/.test(v.id));
}

/* ---------------------------------------------------------------- Meta (Facebook, Instagram) */

async function fetchFacebook({ pageId, token }) {
  const q = new URLSearchParams({ fields: 'id,message,created_time,permalink_url,full_picture,status_type', limit: '25', access_token: token });
  const { data = [] } = JSON.parse(await fetchText(`${GRAPH}/${encodeURIComponent(pageId)}/posts?${q}`));
  return data
    .filter((p) => p.message || p.full_picture)
    .map((p) => ({
      id: p.id,
      type: /video/.test(p.status_type || '') ? 'video' : 'post',
      title: firstLine(p.message),
      text: p.message || '',
      url: isHttps(p.permalink_url) ? p.permalink_url : `https://www.facebook.com/${p.id}`,
      remoteImage: p.full_picture,
      date: p.created_time,
    }));
}

async function fetchInstagram({ userId, token }) {
  const q = new URLSearchParams({ fields: 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp', limit: '25', access_token: token });
  const { data = [] } = JSON.parse(await fetchText(`${GRAPH}/${encodeURIComponent(userId)}/media?${q}`));
  return data.map((m) => ({
    id: m.id,
    type: m.media_type === 'VIDEO' ? 'video' : 'post',
    title: firstLine(m.caption),
    text: m.caption || '',
    url: m.permalink,
    remoteImage: m.media_type === 'VIDEO' ? m.thumbnail_url : m.media_url,
    date: m.timestamp,
  }));
}

/* ---------------------------------------------------------------- Module */

export function createSocial({ dbDir, uploadDir, requireRole, getContentSocial, onArticle }) {
  const FILE = path.join(dbDir, 'social.json');
  const IMG_DIR = path.join(uploadDir, 'social');
  if (!existsSync(IMG_DIR)) mkdirSync(IMG_DIR, { recursive: true });

  let state = { config: structuredClone(DEFAULT_CONFIG), items: [], status: {}, lastSync: null };
  try {
    const saved = JSON.parse(readFileSync(FILE, 'utf8'));
    state = { ...state, ...saved, config: Object.fromEntries(Object.entries(DEFAULT_CONFIG).map(([k, v]) => [k, typeof v === 'object' ? { ...v, ...saved.config?.[k] } : saved.config?.[k] ?? v])) };
  } catch {
    /* première utilisation */
  }

  let saving = Promise.resolve();
  const save = () =>
    (saving = saving.catch(() => {}).then(async () => {
      const tmp = FILE + '.tmp';
      await fs.writeFile(tmp, JSON.stringify(state, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
      await fs.rename(tmp, FILE);
    }));

  /** Copie locale des images Facebook / Instagram (leurs adresses expirent au bout de quelques jours). */
  async function keepImage(network, id, url) {
    if (!isHttps(url)) return '';
    if (network === 'youtube') return url; // adresses i.ytimg.com permanentes
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      const type = res.headers.get('content-type') || '';
      if (!res.ok || !/^image\/(jpeg|png|webp)/.test(type)) return '';
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > 5 * 1024 * 1024) return '';
      const name = `${network}-${id.replace(/[^\w-]/g, '_')}.${type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg'}`;
      await fs.writeFile(path.join(IMG_DIR, name), buf);
      return `/uploads/social/${name}`;
    } catch {
      return '';
    }
  }

  async function syncNetwork(network, contentSocial) {
    const c = state.config[network];
    let fetched;
    if (network === 'youtube') {
      const channel = (c.channel || contentSocial?.youtube || '').trim();
      if (!channel || /^https:\/\/(www\.)?youtube\.com\/?$/.test(channel)) throw new Error('Indiquez l’adresse de la chaîne YouTube');
      if (!c.channelId || c.resolvedFrom !== channel) {
        c.channelId = await resolveYoutubeChannel(channel);
        c.resolvedFrom = channel;
      }
      fetched = await fetchYoutube(c.channelId);
    } else if (network === 'facebook') {
      if (!c.pageId || !c.token) throw new Error('Identifiant de la page et jeton d’accès requis');
      fetched = await fetchFacebook(c);
    } else {
      if (!c.userId || !c.token) throw new Error('Identifiant du compte et jeton d’accès requis');
      fetched = await fetchInstagram(c);
    }
    let added = 0;
    for (const f of fetched) {
      const key = `${network}:${f.id}`;
      const existing = state.items.find((i) => i.key === key);
      const { remoteImage, ...data } = f;
      if (existing) {
        // Texte mis à jour sur le réseau : on le reprend, sans toucher au statut choisi dans l'administration
        Object.assign(existing, { title: data.title, text: data.text, url: data.url });
        continue;
      }
      const date = Number.isNaN(Date.parse(data.date)) ? new Date().toISOString() : new Date(data.date).toISOString();
      state.items.push({ key, network, ...data, date, image: await keepImage(network, f.id, remoteImage), status: c.mode, importedAt: new Date().toISOString() });
      added++;
    }
    return { count: fetched.length, added };
  }

  let running = null;
  /** Synchronise tous les réseaux activés. Une seule synchronisation à la fois. */
  function syncAll() {
    running ||= (async () => {
      const contentSocial = await getContentSocial();
      for (const n of NETWORKS) {
        if (!state.config[n].enabled) continue;
        try {
          const r = await syncNetwork(n, contentSocial);
          state.status[n] = { ok: true, at: new Date().toISOString(), ...r };
        } catch (e) {
          state.status[n] = { ok: false, at: new Date().toISOString(), error: e.name === 'TimeoutError' ? 'Le réseau ne répond pas (délai dépassé)' : e.message };
        }
      }
      state.items.sort((a, b) => b.date.localeCompare(a.date));
      if (state.items.length > MAX_ITEMS) state.items = state.items.slice(0, MAX_ITEMS);
      state.lastSync = new Date().toISOString();
      await save();
    })().finally(() => (running = null));
    return running;
  }

  /** Synchronisation automatique (première au bout d'une minute, puis selon l'intervalle choisi). */
  let timer;
  function schedule(delay = 60_000) {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      if (NETWORKS.some((n) => state.config[n].enabled)) await syncAll().catch(() => {});
      schedule(state.config.intervalMinutes * 60_000);
    }, delay);
    timer.unref?.();
  }

  /** Réglages sans les jetons (seulement « jeton enregistré : oui / non »). */
  const publicConfig = () =>
    Object.fromEntries(Object.entries(state.config).map(([k, v]) => [k, typeof v === 'object' ? { ...v, token: undefined, tokenSet: Boolean(v.token), resolvedFrom: undefined } : v]));
  const adminState = () => ({ config: publicConfig(), items: state.items, status: state.status, lastSync: state.lastSync, syncing: Boolean(running) });

  function validateConfig(c) {
    if (!c || typeof c !== 'object') return 'Réglages invalides';
    if (!Number.isInteger(c.intervalMinutes) || c.intervalMinutes < 15 || c.intervalMinutes > 1440) return 'Intervalle : entre 15 minutes et 24 heures';
    for (const n of NETWORKS) {
      const x = c[n];
      if (!x || typeof x.enabled !== 'boolean' || !['published', 'pending'].includes(x.mode)) return `Réglages ${n} invalides`;
    }
    if (c.youtube.channel && !/^https:\/\/(www\.|m\.)?youtube\.com\/\S+$/.test(c.youtube.channel.trim())) return 'L’adresse de la chaîne YouTube doit commencer par https://www.youtube.com/';
    if (c.facebook.pageId && !/^[\w.-]{1,100}$/.test(c.facebook.pageId.trim())) return 'Identifiant de page Facebook invalide';
    if (c.instagram.userId && !/^\d{5,30}$/.test(c.instagram.userId.trim())) return 'Identifiant Instagram invalide (nombre)';
    for (const n of ['facebook', 'instagram']) if (c[n].token && (typeof c[n].token !== 'string' || c[n].token.length > 1000 || /\s/.test(c[n].token.trim()))) return `Jeton ${n} invalide`;
    return null;
  }

  const router = express.Router();
  const team = requireRole('admin', 'editor');

  // Public : contenus publiés, du plus récent au plus ancien (aucun jeton, aucun contenu à valider ou masqué)
  router.get('/social/feed', (req, res) => {
    const network = NETWORKS.includes(req.query.network) ? req.query.network : null;
    const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 60);
    const items = state.items
      .filter((i) => i.status === 'published' && (!network || i.network === network))
      .slice(0, limit)
      .map(({ key, network: n, type, title, text, url, image, date, videoId }) => ({ key, network: n, type, title, text: text.slice(0, 400), url, image, date, videoId }));
    res.set('Cache-Control', 'public, max-age=60').json({ items, networks: NETWORKS.filter((n) => state.items.some((i) => i.network === n && i.status === 'published')) });
  });

  router.get('/social', team, (_req, res) => res.set('Cache-Control', 'no-store').json(adminState()));

  router.put('/social/config', requireRole('admin'), async (req, res) => {
    const next = req.body;
    const error = validateConfig(next);
    if (error) return res.status(400).json({ error });
    const config = { intervalMinutes: next.intervalMinutes };
    for (const n of NETWORKS) {
      const old = state.config[n];
      const x = next[n];
      config[n] = { ...old, enabled: x.enabled, mode: x.mode };
      if (n === 'youtube') config.youtube.channel = (x.channel || '').trim();
      if (n === 'facebook') config.facebook.pageId = (x.pageId || '').trim();
      if (n === 'instagram') config.instagram.userId = (x.userId || '').trim();
      // Jeton : vide = garder l'ancien ; « clearToken » = l'effacer
      if (n !== 'youtube') config[n].token = x.clearToken ? '' : (x.token || '').trim() || old.token;
    }
    state.config = config;
    await save();
    res.json(adminState());
  });

  router.post('/social/sync', team, async (_req, res, next) => {
    try {
      await syncAll();
      res.json(adminState());
    } catch (e) {
      next(e);
    }
  });

  router.patch('/social/items/:key', team, async (req, res) => {
    const item = state.items.find((i) => i.key === req.params.key);
    if (!item) return res.status(404).json({ error: 'Contenu introuvable' });
    if (!STATUSES.includes(req.body?.status)) return res.status(400).json({ error: 'Statut inconnu' });
    item.status = req.body.status;
    await save();
    res.json(adminState());
  });

  // Transforme un contenu importé en article (brouillon) pour le compléter avant publication
  router.post('/social/items/:key/article', team, async (req, res, next) => {
    const item = state.items.find((i) => i.key === req.params.key);
    if (!item) return res.status(404).json({ error: 'Contenu introuvable' });
    try {
      const slug = await onArticle(item);
      item.articleSlug = slug;
      await save();
      res.json({ ...adminState(), slug });
    } catch (e) {
      next(e);
    }
  });

  /** Titre d'une vidéo YouTube synchronisée (rapports d'audience). */
  const videoTitle = (videoId) => state.items.find((i) => i.network === 'youtube' && i.videoId === videoId)?.title || '';

  return { router, schedule, syncAll, videoTitle };
}
