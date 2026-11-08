import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Logo from '../components/Logo';
import { Close, MenuIcon } from '../components/Icons';
import CollectionEditor from './CollectionEditor';
import ScheduleEditor from './ScheduleEditor';
import Stats from './Stats';
import SettingsEditor from './Settings';
import Account from './Account';
import Users from './Users';
import SocialSync from './SocialSync';
import { ForcePasswordChange, Login } from './Auth';
import { Avatar } from './accountUi';
import { ROLE_LABELS, canSee } from './permissions';
import { slugify } from './fields';
import { api } from './api';
import { formatDate, liveSource } from '../lib';
import { applyColors, settings as siteSettings } from '../siteSettings';
import { DEFAULT_RUBRIQUES, articleSlug, articleStatus, rubriquesOf } from '../articles';

/* ---------------------------------------------------------------- */
/* Définition des sections                                          */
/* ---------------------------------------------------------------- */

const today = () => new Date().toISOString().slice(0, 10);
const uid = (prefix) => `${prefix}-${Date.now().toString(36)}`;
const fr = (v) => (v && typeof v === 'object' ? v.fr : v) || '';

function buildSections(data) {
  const { shows: showsFile, content, schedule } = data;
  const showOptions = showsFile.shows.map((s) => ({ value: s.slug, label: s.title }));
  const catOptions = showsFile.categories.map((c) => ({ value: c.id, label: c.label.fr }));
  const showTitle = (slug) => showsFile.shows.find((s) => s.slug === slug)?.title || slug;
  const usedInSchedule = (slug) => Object.values(schedule.templates).some((slots) => slots.some((s) => s.show === slug));
  const rubriques = rubriquesOf(content);
  const rubriqueOptions = rubriques.map((r) => ({ value: r.id, label: r.label.fr }));
  const rubriqueLabel = (id) => rubriques.find((r) => r.id === id)?.label.fr || 'Sans rubrique';
  const STATUS_LABELS = { draft: 'Brouillon', scheduled: 'Programmé', published: 'Publié' };
  /** Adresse unique d'un article, construite depuis son titre. */
  const uniqueSlug = (title, id) => {
    const base = slugify(title) || 'article';
    let slug = base;
    for (let n = 2; content.news.some((a) => a.id !== id && articleSlug(a) === slug); n++) slug = `${base}-${n}`;
    return slug;
  };

  return {
    shows: {
      label: 'Émissions',
      file: 'shows',
      key: 'shows',
      editor: {
        title: 'Émissions',
        description: 'Les 4 premières émissions « À la une » apparaissent dans le carrousel ; les 4 premières « Temps forts » dans la grille de l’accueil. L’ordre de la liste est celui du site.',
        idKey: 'slug',
        sortable: true,
        fields: [
          { name: 'title', label: 'Titre', required: true },
          { name: 'slug', label: 'Identifiant (URL)', immutable: true, hint: 'Généré depuis le titre si vide. Ex. : reveil-d-espoir', pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/, patternMessage: 'Minuscules, chiffres et tirets uniquement' },
          { name: 'category', label: 'Catégorie', type: 'select', options: catOptions, required: true },
          { name: 'host', label: 'Présentateur·rice' },
          { name: 'highlight', label: 'Temps fort de la semaine', type: 'checkbox' },
          { name: 'image', label: 'Image (16:9)', type: 'image', required: true },
          { name: 'video', label: 'Vidéo de présentation', type: 'video', hint: 'Facultatif. MP4 (H.264) ou WebM, 2 Go max. Affichée sur la page de l’émission ; pensez à enregistrer après l’envoi.' },
          { name: 'tagline', label: 'Accroche', type: 'i18n', required: true },
          { name: 'description', label: 'Description', type: 'i18nText', required: true },
        ],
        makeNew: () => ({ slug: '', title: '', category: catOptions[0]?.value, highlight: false, image: '', video: '', host: '', tagline: { fr: '', en: '' }, description: { fr: '', en: '' } }),
        beforeSave: (item, isNew) => (isNew && !item.slug ? { ...item, slug: slugify(item.title) } : item),
        summary: (s) => ({
          title: s.title,
          subtitle: `${catOptions.find((c) => c.value === s.category)?.label || s.category} · ${showsFile.episodes.filter((e) => e.show === s.slug).length} épisode(s)`,
          image: s.image,
          badges: [s.highlight && 'Temps fort', s.video && 'Vidéo'].filter(Boolean),
        }),
        canDelete: (s) => {
          const n = showsFile.episodes.filter((e) => e.show === s.slug).length;
          if (n) return `Impossible : « ${s.title} » a encore ${n} épisode(s). Supprimez-les ou réaffectez-les d’abord.`;
          if (usedInSchedule(s.slug)) return `Impossible : « ${s.title} » est utilisée dans le programme. Retirez-la de la grille d’abord.`;
          return null;
        },
      },
    },
    episodes: {
      label: 'Épisodes',
      file: 'shows',
      key: 'episodes',
      editor: {
        title: 'Épisodes',
        description: 'Les 8 plus récents apparaissent dans « Derniers épisodes » sur l’accueil. Avec une vidéo téléversée ou un identifiant YouTube, l’épisode est lisible sur la page de l’émission.',
        fields: [
          { name: 'show', label: 'Émission', type: 'select', options: showOptions, required: true },
          { name: 'id', label: 'Identifiant', immutable: true, hint: 'Généré automatiquement si vide.' },
          { name: 'title', label: 'Titre', type: 'i18n', required: true },
          { name: 'summary', label: 'Résumé', type: 'i18nText', required: true },
          { name: 'date', label: 'Date de diffusion', type: 'date', required: true },
          { name: 'duration', label: 'Durée', placeholder: '28:30', required: true, pattern: /^(\d{1,2}:)?\d{1,2}:\d{2}$/, patternMessage: 'Format mm:ss ou h:mm:ss' },
          { name: 'video', label: 'Vidéo de l’épisode', type: 'video', hint: 'MP4 (H.264) ou WebM, 2 Go max. Prioritaire sur YouTube si les deux sont renseignés ; pensez à enregistrer après l’envoi.' },
          { name: 'youtubeId', label: 'Identifiant vidéo YouTube', hint: 'La partie après « v= » dans l’URL YouTube.' },
          { name: 'image', label: 'Vignette (16:9)', type: 'image', required: true },
        ],
        makeNew: () => ({ id: '', show: showOptions[0]?.value, title: { fr: '', en: '' }, summary: { fr: '', en: '' }, duration: '', date: today(), image: '', video: '', youtubeId: '' }),
        beforeSave: (item, isNew) => (isNew && !item.id ? { ...item, id: uid(item.show.slice(0, 3)) } : item),
        sortItems: (a, b) => b.date.localeCompare(a.date),
        filters: [{ label: 'Émission', options: showOptions, test: (e, v) => e.show === v }],
        summary: (e) => ({ title: fr(e.title), subtitle: `${showTitle(e.show)} · ${formatDate(e.date, 'fr')} · ${e.duration}`, image: e.image, badges: e.video || e.youtubeId ? ['Vidéo'] : [] }),
      },
    },
    categories: {
      label: 'Catégories',
      file: 'shows',
      key: 'categories',
      editor: {
        title: 'Catégories',
        description: 'Utilisées pour filtrer les émissions.',
        sortable: true,
        fields: [
          { name: 'label', label: 'Nom', type: 'i18n', required: true },
          { name: 'id', label: 'Identifiant', immutable: true, hint: 'Généré depuis le nom si vide.' },
        ],
        makeNew: () => ({ id: '', label: { fr: '', en: '' } }),
        beforeSave: (item, isNew) => (isNew && !item.id ? { ...item, id: slugify(item.label.fr) } : item),
        summary: (c) => ({ title: c.label.fr, subtitle: `${c.label.en || '—'} · ${showsFile.shows.filter((s) => s.category === c.id).length} émission(s)` }),
        canDelete: (c) => (showsFile.shows.some((s) => s.category === c.id) ? `Impossible : des émissions utilisent la catégorie « ${c.label.fr} ».` : null),
      },
    },
    schedule: { label: 'Programme', custom: 'schedule' },
    events: {
      label: 'Événements',
      file: 'content',
      key: 'events',
      editor: {
        title: 'Événements',
        fields: [
          { name: 'title', label: 'Titre', type: 'i18n', required: true },
          { name: 'date', label: 'Date', type: 'date', required: true },
          { name: 'time', label: 'Heure', type: 'time', required: true },
          { name: 'place', label: 'Lieu', required: true, wide: true },
          { name: 'summary', label: 'Description', type: 'i18nText', required: true },
          { name: 'image', label: 'Image', type: 'image' },
        ],
        makeNew: () => ({ id: uid('evt'), date: today(), time: '10:00', place: '', image: '', title: { fr: '', en: '' }, summary: { fr: '', en: '' } }),
        sortItems: (a, b) => a.date.localeCompare(b.date),
        summary: (e) => ({ title: fr(e.title), subtitle: `${formatDate(e.date, 'fr')} · ${e.time} · ${e.place}`, image: e.image, badges: e.date < today() ? ['Passé'] : [] }),
      },
    },
    news: {
      label: 'Articles',
      file: 'content',
      key: 'news',
      editor: {
        title: 'Articles',
        description: 'Actualités du site (menu « Actualités »). Un article en brouillon ou daté dans le futur n’est pas visible des visiteurs ; « Voir » permet de le relire sur le site avant publication.',
        itemName: { add: '+ Nouvel article', new: 'Nouvel article', edit: 'Modifier l’article' },
        wide: true,
        fields: [
          { name: 'title', label: 'Titre', type: 'i18n', required: true, wide: true },
          { name: 'category', label: 'Rubrique', type: 'select', options: rubriqueOptions, required: true },
          { name: 'status', label: 'Statut', type: 'select', required: true, options: [
            { value: 'published', label: 'Publié' },
            { value: 'draft', label: 'Brouillon (invisible des visiteurs)' },
          ] },
          { name: 'date', label: 'Date de publication', type: 'date', required: true, hint: 'Une date future programme l’article : il apparaîtra tout seul ce jour-là.' },
          { name: 'author', label: 'Auteur', placeholder: 'Rédaction Hope Channel RDC' },
          { name: 'featured', label: 'À la une (mis en avant en tête des actualités et sur l’accueil)', type: 'checkbox', wide: true },
          { name: 'summary', label: 'Chapô (résumé en 1 à 3 phrases)', type: 'i18nText', required: true, hint: 'Affiché sous le titre, sur les cartes d’articles et lors d’un partage sur WhatsApp, Facebook…' },
          { name: 'body', label: 'Texte de l’article', type: 'richtext', hint: 'Laissez une ligne vide entre deux paragraphes. Les boutons ajoutent intertitres, gras, liens, listes, citations, images et vidéos YouTube ; « Aperçu » montre le rendu.' },
          { name: 'image', label: 'Image principale (16:9)', type: 'image' },
          { name: 'imageCaption', label: 'Légende / crédit de l’image', wide: true, placeholder: 'Ex. : Culte d’ouverture de la campagne. Photo : Hope Channel RDC' },
          { name: 'slug', label: 'Adresse de l’article', immutable: true, wide: true, hint: 'Créée automatiquement depuis le titre (ex. /actualites/grande-campagne-2026). Ne change plus après la création, pour ne pas casser les liens partagés.', pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/, patternMessage: 'Minuscules, chiffres et tirets uniquement' },
        ],
        makeNew: () => ({ id: uid('news'), slug: '', status: 'published', featured: false, category: rubriqueOptions[0]?.value, author: '', date: today(), image: '', imageCaption: '', title: { fr: '', en: '' }, summary: { fr: '', en: '' }, body: { fr: '', en: '' } }),
        beforeSave: (item) => (item.slug ? item : { ...item, slug: uniqueSlug(fr(item.title), item.id) }),
        idKey: 'slug',
        sortItems: (a, b) => b.date.localeCompare(a.date),
        filters: [
          { label: 'Rubrique', options: rubriqueOptions, test: (a, v) => a.category === v },
          { label: 'Statut', options: Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })), test: (a, v) => articleStatus(a) === v },
        ],
        viewUrl: (a) => `/actualites/${articleSlug(a)}`,
        summary: (a) => {
          const status = articleStatus(a);
          return {
            title: fr(a.title),
            subtitle: [rubriqueLabel(a.category), formatDate(a.date, 'fr'), a.author].filter(Boolean).join(' · '),
            image: a.image,
            badges: [status !== 'published' && STATUS_LABELS[status], a.featured && 'À la une'].filter(Boolean),
          };
        },
      },
    },
    newsCategories: {
      label: 'Rubriques',
      file: 'content',
      key: 'newsCategories',
      fallback: DEFAULT_RUBRIQUES,
      editor: {
        title: 'Rubriques des articles',
        description: 'Classent les articles et servent de filtres sur la page Actualités. L’ordre de la liste est celui du site.',
        itemName: { add: '+ Nouvelle rubrique', new: 'Nouvelle rubrique', edit: 'Modifier la rubrique' },
        sortable: true,
        fields: [
          { name: 'label', label: 'Nom', type: 'i18n', required: true },
          { name: 'id', label: 'Identifiant', immutable: true, hint: 'Généré depuis le nom si vide.' },
        ],
        makeNew: () => ({ id: '', label: { fr: '', en: '' } }),
        beforeSave: (item, isNew) => (isNew && !item.id ? { ...item, id: slugify(item.label.fr) } : item),
        summary: (c) => ({ title: c.label.fr, subtitle: `${c.label.en || '—'} · ${content.news.filter((a) => a.category === c.id).length} article(s)` }),
        canDelete: (c) => (content.news.some((a) => a.category === c.id) ? `Impossible : des articles utilisent la rubrique « ${c.label.fr} ». Changez d’abord leur rubrique.` : null),
      },
    },
    team: {
      label: 'Équipe',
      file: 'content',
      key: 'team',
      editor: {
        title: 'Équipe',
        idKey: 'name',
        sortable: true,
        fields: [
          { name: 'name', label: 'Nom', required: true },
          { name: 'role', label: 'Fonction', type: 'i18n', required: true },
          { name: 'image', label: 'Photo (carrée)', type: 'image' },
        ],
        makeNew: () => ({ name: '', role: { fr: '', en: '' }, image: '' }),
        summary: (m) => ({ title: m.name, subtitle: fr(m.role), image: m.image }),
      },
    },
    testimonials: {
      label: 'Témoignages',
      file: 'content',
      key: 'testimonials',
      editor: {
        title: 'Témoignages',
        idKey: 'name',
        sortable: true,
        fields: [
          { name: 'name', label: 'Nom et ville', required: true, placeholder: 'Clarisse, Kinshasa' },
          { name: 'text', label: 'Témoignage', type: 'i18nText', required: true },
        ],
        makeNew: () => ({ name: '', text: { fr: '', en: '' } }),
        summary: (x) => ({ title: x.name, subtitle: fr(x.text) }),
      },
    },
    network: {
      label: 'Réseau',
      file: 'content',
      key: 'network',
      editor: {
        title: 'Réseau de diffusion',
        idKey: 'city',
        sortable: true,
        fields: [
          { name: 'city', label: 'Ville', required: true },
          { name: 'channel', label: 'Canaux / fréquences', type: 'i18n', required: true },
        ],
        makeNew: () => ({ city: '', channel: { fr: '', en: '' } }),
        summary: (n) => ({ title: n.city, subtitle: fr(n.channel) }),
      },
    },
    social: { label: 'Synchro réseaux', custom: 'social' },
    stats: { label: 'Statistiques', custom: 'stats' },
    settings: { label: 'Paramètres', custom: 'settings' },
    backups: { label: 'Sauvegardes', custom: 'backups' },
    users: { label: 'Comptes', custom: 'users' },
    account: { label: 'Mon compte', custom: 'account' },
  };
}

