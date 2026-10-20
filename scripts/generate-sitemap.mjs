// Génère public/sitemap.xml à partir de src/data/shows.json (le serveur le sert aussi dynamiquement).
import { readFileSync, writeFileSync } from 'node:fs';
import { buildSitemap } from './sitemap-lib.mjs';

const { shows } = JSON.parse(readFileSync(new URL('../src/data/shows.json', import.meta.url), 'utf8'));
const { xml, count } = buildSitemap(shows);
writeFileSync(new URL('../public/sitemap.xml', import.meta.url), xml);
console.log(`sitemap.xml : ${count} URL`);
