#!/bin/bash
# YearView — Synology NAS setup & update script
# Run this script over SSH on your Synology NAS.
# First run: clones the repo and walks you through .env setup.
# Subsequent runs: pulls latest code and restarts containers.

set -e

# ── Config ─────────────────────────────────────────────────────────────────
REPO_URL="https://github.com/dozauk/yearview.git"
INSTALL_DIR="${INSTALL_DIR:-/volume1/docker/yearview}"

# ── Colours ────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()    { echo -e "${GREEN}[✓]${NC} $1"; }
warn()    { echo -e "${YELLOW}[!]${NC} $1"; }
error()   { echo -e "${RED}[✗]${NC} $1"; exit 1; }
prompt()  { echo -e "${YELLOW}[?]${NC} $1"; }

echo ""
echo "  YearView — Synology Setup"
echo "  =========================="
echo ""

# ── Check prerequisites ─────────────────────────────────────────────────────
command -v git          >/dev/null 2>&1 || error "Git not found. Install it from Synology Package Center."
command -v docker       >/dev/null 2>&1 || error "Docker not found. Install Container Manager from Synology Package Center."
docker compose version  >/dev/null 2>&1 || error "Docker Compose not found. Update Container Manager to a recent version."
info "Prerequisites OK"

# ── Clone or update repo ────────────────────────────────────────────────────
if [ ! -d "$INSTALL_DIR/.git" ]; then
  info "Cloning repository to $INSTALL_DIR ..."
  mkdir -p "$(dirname "$INSTALL_DIR")"
  git clone "$REPO_URL" "$INSTALL_DIR"
  FIRST_RUN=true
else
  info "Pulling latest code ..."
  git -C "$INSTALL_DIR" pull
  FIRST_RUN=false
fi

cd "$INSTALL_DIR"

# ── Create .env on first run ────────────────────────────────────────────────
if [ ! -f .env ]; then
  warn ".env not found — let's create it now."
  echo ""

  prompt "Google Client ID:"
  read -r GOOGLE_CLIENT_ID

  prompt "Google Client Secret:"
  read -rs GOOGLE_CLIENT_SECRET
  echo ""

  prompt "Cloudflare Tunnel Token:"
  read -rs CLOUDFLARE_TUNNEL_TOKEN
  echo ""

  # Generate a random session secret
  SESSION_SECRET=$(cat /proc/sys/kernel/random/uuid | tr -d '-')${RANDOM}

  cat > .env <<EOF
GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
SESSION_SECRET=${SESSION_SECRET}
CLOUDFLARE_TUNNEL_TOKEN=${CLOUDFLARE_TUNNEL_TOKEN}
# Local dev only — production URI is hardcoded in docker-compose.yml
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback
PORT=3000
EOF

  info ".env created."
else
  info ".env already exists — skipping credential setup."
  warn "To update credentials, edit $INSTALL_DIR/.env manually."
fi

# ── Build and start containers ───────────────────────────────────────────────
echo ""
info "Building image and starting containers ..."
docker compose pull cloudflared 2>/dev/null || true   # pull cloudflared image
docker compose up -d --build                           # build yearview + start all

# ── Done ─────────────────────────────────────────────────────────────────────
echo ""
info "Done!"
echo ""
if [ "$FIRST_RUN" = true ]; then
  echo "  YearView is starting up."
  echo "  Once the Cloudflare tunnel connects, it will be live at:"
  echo ""
  echo "    https://yearview.doza.tech"
  echo ""
  echo "  Make sure you have:"
  echo "    1. Created the tunnel in Cloudflare Zero Trust dashboard"
  echo "       and set the public hostname to: yearview.doza.tech → http://yearview:3000"
  echo "    2. Added https://yearview.doza.tech/auth/callback"
  echo "       to your Google Cloud OAuth redirect URIs"
  echo ""
else
  echo "  Containers restarted with latest code."
  echo "  Live at: https://yearview.doza.tech"
  echo ""
fi

echo "  Useful commands:"
echo "    docker compose -f $INSTALL_DIR/docker-compose.yml logs -f    # tail logs"
echo "    docker compose -f $INSTALL_DIR/docker-compose.yml ps          # check status"
echo ""
