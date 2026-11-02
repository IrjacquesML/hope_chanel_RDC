import settings from './data/settings.json';

export { settings };

const DEFAULT_URL = 'https://hckinshasa-rdc.org';

/** Nom du site et adresse publique (sans « / » final), tels que définis dans l'administration. */
export const siteName = () => settings.site?.name || 'Hope Channel RDC';
export const siteUrl = () => (settings.site?.url || DEFAULT_URL).replace(/\/+$/, '');

/** « #0B3C7A » → « 11 60 122 » (format attendu par les variables CSS de Tailwind). */
export function hexToRgb(hex) {
  const m = /^#?([\da-f]{6})$/i.exec(hex || '');
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return `${n >> 16} ${(n >> 8) & 255} ${n & 255}`;
}

const COLOR_VARS = { brand: '--brand', brandDark: '--brand-dark', brandLight: '--brand-light', accent: '--accent', accentDark: '--accent-dark' };

export function applyColors(appearance = {}, root = document.documentElement) {
  for (const [key, cssVar] of Object.entries(COLOR_VARS)) {
    const rgb = hexToRgb(appearance[key]);
    if (rgb) root.style.setProperty(cssVar, rgb);
  }
}

function setHeadTag(selector, create, attrs) {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

const meta = (attr, name, content) => setHeadTag(`meta[${attr}="${name}"]`, () => document.createElement('meta'), { [attr]: name, content });

/** Applique les paramètres du site à la page : couleurs, favicon, partage, vérifications, mesure d'audience. */
export function applySiteSettings() {
  const { site = {}, appearance = {}, integrations = {} } = settings;
  applyColors(appearance);
  if (appearance.brand) meta('name', 'theme-color', appearance.brand);
  if (site.favicon) {
    setHeadTag('link[rel="icon"]', () => document.createElement('link'), { rel: 'icon', href: site.favicon });
    setHeadTag('link[rel="apple-touch-icon"]', () => document.createElement('link'), { rel: 'apple-touch-icon', href: site.favicon });
  }
  if (site.ogImage) meta('property', 'og:image', /^https?:/.test(site.ogImage) ? site.ogImage : siteUrl() + site.ogImage);
  meta('property', 'og:site_name', siteName());
  if (integrations.googleSiteVerification) meta('name', 'google-site-verification', integrations.googleSiteVerification);
  if (integrations.bingSiteVerification) meta('name', 'msvalidate.01', integrations.bingSiteVerification);
  if (integrations.facebookAppId) meta('property', 'fb:app_id', integrations.facebookAppId);
  loadGoogleAnalytics(integrations.googleAnalyticsId);
}

/** Google Analytics 4 (facultatif, en plus des statistiques intégrées). Jamais chargé sur /admin. */
function loadGoogleAnalytics(id) {
  if (!/^G-[A-Z0-9]{4,}$/.test(id || '') || location.pathname.startsWith('/admin') || window.gtag) return;
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments); // eslint-disable-line prefer-rest-params
  };
  window.gtag('js', new Date());
  window.gtag('config', id, { anonymize_ip: true });
}
