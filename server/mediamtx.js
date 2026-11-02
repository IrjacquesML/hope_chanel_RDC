// MediaMTX : relais vMix (RTMP) → HLS pour le lecteur du site. Démarré automatiquement par le serveur.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';

export const MEDIAMTX_HLS = (process.env.MEDIAMTX_HLS || 'http://127.0.0.1:8888').replace(/\/+$/, '');
export const MEDIAMTX_API = (process.env.MEDIAMTX_API || 'http://127.0.0.1:9997').replace(/\/+$/, '');

const exe = process.platform === 'win32' ? 'mediamtx.exe' : 'mediamtx';

/** Emplacements habituels de l'exécutable : variable MEDIAMTX_BIN, dossier mediamtx/ du projet, C:\mediamtx, /usr/local/bin. */
function findBinary(root) {
  const candidates = [
    process.env.MEDIAMTX_BIN,
    path.join(root, 'mediamtx', exe),
    process.platform === 'win32' ? 'C:\\mediamtx\\mediamtx.exe' : '/usr/local/bin/mediamtx',
    process.platform === 'win32' ? null : '/usr/bin/mediamtx',
  ];
  return candidates.find((p) => p && existsSync(p)) || null;
}

const portOpen = (port) =>
  new Promise((resolve) => {
    const s = net.connect({ port, host: '127.0.0.1' });
    s.setTimeout(800);
    s.once('connect', () => (s.destroy(), resolve(true)));
    s.once('timeout', () => (s.destroy(), resolve(false)));
    s.once('error', () => resolve(false));
  });

async function api(route) {
  const r = await fetch(`${MEDIAMTX_API}${route}`, { signal: AbortSignal.timeout(2000) });
  return r.ok ? r.json() : null;
}

/**
 * État du relais, pour la check-liste de l'administration :
 * - 'ok'      : MediaMTX tourne avec la configuration du projet ;
 * - 'other'   : un autre MediaMTX (lancé à la main, sans la configuration) occupe le port 1935 ;
 * - 'missing' : MediaMTX n'est pas installé / pas démarré.
 * paths : flux reçus en ce moment ({ name, ready }).
 */
export async function relayState() {
  try {
    const list = await api('/v3/paths/list');
    if (list) return { relay: 'ok', paths: (list.items || []).map((p) => ({ name: p.name, ready: Boolean(p.ready) })) };
  } catch {
    /* API injoignable */
  }
  return { relay: (await portOpen(1935)) ? 'other' : 'missing', paths: [] };
}

/** Le flux de chemin `name` arrive-t-il ? true / false, ou null si MediaMTX ne répond pas. */
export async function pathReady(name) {
  try {
    const r = await fetch(`${MEDIAMTX_API}/v3/paths/get/${name}`, { signal: AbortSignal.timeout(2000) });
    if (r.status === 404) return false;
    return r.ok ? Boolean((await r.json()).ready) : null;
  } catch {
    return null;
  }
}

/** Lance MediaMTX avec mediamtx/mediamtx.yml et le relance s'il s'arrête. MEDIAMTX_AUTO=0 pour désactiver. */
export function startMediamtx({ root, port }) {
  if (process.env.MEDIAMTX_AUTO === '0') return;
  const bin = findBinary(root);
  if (!bin) {
    const where = process.platform === 'win32' ? 'mediamtx.exe dans le dossier mediamtx/ du projet (ou C:\\mediamtx)' : 'mediamtx dans /usr/local/bin (bash scripts/deploy-vps.sh le fait)';
    console.log(`[mediamtx] introuvable : placez ${where}. Le direct auto-hébergé est désactivé.`);
    return;
  }
  let child = null;
  let stopping = false;
  const run = async () => {
    if (await portOpen(1935)) {
      console.log('[mediamtx] le port 1935 est déjà pris (une fenêtre MediaMTX ouverte à la main ?) : fermez-la, le site relancera le sien.');
      return setTimeout(run, 15_000);
    }
    child = spawn(bin, [path.join(root, 'mediamtx', 'mediamtx.yml')], {
      env: { ...process.env, MTX_AUTHHTTPADDRESS: `http://127.0.0.1:${port}/api/mediamtx/auth` },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    const log = (buf) => {
      for (const line of buf.toString().split(/\r?\n/)) {
        // On masque la clé (dernier segment de live/…) dans le journal
        if (line.trim()) console.log('[mediamtx]', line.replace(/(live\/)[\w-]+/g, '$1****'));
      }
    };
    child.stdout.on('data', log);
    child.stderr.on('data', log);
    child.on('exit', (code) => {
      child = null;
      if (stopping) return;
      console.log(`[mediamtx] arrêté (code ${code}), redémarrage dans 5 s`);
      setTimeout(run, 5000);
    });
  };
  run();
  const stop = () => {
    stopping = true;
    child?.kill();
  };
  process.on('exit', stop);
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => (stop(), process.exit(0)));
}
