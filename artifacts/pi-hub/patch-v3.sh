#!/bin/bash
# LayerDeck Hub — v3 patch: better prompt + Discord images
# Run on Pi: bash ~/bambu-hub/patch-v3.sh

set -e
cd ~/bambu-hub

node << 'NODEEOF'
const fs = require('fs');
const p  = process.env.HOME + '/bambu-hub/server.js';
let s    = fs.readFileSync(p, 'utf8');
let n    = 0;

// ── 1. Improve the Claude vision prompt ─────────────────────────────────────
const oldPrompt = /`You monitor a 3D printer named "\$\{name\}" for failures\. Analyze this camera image\.\\n`[\s\S]*?`status: ok\|warning\|failure   confidence: 0\.0-1\.0`/;
const newPrompt =
  '`You are monitoring a Bambu Lab FDM 3D printer named "${name}" via camera during an active print.\\n\\n` +\n' +
  '            `REAL FAILURE (status:"failure", confidence 0.9+):\\n` +\n' +
  '            `- Filament actively tangling AROUND the toolhead/nozzle in a chaotic mass NOT attached to the print\\n` +\n' +
  '            `- Print completely detached from the bed and being dragged around by the moving toolhead\\n` +\n' +
  '            `- Large molten blob accumulated on the nozzle itself\\n\\n` +\n' +
  '            `WARNING (status:"warning"):\\n` +\n' +
  '            `- Print visibly lifting or curling at edges (warping)\\n` +\n' +
  '            `- Clear layer shift — print looks stepped/misaligned\\n` +\n' +
  '            `- Partial detachment at one corner while rest is still printing\\n\\n` +\n' +
  '            `NORMAL — always status:"ok":\\n` +\n' +
  '            `- Completed or in-progress parts sitting FLAT on the build plate (very common, not a failure)\\n` +\n' +
  '            `- Multiple finished-looking parts on the bed (batch printing is normal)\\n` +\n' +
  '            `- Camera showing bed from above with parts that look done or nearly done\\n` +\n' +
  '            `- Empty or dark bed (printer idle or between jobs)\\n` +\n' +
  '            `- Filament strands that are clearly PART OF the print structure\\n\\n` +\n' +
  '            `KEY RULE: If you cannot clearly see filament tangled around the toolhead or a print being dragged, use status:"ok". Prefer ok over failure when uncertain.\\n\\n` +\n' +
  '            `Reply ONLY with valid JSON, no markdown:\\n` +\n' +
  '            `{"status":"ok","confidence":0.85,"issues":[],"description":"one sentence describing what you see"}\\n` +\n' +
  '            `status: ok|warning|failure   confidence: 0.0-1.0`';

if (oldPrompt.test(s)) {
  s = s.replace(oldPrompt, newPrompt);
  n++; console.log('✓ Vision prompt updated');
} else {
  console.log('⚠ Prompt already updated or pattern not matched — skipping');
}

// ── 2. Add sendDiscordWatchWithImage if missing ──────────────────────────────
if (!s.includes('sendDiscordWatchWithImage')) {
  const fn = `
function sendDiscordWatchWithImage(content, b64) {
  const wurl = DISCORD_WATCH_URL || DISCORD_ALERTS_URL;
  if (!wurl) return;
  try {
    const img = Buffer.from(b64, 'base64');
    const bnd = 'LDV' + Date.now();
    const jp  = Buffer.from('--' + bnd + '\\r\\nContent-Disposition: form-data; name="payload_json"\\r\\n\\r\\n' + JSON.stringify({content}) + '\\r\\n');
    const fp  = Buffer.from('--' + bnd + '\\r\\nContent-Disposition: form-data; name="files[0]"; filename="snapshot.jpg"\\r\\nContent-Type: image/jpeg\\r\\n\\r\\n');
    const tl  = Buffer.from('\\r\\n--' + bnd + '--\\r\\n');
    const bod = Buffer.concat([jp, fp, img, tl]);
    const u   = new URL(wurl);
    const r   = https.request({hostname:u.hostname,path:u.pathname+u.search,method:'POST',headers:{'Content-Type':'multipart/form-data; boundary='+bnd,'Content-Length':bod.length}},()=>{});
    r.on('error',()=>{}); r.write(bod); r.end();
  } catch(e) {}
}
`;
  // Insert right before sendDiscordStatus
  s = s.replace('\nfunction sendDiscordStatus(', fn + '\nfunction sendDiscordStatus(');
  n++; console.log('✓ sendDiscordWatchWithImage added');
} else {
  console.log('✓ sendDiscordWatchWithImage already present');
}

