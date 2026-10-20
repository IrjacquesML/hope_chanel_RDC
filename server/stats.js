// Statistiques de visionnage anonymes, stockées dans SQLite (intégré à Node.js).
// Aucun cookie : un visiteur est identifié par un hachage (IP + navigateur + sel du jour),
// le sel change chaque jour et n'est jamais stocké en base -> impossible de suivre quelqu'un d'un jour à l'autre.
import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const TZ_OFFSET_MS = 3600_000; // Kinshasa = UTC+1, sans heure d'été
const RETENTION_DAYS = 400;
const TYPES = new Set(['pageview', 'play', 'watch']);
const BOT = /bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|whatsapp\/|curl|wget/i;

export function createStats(rootDir) {
  const dir = path.join(rootDir, 'db');
  mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(path.join(dir, 'stats.sqlite'));
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY,
      ts INTEGER NOT NULL,          -- horodatage UTC (ms)
      day TEXT NOT NULL,            -- AAAA-MM-JJ, heure de Kinshasa
      hour INTEGER NOT NULL,        -- 0-23, heure de Kinshasa
      type TEXT NOT NULL,           -- pageview | play | watch
      path TEXT,                    -- page du site
      target TEXT,                  -- 'live' ou identifiant d'épisode
      seconds INTEGER DEFAULT 0,    -- secondes regardées (type watch)
      visitor TEXT NOT NULL,        -- hachage anonyme, valable un jour
      device TEXT,                  -- mobile | tablette | ordinateur
      source TEXT,                  -- site d'origine (whatsapp, facebook, google…)
      lang TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_events_day ON events(day, type);
    CREATE INDEX IF NOT EXISTS idx_events_target ON events(target, type);
  `);
  db.prepare('DELETE FROM events WHERE ts < ?').run(Date.now() - RETENTION_DAYS * 86_400_000);

  const insert = db.prepare(
    'INSERT INTO events (ts, day, hour, type, path, target, seconds, visitor, device, source, lang) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  );

  let salt = { day: '', value: '' };
  const visitorId = (ip, ua, day) => {
    if (salt.day !== day) salt = { day, value: crypto.randomBytes(16).toString('hex') };
    return crypto.createHash('sha256').update(`${salt.value}|${ip}|${ua}`).digest('hex').slice(0, 16);
  };

  const localParts = (ts) => {
    const d = new Date(ts + TZ_OFFSET_MS);
    return { day: d.toISOString().slice(0, 10), hour: d.getUTCHours() };
  };

  const deviceOf = (ua) => (/ipad|tablet/i.test(ua) ? 'tablette' : /mobi|android|iphone/i.test(ua) ? 'mobile' : 'ordinateur');

  function sourceOf(ref, host) {
    if (!ref) return 'direct';
    try {
      const h = new URL(ref).hostname.replace(/^(www\.|m\.|l\.|lm\.)/, '');
      if (h === host) return null; // navigation interne
      if (/whatsapp|wa\.me/.test(h)) return 'whatsapp';
      if (/facebook|fb\./.test(h)) return 'facebook';
      if (/instagram/.test(h)) return 'instagram';
      if (/^(t\.co|x\.com|twitter)/.test(h)) return 'x';
      if (/youtube|youtu\.be/.test(h)) return 'youtube';
      if (/google\./.test(h)) return 'google';
      if (/bing\.|duckduckgo|yahoo/.test(h)) return 'autre moteur';
      return h.slice(0, 60);
    } catch {
      return 'direct';
    }
  }

  /** Enregistre un événement envoyé par le navigateur. Renvoie false si ignoré. */
  function track(body, { ip, ua, host }) {
    if (!body || !TYPES.has(body.type) || BOT.test(ua || '')) return false;
    const p = typeof body.path === 'string' ? body.path.slice(0, 200) : '';
    if (p.startsWith('/admin')) return false;
    const target = typeof body.target === 'string' ? body.target.slice(0, 80) : null;
    if ((body.type === 'play' || body.type === 'watch') && !target) return false;
    const seconds = body.type === 'watch' ? Math.max(0, Math.min(120, Math.round(Number(body.seconds) || 0))) : 0;
    if (body.type === 'watch' && seconds === 0) return false;
    const ts = Date.now();
    const { day, hour } = localParts(ts);
    const source = body.type === 'pageview' && body.first ? sourceOf(body.referrer, host) : null;
    const lang = body.lang === 'en' ? 'en' : 'fr';
    insert.run(ts, day, hour, body.type, p, target, seconds, visitorId(ip, ua, day), deviceOf(ua || ''), source, lang);
    return true;
  }

  /** Agrégats pour le tableau de bord de l'admin, sur les `days` derniers jours. */
  function report(days) {
    const n = [7, 30, 90, 365].includes(days) ? days : 30;
    const today = localParts(Date.now()).day;
    const dayMinus = (k) => new Date(Date.parse(today) - k * 86_400_000).toISOString().slice(0, 10);
    const from = dayMinus(n - 1);
    const prevFrom = dayMinus(2 * n - 1);
    const prevTo = dayMinus(n);

    const totalsSql = `
      SELECT
        SUM(type = 'pageview') AS pageviews,
        (SELECT COUNT(*) FROM (SELECT DISTINCT day, visitor FROM events WHERE day BETWEEN ?1 AND ?2)) AS visitors,
        SUM(type = 'play') AS plays,
        SUM(CASE WHEN type = 'play' AND target = 'live' THEN 1 ELSE 0 END) AS livePlays,
        SUM(seconds) AS watchSeconds,
        SUM(CASE WHEN target = 'live' THEN seconds ELSE 0 END) AS liveSeconds
      FROM events WHERE day BETWEEN ?1 AND ?2`;
    const totals = (a, b) => {
      const r = db.prepare(totalsSql).get(a, b);
      return Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Number(v) || 0]));
    };

    const rows = db.prepare(`
      SELECT day,
        SUM(type = 'pageview') AS pageviews,
        COUNT(DISTINCT visitor) AS visitors,
        SUM(type = 'play') AS plays,
        SUM(seconds) AS watchSeconds
      FROM events WHERE day BETWEEN ? AND ? GROUP BY day`).all(from, today);
    const byDay = new Map(rows.map((r) => [r.day, r]));
    const daily = Array.from({ length: n }, (_, i) => {
      const day = dayMinus(n - 1 - i);
      const r = byDay.get(day);
      return { day, pageviews: r?.pageviews || 0, visitors: r?.visitors || 0, plays: r?.plays || 0, watchSeconds: r?.watchSeconds || 0 };
    });

    const content = db.prepare(`
      SELECT target,
        SUM(type = 'play') AS plays,
        SUM(seconds) AS watchSeconds,
        COUNT(DISTINCT day || visitor) AS viewers
      FROM events WHERE day BETWEEN ? AND ? AND type IN ('play', 'watch')
      GROUP BY target ORDER BY watchSeconds DESC, plays DESC LIMIT 50`).all(from, today);

    const pages = db.prepare(`
      SELECT path, COUNT(*) AS views, COUNT(DISTINCT day || visitor) AS visitors
      FROM events WHERE day BETWEEN ? AND ? AND type = 'pageview'
      GROUP BY path ORDER BY views DESC LIMIT 15`).all(from, today);

    const hourRows = db.prepare(`
      SELECT hour, SUM(seconds) AS watchSeconds FROM events
      WHERE day BETWEEN ? AND ? AND type = 'watch' AND target = 'live' GROUP BY hour`).all(from, today);
    const hourly = Array.from({ length: 24 }, (_, h) => ({ hour: h, watchSeconds: hourRows.find((r) => r.hour === h)?.watchSeconds || 0 }));

    const split = (col, extra = '') =>
      db.prepare(`
        SELECT ${col} AS key, COUNT(DISTINCT day || visitor) AS visitors FROM events
        WHERE day BETWEEN ? AND ? AND ${col} IS NOT NULL ${extra}
        GROUP BY ${col} ORDER BY visitors DESC LIMIT 10`).all(from, today);

    const liveNow = db.prepare(`
      SELECT COUNT(DISTINCT visitor) AS n FROM events
      WHERE type = 'watch' AND target = 'live' AND ts > ?`).get(Date.now() - 90_000).n;

    return {
      days: n,
      from,
      to: today,
      totals: totals(from, today),
      previous: totals(prevFrom, prevTo),
      daily,
      content,
      pages,
      hourly,
      devices: split('device'),
      sources: split('source', "AND type = 'pageview'"),
      langs: split('lang'),
      liveNow,
    };
  }

  return { track, report };
}
