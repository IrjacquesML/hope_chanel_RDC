import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useLang } from '../i18n/LanguageContext';
import { settings, siteName, siteUrl } from '../siteSettings';

function setMeta(attr, name, content) {
  let el = document.head.querySelector(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

/** Met à jour title, description, Open Graph et canonical pour chaque page. */
export function useSeo({ title, description, image }) {
  const { pathname } = useLocation();
  const { tr } = useLang();
  useEffect(() => {
    const site = siteName();
    const tagline = tr(settings.site?.tagline);
    const fullTitle = title ? `${title} | ${site}` : tagline ? `${site} — ${tagline}` : site;
    const url = siteUrl() + pathname;
    document.title = fullTitle;
    description ||= tr(settings.site?.description);
    if (description) {
      setMeta('name', 'description', description);
      setMeta('property', 'og:description', description);
    }
    setMeta('property', 'og:title', fullTitle);
    setMeta('property', 'og:url', url);
    if (image) setMeta('property', 'og:image', image);
    const canonical = document.head.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute('href', url);
  }, [title, description, image, pathname, tr]);
}
