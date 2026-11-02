/**
 * Articles (actualités) : règles partagées par le site, le serveur et la compilation.
 * Un article n'est visible des visiteurs que s'il est publié et que sa date est arrivée (heure de Kinshasa).
 */

export const DEFAULT_RUBRIQUES = [
  { id: 'vie-de-la-chaine', label: { fr: 'Vie de la chaîne', en: 'Channel news' } },
  { id: 'eglise', label: { fr: 'Église', en: 'Church' } },
  { id: 'sante', label: { fr: 'Santé', en: 'Health' } },
  { id: 'famille', label: { fr: 'Famille', en: 'Family' } },
  { id: 'jeunesse', label: { fr: 'Jeunesse', en: 'Youth' } },
  { id: 'societe', label: { fr: 'Société', en: 'Society' } },
];

/** Date du jour à Kinshasa (UTC+1, pas d'heure d'été), au format AAAA-MM-JJ. */
export const kinshasaToday = () => new Date(Date.now() + 3600e3).toISOString().slice(0, 10);

export const isPublished = (a, today = kinshasaToday()) => a.status !== 'draft' && (a.date || '') <= today;

/** Articles visibles des visiteurs, du plus récent au plus ancien. */
export const publicArticles = (news = [], today = kinshasaToday()) =>
  news.filter((a) => isPublished(a, today)).sort((a, b) => b.date.localeCompare(a.date));

export const articleSlug = (a) => a.slug || a.id;

export const rubriquesOf = (content) => (content?.newsCategories?.length ? content.newsCategories : DEFAULT_RUBRIQUES);

/** Statut lisible dans l'administration. */
export function articleStatus(a, today = kinshasaToday()) {
  if (a.status === 'draft') return 'draft';
  return a.date > today ? 'scheduled' : 'published';
}

/** Texte brut d'un contenu enrichi (résumé automatique, temps de lecture, référencement). */
export const plainText = (md = '') =>
  md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{2,3}\s+|^>\s?|^[-*]\s+|^\d+\.\s+/gm, '')
    .replace(/\*\*|\*/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export const readingMinutes = (md = '') => Math.max(1, Math.round(plainText(md).split(' ').filter(Boolean).length / 200));