// ── 3. Add _vConsecFailures if missing ───────────────────────────────────────
if (!s.includes('_vConsecFailures')) {
  s = s.replace(/const _vScanning\s*=\s*new Set\(\);/, 'const _vConsecFailures = {};\nconst _vScanning = new Set();');
  n++; console.log('✓ _vConsecFailures added');
} else {
  console.log('✓ _vConsecFailures already present');
}

// ── 4. Patch failure alert to use image + consecutive guard ──────────────────
// Find the line that calls sendDiscordWatch for failures and wrap it
if (!s.includes('_vConsecFailures[name] =') && s.includes("r.status === 'failure'")) {
  // Simpler approach: find the failure block and inject consecutive guard + image
  s = s.replace(
    /if \(r\.status === 'failure' && \(r\.confidence \|\| 0\) >= _vThreshold\) \{/,
    `if (r.status === 'failure' && (r.confidence || 0) >= _vThreshold) {
      _vConsecFailures[name] = (_vConsecFailures[name] || 0) + 1;
      const _cc = _vConsecFailures[name];`
  );
  // Replace auto-pause condition to require 2 consecutive
  s = s.replace(
    /if \(pc && st2\?\.gcode_state === 'RUNNING'\) \{/,
    `if (_cc >= 2 && pc && st2?.gcode_state === 'RUNNING') {`
  );
  // Replace sendDiscordWatch call in failure block with image version
  s = s.replace(
    /const issues = \(r\.issues \|\| \[\]\)\.join\(', '\) \|\| r\.description \|\| '';\n      sendDiscordWatch\(\s*`🚨[\s\S]*?`\s*\);/,
    `const issues = (r.issues || []).join('\\n• ') || r.description || '';
      const _img = _vImages[name];
      const _atxt = '🚨 **AI Vision — FAILURE on ' + name + '**\\n📄 **Job:** ' + jobName + ' · ' + pct + '% complete\\n📊 **Confidence:** ' + Math.round((r.confidence||0)*100) + '%\\n🔍 **Issues:**\\n• ' + issues + '\\n📝 **Analysis:** ' + (r.description||'') + (autoPaused ? '\\n⏸ **Print paused.**' : '') + (_cc===1 ? '\\n⚠️ *First detection — watching for confirmation.*' : '');
      if (_img && _img.base64) { sendDiscordWatchWithImage(_atxt, _img.base64); } else { sendDiscordWatch(_atxt); }`
  );
  // Replace sendDiscordWatch call in warning block with image version
  s = s.replace(
    /} else if \(r\.status === 'warning' && \(r\.confidence \|\| 0\) >= _vThreshold\) \{\n      const issues = \(r\.issues \|\| \[\]\)\.join\(', '\) \|\| r\.description \|\| '';\n      sendDiscordWatch\(\s*`⚠️[\s\S]*?`\s*\);/,
    `} else {
      _vConsecFailures[name] = 0;
      if (r.status === 'warning' && (r.confidence || 0) >= _vThreshold) {
      const issues = (r.issues || []).join('\\n• ') || r.description || '';
      const _img = _vImages[name];
      const _atxt = '⚠️ **AI Vision — WARNING on ' + name + '**\\n📄 **Job:** ' + jobName + ' · ' + pct + '% complete\\n📊 **Confidence:** ' + Math.round((r.confidence||0)*100) + '%\\n🔍 **Issues:**\\n• ' + issues + '\\n📝 **Analysis:** ' + (r.description||'');
      if (_img && _img.base64) { sendDiscordWatchWithImage(_atxt, _img.base64); } else { sendDiscordWatch(_atxt); }
    }`
  );
  n++; console.log('✓ Alert logic patched (image + consecutive guard)');
} else {
  console.log('✓ Alert logic already patched');
}

// ── 5. Fix model name + clean stale config ───────────────────────────────────
s = s.replace(/let _vModel\s*=\s*'[^']*'/, "let _vModel = 'claude-haiku'");
const vc = process.env.HOME + '/bambu-hub/vision-config.json';
if (fs.existsSync(vc)) {
  const c = JSON.parse(fs.readFileSync(vc,'utf8'));
  delete c.ollamaModel; delete c.ollamaUrl;
  fs.writeFileSync(vc, JSON.stringify(c,null,2));
  console.log('✓ vision-config.json cleaned');
}

fs.writeFileSync(p, s);
console.log('\nDone —', n, 'change(s) applied');
NODEEOF

echo "=== Restarting pm2 ==="
pm2 restart layerdeck-hub
sleep 4
pm2 logs layerdeck-hub --lines 12 --nostream
echo ""
echo "=== Done! Key improvements:"
echo "  • Prompt now understands completed parts on bed are NOT failures"
echo "  • Discord alerts include camera snapshot image"
echo "  • 2 consecutive failures required before auto-pause"
