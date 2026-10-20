# Hope Chanel RDC — site web

Site responsive (React 18 + Vite + Tailwind CSS 3 + React Router), bilingue FR/EN.

## Démarrer

```bash
npm install
npm run dev       # site http://localhost:5173 + API http://localhost:3001
```

> Windows / PowerShell : si « l'exécution de scripts est désactivée », utilisez `npm.cmd run dev`
> ou exécutez une fois `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

## Administration — `/admin`

Ouvrez **http://localhost:5173/admin** et connectez-vous avec l’e-mail et le mot de passe définis dans `.env` (`ADMIN_EMAIL`, `ADMIN_PASSWORD`).

| Section | Ce qu'on y gère |
|---|---|
| Émissions | Titre, catégorie, image, accroche/description FR-EN, « À la une » (carrousel), « Temps fort », ordre |
| Épisodes | Titre, résumé, date, durée, vignette, vidéo YouTube (lisible sur la page de l'émission) |
| Catégories | Libellés FR/EN, ordre |
| Programme | Créneaux de chaque modèle de journée, semaine type, détection des chevauchements |
| Événements, Actualités, Équipe, Témoignages, Réseau | Ajout / modification / suppression |
| Direct & coordonnées | Flux YouTube ou HLS, adresse, téléphones, e-mail, carte, réseaux sociaux |
| Sauvegardes | Restauration d'une version précédente |

Fonctionnement :
- Les modifications sont écrites dans `src/data/*.json` ; le site public les charge via `/api/data` à chaque visite (actualisez la page pour les voir).
- Une sauvegarde est créée dans `backups/` avant chaque écriture (30 dernières par fichier).
- Les images téléversées sont redimensionnées (1600 px) et converties en WebP dans le navigateur, puis stockées dans `uploads/`.
- Sécurité : session par cookie `HttpOnly` / `SameSite=Strict` (8 h), blocage 15 min après 5 échecs de connexion, validation des données côté serveur (slugs, références entre émissions, épisodes et programme).
- Les identifiants (slug d'émission, id d'épisode/catégorie) ne sont pas modifiables après création, pour ne pas casser les liens ; une émission utilisée par des épisodes ou le programme ne peut pas être supprimée.

## Statistiques de visionnage — `/admin` → Statistiques

Mesure d'audience intégrée, **anonyme et sans cookie** (pas de bandeau de consentement nécessaire) :

- **Pages vues** et **visiteurs** (personnes différentes par jour), pages les plus consultées.
- **Lancements de lecture** et **temps réellement regardé** pour le direct et chaque épisode (via l'API du lecteur YouTube, ou le lecteur HLS).
- **Spectateurs du direct en ce moment**, heures de visionnage du direct (heure de Kinshasa).
- **Provenance** (WhatsApp, Facebook, Google, accès direct…), **appareils**, **langue**.
- Comparaison avec la période précédente, export **CSV** (ouvrable dans Excel).

Fonctionnement : le navigateur envoie de petits événements à `/api/track` ; ils sont stockés dans `db/stats.sqlite` (SQLite intégré à Node.js, rien à installer) et conservés 400 jours. Un visiteur est identifié par un hachage de son adresse IP et de son navigateur, salé avec une valeur aléatoire qui change chaque jour et n'est jamais enregistrée : on peut compter les visiteurs d'une journée, mais pas suivre une personne dans le temps. Les robots, les pages `/admin` et les navigateurs en mode « Do Not Track » sont ignorés.

Derrière un proxy (Nginx, hébergeur), définir `TRUST_PROXY=1` pour que l'adresse IP réelle soit utilisée.

## Production

```bash
npm run build     # compile le site dans dist/ (+ public/sitemap.xml)
npm start         # serveur Node : site + API + /admin sur le port PORT (3001 par défaut)
```

Sur le serveur : définir `ADMIN_EMAIL`, `ADMIN_PASSWORD` (mot de passe long), `NODE_ENV=production` (cookie `Secure`, HTTPS requis) et `SITE_URL`. Le site doit tourner derrière HTTPS (Nginx, Caddy, ou l'hébergeur). Sauvegardez régulièrement `src/data/`, `uploads/` et `db/`.

`npm run preview` sert uniquement le site statique (sans API ni admin).

## Structure

| Dossier | Contenu |
|---|---|
| `src/data/shows.json` | Émissions, catégories et épisodes (futur CMS) |
| `src/data/schedule.json` | Grille horaire (heure de Kinshasa, UTC+1) |
| `src/data/content.json` | Contact, réseaux sociaux, flux du direct, événements, actualités, équipe, témoignages |
| `src/i18n/translations.js` | Textes d'interface FR / EN |
| `src/components/` | En-tête, pied de page, carrousel, cartes, sections |
| `src/pages/` | Une page par route |
| `scripts/generate-sitemap.mjs` | Sitemap généré depuis les données |
| `server/index.js` | API d’administration (Express) et serveur de production |
| `server/stats.js` | Statistiques de visionnage (SQLite) |
| `src/analytics.js` | Mesure d’audience côté navigateur |
| `src/admin/` | Interface d'administration |

## À configurer avant la mise en ligne

- **Direct** : `content.json > live.youtubeChannelId` (YouTube) ou `live.hlsUrl` (flux HLS, lu via hls.js chargé à la demande).
- **Paiements** : le formulaire `/dons` est une démonstration ; brancher un prestataire Mobile Money / carte **côté serveur** (aucune donnée de carte ne doit transiter par le front).
- **Newsletter & contact** : brancher les `TODO` sur un service d'e-mail.
- **Domaine** : remplacer `https://www.hopechanelrdc.org` (index.html, useSeo.js, sitemap, robots.txt) et ajouter `public/og-image.png` (1200×630).
- **Coordonnées** : adresse et téléphones sont des placeholders.
- **SEO** : pour un référencement optimal d'une SPA, envisager un prérendu (ex. `vite-plugin-prerender`) ou une migration Next.js.
- **Hébergement** : configurer la redirection de toutes les routes vers `index.html` (SPA).

Images : Unsplash (licence libre), servies en WebP redimensionné et chargées en lazy-load.
