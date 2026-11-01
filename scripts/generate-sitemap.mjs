// Génère public/sitemap.xml à partir de src/data/shows.json (le serveur le sert aussi dynamiquement).
import { readFileSync, writeFileSync } from 'node:fs';
import { buildSitemap } from './sitemap-lib.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../src/data/${name}.json`, import.meta.url), 'utf8'));
const { shows } = read('shows');
const { xml, count } = buildSitemap(shows, process.env.SITE_URL || read('settings').site.url);
writeFileSync(new URL('../public/sitemap.xml', import.meta.url), xml);
console.log(`sitemap.xml : ${count} URL`);
