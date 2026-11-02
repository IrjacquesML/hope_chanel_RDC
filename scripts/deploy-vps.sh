#!/usr/bin/env bash
# Mise en ligne / mise à jour de Hope Chanel RDC sur le VPS (Ubuntu, Nginx, PM2, MySQL).
# Usage, depuis le dossier du site :
#   git checkout -- . && git pull origin main && sudo bash scripts/deploy-vps.sh
# Peut être relancé à chaque mise à jour : chaque étape vérifie d'abord si elle est déjà faite.
# Ne touche qu'à ce site : son dossier, son application PM2 et son fichier Nginx.
set -euo pipefail

APP=hopechannelrdc
DIR=$(cd "$(dirname "$0")/.." && pwd)
DOMAIN=${DOMAIN:-hckinshasa-rdc.org}
NGINX_FILE=/etc/nginx/sites-available/$APP
PORT=3001
cd "$DIR"

step() { printf '\n\033[1;34m== %s\033[0m\n' "$1"; }
ok() { printf '\033[32m✔ %s\033[0m\n' "$1"; }
fail() { printf '\033[31m✘ %s\033[0m\n' "$1"; exit 1; }

[ "$(id -u)" = 0 ] || fail "Lancez ce script avec sudo (ou en root)."

# ---------------------------------------------------------------- Node.js 22+
step "1/6 Node.js"
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
if [ "$NODE_MAJOR" -lt 22 ]; then
  V=$(curl -fsSL https://nodejs.org/dist/index.json | grep -o '"version":"v22\.[0-9.]*"' | head -1 | cut -d'"' -f4)
  [ -n "$V" ] || fail "Version de Node.js 22 introuvable"
  TMP=$(mktemp -d)
  curl -fsSL -o "$TMP/node.tar.xz" "https://nodejs.org/dist/$V/node-$V-linux-x64.tar.xz"
  EXPECTED=$(curl -fsSL "https://nodejs.org/dist/$V/SHASUMS256.txt" | grep " node-$V-linux-x64.tar.xz$" | cut -d' ' -f1)
  echo "$EXPECTED  $TMP/node.tar.xz" | sha256sum -c - >/dev/null || fail "Téléchargement de Node.js corrompu"
  tar -xJf "$TMP/node.tar.xz" -C "$TMP"
  SRC="$TMP/node-$V-linux-x64"
  install -m 755 "$SRC/bin/node" /usr/local/bin/node
  rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack
  cp -a "$SRC/lib/node_modules/npm" "$SRC/lib/node_modules/corepack" /usr/local/lib/node_modules/
  ln -sf ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm
  ln -sf ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx
  rm -rf "$TMP"
  hash -r
  pm2 update >/dev/null 2>&1 || true   # PM2 repart avec le nouveau Node
fi
node -e "require('node:sqlite')" 2>/dev/null || fail "Node.js $(node -v) trop ancien (22.13 minimum)"
ok "Node.js $(node -v)"

# ---------------------------------------------------------------- .env
step "2/6 Fichier .env"
[ -f .env ] || fail "Fichier .env absent : copiez .env.example en .env et remplissez-le"
if ! grep -q '^MYSQL_DATABASE=' .env; then
  cp .env ".env.avant-$(date +%Y%m%d-%H%M%S)"
  # Anciens noms DB_* → MYSQL_* ; les valeurs sont recopiées telles quelles
  sed -i -e 's/^DB_HOST=/MYSQL_HOST=/' -e 's/^DB_PORT=/MYSQL_PORT=/' -e 's/^DB_DATABASE=/MYSQL_DATABASE=/' \
         -e 's/^DB_USERNAME=/MYSQL_USER=/' -e 's/^DB_USER=/MYSQL_USER=/' -e 's/^DB_PASSWORD=/MYSQL_PASSWORD=/' .env
fi
add_env() { grep -q "^$1=" .env || echo "$1=$2" >> .env; }
add_env PORT "$PORT"
add_env NODE_ENV production
add_env TRUST_PROXY 1
add_env SITE_URL "https://$DOMAIN"
chmod 600 .env
for k in ADMIN_EMAIL ADMIN_PASSWORD MYSQL_DATABASE MYSQL_USER MYSQL_PASSWORD; do
  grep -q "^$k=." .env || fail "$k manque dans .env"
done
PW=$(grep '^ADMIN_PASSWORD=' .env | head -1 | cut -d= -f2-)
[ ${#PW} -ge 8 ] || fail "ADMIN_PASSWORD doit faire au moins 8 caractères"
ok ".env complet"

# ---------------------------------------------------------------- Code et compilation
step "3/6 Dépendances et compilation"
git config core.fileMode false
npm ci --no-audit --no-fund
npm run build
ok "Site compilé dans dist/"

# ---------------------------------------------------------------- PM2
step "4/6 Serveur Node (PM2)"
pm2 delete "$APP" >/dev/null 2>&1 || true
pm2 start server/index.js --name "$APP" --cwd "$DIR" --node-args="--env-file=.env" >/dev/null
pm2 save >/dev/null
for i in $(seq 1 20); do
  CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "http://127.0.0.1:$PORT/api/login" -H 'Content-Type: application/json' -d '{"email":"test@test.cd","password":"x"}' || true)
  [ "$CODE" = 401 ] && break
  sleep 1
done
if [ "$CODE" != 401 ]; then
  pm2 logs "$APP" --lines 30 --nostream --no-color
  fail "Le serveur ne répond pas correctement (code $CODE) : voir le journal ci-dessus"
fi
ok "Serveur Node en marche sur le port $PORT (connexion : réponse 401 attendue = OK)"

# ---------------------------------------------------------------- Nginx
step "5/6 Nginx"
if grep -q "proxy_pass http://127.0.0.1:$PORT" "$NGINX_FILE" 2>/dev/null; then
  ok "Nginx transmet déjà les demandes au serveur Node"
else
  CERT=/etc/letsencrypt/live/$DOMAIN
  [ -f "$CERT/fullchain.pem" ] || fail "Certificat HTTPS introuvable dans $CERT"
  [ -f "$NGINX_FILE" ] && cp "$NGINX_FILE" "$NGINX_FILE.avant-$(date +%Y%m%d-%H%M%S)"
  NEW=$(mktemp)
  cat > "$NEW" <<NGINX
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl;
    server_name $DOMAIN www.$DOMAIN;

    ssl_certificate $CERT/fullchain.pem;
    ssl_certificate_key $CERT/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    client_max_body_size 10m;   # envoi d'images depuis l'administration

    # Tout passe par le serveur Node : site, API (connexion…), direct /hls/
    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_buffering off;
        proxy_read_timeout 60s;
    }
}
NGINX
  OLD_BACKUP=$(mktemp)
  [ -f "$NGINX_FILE" ] && cp "$NGINX_FILE" "$OLD_BACKUP"
  cp "$NEW" "$NGINX_FILE"
  ln -sf "$NGINX_FILE" "/etc/nginx/sites-enabled/$APP"
  if nginx -t 2>/dev/null; then
    systemctl reload nginx
    ok "Nginx transmet maintenant les demandes au serveur Node"
  else
    cp "$OLD_BACKUP" "$NGINX_FILE"
    nginx -t || true
    fail "Configuration Nginx refusée : l'ancienne est remise, aucun site n'a été touché"
  fi
  rm -f "$NEW" "$OLD_BACKUP"
fi

# ---------------------------------------------------------------- Vérification
step "6/6 Vérification publique"
# Nginx recharge en douceur : on laisse quelques secondes aux anciens processus pour s'arrêter
for i in $(seq 1 10); do
  CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "https://$DOMAIN/api/login" --resolve "$DOMAIN:443:127.0.0.1" -H 'Content-Type: application/json' -d '{"email":"test@test.cd","password":"x"}' || true)
  [ "$CODE" = 401 ] && break
  sleep 1
done
[ "$CODE" = 401 ] || fail "https://$DOMAIN/api/login répond $CODE au lieu de 401"
ok "https://$DOMAIN/api/login répond correctement (plus de 405)"

printf '\n\033[1;32mTerminé.\033[0m Connexion : https://%s/login avec ADMIN_EMAIL / ADMIN_PASSWORD du fichier .env\n' "$DOMAIN"
