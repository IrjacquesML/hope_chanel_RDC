# Hope Channel RDC — site web

Site responsive (React 18 + Vite + Tailwind CSS 3 + React Router), bilingue FR/EN.

## Démarrer

```bash
npm install
npm run dev       # site http://localhost:5173 + API http://localhost:3001
```

> Windows / PowerShell : si « l'exécution de scripts est désactivée », utilisez `npm.cmd run dev`
> ou exécutez une fois `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

## Administration — `/admin`

Ouvrez **http://localhost:5173/admin** et connectez-vous. Au premier démarrage, le compte défini dans `.env` (`ADMIN_EMAIL`, `ADMIN_PASSWORD`) devient le premier **Administrateur** ; les autres comptes se créent ensuite dans **Comptes**.

### Comptes, rôles et mots de passe

| Rôle | Accès |
|---|---|
| Administrateur | Tout : contenus, paramètres, sauvegardes, gestion des comptes |
| Rédacteur | Émissions, épisodes, catégories, programme, événements, actualités, équipe, témoignages, réseau, statistiques |
| Technicien régie | Lecteur du direct, diffusion (plateformes, vMix, OBS, clés de flux), statistiques |

- Les droits sont vérifiés **par le serveur** : un rédacteur ne peut pas modifier les coordonnées ou les paramètres, même en appelant l'API directement ; un technicien ne peut modifier que la section `live` de `content.json`.
- **Mon compte** (chaque utilisateur) : nom, e-mail (mot de passe exigé), photo, changement de mot de passe, **codes de secours**, sessions ouvertes (fermeture une à une ou toutes), historique de connexion.
- **Comptes** (administrateurs) : création (mot de passe provisoire affiché une fois, à changer à la première connexion), modification, rôle, réinitialisation du mot de passe, déconnexion, désactivation, suppression, journal des connexions. Il reste toujours au moins un administrateur actif ; on ne peut ni supprimer ni rétrograder son propre compte.
- **Mot de passe oublié ?** sur la page de connexion : e-mail + un code de secours (8 codes à usage unique, créés dans « Mon compte ») + nouveau mot de passe.
- Règles : 10 caractères minimum, lettres et chiffres, ni l'adresse e-mail ni un mot de passe courant. Stockage chiffré (scrypt). Changer ou réinitialiser un mot de passe ferme les autres sessions.
- **Dernier recours** (plus aucun administrateur ne peut se connecter) : sur le serveur, ajoutez `ADMIN_RESET=1` dans `.env` et redémarrez : le compte `ADMIN_EMAIL` redevient administrateur actif avec le mot de passe `ADMIN_PASSWORD` (à changer à la connexion). Retirez ensuite `ADMIN_RESET=1`.

#### Base MySQL des comptes

Les comptes et le journal des connexions sont enregistrés dans une base **MySQL / MariaDB** dès que `MYSQL_DATABASE` est défini dans `.env` (sinon : fichiers `db/users.json` et `db/auth-log.json`).

- Tables `users` et `auth_log`, créées automatiquement au démarrage (`server/db.js`). Le journal garde un an d'historique.
- Au premier démarrage avec MySQL, les comptes et le journal des fichiers `db/*.json` sont **repris dans la base** : le login administrateur reste le même. Ensuite, seule la base fait foi (les fichiers JSON ne sont plus mis à jour).
- Créer la base et son utilisateur (une fois, en `root` : phpMyAdmin → SQL, ou `mysql -u root -p`) :

  ```sql
  CREATE DATABASE hopechanel_rdc CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  CREATE USER 'hopechanel'@'localhost' IDENTIFIED BY 'un-mot-de-passe-solide';
  GRANT ALL PRIVILEGES ON hopechanel_rdc.* TO 'hopechanel'@'localhost';
  ```

  puis renseigner `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD` dans `.env` (voir `.env.example`).
- Sauvegarde : `mysqldump -u hopechanel -p hopechanel_rdc > comptes.sql`.

| Section | Ce qu'on y gère |
|---|---|
| Émissions | Titre, catégorie, image, accroche/description FR-EN, « À la une » (carrousel), « Temps fort », ordre |
| Épisodes | Titre, résumé, date, durée, vignette, vidéo YouTube (lisible sur la page de l'émission) |
| Catégories | Libellés FR/EN, ordre |
| Programme | Créneaux de chaque modèle de journée, semaine type, détection des chevauchements |
| Événements, Actualités, Équipe, Témoignages, Réseau | Ajout / modification / suppression |
| Paramètres | Voir ci-dessous : identité et logo, coordonnées, réseaux sociaux, lecteur du direct, diffusion (vMix, OBS, plateformes), apparence, annonce et maintenance, référencement, sécurité |
| Sauvegardes | Restauration d'une version précédente |

### Paramètres — `/admin/settings`

| Onglet | Contenu |
|---|---|
| Identité & logo | Nom, slogan, description (Google), texte de présentation, copyright, adresse du site ; logo, favicon, image de partage ; aperçus Google et partage |
| Coordonnées | Adresse, e-mail, téléphones, WhatsApp, heures d'ouverture, position de la carte |
| Réseaux sociaux | YouTube, Facebook, TikTok, Instagram, X, WhatsApp, Telegram, LinkedIn (un réseau vide n'est pas affiché) |
| Lecteur du direct | Jet-Stream (intégration ou HLS), YouTube ; aperçu et diagnostic |
| Diffusion | Serveur RTMP + clé de flux de YouTube, Facebook, TikTok, Jet-Stream et d'une plateforme libre ; **vMix, encodeur recommandé** (API web : statut, direct, enregistrement, entrées, Cut/Fondu ; fiche des 3 destinations à recopier dans vMix) ; **OBS Studio** en alternative (connexion obs-websocket : envoi de la destination, démarrage/arrêt du direct et de l'enregistrement, scènes, santé du flux) ; réglages d'encodage conseillés |
| Apparence | Couleurs du site, aperçu en direct et contrôle de lisibilité |
| Annonce & maintenance | Bandeau d'annonce (texte FR/EN, lien, couleur) ; mode maintenance (les visiteurs voient une page d'attente, l'administrateur connecté voit le site) |
| Référencement & intégrations | Google Analytics 4, vérification Google Search Console et Bing, identifiant d'application Facebook |

- Les paramètres publics sont dans `src/data/settings.json` (sauvegardés comme les autres fichiers).
- Les **réglages confidentiels** (clés de diffusion, mot de passe OBS, adresse vMix) sont dans `db/private.json`, jamais envoyé aux visiteurs. Sauvegardez ce fichier avec `db/`.
- **vMix (recommandé)** : activer *Settings → Web Controller* (port 8088). Les commandes sont relayées par le serveur du site, qui doit pouvoir joindre le PC vMix (même réseau ou VPN). vMix diffuse vers 3 destinations à la fois : les 3 premières plateformes cochées.
- **OBS (alternative)** : activer *Outils → Paramètres du serveur WebSocket* (OBS 28+, port 4455). La connexion part du navigateur : ouvrez l'administration sur le PC qui fait tourner OBS (`localhost`). OBS ne diffuse que vers une destination à la fois (la « destination principale »).
- En production, le serveur injecte le titre, la description, le favicon, l'image de partage et les données structurées dans `index.html` à partir des paramètres.

Fonctionnement :
- Les modifications sont écrites dans `src/data/*.json` ; le site public les charge via `/api/data` à chaque visite (actualisez la page pour les voir).
- Une sauvegarde est créée dans `backups/` avant chaque écriture (30 dernières par fichier).
- Les images téléversées sont redimensionnées (1600 px) et converties en WebP dans le navigateur, puis stockées dans `uploads/`.
- Les vidéos des émissions et des épisodes (MP4 H.264 ou WebM, 2 Go max.) sont envoyées telles quelles dans `uploads/videos/`, sans conversion, et lues par le lecteur du site.
- Sécurité : session par cookie `HttpOnly` / `SameSite=Strict` (8 h), blocage 15 min après 5 échecs de connexion par adresse IP (10 par compte), validation des données côté serveur (slugs, références entre émissions, épisodes et programme).
- Les identifiants (slug d'émission, id d'épisode/catégorie) ne sont pas modifiables après création, pour ne pas casser les liens ; une émission utilisée par des épisodes ou le programme ne peut pas être supprimée.

### Articles (`/admin/news`) et rubriques

- Chaque article a un titre, un chapô, un texte enrichi (syntaxe simple : `## intertitre`, `**gras**`, `[lien](https://…)`, listes, citations, images, adresse YouTube seule sur une ligne = vidéo), une rubrique, un auteur, une image et une adresse `/actualites/<slug>`.
- Statut **brouillon**, ou **publié** avec une date : une date future programme l'article. Les règles sont dans `src/articles.js`, partagées par le site, le serveur et la compilation.
- Les brouillons et articles programmés ne sont **jamais** envoyés aux visiteurs : `/api/data` les retire pour qui n'est pas connecté, et le plugin `hide-draft-articles` de `vite.config.js` les retire du site compilé.
- Partage : le serveur remplit `og:title`, `og:description` et `og:image` de chaque article publié (aperçu WhatsApp / Facebook) ; les articles publiés sont ajoutés au sitemap.

### Synchronisation des réseaux sociaux (`/admin/social`) — `server/social.js`

- **YouTube** : flux public de la chaîne, sans clé (adresse reprise de Paramètres → Réseaux sociaux si elle n'est pas saisie). **Facebook** (page) et **Instagram** (compte professionnel) : API Graph de Meta avec un jeton de page longue durée.
- Synchronisation automatique (15 min à 24 h) et bouton « Synchroniser maintenant ». Chaque réseau : contenus publiés automatiquement ou « à valider ».
- Réglages, jetons et contenus importés : `db/social.json` (jamais sur GitHub ; les jetons ne sont jamais renvoyés au navigateur). Images Facebook/Instagram copiées dans `uploads/social/` (leurs adresses expirent).
- Public : `GET /api/social/feed` (contenus publiés) → bloc « Sur nos réseaux » de l'accueil et page `/sur-nos-reseaux`. « Créer un article » transforme un contenu importé en article brouillon.
- TikTok : non pris en charge (exige une application TikTok for Developers validée).

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

Sur le serveur : définir `ADMIN_EMAIL`, `ADMIN_PASSWORD` (mot de passe long, utilisé pour créer le premier administrateur), `NODE_ENV=production` (cookie `Secure`, HTTPS requis) et `SITE_URL`. Le site doit tourner derrière HTTPS (Nginx, Caddy, ou l'hébergeur). Sauvegardez régulièrement `src/data/`, `uploads/` et `db/`.

`npm run preview` sert uniquement le site statique (sans API ni admin).

## Direct vMix sans plateforme : MediaMTX

Un navigateur ne lit pas directement le flux de vMix : **MediaMTX** (gratuit, un seul fichier) le reçoit et le convertit pour le site. **Le serveur du site démarre MediaMTX tout seul** (`npm run dev` / `npm start`) et crée la clé de diffusion au premier démarrage.

```
vMix ──RTMP :1935──▶ MediaMTX ──▶ serveur du site (/hls/live/) ──▶ visiteurs
```

**Installation (une fois)** : téléchargez MediaMTX sur <https://github.com/bluenviron/mediamtx/releases> — version `windows_amd64` sur le PC, `linux_amd64` sur le VPS — et placez l'exécutable dans `C:\mediamtx\` (Windows), `/usr/local/bin/` (Linux) ou dans le dossier `mediamtx/` du projet. Ne le lancez pas à la main.

**Utilisation** : Admin → Diffusion → cadre **« Diffuser vMix sur le site »**. Trois étapes qui passent au vert toutes seules :
1. relais vidéo démarré ;
2. dans vMix (roue ⚙ à côté de *Stream* → *Custom RTMP Server*), coller l'**URL** et la **clé** affichées ;
3. cliquer sur *Stream* dans vMix : le direct s'affiche en tête de l'accueil.

**Sur le VPS** : ouvrez uniquement le port **1935/tcp** (`sudo ufw allow 1935/tcp`) ; l'URL affichée dans l'admin utilise automatiquement le nom du serveur. Si le nom de domaine passe par un proxy (Cloudflare…), utilisez l'adresse IP du VPS dans vMix : `rtmp://IP-DU-VPS:1935/live`. Options : `MEDIAMTX_BIN` (chemin de l'exécutable), `MEDIAMTX_AUTO=0` (ne pas le démarrer).

**Bande passante** : chaque spectateur consomme le débit du flux (≈ 4 à 6 Mb/s en 1080p, 2,5 à 4 Mb/s en 720p). Avec une connexion de VPS de 1 Gb/s, comptez environ 150 spectateurs simultanés en 1080p ; au-delà, passez par Jet-Stream ou un CDN, ou baissez la qualité.

## Structure

| Dossier | Contenu |
|---|---|
| `src/data/shows.json` | Émissions, catégories et épisodes (futur CMS) |
| `src/data/schedule.json` | Grille horaire (heure de Kinshasa, UTC+1) |
| `src/data/content.json` | Contact, réseaux sociaux, flux du direct, événements, actualités, équipe, témoignages |
| `src/data/settings.json` | Identité du site, logo, couleurs, annonce, maintenance, intégrations |
| `db/private.json` | Réglages confidentiels (clés de diffusion, OBS, vMix) — créé au premier enregistrement |
| `db/users.json` | Comptes de l'administration (mots de passe chiffrés, codes de secours chiffrés) |
| `db/auth-log.json` | Journal des connexions et des actions sur les comptes (500 derniers évènements) |
| `server/auth.js` | Comptes, rôles, sessions, mots de passe, codes de secours |
| `src/i18n/translations.js` | Textes d'interface FR / EN |
| `src/components/` | En-tête, pied de page, carrousel, cartes, sections |
| `src/pages/` | Une page par route |
| `scripts/generate-sitemap.mjs` | Sitemap généré depuis les données |
| `server/index.js` | API d’administration (Express) et serveur de production |
| `server/stats.js` | Statistiques de visionnage (SQLite) |
| `src/analytics.js` | Mesure d’audience côté navigateur |
| `src/admin/` | Interface d'administration |

## À configurer avant la mise en ligne

- **Direct** (par ordre de priorité) : `content.json > live.jetstreamEmbedUrl` (lecteur Jet-Stream intégré), `live.hlsUrl` (flux HLS, lu via hls.js chargé à la demande), `live.youtubeUrl` puis `live.youtubeChannelId` (YouTube).
- **Paiements** : le formulaire `/dons` est une démonstration ; brancher un prestataire Mobile Money / carte **côté serveur** (aucune donnée de carte ne doit transiter par le front).
- **Newsletter & contact** : brancher les `TODO` sur un service d'e-mail.
- **Domaine** : `https://hckinshasa-rdc.org` (index.html, siteSettings.js, sitemap, robots.txt) ; à changer à ces endroits en cas de nouveau domaine.
- **Coordonnées** : adresse et téléphones sont des placeholders.
- **SEO** : pour un référencement optimal d'une SPA, envisager un prérendu (ex. `vite-plugin-prerender`) ou une migration Next.js.
- **Hébergement** : configurer la redirection de toutes les routes vers `index.html` (SPA).

Images : Unsplash (licence libre), servies en WebP redimensionné et chargées en lazy-load.
