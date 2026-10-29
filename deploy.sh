#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Blendfold Media Dashboard — one-shot VPS setup & redeploy with pm2
# (Ubuntu 22.04/24.04, Debian 12)
#
# First run (from the project root, with sudo):
#   sudo DOMAIN=dash.example.com LETSENCRYPT_EMAIL=you@example.com \
#        ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='a-strong-password' \
#        META_ACCESS_TOKEN='EAAB...' ./deploy.sh
#
# Anything not passed is asked for interactively (when a terminal is attached).
# Re-run ./deploy.sh any time after `git pull` to rebuild and restart — it is idempotent:
# existing .env values, database, users and the chosen port are kept.
#
# The app runs under pm2 as the user who ran sudo (so it shows in *your* `pm2 list`).
# Optional: APP_NAME (blendfold), APP_USER (default: $SUDO_USER), PORT (default: first
#           free port from 3000), DB_NAME, DB_USER, META_APP_SECRET, NODE_MAJOR (22), SKIP_SSL=1
# ─────────────────────────────────────────────────────────────────────────────
set -Eeuo pipefail

APP_NAME="${APP_NAME:-blendfold}"
APP_USER="${APP_USER:-${SUDO_USER:-root}}"
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
id "$APP_USER" &>/dev/null || die "User '$APP_USER' does not exist (set APP_USER=...)."
APP_HOME="$(getent passwd "$APP_USER" | cut -d: -f6)"

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

# Run a command as the app user, in the project dir, with their HOME (so pm2 uses their daemon).
as_app() { runuser -u "$APP_USER" -- env HOME="$APP_HOME" APP_NAME="$APP_NAME" NEXT_TELEMETRY_DISABLED=1 PATH="$PATH" bash -c "cd '$APP_DIR' && $*"; }
port_busy() { ss -ltnH "sport = :$1" 2>/dev/null | grep -q .; }

# ─── 1. System packages ─────────────────────────────────────────────────────
log "Installing system packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl ca-certificates gnupg openssl nginx postgresql postgresql-contrib iproute2 >/dev/null
ok "nginx, PostgreSQL, openssl"

if ! command -v node >/dev/null || [[ "$(node -v | sed -E 's/v([0-9]+).*/\1/')" -lt 20 ]]; then
  log "Installing Node.js $NODE_MAJOR"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
ok "Node $(node -v), npm $(npm -v)"

if ! command -v pm2 >/dev/null; then
  npm install -g pm2 --silent >/dev/null
fi
ok "pm2 $(pm2 -v 2>/dev/null | tail -1)"

# An earlier version of this script ran the app as a systemd service; retire it so it frees its port.
if [[ -f "/etc/systemd/system/$APP_NAME.service" ]]; then
  systemctl disable --now "$APP_NAME" >/dev/null 2>&1 || true
  rm -f "/etc/systemd/system/$APP_NAME.service"
  systemctl daemon-reload
  ok "Removed the old $APP_NAME systemd service"
fi

# ─── 2. Configuration (.env) ────────────────────────────────────────────────
log "Configuring environment"
if [[ ! -f "$ENV_FILE" ]]; then
  if [[ -f "$APP_DIR/.env.example" ]]; then cp "$APP_DIR/.env.example" "$ENV_FILE"; else touch "$ENV_FILE"; fi
  ok "Created .env from .env.example"
fi

DOMAIN="${DOMAIN:-$(env_get APP_DOMAIN)}"
ask DOMAIN "Domain for the dashboard (blank = serve on the server IP)"
[[ -n "${DOMAIN:-}" ]] && env_set APP_DOMAIN "$DOMAIN"

DB_PASS="$(env_get DB_PASSWORD)"
[[ -n "$DB_PASS" ]] || DB_PASS="$(openssl rand -hex 24)"
env_set DB_PASSWORD "$DB_PASS"
env_set DATABASE_URL "postgresql://$DB_USER:$DB_PASS@127.0.0.1:5432/$DB_NAME?schema=public"

AUTH_SECRET_CUR="$(env_get AUTH_SECRET)"
if [[ -z "$AUTH_SECRET_CUR" || "$AUTH_SECRET_CUR" == "change-me" ]]; then env_set AUTH_SECRET "$(openssl rand -hex 32)"; ok "Generated AUTH_SECRET"; fi

