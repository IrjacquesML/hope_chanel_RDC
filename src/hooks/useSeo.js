import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const SITE = 'Hope Chanel RDC';
const BASE_URL = 'https://www.hopechanelrdc.org';

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
  useEffect(() => {
    const fullTitle = title ? `${title} | ${SITE}` : `${SITE} — La télévision de l'espoir`;
    const url = BASE_URL + pathname;
    document.title = fullTitle;
    if (description) {
      setMeta('name', 'description', description);
      setMeta('property', 'og:description', description);
    }
    setMeta('property', 'og:title', fullTitle);
    setMeta('property', 'og:url', url);
    if (image) setMeta('property', 'og:image', image);
    const canonical = document.head.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute('href', url);
  }, [title, description, image, pathname]);
}
