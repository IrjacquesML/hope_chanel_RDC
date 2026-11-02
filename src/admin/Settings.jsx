import { useEffect, useState } from 'react';
import Broadcast from './Broadcast';
import { canSeeTab } from './permissions';
import { Field, getPath, setPath } from './fields';
import { SOCIALS } from '../components/Socials';
import { liveSource, parseEmbedUrl, img } from '../lib';
import { hexToRgb } from '../siteSettings';

/* ---------------------------------------------------------------- */
/* Onglets : chacun modifie un fichier (content / settings) ou a son propre écran */
/* ---------------------------------------------------------------- */

const DEFAULT_COLORS = { brand: '#0B3C7A', brandDark: '#082C5A', brandLight: '#1E5BA8', accent: '#F59E0B', accentDark: '#D97706' };

const TABS = [
  {
    key: 'identite',
    label: 'Identité & logo',
    file: 'settings',
    groups: [
      ['Identité du site', [
        { name: 'site.name', label: 'Nom du site / de la chaîne', required: true },
        { name: 'site.url', label: 'Adresse du site', type: 'url', placeholder: 'https://hckinshasa-rdc.org', hint: 'Utilisée pour le référencement, le partage et le plan du site.' },
        { name: 'site.tagline', label: 'Slogan', type: 'i18n', hint: 'Affiché dans l’onglet du navigateur sur l’accueil : « Nom — Slogan ».' },
        { name: 'site.description', label: 'Description du site', type: 'i18nText', hint: 'Texte affiché par Google sous le nom du site (150 caractères environ).' },
        { name: 'site.copyright', label: 'Mention de copyright', hint: 'Affiché : « © année Mention. Tous droits réservés. »' },
      ]],
      ['Logo et icônes', [
        { name: 'site.logo', label: 'Logo (format bannière, fond intégré ou transparent)', type: 'image', hint: 'Affiché dans l’en-tête, le pied de page, l’administration et la page de maintenance. Hauteur affichée : 32 à 44 px.' },
        { name: 'site.favicon', label: 'Icône du site (favicon, carrée)', type: 'image', hint: 'Petite icône de l’onglet du navigateur et de l’écran d’accueil des téléphones. Image carrée, 512 × 512 px idéalement.' },
        { name: 'site.ogImage', label: 'Image de partage (réseaux sociaux)', type: 'image', hint: 'Affichée quand un lien du site est partagé sur WhatsApp, Facebook, X… Format 1200 × 630 px.' },
      ]],
    ],
  },
  {
    key: 'apropos',
    label: 'À propos',
    file: 'settings',
    groups: [
      ['Page « À propos » (menu À propos du site)', [
        { name: 'aboutPage.title', label: 'Titre de la page', type: 'i18n', wide: true },
        { name: 'aboutPage.intro', label: 'Phrase d’introduction', type: 'i18nText', hint: 'Affichée sous le titre, et par Google pour cette page.' },
        { name: 'aboutPage.mission', label: 'Texte « Notre mission »', type: 'i18nText', hint: 'Le texte principal de présentation de la chaîne.' },
      ]],
      ['Pied de page', [
        { name: 'site.about', label: 'Présentation (pied de page, rubrique « À propos »)', type: 'i18nText', hint: 'Court texte affiché en bas de toutes les pages. Laissez vide pour garder le texte par défaut.' },
      ]],
    ],
    intro: 'Textes de présentation de la chaîne. Le texte anglais (EN) s’affiche quand le visiteur choisit l’anglais ; s’il est vide, le texte français est utilisé.',
  },
  {
    key: 'coordonnees',
    label: 'Coordonnées',
    file: 'content',
    groups: [
      ['Coordonnées', [
        { name: 'contact.address', label: 'Adresse', wide: true },
        { name: 'contact.email', label: 'E-mail', type: 'email' },
        { name: 'contact.whatsapp', label: 'Numéro WhatsApp', placeholder: '+243 …', hint: 'Le lien WhatsApp de la page Contact est créé à partir de ce numéro.' },
        { name: 'contact.phones', label: 'Téléphones', type: 'list' },
        { name: 'contact.hours', label: 'Heures d’ouverture', type: 'i18n', placeholder: 'Lun.–ven. 8 h – 17 h', hint: 'Facultatif. Affiché sur la page Contact et en pied de page.' },
      ]],
      ['Carte (page Contact)', [
        { name: 'contact.map.lat', label: 'Latitude', type: 'number', hint: 'Sur Google Maps : clic droit sur le lieu → les deux nombres affichés (latitude, longitude).' },
        { name: 'contact.map.lon', label: 'Longitude', type: 'number' },
      ]],
    ],
  },
  {
    key: 'reseaux',
    label: 'Réseaux sociaux',
    file: 'content',
    groups: [
      ['Réseaux sociaux', SOCIALS.map(({ key, label }) => ({
        name: `social.${key}`,
        label,
        type: 'url',
        placeholder: { youtube: 'https://www.youtube.com/@…', tiktok: 'https://www.tiktok.com/@…', whatsapp: 'https://wa.me/243…', telegram: 'https://t.me/…' }[key] || 'https://…',
      }))],
    ],
    intro: 'Seuls les réseaux renseignés s’affichent sur le site (pied de page et menu mobile). Laissez vide pour masquer un réseau.',
  },
  {
    key: 'partenaires',
    label: 'Partenaires',
    file: 'content',
    groups: [
      ['Partenaires (pied de page)', [
        { name: 'partners', label: 'Partenaires', type: 'links', hint: 'Seul le nom est affiché sur le site ; un clic dessus ouvre le site du partenaire dans un nouvel onglet.' },
      ]],
    ],
    intro: 'Ajoutez le nom et l’adresse du site de chaque partenaire. La liste s’affiche dans cet ordre en bas de toutes les pages. Laissez vide pour masquer la rubrique.',
  },
  {
    key: 'direct',
    label: 'Lecteur du direct',
    file: 'content',
    groups: [
      ['Lecteur du direct vMix (accueil et page « Regarder »)', [
        { name: 'live.selfHosted', label: 'Lire le direct depuis le serveur du site (MediaMTX)', type: 'checkbox', wide: true, hint: 'Conseillé : vMix envoie au serveur du site (onglet Diffusion → « Diffuser vMix sur le site »), sans plateforme payante. Prioritaire sur les options ci-dessous.' },
        { name: 'live.hlsUrl', label: 'URL du flux HLS (.m3u8)', type: 'url', wide: true, hint: 'Flux HLS d’une plateforme (Jet-Stream…), si vous n’utilisez pas le serveur du site.' },
        { name: 'live.jetstreamEmbedUrl', label: 'URL d’intégration Jet-Stream', wide: true, placeholder: 'https://…  ou  <iframe src="…"></iframe>', hint: 'Autre possibilité : le lecteur Jet-Stream (URL ou code <iframe>). Prioritaire sur l’URL HLS.' },
        { name: 'live.poster', label: 'Image d’attente du lecteur', type: 'image' },
      ]],
    ],
  },
  { key: 'diffusion', label: 'Diffusion (vMix, OBS…)', custom: 'broadcast' },
  {
    key: 'apparence',
    label: 'Apparence',
    file: 'settings',
    groups: [
      ['Couleurs du site', [
        { name: 'appearance.brand', label: 'Couleur principale', type: 'color', hint: 'Boutons, liens, titres.' },
        { name: 'appearance.brandDark', label: 'Principale foncée', type: 'color', hint: 'Pied de page, survols, menu de l’administration.' },
        { name: 'appearance.brandLight', label: 'Principale claire', type: 'color' },
        { name: 'appearance.accent', label: 'Couleur d’accent', type: 'color', hint: 'Bouton « Faire un don », mises en avant (texte foncé dessus).' },
        { name: 'appearance.accentDark', label: 'Accent foncée', type: 'color' },
      ]],
    ],
  },
  {
    key: 'annonce',
    label: 'Annonce & maintenance',
    file: 'settings',
    groups: [
      ['Bandeau d’annonce', [
        { name: 'announcement.enabled', label: 'Afficher le bandeau en haut du site', type: 'checkbox', wide: true },
        { name: 'announcement.text', label: 'Texte de l’annonce', type: 'i18n', wide: true, placeholder: 'Ex. : Grande campagne d’évangélisation ce samedi à 15 h !' },
        { name: 'announcement.link', label: 'Lien (facultatif)', placeholder: '/evenements  ou  https://…' },
        { name: 'announcement.tone', label: 'Couleur du bandeau', type: 'select', required: true, options: [
          { value: 'info', label: 'Bleu (information)' },
          { value: 'success', label: 'Vert (bonne nouvelle)' },
          { value: 'warning', label: 'Orange (important)' },
          { value: 'urgent', label: 'Rouge (urgent)' },
        ] },
      ]],
      ['Mode maintenance', [
        { name: 'maintenance.enabled', label: 'Activer le mode maintenance', type: 'checkbox', wide: true, hint: 'Les visiteurs voient une page d’attente. Vous, connecté à l’administration, voyez toujours le site.' },
        { name: 'maintenance.message', label: 'Message affiché aux visiteurs', type: 'i18nText' },
      ]],
    ],
  },
  {
    key: 'seo',
    label: 'Référencement & intégrations',
    file: 'settings',
    groups: [
      ['Mesure d’audience', [
        { name: 'integrations.googleAnalyticsId', label: 'Google Analytics 4 (facultatif)', placeholder: 'G-XXXXXXXXXX', hint: 'En plus des statistiques intégrées. Attention : Google Analytics dépose des cookies, ce qui peut nécessiter un bandeau de consentement.' },
      ]],
      ['Vérification des moteurs de recherche', [
        { name: 'integrations.googleSiteVerification', label: 'Google Search Console', placeholder: 'Code de la balise meta', hint: 'Search Console → Ajouter une propriété → Balise HTML : copiez la valeur de « content ».' },
        { name: 'integrations.bingSiteVerification', label: 'Bing Webmaster Tools', placeholder: 'Code de la balise meta' },
        { name: 'integrations.facebookAppId', label: 'Identifiant d’application Facebook', hint: 'Facultatif : statistiques de partage sur Facebook.' },
      ]],
    ],
  },
];

