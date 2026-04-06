#!/bin/bash
# LayerDeck Hub — model name patch
# Run on the Pi: bash ~/bambu-hub/patch-model-name.sh

set -e
cd ~/bambu-hub

echo "=== Cleaning vision-config.json ==="
node -e "
const fs = require('fs');
const p = 'vision-config.json';
if (fs.existsSync(p)) {
  const c = JSON.parse(fs.readFileSync(p, 'utf8'));
  delete c.ollamaModel;
  delete c.ollamaUrl;
  fs.writeFileSync(p, JSON.stringify(c, null, 2));
  console.log('Removed stale keys. Remaining:', Object.keys(c).join(', '));
} else {
  console.log('No vision-config.json found — nothing to clean');
}
"

echo "=== Patching server.js ==="
node -e "
const fs = require('fs');
const p = process.env.HOME + '/bambu-hub/server.js';
let s = fs.readFileSync(p, 'utf8');
let changed = 0;

// 1. Fix status endpoint: rename ollamaModel → model, drop ollamaUrl
const before1 = s;
s = s.replace(
  /confidenceThreshold: _vThreshold, ollamaModel: _vModel, ollamaUrl: _vOllamaUrl,/,
  'confidenceThreshold: _vThreshold, model: _vModel,'
);
s = s.replace(
  /confidenceThreshold: _vThreshold, ollamaModel: _vModel,/,
  'confidenceThreshold: _vThreshold, model: _vModel,'
);
if (s !== before1) { changed++; console.log('  ✓ status endpoint field renamed'); }

// 2. Stop loading ollamaModel from saved config (so stale value can never override)
const before2 = s;
s = s.replace(
  /\s*if \(c\.ollamaModel\)\s+_vModel\s*=\s*c\.ollamaModel;/g,
  ''
);
if (s !== before2) { changed++; console.log('  ✓ removed ollamaModel load from config'); }

// 3. Ensure _vModel is always claude-haiku (fix value if stale)
const before3 = s;
s = s.replace(
  /let _vModel\s*=\s*'[^']*'/,
  \"let _vModel     = 'claude-haiku'\"
);
if (s !== before3) { changed++; console.log('  ✓ _vModel defaulted to claude-haiku'); }

fs.writeFileSync(p, s);
console.log('Patched OK (' + changed + ' change(s))');
"

echo "=== Restarting pm2 ==="
pm2 restart layerdeck-hub
sleep 3
pm2 logs layerdeck-hub --lines 12 --nostream
echo ""
echo "=== Done — AI Vision will now show Claude Haiku ==="
