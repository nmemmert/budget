#!/bin/bash
# Capsule Budget — bare-metal installer (no Docker)
# Usage: curl -fsSL https://raw.githubusercontent.com/nmemmert/budget/master/install.sh | bash

set -e

REPO_URL="https://github.com/nmemmert/budget.git"
INSTALL_DIR="/opt/capsule"
SERVICE_USER="capsule"
PORT=7654

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $*"; }
info() { echo -e "${CYAN}→${NC} $*"; }
warn() { echo -e "${YELLOW}⚠${NC}  $*"; }
die()  { echo -e "${RED}✗${NC} $*"; exit 1; }

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║        Capsule Budget  Installer         ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Must be root
[ "$EUID" -eq 0 ] || die "Run as root: sudo bash install.sh  (or pipe through sudo)"

# ── Node.js 20 ────────────────────────────────────────────────────────────────
install_node() {
  info "Installing Node.js 20..."
  if command -v apt-get &>/dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
  elif command -v dnf &>/dev/null; then
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
    dnf install -y nodejs
  elif command -v yum &>/dev/null; then
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
    yum install -y nodejs
  else
    die "Unsupported package manager. Install Node.js 20 manually then re-run."
  fi
}

if command -v node &>/dev/null; then
  NODE_MAJOR=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
  if [ "$NODE_MAJOR" -ge 20 ]; then
    ok "Node.js $(node --version) already installed"
  else
    warn "Node.js $(node --version) is too old (need 20+)"
    install_node
  fi
else
  install_node
fi
ok "Node.js $(node --version)"

# ── git ───────────────────────────────────────────────────────────────────────
command -v git &>/dev/null || {
  info "Installing git..."
  if command -v apt-get &>/dev/null; then apt-get install -y git
  elif command -v dnf &>/dev/null;    then dnf install -y git
  else yum install -y git; fi
}
ok "git $(git --version | awk '{print $3}')"

# ── Clone / update ────────────────────────────────────────────────────────────
if [ -d "$INSTALL_DIR/.git" ]; then
  info "Updating existing installation at $INSTALL_DIR..."
  git config --global --add safe.directory "$INSTALL_DIR" 2>/dev/null || true
  git -C "$INSTALL_DIR" pull --ff-only
else
  info "Cloning to $INSTALL_DIR..."
  git clone "$REPO_URL" "$INSTALL_DIR"
fi

# ── System user ───────────────────────────────────────────────────────────────
if ! id "$SERVICE_USER" &>/dev/null; then
  info "Creating system user '$SERVICE_USER'..."
  useradd --system --no-create-home --shell /usr/sbin/nologin "$SERVICE_USER"
fi

# ── Build ─────────────────────────────────────────────────────────────────────
info "Installing dependencies and building..."
cd "$INSTALL_DIR"
npm ci --prefer-offline 2>&1 | tail -3
npm run build 2>&1 | tail -5
ok "Build complete"

# ── Data directory ────────────────────────────────────────────────────────────
mkdir -p "$INSTALL_DIR/data"
chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"
ok "Data directory: $INSTALL_DIR/data"

# ── Systemd service ───────────────────────────────────────────────────────────
SERVICE_FILE="/etc/systemd/system/capsule.service"
cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=Capsule Budget
After=network.target

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$INSTALL_DIR
ExecStart=$(command -v node) node_modules/.bin/next start -p $PORT
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=$PORT

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable capsule
systemctl restart capsule
ok "systemd service 'capsule' enabled and started"

# ── Done ──────────────────────────────────────────────────────────────────────
sleep 2
if systemctl is-active --quiet capsule; then
  LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "your-server-ip")
  echo ""
  echo -e "${GREEN}╔══════════════════════════════════════════╗"
  echo "║         Installation complete!           ║"
  echo -e "╚══════════════════════════════════════════╝${NC}"
  echo ""
  echo "  Access Capsule at:"
  echo "    http://$LOCAL_IP:$PORT"
  echo ""
  echo "  Useful commands:"
  echo "    systemctl status capsule      # check status"
  echo "    systemctl restart capsule     # restart"
  echo "    journalctl -u capsule -f      # view logs"
  echo ""
  echo "  Data lives at: $INSTALL_DIR/data/"
  echo "  Back up that directory to move to a new server."
  echo ""
else
  die "Service failed to start. Check logs: journalctl -u capsule -xe"
fi
