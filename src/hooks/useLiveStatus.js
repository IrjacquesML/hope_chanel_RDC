import { useEffect, useState } from 'react';

const POLL_MS = 30_000;
let state = { onAir: null };
const listeners = new Set();
let timer = null;

async function poll() {
  try {
    const res = await fetch('/api/live', { cache: 'no-store' });
    if (res.ok) state = await res.json();
  } catch {
    /* pas de serveur (hébergement statique) : statut inconnu */
  }
  listeners.forEach((fn) => fn(state));
}

/**
 * Statut du direct lancé depuis vMix : { onAir: true | false | null }.
 * onAir vaut null quand vMix n'est pas relié au site. Un seul appel toutes les 30 s pour toute la page.
 */
export function useLiveStatus() {
  const [live, setLive] = useState(state);
  useEffect(() => {
    listeners.add(setLive);
    if (!timer) {
      poll();
      timer = setInterval(poll, POLL_MS);
    }
    return () => {
      listeners.delete(setLive);
      if (!listeners.size) {
        clearInterval(timer);
        timer = null;
      }
    };
  }, []);
  return live;
}