const NAV_GROUPS = [
  ['Tableau de bord', ['dashboard', 'stats']],
  ['Contenus TV', ['shows', 'episodes', 'categories', 'schedule']],
  ['Site', ['news', 'newsCategories', 'social', 'events', 'team', 'testimonials', 'network']],
  ['Configuration', ['settings', 'users', 'backups']],
];

function Backups({ onRestored, notify }) {
  const [list, setList] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const refresh = useCallback(() => api.backups().then(setList).catch((e) => notify(e.message, 'error')), [notify]);
  useEffect(() => {
    refresh();
  }, [refresh]);

  const restore = async (name) => {
    setConfirm(null);
    try {
      await api.restore(name);
      notify('Sauvegarde restaurée.');
      await onRestored();
      refresh();
    } catch (e) {
      notify(e.message, 'error');
    }
  };

  const describe = (name) => {
    const [, file, stamp] = /^(\w+)-(.+)\.json$/.exec(name);
    const iso = stamp.replace(/^(\d{4}-\d{2}-\d{2}T\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/, '$1:$2:$3.$4Z');
    return { file: { shows: 'Émissions, épisodes, catégories', schedule: 'Programme', content: 'Contenus, coordonnées et direct', settings: 'Paramètres du site' }[file], date: new Date(iso).toLocaleString('fr-FR') };
  };

  return (
    <div>
      <h1 className="text-2xl font-bold">Sauvegardes</h1>
      <p className="mb-6 mt-1 text-sm text-gray-600">Une copie est faite automatiquement avant chaque enregistrement (30 dernières par fichier). Restaurer remplace la version actuelle — qui est elle-même sauvegardée.</p>
      <ul className="divide-y divide-gray-100 rounded-xl bg-white ring-1 ring-black/5">
        {list?.length === 0 && <li className="p-6 text-center text-sm text-gray-500">Aucune sauvegarde pour l’instant.</li>}
        {list === null && <li className="p-6 text-center text-sm text-gray-500">Chargement…</li>}
        {list?.map((name) => {
          const d = describe(name);
          return (
            <li key={name} className="flex items-center gap-4 p-3">
              <div className="flex-1">
                <p className="font-medium">{d.file}</p>
                <p className="text-xs text-gray-500">{d.date}</p>
              </div>
              {confirm === name ? (
                <span className="flex gap-1">
                  <button type="button" onClick={() => restore(name)} className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white">Confirmer</button>
                  <button type="button" onClick={() => setConfirm(null)} className="rounded-lg px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-200">Annuler</button>
                </span>
              ) : (
                <button type="button" onClick={() => setConfirm(name)} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-brand hover:bg-brand/10">Restaurer</button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Dashboard({ data, go, user }) {
  const { shows, content } = data;
  const canSettings = canSee(user, 'settings');
  const stats = [
    ['Émissions', shows.shows.length, 'shows'],
    ['Épisodes', shows.episodes.length, 'episodes'],
    ['Événements à venir', content.events.filter((e) => e.date >= today()).length, 'events'],
    ['Articles', content.news.length, 'news'],
  ].filter(([, , key]) => canSee(user, key));
  const latest = [...shows.episodes].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const liveOk = Boolean(liveSource(content.live));
  return (
    <div>
      <h1 className="text-2xl font-bold">Bonjour, {user.name}</h1>
      <p className="mt-1 text-sm text-gray-600">Bienvenue dans l’administration de Hope Channel RDC · {ROLE_LABELS[user.role]}</p>
      {user.recoveryCodesLeft === 0 && (
        <button type="button" onClick={() => go('account')} className="mt-6 block w-full rounded-xl bg-white p-4 text-left text-sm text-ink ring-1 ring-black/10 hover:ring-brand">
          🔑 Vous n’avez pas encore de codes de secours : sans eux, un mot de passe oublié ne peut pas être récupéré par vous-même. <strong className="text-brand">Créer mes codes →</strong>
        </button>
      )}
      {user.role === 'admin' && data.settings.maintenance?.enabled && (
        <button type="button" onClick={() => go('settings', 'annonce')} className="mt-6 block w-full rounded-xl bg-red-50 p-4 text-left text-sm text-red-900 ring-1 ring-red-200 hover:bg-red-100">
          ⚠ Le mode maintenance est actif : les visiteurs ne voient pas le site. <strong>Désactiver →</strong>
        </button>
      )}
      {canSettings && !liveOk && (
        <button type="button" onClick={() => go('settings', 'direct')} className="mt-6 block w-full rounded-xl bg-amber-50 p-4 text-left text-sm text-amber-900 ring-1 ring-amber-200 hover:bg-amber-100">
          ⚠ Le flux du direct n’est pas configuré : la page « Regarder » ne peut pas diffuser. <strong>Configurer →</strong>
        </button>
      )}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(([label, n, key]) => (
          <button key={key} type="button" onClick={() => go(key)} className="rounded-xl bg-white p-5 text-left ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-md">
            <span className="block font-heading text-3xl font-bold text-brand">{n}</span>
            <span className="text-sm text-gray-600">{label}</span>
          </button>
        ))}
      </div>
      {canSee(user, 'episodes') && (
      <section className="mt-8 rounded-xl bg-white p-5 ring-1 ring-black/5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Derniers épisodes</h2>
          <button type="button" onClick={() => go('episodes')} className="text-sm font-semibold text-brand hover:underline">Gérer →</button>
        </div>
        <ul className="divide-y divide-gray-100 text-sm">
          {latest.map((e) => (
            <li key={e.id} className="flex justify-between gap-4 py-2">
              <span className="truncate">{fr(e.title)}</span>
              <span className="shrink-0 text-gray-500">{formatDate(e.date, 'fr')}</span>
            </li>
          ))}
        </ul>
      </section>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- */

export default function Admin() {
  const { pathname } = useLocation();
  const [user, setUser] = useState(null); // null = vérification en cours, false = non connecté
  const [data, setData] = useState(null);
  const [section, setSection] = useState(() => pathname.split('/')[2] || 'dashboard');
  const [toast, setToast] = useState(null);
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    document.title = 'Administration | Hope Channel RDC';
    api.me().then((r) => setUser(r.authenticated ? r.user : false)).catch(() => setUser(false));
    return () => meta.remove();
  }, []);

  // Menu mobile : Échap pour fermer, page figée derrière
  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e) => e.key === 'Escape' && setNavOpen(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [navOpen]);

  const onAuthLost = useCallback(() => setUser(false), []);
  const logout = () => api.logout().finally(() => setUser(false));
  const notify = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const load = useCallback(() => api.load().then(setData).catch((e) => notify(e.message, 'error')), [notify]);
  const ready = Boolean(user && !user.mustChangePassword);
  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  const go = (key, hash) => {
    setSection(key);
    setNavOpen(false);
    window.history.replaceState(null, '', (key === 'dashboard' ? '/admin' : `/admin/${key}`) + (hash ? `#${hash}` : ''));
    window.scrollTo(0, 0);
  };

  /** Enregistre un fichier complet. Renvoie true si réussi. */
  const saveFile = async (file, next) => {
    try {
      await api.save(file, next);
      setData((d) => ({ ...d, [file]: next }));
      if (file === 'settings') {
        // Logo et couleurs de l'administration mis à jour sans recharger la page
        Object.assign(siteSettings, next);
        applyColors(next.appearance);
      }
      notify('Modifications enregistrées.');
      return true;
    } catch (e) {
      if (e.status === 401) setUser(false);
      notify(e.message, 'error');
      return false;
    }
  };

  if (user === null) return <div className="flex min-h-screen items-center justify-center text-gray-500">Chargement…</div>;
  if (!user) return <Login onLogged={setUser} />;
  if (user.mustChangePassword) return <ForcePasswordChange user={user} onDone={setUser} onLogout={logout} />;
  if (!data) return <div className="flex min-h-screen items-center justify-center text-gray-500">Chargement des données…</div>;

  const sections = buildSections(data);
  // Une section non autorisée pour ce rôle (ex. : adresse saisie à la main) ramène au tableau de bord.
  const current = canSee(user, section) ? sections[section] : null;

  let body;
  if (section === 'dashboard' || !current) body = <Dashboard data={data} go={go} user={user} />;
  else if (current.custom === 'schedule') body = <ScheduleEditor key={JSON.stringify(data.schedule).length} schedule={data.schedule} shows={data.shows.shows} onSave={(s) => saveFile('schedule', s)} onGo={go} />;
  else if (current.custom === 'settings') body = <SettingsEditor data={data} user={user} onSave={saveFile} notify={notify} onAuthLost={onAuthLost} />;
  else if (current.custom === 'account') body = <Account user={user} onUserChange={setUser} notify={notify} onAuthLost={onAuthLost} />;
  else if (current.custom === 'users') body = <Users me={user} notify={notify} onAuthLost={onAuthLost} />;
  else if (current.custom === 'stats') body = <Stats data={data} user={user} />;
  else if (current.custom === 'social') body = <SocialSync user={user} socialLinks={data.content.social} notify={notify} onAuthLost={onAuthLost} onArticleCreated={load} />;
  else if (current.custom === 'backups') body = <Backups onRestored={load} notify={notify} />;
  else {
    const fileData = data[current.file];
    body = (
      <CollectionEditor
        key={section}
        {...current.editor}
        items={fileData[current.key] ?? current.fallback ?? []}
        onSave={(items) => saveFile(current.file, { ...fileData, [current.key]: items })}
      />
    );
  }

  const label = (k) => (k === 'dashboard' ? 'Accueil' : sections[k].label);
  const navGroups = NAV_GROUPS.map(([group, keys]) => [group, keys.filter((k) => k === 'dashboard' || canSee(user, k))]).filter(([, keys]) => keys.length);
  const shown = current ? section : 'dashboard';

  return (
    <div data-admin className="min-h-screen bg-mist lg:flex">
      <aside className="sticky top-0 z-40 bg-brand-dark text-white lg:h-screen lg:w-64 lg:shrink-0 lg:overflow-y-auto">
        <div className="flex items-center justify-between gap-3 px-4 py-3 lg:p-6">
          <Logo size="sm" onDark />
          {/* Mobile : section en cours + bouton du menu */}
          <button
            type="button"
            className="flex h-11 min-w-0 items-center gap-2 rounded-full bg-white/10 pl-4 pr-3 text-sm font-semibold ring-1 ring-white/20 lg:hidden"
            aria-expanded={navOpen}
            aria-controls="admin-nav"
            aria-label={navOpen ? 'Fermer le menu' : `Menu — section : ${label(shown)}`}
            onClick={() => setNavOpen((v) => !v)}
          >
            <span className="truncate">{label(shown)}</span>
            {navOpen ? <Close className="h-5 w-5 shrink-0" /> : <MenuIcon className="h-5 w-5 shrink-0" />}
          </button>
        </div>
        {navOpen && <div className="fixed inset-0 top-[68px] -z-10 bg-ink/50 lg:hidden" onClick={() => setNavOpen(false)} aria-hidden="true" />}
        <nav
          id="admin-nav"
          aria-label="Administration"
          className={`${navOpen ? 'block' : 'hidden'} absolute inset-x-0 top-full max-h-[calc(100dvh-68px)] overflow-y-auto overscroll-contain bg-brand-dark px-3 pb-6 shadow-2xl lg:static lg:block lg:max-h-none lg:shadow-none`}
        >
          {navGroups.map(([group, keys]) => (
            <div key={group} className="mb-4">
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-white/50">{group}</p>
              {keys.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => go(k)}
                  aria-current={shown === k ? 'page' : undefined}
                  className={`block w-full rounded-lg px-3 py-3 text-left text-[15px] transition lg:py-2 lg:text-sm ${shown === k ? 'bg-white/15 font-semibold text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'}`}
                >
                  {label(k)}
                </button>
              ))}
            </div>
          ))}
          <div className="mt-6 space-y-1 border-t border-white/10 pt-4">
            <button
              type="button"
              onClick={() => go('account')}
              aria-current={shown === 'account' ? 'page' : undefined}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition ${shown === 'account' ? 'bg-white/15' : 'hover:bg-white/10'}`}
            >
              <Avatar user={user} size="h-9 w-9 text-xs" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{user.name}</span>
                <span className="block truncate text-xs text-white/60">{ROLE_LABELS[user.role]} · Mon compte</span>
              </span>
            </button>
            <a href="/" target="_blank" rel="noopener" className="block rounded-lg px-3 py-2 text-sm text-white/80 hover:bg-white/10">↗ Voir le site</a>
            <button
              type="button"
              onClick={logout}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10"
            >
              Se déconnecter
            </button>
          </div>
        </nav>
      </aside>

      <main className="mx-auto w-full min-w-0 max-w-6xl flex-1 p-4 sm:p-8">{body}</main>

      {/* En haut au centre : ne recouvre pas les boutons « Enregistrer » des panneaux */}
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex justify-center px-4">
          <div
            role={toast.type === 'error' ? 'alert' : 'status'}
            className={`max-w-md animate-fade-in rounded-xl px-5 py-3 text-sm font-medium text-white shadow-xl ${toast.type === 'error' ? 'bg-red-600' : 'bg-green-700'}`}
          >
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}
