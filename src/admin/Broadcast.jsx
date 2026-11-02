import { useCallback, useEffect, useRef, useState } from 'react';
import { Field, getPath, setPath } from './fields';
import { api } from './api';
import { ObsClient } from './obs';

/* ---------------------------------------------------------------- */
/* Plateformes de diffusion (serveur RTMP + clé de flux)            */
/* ---------------------------------------------------------------- */

const PLATFORMS = [
  {
    key: 'youtube',
    label: 'YouTube Live',
    defaultServer: 'rtmp://a.rtmp.youtube.com/live2',
    help: 'YouTube Studio → Créer → Passer au direct → « Streaming » : copiez la clé de flux. Serveur : rtmp://a.rtmp.youtube.com/live2 (ou rtmps://a.rtmps.youtube.com:443/live2, chiffré).',
  },
  {
    key: 'facebook',
    label: 'Facebook Live',
    defaultServer: 'rtmps://live-api-s.facebook.com:443/rtmp/',
    help: 'Facebook → Vidéo en direct (Live Producer) → « Logiciel de streaming » : copiez la clé. Choisissez une clé persistante pour ne pas la changer à chaque direct.',
  },
  {
    key: 'tiktok',
    label: 'TikTok LIVE',
    help: 'Pour les comptes ayant accès à la clé de diffusion : TikTok LIVE Center / LIVE Studio → copiez l’URL du serveur et la clé. TikTok les renouvelle souvent : vérifiez-les avant chaque direct.',
  },
  {
    key: 'jetstream',
    label: 'Jet-Stream',
    help: 'Console Jet-Stream → votre canal live → paramètres d’ingest : URL RTMP et clé (stream name). Le lecteur du site se règle dans l’onglet « Lecteur du direct ».',
  },
  {
    key: 'custom',
    label: 'Autre plateforme',
    help: 'Restream, Vimeo, Twitch, un serveur RTMP / SRT personnel… Restream permet d’envoyer un seul flux vers plusieurs réseaux à la fois.',
  },
];

/** Complète les destinations absentes (ancien serveur, ou ancien db/private.json) pour ne jamais planter l'écran. */
const withAllDestinations = (st) => ({
  ...st,
  destinations: {
    ...st.destinations, // dont « selfhost », géré par le serveur
    ...Object.fromEntries(
      PLATFORMS.map((p) => [p.key, { enabled: false, server: p.defaultServer || '', key: '', ...(p.key === 'custom' && { label: 'Autre plateforme' }), ...st.destinations?.[p.key] }]),
    ),
  },
});

const platformLabel = (st, key) => (key === 'custom' && st.destinations.custom.label) || PLATFORMS.find((p) => p.key === key).label;

