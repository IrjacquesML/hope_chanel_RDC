// Mesure d'audience anonyme (sans cookie). Les données partent vers /api/track.
const ENDPOINT = '/api/track';
const HEARTBEAT_MS = 30_000;
const disabled = typeof navigator !== 'undefined' && (navigator.doNotTrack === '1' || window.doNotTrack === '1');
let firstPageview = true;

function send(event) {
  if (disabled) return;
  const body = JSON.stringify({ ...event, path: location.pathname, lang: document.documentElement.lang });
  // text/plain : envoi simple, compatible sendBeacon (fonctionne même quand on quitte la page)
  const blob = new Blob([body], { type: 'text/plain' });
  if (!navigator.sendBeacon?.(ENDPOINT, blob)) {
    fetch(ENDPOINT, { method: 'POST', body: blob, keepalive: true }).catch(() => {});
  }
}

export function trackPageview() {
  if (location.pathname.startsWith('/admin')) return;
  send({ type: 'pageview', first: firstPageview, referrer: firstPageview ? document.referrer : undefined });
  firstPageview = false;
}

/**
 * Suit la lecture d'un contenu ('live' ou identifiant d'épisode) :
 * un « play » au premier démarrage, puis le temps réellement regardé, envoyé toutes les 30 s.
 */
export function createWatchTracker(target) {
  let playingSince = null;
  let pending = 0;
  let played = false;
  let timer = null;

  const accumulate = () => {
    if (playingSince) {
      pending += (Date.now() - playingSince) / 1000;
      playingSince = Date.now();
    }
  };
  const flush = () => {
    accumulate();
    const seconds = Math.round(pending);
    if (seconds >= 1) {
      send({ type: 'watch', target, seconds: Math.min(seconds, 120) });
      pending = 0;
    }
  };
  const onHide = () => document.visibilityState === 'hidden' && flush();

  return {
    playing() {
      if (!played) {
        played = true;
        send({ type: 'play', target });
      }
      if (playingSince) return;
      playingSince = Date.now();
      timer = setInterval(flush, HEARTBEAT_MS);
      document.addEventListener('visibilitychange', onHide);
      window.addEventListener('pagehide', flush);
    },
    paused() {
      flush();
      playingSince = null;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flush);
    },
  };
}

/* ---------- Lecteur YouTube ---------- */
let ytApi;
function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!ytApi) {
    ytApi = new Promise((resolve) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        resolve(window.YT);
      };
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.async = true;
      document.head.appendChild(s);
    });
  }
  return ytApi;
}

/** Ajoute à une URL d'intégration YouTube les paramètres nécessaires au suivi. */
export const withYouTubeApi = (src) => `${src}${src.includes('?') ? '&' : '?'}enablejsapi=1&origin=${encodeURIComponent(location.origin)}`;

/** Branche le suivi sur une iframe YouTube (son URL doit contenir enablejsapi=1). Renvoie une fonction de nettoyage. */
export function trackYouTubeIframe(iframe, target) {
  if (!iframe || disabled) return () => {};
  const tracker = createWatchTracker(target);
  let player;
  let cancelled = false;
  loadYouTubeApi().then((YT) => {
    if (cancelled) return;
    player = new YT.Player(iframe, {
      events: {
        onStateChange: (e) => (e.data === YT.PlayerState.PLAYING ? tracker.playing() : tracker.paused()),
      },
    });
  });
  return () => {
    // Pas de player.destroy() : l'iframe appartient à React, qui la retire lui-même.
    cancelled = true;
    tracker.paused();
    void player;
  };
}

/** Branche le suivi sur un élément <video> (flux HLS). */
export function trackVideoElement(video, target) {
  if (!video || disabled) return () => {};
  const tracker = createWatchTracker(target);
  const onPlay = () => tracker.playing();
  const onStop = () => tracker.paused();
  video.addEventListener('playing', onPlay);
  ['pause', 'ended', 'waiting', 'error'].forEach((ev) => video.addEventListener(ev, onStop));
  return () => {
    tracker.paused();
    video.removeEventListener('playing', onPlay);
    ['pause', 'ended', 'waiting', 'error'].forEach((ev) => video.removeEventListener(ev, onStop));
  };
}
