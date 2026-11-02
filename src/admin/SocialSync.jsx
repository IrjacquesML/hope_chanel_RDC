import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from './api';
import { img } from '../lib';
import { Facebook, Instagram, YouTube } from '../components/Icons';

const NETWORKS = {
  youtube: { label: 'YouTube', Icon: YouTube, color: 'text-red-600' },
  facebook: { label: 'Facebook', Icon: Facebook, color: 'text-[#1877F2]' },
  instagram: { label: 'Instagram', Icon: Instagram, color: 'text-[#C13584]' },
};
const STATUS = { pending: 'À valider', published: 'Publié', hidden: 'Masqué' };
const INTERVALS = [[15, '15 minutes'], [30, '30 minutes'], [60, '1 heure'], [180, '3 heures'], [360, '6 heures'], [1440, '1 fois par jour']];
const input = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25';
const when = (iso) => (iso ? new Date(iso).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) : '');

function Help({ children }) {
  return (
    <details className="mt-3 rounded-lg bg-mist p-3 text-sm text-gray-700">
      <summary className="cursor-pointer font-semibold text-brand">Comment obtenir ces informations ?</summary>
      <div className="mt-2 space-y-1.5">{children}</div>
    </details>
  );
}

function StatusLine({ status }) {
  if (!status) return <p className="mt-2 text-xs text-gray-500">Pas encore synchronisé.</p>;
  return status.ok ? (
    <p className="mt-2 text-xs text-green-800">✓ {when(status.at)} : {status.count} contenu(s) lu(s), {status.added} nouveau(x).</p>
  ) : (
    <p className="mt-2 rounded-md bg-red-50 px-2 py-1 text-xs text-red-800">✗ {when(status.at)} : {status.error}</p>
  );
}

