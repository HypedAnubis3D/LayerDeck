#!/bin/bash
# LayerDeck Hub — update server.js to the latest version
# Run this on the Pi to get background auto-scanning working:
#   bash ~/bambu-hub/update-pi.sh

set -e
cd ~/bambu-hub

echo "=== LayerDeck Hub Updater ==="

REPLIT_URL="https://layerstack.replit.app"

# 1. Verify the file is reachable
echo "[1/4] Downloading latest server.js from LayerDeck..."
curl -fsSL "${REPLIT_URL}/api/pihub/server-js" -o server.js.new

# Quick sanity check — make sure it looks like a Node.js server file
if ! grep -q "_scheduleVision" server.js.new; then
  echo "ERROR: Downloaded file looks wrong (missing _scheduleVision). Aborting."
  rm -f server.js.new
  exit 1
fi

# 2. Back up current version
echo "[2/4] Backing up current server.js..."
cp server.js server.js.bak 2>/dev/null || true

# 3. Install new version
echo "[3/4] Installing new server.js..."
mv server.js.new server.js

# 4. Restart pm2
echo "[4/4] Restarting layerdeck-hub with pm2..."
pm2 restart layerdeck-hub

echo ""
echo "=== Done! ==="
echo "Auto-scan scheduler is now active. Scans run every configured interval"
echo "while a printer is RUNNING, and Discord alerts fire on failure/warning."
echo ""
echo "Check status with:  pm2 logs layerdeck-hub --lines 30"