if [[ -n "${META_ACCESS_TOKEN:-}" ]]; then
  env_set META_ACCESS_TOKEN "$META_ACCESS_TOKEN"; env_set META_MOCK "false"; ok "Meta token saved"
elif [[ -z "$(env_get META_ACCESS_TOKEN)" ]]; then
  ask META_ACCESS_TOKEN "Meta access token (blank = sample data mode for now)" secret
  if [[ -n "${META_ACCESS_TOKEN:-}" ]]; then
    env_set META_ACCESS_TOKEN "$META_ACCESS_TOKEN"; env_set META_MOCK "false"; ok "Meta token saved"
  else
    env_set META_MOCK "true"; warn "No Meta token — running with sample data. Add META_ACCESS_TOKEN to .env and re-run."
  fi
fi
[[ -n "${META_APP_SECRET:-}" ]] && env_set META_APP_SECRET "$META_APP_SECRET"
[[ -n "$(env_get META_API_VERSION)" ]] || env_set META_API_VERSION "v23.0"
[[ -n "$(env_get META_CACHE_SECONDS)" ]] || env_set META_CACHE_SECONDS "900"

# ─── 3. PostgreSQL ──────────────────────────────────────────────────────────
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

# ─── 4. Build ───────────────────────────────────────────────────────────────
log "Installing dependencies and building (this takes a few minutes)"
chown -R "$APP_USER:$(id -gn "$APP_USER")" "$APP_DIR"
chmod 600 "$ENV_FILE"
# Keep `git pull` working as root/sudo on a directory owned by the app user
if command -v git >/dev/null && ! git config --system --get-all safe.directory 2>/dev/null | grep -qx "$APP_DIR"; then
  git config --system --add safe.directory "$APP_DIR" || true
fi
as_app "npm ci --no-audit --no-fund --loglevel=error"
as_app "npx prisma migrate deploy"
ok "Database migrated"
as_app "npm run build"
ok "Build complete"

# ─── 5. First admin ─────────────────────────────────────────────────────────
ADMIN_COUNT="$(runuser -u postgres -- psql -d "$DB_NAME" -tAc "SELECT count(*) FROM \"User\" WHERE role='ADMIN'" | tr -d '[:space:]')"
if [[ "$ADMIN_COUNT" == "0" ]]; then
  log "Creating the first admin"
  ask ADMIN_EMAIL "Admin email"
  ask ADMIN_PASSWORD "Admin password (min 8 chars)" secret
  ADMIN_NAME="${ADMIN_NAME:-Admin}"
  if [[ -n "${ADMIN_EMAIL:-}" && -n "${ADMIN_PASSWORD:-}" ]]; then
    runuser -u "$APP_USER" -- env HOME="$APP_HOME" bash -c "cd '$APP_DIR' && node --env-file=.env scripts/create-admin.mjs \"\$0\" \"\$1\" \"\$2\"" "$ADMIN_EMAIL" "$ADMIN_PASSWORD" "$ADMIN_NAME"
  else
    warn "No admin created. Later run: node --env-file=.env scripts/create-admin.mjs EMAIL PASSWORD"
  fi
fi

# ─── 6. pm2 ─────────────────────────────────────────────────────────────────
log "Starting $APP_NAME with pm2 (as $APP_USER)"
# Stop our own app first so the port check below only sees *other* processes.
as_app "pm2 delete '$APP_NAME' >/dev/null 2>&1 || true"
sleep 1

SAVED_PORT="$(env_get APP_PORT)"
if [[ -n "${PORT:-}" ]]; then
  port_busy "$PORT" && die "Port $PORT is already used by another process: $(ss -ltnpH "sport = :$PORT" | head -1). Pick another: sudo PORT=3010 ./deploy.sh"
elif [[ -n "$SAVED_PORT" ]] && ! port_busy "$SAVED_PORT"; then
  PORT="$SAVED_PORT"
else
  [[ -n "$SAVED_PORT" ]] && warn "Port $SAVED_PORT is now taken by another process; choosing a new one."
  PORT=3000
  while port_busy "$PORT"; do PORT=$((PORT + 1)); done
fi
env_set APP_PORT "$PORT"
ok "Using port $PORT"

