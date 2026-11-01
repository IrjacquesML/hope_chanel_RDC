export const BASE_URL = process.env.SITE_URL || 'https://www.hopechanelrdc.org';

const STATIC_ROUTES = [
  ['/', '1.0', 'daily'],
  ['/regarder', '0.9', 'daily'],
  ['/programme', '0.9', 'daily'],
  ['/emissions', '0.8', 'weekly'],
  ['/episodes', '0.8', 'daily'],
  ['/dons', '0.8', 'monthly'],
  ['/dons/reguliers', '0.6', 'monthly'],
  ['/dons/temoignages', '0.5', 'monthly'],
  ['/evenements', '0.7', 'weekly'],
  ['/apropos', '0.6', 'monthly'],
  ['/contact', '0.6', 'yearly'],
  ['/actualites', '0.7', 'weekly'],
  ['/reseau', '0.6', 'monthly'],
  ['/comment-nous-regarder', '0.6', 'monthly'],
  ['/faq', '0.4', 'yearly'],
  ['/confidentialite', '0.3', 'yearly'],
  ['/conditions', '0.3', 'yearly'],
];

export function buildSitemap(shows, baseUrl = BASE_URL) {
  const base = baseUrl.replace(/\/+$/, '');
  const routes = [...STATIC_ROUTES, ...shows.map((s) => [`/emissions/${s.slug}`, '0.7', 'weekly'])];
  const today = new Date().toISOString().slice(0, 10);
  const urls = routes
    .map(([p, prio, freq]) => `  <url><loc>${base}${p}</loc><lastmod>${today}</lastmod><changefreq>${freq}</changefreq><priority>${prio}</priority></url>`)
    .join('\n');
  return { count: routes.length, xml: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n` };
}
