import showsData from './data/shows.json';
import scheduleData from './data/schedule.json';
import contentData from './data/content.json';
import settingsData from './data/settings.json';

export const { shows, episodes, categories } = showsData;

/** Visiteur courant : admin = connecté à l'administration (voit le site même en maintenance). */
export const viewer = { admin: false };

/**
 * Remplace les données intégrées au build par celles du serveur (modifiées via /admin).
 * Les objets sont mutés sur place : tous les modules qui les importent voient la version à jour.
 */
export async function hydrateData() {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch('/api/data', { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return;
    const remote = await res.json();
    viewer.admin = Boolean(remote.viewer?.admin);
    const targets = { shows: showsData, schedule: scheduleData, content: contentData, settings: settingsData };
    for (const [file, target] of Object.entries(targets)) {
      if (!remote[file]) continue;
      for (const [key, value] of Object.entries(remote[file])) {
        if (Array.isArray(target[key]) && Array.isArray(value)) target[key].splice(0, target[key].length, ...value);
        else target[key] = value;
      }
    }
  } catch {
    /* pas de serveur (hébergement statique) : on garde les données du build */
  }
}

/**
 * Analyse l'URL d'intégration Jet-Stream collée par l'administrateur.
 * Accepte l'URL seule ou le code <iframe src="…"> complet. Renvoie l'URL https ou null.
 */
export function parseEmbedUrl(input) {
  const raw = (input || '').trim();
  if (!raw) return null;
  const src = raw.match(/src\s*=\s*["']([^"']+)["']/i)?.[1] || raw;
  try {
    const url = new URL(src.startsWith('//') ? `https:${src}` : src);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

/** Flux HLS du serveur du site (MediaMTX relayé par server/index.js). */
export const SELF_HOSTED_HLS = '/hls/live/index.m3u8';

/**
 * Source du direct vMix, sans YouTube : serveur du site (MediaMTX), sinon lecteur Jet-Stream intégré, sinon flux HLS (.m3u8).
 */
export function liveSource(live) {
  if (live.selfHosted) return { type: 'hls', src: SELF_HOSTED_HLS };
  const embed = parseEmbedUrl(live.jetstreamEmbedUrl);
  if (embed) return { type: 'embed', src: embed };
  if (live.hlsUrl) return { type: 'hls', src: live.hlsUrl };
  return null;
}

export const getShow = (slug) => shows.find((s) => s.slug === slug);

export const getSortedEpisodes = () => [...episodes].sort((a, b) => b.date.localeCompare(a.date));

export function categoryLabel(id, lang) {
  const c = categories.find((x) => x.id === id);
  return c ? c.label[lang] || c.label.fr : id;
}

/** URL d'image Unsplash optimisée (WebP, recadrée). */
export function img(id, w = 800, ratio = 16 / 9) {
  if (!id) return '';
  if (id.startsWith('http') || id.startsWith('/')) return id;
  const h = Math.round(w / ratio);
  return `https://images.unsplash.com/${id}?auto=format&fm=webp&fit=crop&w=${w}&h=${h}&q=70`;
}

export function srcSet(id, ratio = 16 / 9, widths = [400, 800, 1200]) {
  if (!id || id.startsWith('http') || id.startsWith('/')) return undefined;
  return widths.map((w) => `${img(id, w, ratio)} ${w}w`).join(', ');
}

/** Date/heure courante à Kinshasa (UTC+1, pas d'heure d'été). */
export function kinshasaNow() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: scheduleData.timezone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type)?.value;
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return { dayIndex: days.indexOf(get('weekday')), time: `${get('hour')}:${get('minute')}` };
}

export function scheduleForDay(dayIndex) {
  return scheduleData.templates[scheduleData.week[dayIndex]];
}

export function isOnAir(slot, time) {
  return time >= slot.start && time < slot.end;
}

export function formatDate(iso, lang, opts = { day: 'numeric', month: 'long', year: 'numeric' }) {
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'fr-FR', opts).format(new Date(iso + 'T12:00:00'));
}