as_app "pm2 start ecosystem.config.cjs --update-env >/dev/null"
as_app "pm2 save >/dev/null"
if ! systemctl is-enabled "pm2-$APP_USER" >/dev/null 2>&1; then
  env PATH="$PATH" pm2 startup systemd -u "$APP_USER" --hp "$APP_HOME" >/dev/null
  ok "pm2 will start on boot (pm2-$APP_USER service)"
fi
ok "Running under pm2 on 127.0.0.1:$PORT"

# ─── 7. nginx ───────────────────────────────────────────────────────────────
log "Configuring nginx"
SERVER_NAME="${DOMAIN:-_}"
SITE="/etc/nginx/sites-available/$APP_NAME"
# Keep certbot's HTTPS block if it already exists; only the upstream port needs refreshing.
if [[ -f "$SITE" ]] && grep -q "managed by Certbot" "$SITE"; then
  sed -i -E "s#proxy_pass http://127\.0\.0\.1:[0-9]+;#proxy_pass http://127.0.0.1:$PORT;#g" "$SITE"
  # Older configs lack X-Forwarded-Host, which the app needs to build redirects on the public domain.
  grep -q "X-Forwarded-Host" "$SITE" || sed -i -E 's#^([[:space:]]*)proxy_set_header Host \$host;#&\n\1proxy_set_header X-Forwarded-Host $host;#' "$SITE"
  ok "Updated upstream port in existing HTTPS config"
else
  cat >"$SITE" <<NGINX
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
        proxy_set_header X-Forwarded-Host \$host;
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
fi
ln -sf "$SITE" "/etc/nginx/sites-enabled/$APP_NAME"

if [[ -n "${DOMAIN:-}" ]]; then
  OTHERS="$(grep -rlE "server_name[^;]*[[:space:]]$DOMAIN([[:space:];]|$)" /etc/nginx/sites-enabled/ /etc/nginx/conf.d/ 2>/dev/null | grep -v "/$APP_NAME\$" || true)"
  [[ -n "$OTHERS" ]] && warn "Other nginx configs also claim $DOMAIN and may take priority: $OTHERS"
else
  rm -f /etc/nginx/sites-enabled/default
fi
nginx -t -q
systemctl reload nginx
ok "nginx → 127.0.0.1:$PORT"

if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  ufw allow 'Nginx Full' >/dev/null && ok "Firewall: allowed HTTP/HTTPS"
fi

# ─── 8. HTTPS ───────────────────────────────────────────────────────────────
SECURE=false
if [[ -n "${DOMAIN:-}" && -z "${SKIP_SSL:-}" ]]; then
  log "Setting up HTTPS for $DOMAIN"
  apt-get install -y -qq certbot python3-certbot-nginx >/dev/null
  if [[ -d "/etc/letsencrypt/live/$DOMAIN" ]]; then
    certbot --nginx -d "$DOMAIN" --non-interactive --redirect --reinstall >/dev/null 2>&1 || true
    SECURE=true; ok "Certificate already present"
  else
    ask LETSENCRYPT_EMAIL "Email for Let's Encrypt renewal notices"
    if [[ -n "${LETSENCRYPT_EMAIL:-}" ]] && certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$LETSENCRYPT_EMAIL" --redirect; then
      SECURE=true; ok "HTTPS enabled"
    else
      warn "HTTPS not set up — check the domain's DNS A record points at this server, then re-run."
    fi
  fi
fi
if [[ "$(env_get COOKIE_SECURE)" != "$SECURE" ]]; then
  env_set COOKIE_SECURE "$SECURE"
  as_app "pm2 restart '$APP_NAME' --update-env >/dev/null"
fi

# ─── 9. Health check ────────────────────────────────────────────────────────
log "Checking the app"
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then
    URL="http://${DOMAIN:-$(hostname -I | awk '{print $1}')}"
    [[ "$SECURE" == "true" ]] && URL="https://$DOMAIN"
    as_app "pm2 list"
    printf '\n\033[1;32m✓ Blendfold Media Dashboard is live at %s\033[0m\n' "$URL"
    [[ "$(env_get META_MOCK)" == "true" ]] && warn "Sample data mode is on (META_MOCK=true)."
    echo "  Logs:     pm2 logs $APP_NAME"
    echo "  Redeploy: git pull && sudo ./deploy.sh"
    exit 0
  fi
  sleep 2
done
as_app "pm2 logs '$APP_NAME' --lines 40 --nostream" || true
die "The app didn't respond on port $PORT (logs above). Check: pm2 logs $APP_NAME"
