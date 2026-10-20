import showsData from './data/shows.json';
import scheduleData from './data/schedule.json';
import contentData from './data/content.json';

export const { shows, episodes, categories } = showsData;

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
    const targets = { shows: showsData, schedule: scheduleData, content: contentData };
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
 * Analyse un lien YouTube collé par l'administrateur.
 * Reconnaît : watch?v=ID, youtu.be/ID, /live/ID, /embed/ID, /shorts/ID, /channel/UC…
 * Renvoie { videoId } | { channelId } | { handle } (non intégrable) | null.
 */
export function parseYouTube(input) {
  const raw = (input || '').trim();
  if (!raw) return null;
  if (/^[\w-]{11}$/.test(raw)) return { videoId: raw };
  let url;
  try {
    url = new URL(/^https?:\/\//.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www\.|m\.)/, '');
  const parts = url.pathname.split('/').filter(Boolean);
  if (host === 'youtu.be' && /^[\w-]{11}$/.test(parts[0] || '')) return { videoId: parts[0] };
  if (!['youtube.com', 'youtube-nocookie.com'].includes(host)) return null;
  const v = url.searchParams.get('v');
  if (v && /^[\w-]{11}$/.test(v)) return { videoId: v };
  if (['live', 'embed', 'shorts'].includes(parts[0]) && /^[\w-]{11}$/.test(parts[1] || '')) return { videoId: parts[1] };
  if (parts[0] === 'channel' && /^UC[\w-]{22}$/.test(parts[1] || '')) return { channelId: parts[1] };
  if (parts[0]?.startsWith('@')) return { handle: parts[0] };
  return null;
}

/** URL d'intégration du direct selon la configuration (lien YouTube > flux HLS > identifiant de chaîne). */
export function liveSource(live) {
  const yt = parseYouTube(live.youtubeUrl);
  if (yt?.videoId) return { type: 'youtube', src: `https://www.youtube-nocookie.com/embed/${yt.videoId}?autoplay=1` };
  if (yt?.channelId) return { type: 'youtube', src: `https://www.youtube-nocookie.com/embed/live_stream?channel=${yt.channelId}&autoplay=1` };
  if (live.hlsUrl) return { type: 'hls', src: live.hlsUrl };
  if (live.youtubeChannelId) return { type: 'youtube', src: `https://www.youtube-nocookie.com/embed/live_stream?channel=${live.youtubeChannelId}&autoplay=1` };
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