/* ---------------------------------------------------------------- */
/* Encarts spécifiques                                              */
/* ---------------------------------------------------------------- */

const LIVE_STEPS = [
  ['La régie', 'produit le programme, celui qui part déjà vers l’émetteur TV.'],
  ['vMix', 'transforme ce signal en flux Internet et l’envoie au serveur du site (voir l’onglet « Diffusion »). À défaut : OBS Studio.'],
  ['Le serveur du site', 'reçoit le flux (relais MediaMTX) et le prépare pour les navigateurs. Pour des milliers de spectateurs, une plateforme comme Jet-Stream peut prendre le relais.'],
  ['Le site', 'affiche le direct tout seul en tête de l’accueil et sur la page « Regarder ».'],
];

function LiveHelp() {
  return (
    <div className="mb-5 rounded-lg bg-brand/5 p-4 ring-1 ring-brand/10">
      <p className="mb-3 text-sm font-semibold text-brand">Comment le direct arrive sur le site</p>
      <ol className="grid gap-3 sm:grid-cols-4">
        {LIVE_STEPS.map(([title, text], i) => (
          <li key={title} className="text-sm text-gray-700">
            <span className="mb-1 flex items-center gap-2 font-semibold text-ink">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-xs text-white">{i + 1}</span>
              {title}
            </span>
            {text}
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-gray-600">La fréquence TV (TNT, satellite) ne peut pas être lue par un navigateur : seul un flux Internet peut s’afficher sur le site.</p>
    </div>
  );
}

/** Indique ce qui a été reconnu dans la configuration du direct et propose un aperçu. */
function LiveStatus({ live }) {
  const [preview, setPreview] = useState(false);
  const source = liveSource(live);
  let message;
  let tone = 'text-green-800 bg-green-50 ring-green-200';
  if (live.selfHosted) message = '✓ Serveur du site : le direct envoyé par vMix démarrera seul en tête de l’accueil.';
  else if (live.jetstreamEmbedUrl && !parseEmbedUrl(live.jetstreamEmbedUrl)) {
    message = 'URL d’intégration Jet-Stream non reconnue. Collez une adresse en https://… ou le code <iframe> fourni par Jet-Stream.';
    tone = 'text-red-800 bg-red-50 ring-red-200';
  } else if (source?.type === 'embed') message = '✓ Lecteur Jet-Stream détecté : il sera affiché sur la page « Regarder ».';
  else if (source?.type === 'hls') message = '✓ Flux HLS : il démarrera seul en tête de l’accueil et sur la page « Regarder ».';
  else {
    message = 'Aucun direct configuré : la page « Regarder » affichera un message d’attente.';
    tone = 'text-amber-900 bg-amber-50 ring-amber-200';
  }
  return (
    <div className="mt-4 space-y-3 sm:col-span-2">
      <p role="status" className={`rounded-lg p-3 text-sm ring-1 ${tone}`}>{message}</p>
      {source?.type === 'embed' && (
        <>
          <button type="button" onClick={() => setPreview((v) => !v)} className="text-sm font-semibold text-brand hover:underline">
            {preview ? 'Masquer l’aperçu' : '▶ Aperçu du lecteur'}
          </button>
          {preview && (
            <div className="aspect-video max-w-xl overflow-hidden rounded-lg bg-ink">
              <iframe title="Aperçu du direct" src={source.src.replace('autoplay=1', 'autoplay=0')} allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen className="h-full w-full" />
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Rapport de contraste WCAG entre deux couleurs hexadécimales. */
function contrast(a, b) {
  const lum = (hex) => {
    const [r, g, bl] = hexToRgb(hex).split(' ').map((v) => {
      const c = Number(v) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Aperçu des couleurs sur de vrais composants, avec vérification de lisibilité. */
function ColorPreview({ appearance, onReset }) {
  const colors = { ...DEFAULT_COLORS, ...appearance };
  const valid = Object.values(colors).every((c) => hexToRgb(c));
  const vars = valid
    ? { '--brand': hexToRgb(colors.brand), '--brand-dark': hexToRgb(colors.brandDark), '--brand-light': hexToRgb(colors.brandLight), '--accent': hexToRgb(colors.accent), '--accent-dark': hexToRgb(colors.accentDark) }
    : {};
  const warnings = valid
    ? [
        contrast(colors.brand, '#FFFFFF') < 4.5 && 'Texte blanc peu lisible sur la couleur principale : choisissez une teinte plus foncée.',
        contrast(colors.brandDark, '#FFFFFF') < 4.5 && 'Texte blanc peu lisible sur la couleur principale foncée (pied de page).',
        contrast(colors.accent, '#111827') < 4.5 && 'Texte foncé peu lisible sur la couleur d’accent : choisissez une teinte plus claire.',
      ].filter(Boolean)
    : ['Une couleur est invalide : utilisez le format #RRGGBB.'];
  return (
    <div className="mt-4 space-y-3 sm:col-span-2">
      <div style={vars} className="overflow-hidden rounded-xl ring-1 ring-black/10">
        <div className="flex flex-wrap items-center gap-3 bg-white p-4">
          <span className="font-heading font-bold text-brand">Aperçu</span>
          <span className="btn-primary">Bouton principal</span>
          <span className="btn-accent">Faire un don</span>
          <span className="btn-outline">Bouton secondaire</span>
        </div>
        <div className="bg-brand-dark p-4 text-sm text-white/85">Pied de page · <span className="font-semibold text-accent">Titre en accent</span></div>
      </div>
      {warnings.map((w) => <p key={w} className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">⚠ {w}</p>)}
      <button type="button" onClick={onReset} className="text-sm font-semibold text-brand hover:underline">Rétablir les couleurs d’origine</button>
    </div>
  );
}

/** Aperçu du résultat dans Google et lors d'un partage. */
function SharePreview({ settings }) {
  const { site } = settings;
  const title = site.tagline?.fr ? `${site.name} — ${site.tagline.fr}` : site.name;
  return (
    <div className="mt-4 grid gap-4 sm:col-span-2 md:grid-cols-2">
      <div className="rounded-xl bg-white p-4 ring-1 ring-black/10">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Aperçu Google</p>
        <p className="truncate text-xs text-gray-600">{site.url}</p>
        <p className="truncate text-lg text-[#1a0dab]">{title}</p>
        <p className="line-clamp-2 text-sm text-gray-700">{site.description?.fr || <em className="text-gray-400">Pas de description</em>}</p>
        {(site.description?.fr || '').length > 160 && <p className="mt-2 text-xs text-amber-800">Description longue : Google la coupera vers 160 caractères.</p>}
      </div>
      <div className="overflow-hidden rounded-xl bg-white ring-1 ring-black/10">
        <p className="p-4 pb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Aperçu d’un partage</p>
        <div className="aspect-[1200/630] bg-mist">{site.ogImage && <img src={img(site.ogImage, 600, 1200 / 630)} alt="" className="h-full w-full object-cover" />}</div>
        <div className="p-3">
          <p className="truncate font-semibold">{title}</p>
          <p className="truncate text-xs text-gray-600">{site.url.replace(/^https?:\/\//, '')}</p>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */

export default function SettingsEditor({ data, user, onSave, notify, onAuthLost }) {
  // Onglets autorisés pour ce rôle (le technicien régie ne voit que le direct et la diffusion)
  const tabs = TABS.filter((t) => canSeeTab(user, t.key));
  const [tab, setTab] = useState(() => tabs.find((t) => t.key === location.hash.slice(1))?.key || tabs[0].key);
  const [drafts, setDrafts] = useState({ content: data.content, settings: data.settings });
  const [busy, setBusy] = useState(false);
  const dirtyFiles = ['content', 'settings'].filter((f) => JSON.stringify(drafts[f]) !== JSON.stringify(data[f]));

  // Prévient la perte de modifications non enregistrées
  useEffect(() => {
    if (!dirtyFiles.length) return;
    const warn = (e) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirtyFiles.length]);

  const choose = (key) => {
    setTab(key);
    window.history.replaceState(null, '', `#${key}`);
  };

  const save = async () => {
    setBusy(true);
    for (const file of dirtyFiles) if (!(await onSave(file, drafts[file]))) break;
    setBusy(false);
  };

  const current = tabs.find((t) => t.key === tab);
  const draft = current.file && drafts[current.file];
  const update = (name, v) => setDrafts((d) => ({ ...d, [current.file]: setPath(d[current.file], name, v) }));
  const dirtyTabs = new Set(tabs.filter((t) => t.file && dirtyFiles.includes(t.file) && t.groups.some(([, fields]) => fields.some((f) => JSON.stringify(getPath(drafts[t.file], f.name)) !== JSON.stringify(getPath(data[t.file], f.name))))).map((t) => t.key));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Paramètres</h1>
          <p className="mt-1 text-sm text-gray-600">Identité du site, coordonnées, réseaux sociaux, diffusion en direct et configuration générale.</p>
        </div>
        {!current.custom && (
          <div className="flex items-center gap-3">
            {dirtyFiles.length > 0 && (
              <button type="button" onClick={() => setDrafts({ content: data.content, settings: data.settings })} className="text-sm text-gray-600 hover:text-ink">Annuler les modifications</button>
            )}
            <button type="button" disabled={!dirtyFiles.length || busy} onClick={save} className="btn-primary disabled:opacity-50">{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
          </div>
        )}
      </div>

      <div role="tablist" aria-label="Rubriques des paramètres" className="-mx-4 mb-6 flex gap-1 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => choose(t.key)}
            className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${tab === t.key ? 'bg-brand text-white' : 'bg-white text-gray-700 ring-1 ring-black/10 hover:text-brand'}`}
          >
            {t.label}
            {dirtyTabs.has(t.key) && <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-accent align-middle" aria-label="(modifié)" />}
          </button>
        ))}
      </div>

      {current.custom === 'broadcast' && <Broadcast notify={notify} onAuthLost={onAuthLost} />}

      {!current.custom && (
        <div role="tabpanel" className="space-y-6">
          {current.intro && <p className="text-sm text-gray-600">{current.intro}</p>}
          {current.groups.map(([title, fields]) => (
            <section key={title} className="rounded-xl bg-white p-6 ring-1 ring-black/5">
              <h2 className="mb-4 font-semibold">{title}</h2>
              {current.key === 'direct' && <LiveHelp />}
              <div className="grid gap-4 sm:grid-cols-2">
                {fields.map((def) => (
                  <Field key={def.name} def={def} value={getPath(draft, def.name)} onChange={(v) => update(def.name, v)} />
                ))}
                {current.key === 'direct' && <LiveStatus live={draft.live} />}
                {current.key === 'apparence' && <ColorPreview appearance={draft.appearance} onReset={() => update('appearance', DEFAULT_COLORS)} />}
                {current.key === 'identite' && title === 'Logo et icônes' && <SharePreview settings={drafts.settings} />}
              </div>
            </section>
          ))}
          {dirtyFiles.length > 0 && (
            <div className="sticky bottom-4 flex items-center justify-between gap-4 rounded-xl bg-ink px-5 py-3 text-sm text-white shadow-xl">
              <span>Modifications non enregistrées</span>
              <button type="button" disabled={busy} onClick={save} className="btn-accent py-2">{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