function Card({ title, subtitle, children, right }) {
  return (
    <section className="rounded-xl bg-white p-6 ring-1 ring-black/5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-gray-600">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

const Pill = ({ on, children }) => (
  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${on ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
    <span className={`h-2 w-2 rounded-full ${on ? 'animate-pulse bg-white' : 'bg-gray-400'}`} />
    {children}
  </span>
);

const smallBtn = 'rounded-lg px-3 py-2 text-sm font-semibold transition disabled:opacity-50';

/* ---------------------------------------------------------------- */
/* OBS Studio (obs-websocket, depuis le navigateur)                 */
/* ---------------------------------------------------------------- */

function ObsPanel({ st, update }) {
  const client = useRef(null);
  const [state, setState] = useState('off'); // off | connecting | on
  const [error, setError] = useState('');
  const [info, setInfo] = useState(null);
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState('');
  const { host, port, password } = st.obs;
  const primary = st.destinations[st.primary];

  const refresh = useCallback(async () => {
    const obs = client.current;
    if (!obs?.connected) return;
    try {
      const [stream, record, scenes, service] = await Promise.all([
        obs.request('GetStreamStatus'),
        obs.request('GetRecordStatus'),
        obs.request('GetSceneList'),
        obs.request('GetStreamServiceSettings'),
      ]);
      setStatus({ stream, record, scenes: [...scenes.scenes].reverse(), current: scenes.currentProgramSceneName, service });
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    if (state !== 'on') return;
    refresh();
    const id = setInterval(refresh, 2000);
    return () => clearInterval(id);
  }, [state, refresh]);

  useEffect(() => () => client.current?.close(), []);

  const connect = async () => {
    setError('');
    setState('connecting');
    const obs = new ObsClient();
    obs.onClose = () => {
      setState('off');
      setStatus(null);
    };
    try {
      await obs.connect(host || 'localhost', port, password);
      client.current = obs;
      setInfo(await obs.request('GetVersion'));
      setState('on');
    } catch (e) {
      obs.onClose = null;
      setState('off');
      setError(e.message);
    }
  };

  const run = async (label, fn) => {
    setBusy(label);
    setError('');
    try {
      await fn(client.current);
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  const applyDestination = () =>
    run('apply', (obs) =>
      obs.request('SetStreamServiceSettings', { streamServiceType: 'rtmp_custom', streamServiceSettings: { server: primary.server, key: primary.key } }),
    );

  const live = status?.stream.outputActive;
  const recording = status?.record.outputActive;
  const svc = status?.service.streamServiceSettings || {};
  const matches = svc.server === primary.server && svc.key === primary.key;

  return (
    <Card
      title="OBS Studio (alternative)"
      subtitle="À utiliser seulement si vMix n’est pas disponible. Pilotez OBS depuis cette page : envoi de la destination, démarrage du direct et de l’enregistrement, changement de scène."
      right={state === 'on' ? <Pill on={live}>{live ? `En direct ${status.stream.outputTimecode?.slice(0, 8)}` : 'Hors antenne'}</Pill> : null}
    >
      <details className="mb-4 rounded-lg bg-mist p-4 text-sm text-gray-700">
        <summary className="cursor-pointer font-semibold text-ink">Activer la connexion dans OBS (une seule fois)</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>OBS Studio 28 ou plus récent : menu <strong>Outils → Paramètres du serveur WebSocket</strong>.</li>
          <li>Cochez <strong>Activer le serveur WebSocket</strong>, gardez le port <strong>4455</strong> et l’authentification.</li>
          <li>Cliquez sur <strong>Afficher les informations de connexion</strong> et copiez le mot de passe ci-dessous.</li>
          <li>Ouvrez cette page d’administration <strong>sur le PC qui fait tourner OBS</strong> (adresse : localhost).</li>
        </ol>
      </details>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field def={{ name: 'obs.host', label: 'Adresse', placeholder: 'localhost' }} value={host} onChange={(v) => update('obs.host', v)} />
        <Field def={{ name: 'obs.port', label: 'Port', type: 'number' }} value={port} onChange={(v) => update('obs.port', v === '' ? '' : Math.trunc(v))} />
        <Field def={{ name: 'obs.password', label: 'Mot de passe WebSocket', type: 'secret' }} value={password} onChange={(v) => update('obs.password', v)} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {state === 'on' ? (
          <button type="button" onClick={() => client.current?.close()} className={`${smallBtn} bg-mist text-ink hover:bg-gray-200`}>Se déconnecter</button>
        ) : (
          <button type="button" onClick={connect} disabled={state === 'connecting'} className="btn-primary">{state === 'connecting' ? 'Connexion…' : 'Se connecter à OBS'}</button>
        )}
        {info && state === 'on' && <span className="text-xs text-gray-600">✓ Connecté à OBS {info.obsVersion} (WebSocket {info.obsWebSocketVersion})</span>}
      </div>
      {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800 ring-1 ring-red-200">{error}</p>}

      {state === 'on' && status && (
        <div className="mt-6 space-y-6 border-t border-gray-100 pt-6">
          <div>
            <h3 className="mb-2 text-sm font-semibold">Destination du direct</h3>
            <p className="text-sm text-gray-700">
              OBS envoie actuellement vers : <code className="break-all rounded bg-mist px-1.5 py-0.5 text-xs">{svc.server || '—'}</code>
              {matches ? <span className="ml-2 text-green-700">✓ {platformLabel(st, st.primary)}</span> : null}
            </p>
            {!matches && (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button type="button" onClick={applyDestination} disabled={!primary.server || !primary.key || live || busy === 'apply'} className="btn-accent">
                  Envoyer « {platformLabel(st, st.primary)} » à OBS
                </button>
                {(!primary.server || !primary.key) && <span className="text-xs text-amber-800">Renseignez le serveur et la clé de la destination principale ci-dessous.</span>}
                {live && <span className="text-xs text-gray-600">Arrêtez le direct pour changer de destination.</span>}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {live ? (
              <button type="button" disabled={!!busy} onClick={() => run('stream', (obs) => obs.request('StopStream'))} className={`${smallBtn} bg-red-600 text-white hover:bg-red-700`}>■ Arrêter le direct</button>
            ) : (
              <button type="button" disabled={!!busy} onClick={() => run('stream', (obs) => obs.request('StartStream'))} className={`${smallBtn} bg-green-700 text-white hover:bg-green-800`}>● Démarrer le direct</button>
            )}
            {recording ? (
              <button type="button" disabled={!!busy} onClick={() => run('rec', (obs) => obs.request('StopRecord'))} className={`${smallBtn} bg-red-50 text-red-700 ring-1 ring-red-200`}>■ Arrêter l’enregistrement ({status.record.outputTimecode?.slice(0, 8)})</button>
            ) : (
              <button type="button" disabled={!!busy} onClick={() => run('rec', (obs) => obs.request('StartRecord'))} className={`${smallBtn} bg-mist text-ink hover:bg-gray-200`}>● Enregistrer</button>
            )}
          </div>

          {live && (
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <div className="rounded-lg bg-mist p-3"><dt className="text-xs text-gray-500">Durée</dt><dd className="font-semibold">{status.stream.outputTimecode?.slice(0, 8)}</dd></div>
              <div className="rounded-lg bg-mist p-3"><dt className="text-xs text-gray-500">Congestion réseau</dt><dd className={`font-semibold ${status.stream.outputCongestion > 0.2 ? 'text-red-700' : ''}`}>{Math.round((status.stream.outputCongestion || 0) * 100)} %</dd></div>
              <div className="rounded-lg bg-mist p-3"><dt className="text-xs text-gray-500">Images perdues</dt><dd className="font-semibold">{status.stream.outputSkippedFrames} / {status.stream.outputTotalFrames}</dd></div>
            </dl>
          )}

          <div>
            <h3 className="mb-2 text-sm font-semibold">Scènes</h3>
            <div className="flex flex-wrap gap-2">
              {status.scenes.map(({ sceneName }) => (
                <button
                  key={sceneName}
                  type="button"
                  onClick={() => run('scene', (obs) => obs.request('SetCurrentProgramScene', { sceneName }))}
                  aria-pressed={sceneName === status.current}
                  className={`${smallBtn} ${sceneName === status.current ? 'bg-red-600 text-white' : 'bg-white text-ink ring-1 ring-black/10 hover:ring-brand'}`}
                >
                  {sceneName}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

/* ---------------------------------------------------------------- */
/* vMix (API web relayée par le serveur)                            */
/* ---------------------------------------------------------------- */

function CopyButton({ value, label }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch {
      /* presse-papiers indisponible (http hors localhost) */
    }
  };
  return (
    <button type="button" onClick={copy} disabled={!value} className={`${smallBtn} bg-white py-1 text-xs ring-1 ring-black/10 hover:ring-brand`}>
      {done ? '✓ Copié' : label}
    </button>
  );
}

/** Plateformes cochées (YouTube, Facebook…) : facultatives, en Destination 2 et 3 de vMix (la 1 est le site). */
function VmixDestinations({ st }) {
  const enabled = PLATFORMS.filter((p) => st.destinations[p.key].enabled);
  if (!enabled.length) return null;
  return (
    <div className="mt-4">
      <h3 className="mb-1 text-sm font-semibold">Facultatif : diffuser aussi sur vos réseaux (vMix → Stream → Settings)</h3>
      {enabled.length > 2 && <p className="mb-2 text-xs text-amber-800">vMix diffuse vers 3 destinations au maximum, dont le site : seules les 2 premières plateformes cochées sont listées.</p>}
      <ol className="space-y-2">
        {enabled.slice(0, 2).map((p, i) => {
          const dest = st.destinations[p.key];
          return (
            <li key={p.key} className="flex flex-wrap items-center gap-2 rounded-lg bg-mist p-3 text-sm">
              <span className="font-semibold">Destination {i + 2} : {platformLabel(st, p.key)}</span>
              <code className="break-all rounded bg-white px-1.5 py-0.5 text-xs">{dest.server || 'serveur manquant'}</code>
              <span className="ml-auto flex gap-2">
                <CopyButton value={dest.server} label="Copier l’URL" />
                <CopyButton value={dest.key} label={dest.key ? 'Copier la clé' : 'Clé manquante'} />
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Direct sur le site : check-liste en 3 étapes                     */
/* ---------------------------------------------------------------- */

// Adresse que vMix doit appeler : ce PC en local, sinon le nom du serveur (VPS)
const rtmpUrl = () => {
  const h = location.hostname;
  return `rtmp://${['localhost', '127.0.0.1', '::1', '[::1]'].includes(h) ? '127.0.0.1' : h}:1935/live`;
};

function Step({ n, ok, title, children }) {
  return (
    <li className={`rounded-xl p-4 ring-1 ${ok ? 'bg-green-50 ring-green-200' : 'bg-white ring-black/10'}`}>
      <p className="flex items-center gap-3 font-semibold">
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm ${ok ? 'bg-green-600 text-white' : 'bg-gray-200 text-ink'}`}>{ok ? '✓' : n}</span>
        {title}
      </p>
      {children && <div className="mt-3 pl-10 text-sm text-gray-700">{children}</div>}
    </li>
  );
}

function CopyRow({ label, value, display }) {
  return (
    <div className="flex flex-wrap items-center gap-2 py-1">
      <span className="w-40 shrink-0 text-gray-600">{label}</span>
      <code className="break-all rounded bg-mist px-2 py-1 text-sm font-semibold text-ink">{display || value}</code>
      <CopyButton value={value} label="Copier" />
    </div>
  );
}

function SiteLive({ notify }) {
  const [s, setS] = useState(null);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      setS(await api.selfhostStatus());
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 3000);
    return () => clearInterval(id);
  }, [refresh]);

  const newKey = async () => {
    if (!confirm('Créer une nouvelle clé ? L’ancienne ne fonctionnera plus : il faudra recopier la nouvelle dans vMix.')) return;
    try {
      await api.selfhostNewKey();
      await refresh();
      notify('Nouvelle clé créée : recopiez-la dans vMix.');
    } catch (e) {
      notify(e.message, 'error');
    }
  };

  if (error) return <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-800">Statut du direct indisponible : {error}. Redémarrez le site (npm run dev).</p>;
  if (!s) return null;
  const relayOk = s.relay === 'ok';

  return (
    <Card
      title="Diffuser vMix sur le site"
      subtitle="Trois étapes. Chaque étape devient verte toute seule quand elle est réussie."
      right={<Pill on={s.receiving}>{s.receiving ? 'En direct sur le site' : 'Pas de direct'}</Pill>}
    >
      <ol className="space-y-3">
        <Step n={1} ok={relayOk} title={relayOk ? 'Le relais vidéo du site est démarré' : 'Démarrer le relais vidéo du site'}>
          {s.relay === 'other' && (
            <p>Une fenêtre MediaMTX a été ouverte à la main : <strong>fermez-la</strong>. Le site démarre le sien tout seul (attendez 15 secondes).</p>
          )}
          {s.relay === 'missing' && (
            <p>
              Le programme MediaMTX est introuvable. Sur un PC Windows : placez <strong>mediamtx.exe</strong> dans le dossier <code>C:\mediamtx</code> (ou dans le dossier <code>mediamtx</code> du
              projet), puis redémarrez le site (<code>npm run dev</code>). Sur le VPS : lancez <code>bash scripts/deploy-vps.sh</code>, qui l’installe.
            </p>
          )}
        </Step>

        <Step n={2} title="Dans vMix : recopier l’adresse et la clé (une seule fois)">
          <ol className="mb-3 list-decimal space-y-1 pl-5">
            <li>Dans vMix, cliquez sur la petite <strong>roue ⚙</strong> à côté du bouton <strong>Stream</strong> (en bas).</li>
            <li>
              Destination : choisissez <strong>Custom RTMP Server</strong>.
            </li>
            <li>Copiez-collez les deux lignes ci-dessous dans <strong>URL</strong> et <strong>Stream Name or Key</strong>, puis fermez la fenêtre.</li>
          </ol>
          <CopyRow label="URL" value={rtmpUrl()} />
          <CopyRow label="Stream Name or Key" value={s.key} display={`${s.key.slice(0, 4)}••••••••`} />
          <button type="button" onClick={newKey} className="mt-2 text-xs font-semibold text-gray-500 hover:text-brand hover:underline">
            Changer la clé (si elle a été communiquée à quelqu’un)
          </button>
        </Step>

        <Step n={3} ok={s.receiving} title={s.receiving ? 'vMix envoie l’image : le direct s’affiche sur le site' : 'Dans vMix, cliquez sur « Stream »'}>
          {s.receiving ? (
            <a href="/" target="_blank" rel="noreferrer" className="font-semibold text-brand hover:underline">Voir la page d’accueil →</a>
          ) : s.elsewhere.length ? (
            <p className="text-amber-900">
              ⚠ vMix envoie bien une image, mais à une autre adresse (<code>{s.elsewhere.join(', ')}</code>). Dans vMix, cliquez sur Stream pour l’arrêter, recopiez l’URL et la clé de
              l’étape 2, puis cliquez de nouveau sur Stream.
            </p>
          ) : (
            <p>Le bouton Stream devient rouge dans vMix. Cette étape passe au vert en quelques secondes.</p>
          )}
        </Step>
      </ol>
    </Card>
  );
}

function VmixPanel({ st, saved, update }) {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const unsaved = JSON.stringify(st.vmix) !== JSON.stringify(saved.vmix);

  const refresh = useCallback(async () => {
    try {
      setStatus(await api.vmixStatus());
      setError('');
    } catch (e) {
      setStatus(null);
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    if (!status) return;
    const id = setInterval(refresh, 3000);
    return () => clearInterval(id);
  }, [status, refresh]);

  const call = async (name, input) => {
    setBusy(true);
    try {
      await api.vmixFunction(name, input);
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      title="Piloter vMix depuis cette page (facultatif)"
      subtitle="Pour démarrer le direct, changer de caméra, etc. sans être devant vMix. Pas nécessaire pour que le direct s’affiche sur le site."
      right={status ? <Pill on={status.streaming}>{status.streaming ? 'En direct' : 'Hors antenne'}</Pill> : null}
    >
      <details className="mb-4 rounded-lg bg-mist p-4 text-sm text-gray-700">
        <summary className="cursor-pointer font-semibold text-ink">Activer l’API web dans vMix (une seule fois)</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>vMix → <strong>Settings → Web Controller</strong> : cochez <strong>Enable</strong> (port 8088 par défaut).</li>
          <li>Indiquez ci-dessous l’adresse IP du PC vMix (ex. 192.168.1.20). Le <strong>serveur du site</strong> doit pouvoir le joindre : même réseau local, ou VPN.</li>
          <li>Autorisez le port dans le pare-feu Windows du PC vMix.</li>
        </ol>
      </details>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field def={{ name: 'vmix.host', label: 'Adresse IP du PC vMix', placeholder: '192.168.1.20' }} value={st.vmix.host} onChange={(v) => update('vmix.host', v)} />
        <Field def={{ name: 'vmix.port', label: 'Port', type: 'number' }} value={st.vmix.port} onChange={(v) => update('vmix.port', v === '' ? '' : Math.trunc(v))} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={refresh} disabled={unsaved || !saved.vmix.host} className="btn-primary disabled:opacity-50">{status ? 'Actualiser' : 'Tester la connexion'}</button>
        {unsaved && <span className="text-xs text-amber-800">Enregistrez les réglages pour tester cette adresse.</span>}
        {status && <span className="text-xs text-gray-600">✓ vMix {status.edition} {status.version}</span>}
      </div>
      {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800 ring-1 ring-red-200">{error}</p>}

      <VmixDestinations st={st} />

      {status && (
        <div className="mt-6 space-y-5 border-t border-gray-100 pt-6">
          <div className="flex flex-wrap gap-2">
            {status.streaming ? (
              <button type="button" disabled={busy} onClick={() => call('StopStreaming')} className={`${smallBtn} bg-red-600 text-white hover:bg-red-700`}>■ Arrêter le direct</button>
            ) : (
              <button type="button" disabled={busy} onClick={() => call('StartStreaming')} className={`${smallBtn} bg-green-700 text-white hover:bg-green-800`}>● Démarrer le direct</button>
            )}
            {status.recording ? (
              <button type="button" disabled={busy} onClick={() => call('StopRecording')} className={`${smallBtn} bg-red-50 text-red-700 ring-1 ring-red-200`}>■ Arrêter l’enregistrement</button>
            ) : (
              <button type="button" disabled={busy} onClick={() => call('StartRecording')} className={`${smallBtn} bg-mist text-ink hover:bg-gray-200`}>● Enregistrer</button>
            )}
            <button type="button" disabled={busy} onClick={() => call('Cut')} className={`${smallBtn} bg-white ring-1 ring-black/10 hover:ring-brand`}>Cut</button>
            <button type="button" disabled={busy} onClick={() => call('Fade')} className={`${smallBtn} bg-white ring-1 ring-black/10 hover:ring-brand`}>Fondu</button>
          </div>
          <div>
            <h3 className="mb-1 text-sm font-semibold">Entrées</h3>
            <p className="mb-2 text-xs text-gray-500">Cliquez pour mettre une entrée en préparation (vert), puis « Cut » ou « Fondu » pour la passer à l’antenne (rouge).</p>
            <div className="flex flex-wrap gap-2">
              {status.inputs.map((i) => (
                <button
                  key={i.number}
                  type="button"
                  disabled={busy}
                  onClick={() => call('PreviewInput', i.number)}
                  className={`${smallBtn} ${i.number === status.active ? 'bg-red-600 text-white' : i.number === status.preview ? 'bg-green-600 text-white' : 'bg-white text-ink ring-1 ring-black/10 hover:ring-brand'}`}
                >
                  {i.number}. {i.title}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

/* ---------------------------------------------------------------- */

export default function Broadcast({ notify, onAuthLost }) {
  const [saved, setSaved] = useState(null);
  const [st, setSt] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .privateSettings()
      .then((r) => {
        const streaming = withAllDestinations(r.streaming);
        setSaved(streaming);
        setSt(streaming);
      })
      .catch((e) => (e.status === 401 ? onAuthLost() : setError(e.message)));
  }, [onAuthLost]);

  if (error) return <p className="rounded-lg bg-red-50 p-4 text-sm text-red-800">{error}</p>;
  if (!st) return <p className="text-sm text-gray-500">Chargement…</p>;

  const update = (path, v) => setSt((s) => setPath(s, path, v));
  const dirty = JSON.stringify(st) !== JSON.stringify(saved);

  const save = async () => {
    setBusy(true);
    try {
      await api.saveStreaming(st);
      setSaved(st);
      notify('Réglages de diffusion enregistrés.');
    } catch (e) {
      if (e.status === 401) onAuthLost();
      notify(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-brand/5 p-4 ring-1 ring-brand/10">
        <p className="max-w-2xl text-sm text-gray-700">
          🔒 Les clés de diffusion sont <strong>confidentielles</strong> : quiconque les connaît peut diffuser sur vos chaînes. Elles sont stockées sur le serveur (db/private.json) et ne sont jamais envoyées aux visiteurs du site.
        </p>
        <button type="button" onClick={save} disabled={!dirty || busy} className="btn-primary disabled:opacity-50">{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
      </div>

      <SiteLive notify={notify} />

      <VmixPanel st={st} saved={saved} update={update} />

      <Card title="Réseaux sociaux (facultatif)" subtitle="Pour diffuser en même temps sur YouTube, Facebook… Cochez une plateforme et renseignez sa clé : elle apparaît dans le cadre « Piloter vMix » ci-dessus, prête à recopier dans vMix. La « destination principale » ne sert qu’à OBS.">
        <div className="space-y-4">
          {PLATFORMS.map((p) => {
            const dest = st.destinations[p.key];
            const base = `destinations.${p.key}`;
            return (
              <fieldset key={p.key} className={`rounded-xl p-4 ring-1 ${dest.enabled ? 'ring-brand/30' : 'ring-black/10'}`}>
                <legend className="sr-only">{p.label}</legend>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <label className="flex items-center gap-2 font-semibold">
                    <input type="checkbox" checked={dest.enabled} onChange={(e) => update(`${base}.enabled`, e.target.checked)} className="h-4 w-4 accent-brand" />
                    {platformLabel(st, p.key)}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="radio" name="primary" checked={st.primary === p.key} onChange={() => update('primary', p.key)} className="h-4 w-4 accent-brand" />
                    Destination principale (OBS)
                  </label>
                </div>
                {dest.enabled && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {p.key === 'custom' && <Field def={{ name: `${base}.label`, label: 'Nom de la plateforme', wide: true }} value={dest.label} onChange={(v) => update(`${base}.label`, v)} />}
                    <Field def={{ name: `${base}.server`, label: 'URL du serveur', placeholder: p.defaultServer || 'rtmp://…' }} value={getPath(st, `${base}.server`)} onChange={(v) => update(`${base}.server`, v.trim())} />
                    <Field def={{ name: `${base}.key`, label: 'Clé de flux', type: 'secret' }} value={dest.key} onChange={(v) => update(`${base}.key`, v)} />
                    <p className="text-xs text-gray-600 sm:col-span-2">{p.help}</p>
                    {p.defaultServer && dest.server !== p.defaultServer && (
                      <button type="button" onClick={() => update(`${base}.server`, p.defaultServer)} className="justify-self-start text-xs font-semibold text-brand hover:underline sm:col-span-2">
                        Utiliser le serveur par défaut ({p.defaultServer})
                      </button>
                    )}
                  </div>
                )}
              </fieldset>
            );
          })}
        </div>
      </Card>

      <Card title="Réglages d’encodage conseillés" subtitle="À appliquer dans vMix (Stream → Settings → Quality) ou, à défaut, dans OBS (Paramètres → Sortie / Vidéo).">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="text-xs uppercase text-gray-500">
              <tr><th className="py-2 pr-4">Qualité</th><th className="py-2 pr-4">Résolution</th><th className="py-2 pr-4">Débit vidéo</th><th className="py-2 pr-4">Connexion montante</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr><td className="py-2 pr-4 font-medium">Recommandée</td><td className="py-2 pr-4">1920 × 1080, 30 i/s</td><td className="py-2 pr-4">4 500 – 6 000 kb/s</td><td className="py-2 pr-4">≥ 10 Mb/s</td></tr>
              <tr><td className="py-2 pr-4 font-medium">Connexion moyenne</td><td className="py-2 pr-4">1280 × 720, 30 i/s</td><td className="py-2 pr-4">2 500 – 4 000 kb/s</td><td className="py-2 pr-4">≥ 6 Mb/s</td></tr>
              <tr><td className="py-2 pr-4 font-medium">Connexion faible</td><td className="py-2 pr-4">854 × 480, 30 i/s</td><td className="py-2 pr-4">1 000 – 1 500 kb/s</td><td className="py-2 pr-4">≥ 3 Mb/s</td></tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-gray-600">Dans tous les cas : encodeur H.264, intervalle d’images clés 2 s, audio AAC 128–160 kb/s 48 kHz. TikTok est vertical : prévoyez une scène 1080 × 1920 si vous y diffusez.</p>
      </Card>

      <ObsPanel st={st} update={update} />
    </div>
  );
}
