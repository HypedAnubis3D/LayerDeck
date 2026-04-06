#!/bin/bash
# LayerDeck Hub — full deploy script
# Run on the Pi: bash ~/bambu-hub/deploy-to-pi.sh

set -e
cd ~/bambu-hub
echo "=== Updating config.json with Anthropic key ==="
node -e "
const fs=require('fs');
const p='config.json';
const c=fs.existsSync(p)?JSON.parse(fs.readFileSync(p,'utf8')):{};
c.anthropicApiKey='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';
fs.writeFileSync(p,JSON.stringify(c,null,2));
console.log('Config keys saved:', Object.keys(c).join(', '));
"

echo "=== Patching server.js ==="
node << 'NODEEOF'
const fs = require('fs');
const sp = process.env.HOME + '/bambu-hub/server.js';
let s = fs.readFileSync(sp, 'utf8');

// Fix model name
s = s.replace(/let _vModel\s*=\s*'[^']*'/, "let _vModel = 'claude-haiku'");
// Remove ollamaUrl line
s = s.replace(/let _vOllamaUrl\s*=\s*'[^']*';\n/, '');

// Inject anthropicKey var (only once)
if (!s.includes('_anthropicKey')) {
  s = s.replace(
    /let _vPerPrint\s*=\s*\{\};[^\n]*/,
    "let _vPerPrint  = {};\n\nlet _anthropicKey = process.env.ANTHROPIC_API_KEY || '';"
  );
  const inject = "\ntry{if(fs.existsSync(configPath)){const _k=JSON.parse(fs.readFileSync(configPath,'utf8'));if(_k.anthropicApiKey)_anthropicKey=_k.anthropicApiKey;}}catch(_){}\n";
  s = s.replace('function _saveVisionCfg()', inject + 'function _saveVisionCfg()');
  console.log('anthropicKey injected');
} else {
  // Key already injected — just update the value read from config (already handled at startup)
  console.log('anthropicKey already present, key will load from config.json at startup');
}

// Replace _askOllama function
const fnStart = s.indexOf('function _askOllama(');
const fnEnd = s.indexOf('\nasync function _visionScan');
if (fnStart === -1 || fnEnd === -1) { console.error('Could not find function boundaries'); process.exit(1); }

const newFn = ;

s = s.slice(0, fnStart) + newFn + s.slice(fnEnd);
fs.writeFileSync(sp, s);
console.log('server.js patched successfully');
NODEEOF

echo "=== Restarting pm2 ==="
pm2 restart layerdeck-hub
sleep 4
pm2 logs layerdeck-hub --lines 20 --nostream
echo "=== Done ==="
