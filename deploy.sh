#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Blendfold Media Dashboard — one-shot VPS setup & redeploy (Ubuntu 22.04/24.04, Debian 12)
#
# First run (from the project root, as root or with sudo):
#   sudo DOMAIN=dash.example.com LETSENCRYPT_EMAIL=you@example.com \
#        ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='a-strong-password' \
#        META_ACCESS_TOKEN='EAAB...' ./deploy.sh
#
# Anything not passed is asked for interactively (when a terminal is attached).
# Re-run ./deploy.sh any time after `git pull` to rebuild and restart — it is idempotent:
# existing .env values, database and users are kept.
#
# Optional: APP_NAME (blendfold), APP_USER (blendfold), PORT (3000), DB_NAME, DB_USER,
#           META_APP_SECRET, NODE_MAJOR (22), SKIP_SSL=1
# ─────────────────────────────────────────────────────────────────────────────
set -Eeuo pipefail

APP_NAME="${APP_NAME:-blendfold}"
APP_USER="${APP_USER:-blendfold}"
PORT="${PORT:-3000}"
DB_NAME="${DB_NAME:-blendfold}"
DB_USER="${DB_USER:-blendfold}"
NODE_MAJOR="${NODE_MAJOR:-22}"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$APP_DIR/.env"

log()  { printf '\n\033[1;34m▸ %s\033[0m\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }
die()  { printf '\n\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }
trap 'die "Failed at line $LINENO: $BASH_COMMAND"' ERR

[[ $EUID -eq 0 ]] || die "Run as root: sudo ./deploy.sh"
[[ -f "$APP_DIR/package.json" ]] || die "Run this from the project root (package.json not found)."
command -v apt-get >/dev/null || die "This script supports Debian/Ubuntu (apt) only."

ask() { # ask VAR "Prompt" [secret]
  local var="$1" prompt="$2" secret="${3:-}" value
  [[ -n "${!var:-}" ]] && return 0
  [[ -t 0 ]] || return 0
  if [[ -n "$secret" ]]; then read -rsp "  $prompt: " value; echo; else read -rp "  $prompt: " value; fi
  printf -v "$var" '%s' "$value"
}

env_get() { [[ -f "$ENV_FILE" ]] && grep -E "^$1=" "$ENV_FILE" | tail -1 | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/' || true; }
env_set() { # upsert KEY="value" in .env
  local key="$1" val="$2" esc
  esc=$(printf '%s' "$val" | sed -e 's/[\/&|]/\\&/g')
  if grep -qE "^$key=" "$ENV_FILE"; then sed -i "s|^$key=.*|$key=\"$esc\"|" "$ENV_FILE"; else echo "$key=\"$val\"" >>"$ENV_FILE"; fi
}

# ─── 1. System packages ─────────────────────────────────────────────────────
log "Installing system packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl ca-certificates gnupg openssl nginx postgresql postgresql-contrib >/dev/null
ok "nginx, PostgreSQL, openssl"

if ! command -v node >/dev/null || [[ "$(node -v | sed -E 's/v([0-9]+).*/\1/')" -lt 20 ]]; then
  log "Installing Node.js $NODE_MAJOR"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
ok "Node $(node -v), npm $(npm -v)"

# ─── 2. App user ────────────────────────────────────────────────────────────
if ! id "$APP_USER" &>/dev/null; then
  useradd --system --create-home --shell /usr/sbin/nologin "$APP_USER"
  ok "Created system user $APP_USER"
fi

# ─── 3. Configuration (.env) ────────────────────────────────────────────────
log "Configuring environment"
FIRST_RUN=0
if [[ ! -f "$ENV_FILE" ]]; then
  FIRST_RUN=1
  [[ -f "$APP_DIR/.env.example" ]] && cp "$APP_DIR/.env.example" "$ENV_FILE" || touch "$ENV_FILE"
  ok "Created .env from .env.example"
fi
chmod 600 "$ENV_FILE"

DOMAIN="${DOMAIN:-$(env_get APP_DOMAIN)}"
ask DOMAIN "Domain for the dashboard (blank = serve on the server IP)"
[[ -n "${DOMAIN:-}" ]] && env_set APP_DOMAIN "$DOMAIN"

DB_PASS="$(env_get DB_PASSWORD)"
[[ -n "$DB_PASS" ]] || DB_PASS="$(openssl rand -hex 24)"
env_set DB_PASSWORD "$DB_PASS"
env_set DATABASE_URL "postgresql://$DB_USER:$DB_PASS@127.0.0.1:5432/$DB_NAME?schema=public"

AUTH_SECRET_CUR="$(env_get AUTH_SECRET)"
if [[ -z "$AUTH_SECRET_CUR" || "$AUTH_SECRET_CUR" == "change-me" ]]; then env_set AUTH_SECRET "$(openssl rand -hex 32)"; ok "Generated AUTH_SECRET"; fi

if [[ -z "$(env_get META_ACCESS_TOKEN)" ]]; then
  ask META_ACCESS_TOKEN "Meta access token (blank = sample data mode for now)" secret
  if [[ -n "${META_ACCESS_TOKEN:-}" ]]; then env_set META_ACCESS_TOKEN "$META_ACCESS_TOKEN"; env_set META_MOCK "false"; ok "Meta token saved"; else env_set META_MOCK "true"; warn "No Meta token — running with sample data. Add META_ACCESS_TOKEN to .env and re-run."; fi
elif [[ -n "${META_ACCESS_TOKEN:-}" ]]; then
  env_set META_ACCESS_TOKEN "$META_ACCESS_TOKEN"; env_set META_MOCK "false"; ok "Meta token updated"
fi
[[ -n "${META_APP_SECRET:-}" ]] && env_set META_APP_SECRET "$META_APP_SECRET"
[[ -n "$(env_get META_API_VERSION)" ]] || env_set META_API_VERSION "v23.0"
[[ -n "$(env_get META_CACHE_SECONDS)" ]] || env_set META_CACHE_SECONDS "900"

# ─── 4. PostgreSQL ──────────────────────────────────────────────────────────
log "Setting up PostgreSQL"
systemctl enable --now postgresql >/dev/null 2>&1
runuser -u postgres -- psql -v ON_ERROR_STOP=1 -q <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$DB_USER') THEN
    CREATE ROLE "$DB_USER" LOGIN PASSWORD '$DB_PASS';
  ELSE
    ALTER ROLE "$DB_USER" WITH LOGIN PASSWORD '$DB_PASS';
  END IF;
END \$\$;
SQL
if ! runuser -u postgres -- psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1; then
  runuser -u postgres -- createdb -O "$DB_USER" "$DB_NAME"
  ok "Created database $DB_NAME"
fi
ok "Database ready"

# ─── 5. Build ───────────────────────────────────────────────────────────────
log "Installing dependencies and building (this takes a few minutes)"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
# Keep `git pull` working as root/sudo on a directory owned by the app user
command -v git >/dev/null && git config --system --get-all safe.directory 2>/dev/null | grep -qx "$APP_DIR" || { command -v git >/dev/null && git config --system --add safe.directory "$APP_DIR"; } || true
as_app() { runuser -u "$APP_USER" -- env HOME="/home/$APP_USER" NEXT_TELEMETRY_DISABLED=1 bash -c "cd '$APP_DIR' && $*"; }
as_app "npm ci --no-audit --no-fund --loglevel=error"
as_app "npx prisma migrate deploy"
ok "Database migrated"
as_app "npm run build"
ok "Build complete"

# ─── 6. First admin ─────────────────────────────────────────────────────────
ADMIN_COUNT="$(runuser -u postgres -- psql -d "$DB_NAME" -tAc "SELECT count(*) FROM \"User\" WHERE role='ADMIN'" | tr -d '[:space:]')"
if [[ "$ADMIN_COUNT" == "0" ]]; then
  log "Creating the first admin"
  ask ADMIN_EMAIL "Admin email"
  ask ADMIN_PASSWORD "Admin password (min 8 chars)" secret
  ADMIN_NAME="${ADMIN_NAME:-Admin}"
  if [[ -n "${ADMIN_EMAIL:-}" && -n "${ADMIN_PASSWORD:-}" ]]; then
    runuser -u "$APP_USER" -- env HOME="/home/$APP_USER" bash -c "cd '$APP_DIR' && node --env-file=.env scripts/create-admin.mjs \"\$0\" \"\$1\" \"\$2\"" "$ADMIN_EMAIL" "$ADMIN_PASSWORD" "$ADMIN_NAME"
  else
    warn "No admin created. Later run: sudo -u $APP_USER node --env-file=.env scripts/create-admin.mjs EMAIL PASSWORD"
  fi
fi

# ─── 7. systemd service ─────────────────────────────────────────────────────
log "Configuring the $APP_NAME service"
cat >/etc/systemd/system/$APP_NAME.service <<UNIT
[Unit]
Description=Blendfold Media Dashboard
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=production
Environment=PORT=$PORT
Environment=HOSTNAME=127.0.0.1
Environment=NEXT_TELEMETRY_DISABLED=1
ExecStart=$(command -v node) $APP_DIR/node_modules/next/dist/bin/next start -p $PORT -H 127.0.0.1
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable "$APP_NAME" >/dev/null 2>&1
systemctl restart "$APP_NAME"
ok "Service running on 127.0.0.1:$PORT"

# ─── 8. nginx ───────────────────────────────────────────────────────────────
log "Configuring nginx"
SERVER_NAME="${DOMAIN:-_}"
cat >/etc/nginx/sites-available/$APP_NAME <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name $SERVER_NAME;

    client_max_body_size 5m;

    location /_next/static/ {
        proxy_pass http://127.0.0.1:$PORT;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 120s;
    }

    add_header X-Frame-Options SAMEORIGIN always;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;
}
NGINX
ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/$APP_NAME
[[ "$SERVER_NAME" == "_" ]] && rm -f /etc/nginx/sites-enabled/default
nginx -t -q
systemctl reload nginx
ok "nginx proxying to the app"

if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  ufw allow 'Nginx Full' >/dev/null && ok "Firewall: allowed HTTP/HTTPS"
fi

# ─── 9. HTTPS ───────────────────────────────────────────────────────────────
if [[ -n "${DOMAIN:-}" && -z "${SKIP_SSL:-}" ]]; then
  log "Setting up HTTPS for $DOMAIN"
  apt-get install -y -qq certbot python3-certbot-nginx >/dev/null
  if [[ -d "/etc/letsencrypt/live/$DOMAIN" ]]; then
    certbot --nginx -d "$DOMAIN" --non-interactive --redirect --reinstall >/dev/null 2>&1 || true
    env_set COOKIE_SECURE "true"; ok "Certificate already present"
  else
    ask LETSENCRYPT_EMAIL "Email for Let's Encrypt renewal notices"
    if [[ -n "${LETSENCRYPT_EMAIL:-}" ]] && certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$LETSENCRYPT_EMAIL" --redirect; then
      env_set COOKIE_SECURE "true"; ok "HTTPS enabled"
    else
      env_set COOKIE_SECURE "false"; warn "HTTPS not set up (check DNS points at this server, then re-run)."
    fi
  fi
  systemctl restart "$APP_NAME"
else
  env_set COOKIE_SECURE "false"
  systemctl restart "$APP_NAME"
fi

# ─── 10. Health check ───────────────────────────────────────────────────────
log "Checking the app"
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then
    URL="http://${DOMAIN:-$(hostname -I | awk '{print $1}')}"
    [[ "$(env_get COOKIE_SECURE)" == "true" ]] && URL="https://$DOMAIN"
    printf '\n\033[1;32m✓ Blendfold Media Dashboard is live at %s\033[0m\n' "$URL"
    [[ "$(env_get META_MOCK)" == "true" ]] && warn "Sample data mode is on (META_MOCK=true)."
    echo "  Logs:     journalctl -u $APP_NAME -f"
    echo "  Redeploy: git pull && sudo ./deploy.sh"
    exit 0
  fi
  sleep 2
done
die "The app didn't respond on port $PORT. Check: journalctl -u $APP_NAME -n 100"