/** Réglages (administrateur) : un cadre par réseau. */
function Config({ state, socialLinks, onSaved, notify }) {
  const [draft, setDraft] = useState(() => structuredClone(state.config));
  const [busy, setBusy] = useState(false);
  const set = (n, patch) => setDraft((d) => ({ ...d, [n]: { ...d[n], ...patch } }));
  const save = async () => {
    setBusy(true);
    try {
      const next = await api.saveSocialConfig(draft);
      setDraft(structuredClone(next.config));
      onSaved(next);
      notify('Réglages enregistrés.');
    } catch (e) {
      notify(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const mode = (n) => (
    <label className="text-sm">
      <span className="mb-1 block font-medium">Nouveaux contenus</span>
      <select value={draft[n].mode} onChange={(e) => set(n, { mode: e.target.value })} className={input}>
        <option value="published">Publiés automatiquement sur le site</option>
        <option value="pending">À valider ici avant d’apparaître</option>
      </select>
    </label>
  );
  const token = (n) => (
    <label className="text-sm sm:col-span-2">
      <span className="mb-1 block font-medium">Jeton d’accès {draft[n].tokenSet && <span className="font-normal text-green-700">(enregistré ✓ — laissez vide pour le garder)</span>}</span>
      <div className="flex gap-2">
        <input type="password" autoComplete="off" value={draft[n].token || ''} onChange={(e) => set(n, { token: e.target.value, clearToken: false })} placeholder={draft[n].tokenSet ? '••••••••••••' : 'EAAB…'} className={`${input} font-mono`} />
        {draft[n].tokenSet && (
          <button type="button" onClick={() => set(n, { token: '', clearToken: !draft[n].clearToken })} className={`shrink-0 rounded-lg px-3 text-xs font-semibold ${draft[n].clearToken ? 'bg-red-600 text-white' : 'text-red-700 hover:bg-red-50'}`}>
            {draft[n].clearToken ? 'Sera effacé' : 'Effacer'}
          </button>
        )}
      </div>
    </label>
  );
  const box = (n, children, help) => {
    const { label, Icon, color } = NETWORKS[n];
    return (
      <section key={n} className="rounded-xl bg-white p-5 ring-1 ring-black/5">
        <label className="flex items-center gap-3">
          <input type="checkbox" checked={draft[n].enabled} onChange={(e) => set(n, { enabled: e.target.checked })} className="h-5 w-5 accent-brand" />
          <Icon className={`h-6 w-6 ${color}`} />
          <span className="text-lg font-semibold">{label}</span>
          <span className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-semibold ${draft[n].enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>{draft[n].enabled ? 'Activé' : 'Désactivé'}</span>
        </label>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">{children}</div>
        <StatusLine status={state.status[n]} />
        {help}
      </section>
    );
  };

  return (
    <div className="space-y-4">
      {box('youtube', <>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Adresse de la chaîne</span>
          <input value={draft.youtube.channel} onChange={(e) => set('youtube', { channel: e.target.value })} placeholder={socialLinks.youtube && socialLinks.youtube !== 'https://www.youtube.com/' ? socialLinks.youtube : 'https://www.youtube.com/@MaChaine'} className={input} />
          <span className="mt-1 block text-xs text-gray-500">Vide = l’adresse de Paramètres → Réseaux sociaux. Aucune clé nécessaire.</span>
        </label>
        {mode('youtube')}
      </>)}
      {box('facebook', <>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Identifiant de la page</span>
          <input value={draft.facebook.pageId} onChange={(e) => set('facebook', { pageId: e.target.value })} placeholder="Ex. : 123456789012345" className={input} />
        </label>
        {mode('facebook')}
        {token('facebook')}
      </>, (
        <Help>
          <p>1. Sur <b>developers.facebook.com</b>, créez une application (type « Entreprise ») avec le compte qui gère la page.</p>
          <p>2. Dans l’<b>Explorateur de l’API Graph</b>, choisissez l’application, puis « Obtenir un jeton d’accès de page » avec les autorisations <b>pages_read_engagement</b> et <b>pages_show_list</b>.</p>
          <p>3. Transformez-le en jeton <b>longue durée</b> (outil « Débogueur de token d’accès » → « Prolonger le token d’accès »). Un jeton de page longue durée n’expire pas tant que le mot de passe ne change pas.</p>
          <p>4. L’identifiant de la page se trouve dans Facebook : Page → À propos → Transparence de la Page (« ID de la Page »).</p>
        </Help>
      ))}
      {box('instagram', <>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Identifiant du compte Instagram (nombre)</span>
          <input value={draft.instagram.userId} onChange={(e) => set('instagram', { userId: e.target.value })} placeholder="Ex. : 17841400000000000" className={input} />
        </label>
        {mode('instagram')}
        {token('instagram')}
      </>, (
        <Help>
          <p>1. Le compte Instagram doit être <b>professionnel</b> (Créateur ou Entreprise) et <b>relié à la page Facebook</b>.</p>
          <p>2. Avec la même application Meta, obtenez un jeton de page longue durée incluant l’autorisation <b>instagram_basic</b> (le même jeton que Facebook convient s’il a cette autorisation).</p>
          <p>3. L’identifiant Instagram s’obtient dans l’Explorateur de l’API Graph : requête <b>me/accounts?fields=instagram_business_account</b>.</p>
        </Help>
      ))}
      <section className="rounded-xl bg-white p-5 text-sm text-gray-700 ring-1 ring-black/5">
        <p className="font-semibold text-ink">TikTok</p>
        <p className="mt-1">TikTok n’autorise la lecture des vidéos d’un compte qu’aux applications « TikTok for Developers » validées par TikTok (démarche de plusieurs jours). Une fois l’application obtenue, la synchronisation TikTok pourra être ajoutée ici.</p>
      </section>
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-xl bg-white p-5 ring-1 ring-black/5">
        <label className="text-sm">
          <span className="mb-1 block font-medium">Synchronisation automatique</span>
          <select value={draft.intervalMinutes} onChange={(e) => setDraft((d) => ({ ...d, intervalMinutes: Number(e.target.value) }))} className={input}>
            {INTERVALS.map(([v, l]) => <option key={v} value={v}>Toutes les {l}</option>)}
          </select>
        </label>
        <button type="button" onClick={save} disabled={busy} className="btn-primary disabled:opacity-60">{busy ? 'Enregistrement…' : 'Enregistrer les réglages'}</button>
      </div>
    </div>
  );
}

export default function SocialSync({ user, socialLinks, notify, onAuthLost, onArticleCreated }) {
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState('');
  const [tab, setTab] = useState('items');
  const [filter, setFilter] = useState('pending');
  const [network, setNetwork] = useState('');
  const isAdmin = user.role === 'admin';

  const fail = useCallback((e) => (e.status === 401 ? onAuthLost() : notify(e.message, 'error')), [notify, onAuthLost]);
  useEffect(() => {
    api.social().then((s) => {
      setState(s);
      // Rien à valider : on affiche directement les contenus publiés
      if (!s.items.some((i) => i.status === 'pending')) setFilter('published');
    }).catch(fail);
  }, [fail]);

  const run = async (label, fn) => {
    setBusy(label);
    try {
      const next = await fn();
      setState(next);
      return next;
    } catch (e) {
      fail(e);
    } finally {
      setBusy('');
    }
  };
  const sync = async () => {
    const next = await run('sync', api.socialSync);
    if (!next) return;
    const errors = Object.entries(next.status).filter(([n, s]) => next.config[n]?.enabled && !s.ok);
    notify(errors.length ? `Synchronisation terminée avec ${errors.length} erreur(s) : voir les réglages.` : 'Synchronisation terminée.', errors.length ? 'error' : 'success');
  };
  const toArticle = async (item) => {
    const next = await run(item.key, () => api.socialToArticle(item.key));
    if (next) {
      notify('Article créé en brouillon : complétez-le dans « Articles ».');
      onArticleCreated?.();
    }
  };

  const counts = useMemo(() => {
    const c = { pending: 0, published: 0, hidden: 0, all: 0 };
    state?.items.forEach((i) => {
      if (network && i.network !== network) return;
      c[i.status]++;
      c.all++;
    });
    return c;
  }, [state, network]);

  if (!state) return <p className="text-gray-500">Chargement…</p>;
  const enabled = Object.keys(NETWORKS).filter((n) => state.config[n].enabled);
  const items = state.items.filter((i) => (filter === 'all' || i.status === filter) && (!network || i.network === network));
  const chip = (active) => `min-h-[40px] rounded-full px-4 text-sm font-semibold ${active ? 'bg-brand text-white' : 'bg-white text-gray-700 ring-1 ring-black/10 hover:text-brand'}`;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Synchronisation des réseaux sociaux</h1>
          <p className="mt-1 text-sm text-gray-600">
            Les nouvelles vidéos et publications de vos réseaux arrivent toutes seules sur le site (bloc « Sur nos réseaux » de l’accueil et page dédiée).
            {state.lastSync && <> Dernière synchronisation : {when(state.lastSync)}.</>}
          </p>
        </div>
        <button type="button" onClick={sync} disabled={Boolean(busy) || !enabled.length} className="btn-primary disabled:opacity-50">{busy === 'sync' ? 'Synchronisation…' : '↻ Synchroniser maintenant'}</button>
      </div>

      {!enabled.length && (
        <p className="mb-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
          Aucun réseau n’est activé. {isAdmin ? 'Ouvrez l’onglet « Réglages » pour activer YouTube (aucune clé nécessaire), Facebook ou Instagram.' : 'Demandez à un administrateur de les activer.'}
        </p>
      )}

      {isAdmin && (
        <div role="tablist" className="mb-6 flex gap-2">
          <button type="button" role="tab" aria-selected={tab === 'items'} onClick={() => setTab('items')} className={chip(tab === 'items')}>Contenus importés</button>
          <button type="button" role="tab" aria-selected={tab === 'config'} onClick={() => setTab('config')} className={chip(tab === 'config')}>Réglages</button>
        </div>
      )}

      {tab === 'config' && isAdmin ? (
        <Config state={state} socialLinks={socialLinks} onSaved={setState} notify={notify} />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {[['pending', 'À valider'], ['published', 'Publiés'], ['hidden', 'Masqués'], ['all', 'Tous']].map(([k, l]) => (
              <button key={k} type="button" onClick={() => setFilter(k)} aria-pressed={filter === k} className={chip(filter === k)}>
                {l} <span className="opacity-70">({counts[k]})</span>
              </button>
            ))}
            <select value={network} onChange={(e) => setNetwork(e.target.value)} aria-label="Réseau" className="ml-auto rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">Tous les réseaux</option>
              {Object.entries(NETWORKS).map(([k, { label }]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </div>
          <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl bg-white ring-1 ring-black/5">
            {items.length === 0 && <li className="p-6 text-center text-sm text-gray-500">Aucun contenu dans cette liste.</li>}
            {items.map((i) => {
              const { label, Icon, color } = NETWORKS[i.network];
              return (
                <li key={i.key} className="flex flex-wrap items-start gap-4 p-4">
                  <div className="h-20 w-32 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-brand to-accent">
                    {i.image && <img src={img(i.image, 260)} alt="" loading="lazy" className="h-full w-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1 basis-60">
                    <p className="flex items-center gap-2 text-xs text-gray-500">
                      <Icon className={`h-4 w-4 ${color}`} /> {label} · {when(i.date)}
                      <span className={`rounded-full px-2 py-0.5 font-semibold ${i.status === 'published' ? 'bg-green-100 text-green-800' : i.status === 'pending' ? 'bg-amber-100 text-amber-900' : 'bg-gray-100 text-gray-600'}`}>{STATUS[i.status]}</span>
                    </p>
                    <p className="mt-1 font-medium text-ink">{i.title || <em className="text-gray-400">Sans titre</em>}</p>
                    {i.text && i.text !== i.title && <p className="mt-0.5 line-clamp-2 text-sm text-gray-600">{i.text}</p>}
                    <a href={i.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs font-semibold text-brand hover:underline">Ouvrir sur {label} ↗</a>
                  </div>
                  <div className="flex w-full flex-wrap gap-1 sm:w-auto sm:flex-col sm:items-stretch">
                    {i.status !== 'published' && <button type="button" disabled={Boolean(busy)} onClick={() => run(i.key, () => api.socialStatus(i.key, 'published'))} className="rounded-lg bg-green-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-50">Publier</button>}
                    {i.status !== 'hidden' && <button type="button" disabled={Boolean(busy)} onClick={() => run(i.key, () => api.socialStatus(i.key, 'hidden'))} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-gray-700 ring-1 ring-black/10 hover:bg-gray-100 disabled:opacity-50">Masquer</button>}
                    {i.articleSlug ? (
                      <a href={`/actualites/${i.articleSlug}`} target="_blank" rel="noopener" className="rounded-lg px-3 py-1.5 text-center text-sm font-semibold text-brand hover:bg-brand/10">Article créé ↗</a>
                    ) : (
                      <button type="button" disabled={Boolean(busy)} onClick={() => toArticle(i)} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-brand hover:bg-brand/10 disabled:opacity-50">{busy === i.key ? '…' : 'Créer un article'}</button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-xs text-gray-500">« Créer un article » prépare un brouillon (titre, texte, image, lien ou vidéo) à compléter dans « Articles ». Les contenus masqués ne sont jamais réimportés.</p>
        </>
      )}
    </div>
  );
}
