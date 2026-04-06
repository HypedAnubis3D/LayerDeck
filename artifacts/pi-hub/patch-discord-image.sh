#!/bin/bash
# LayerDeck Hub — Discord image + false-positive guard patch
# Run on Pi: bash ~/bambu-hub/patch-discord-image.sh

set -e
cd ~/bambu-hub

echo "=== Patching server.js ==="
node << 'NODEEOF'
const fs = require('fs');
const p  = process.env.HOME + '/bambu-hub/server.js';
let s    = fs.readFileSync(p, 'utf8');
let changed = 0;

// ── 1. Add sendDiscordWatchWithImage after sendDiscordWatch ──────────────────
const newFn = `
// Send Discord alert with a JPEG image attached (multipart/form-data)
function sendDiscordWatchWithImage(content, base64Jpeg) {
  const webhookUrl = DISCORD_WATCH_URL || DISCORD_ALERTS_URL;
  if (!webhookUrl) return;
  try {
    const imgBuf   = Buffer.from(base64Jpeg, 'base64');
    const boundary = 'LayerDeckVision' + Date.now();
    const jsonPart = Buffer.from(
      \`--\${boundary}\\r\\nContent-Disposition: form-data; name="payload_json"\\r\\n\\r\\n\` +
      JSON.stringify({ content }) + \`\\r\\n\`
    );
    const filePart = Buffer.from(
      \`--\${boundary}\\r\\nContent-Disposition: form-data; name="files[0]"; filename="snapshot.jpg"\\r\\nContent-Type: image/jpeg\\r\\n\\r\\n\`
    );
    const tail     = Buffer.from(\`\\r\\n--\${boundary}--\\r\\n\`);
    const body     = Buffer.concat([jsonPart, filePart, imgBuf, tail]);
    const url      = new URL(webhookUrl);
    const req      = https.request({
      hostname: url.hostname,
      path:     url.pathname + url.search,
      method:   'POST',
      headers:  { 'Content-Type': \`multipart/form-data; boundary=\${boundary}\`, 'Content-Length': body.length }
    }, () => {});
    req.on('error', () => {});
    req.write(body);
    req.end();
  } catch (e) { /* silent */ }
}
`;

if (!s.includes('sendDiscordWatchWithImage')) {
  // Insert after the closing brace of sendDiscordWatch
  s = s.replace(
    /function sendDiscordWatch\(content\) \{[\s\S]*?\}\n/,
    match => match + newFn
  );
  changed++;
  console.log('  ✓ sendDiscordWatchWithImage added');
} else {
  console.log('  ✓ sendDiscordWatchWithImage already present');
}

// ── 2. Add _vConsecFailures state variable ───────────────────────────────────
if (!s.includes('_vConsecFailures')) {
  s = s.replace(
    /const _vScanning\s*=\s*new Set\(\);/,
    "const _vConsecFailures    = {}; // consecutive failure count per printer\nconst _vScanning       = new Set();"
  );
  changed++;
  console.log('  ✓ _vConsecFailures added');
} else {
  console.log('  ✓ _vConsecFailures already present');
}

// ── 3. Replace the failure/warning alert block ───────────────────────────────
const oldBlock = /let autoPaused = false;\s*\n\s*\/\/ Auto-pause \+ Discord[\s\S]*?^\s*\}\n\s*\n\s*_vResults\[name\]/m;
const newBlock = `let autoPaused = false;
    const img = _vImages[name];

    // Auto-pause + Discord alert for confirmed failures
    if (r.status === 'failure' && (r.confidence || 0) >= _vThreshold) {
      _vConsecFailures[name] = (_vConsecFailures[name] || 0) + 1;
      const consecCount = _vConsecFailures[name];
      // Require 2 consecutive failure detections before auto-pausing (reduces false positives)
      const pc = printerClients[name];
      if (consecCount >= 2 && pc && st2?.gcode_state === 'RUNNING') {
        pc.client.publish(pc.REQUEST_TOPIC, JSON.stringify({ print: { sequence_id: '0', command: 'pause' } }));
        autoPaused = true;
        console.log(\`[Vision] Auto-paused \${name} — \${consecCount} consecutive failures\`);
      }
      const issues = (r.issues || []).join('\\n• ') || r.description || '';
      const alertText =
        \`🚨 **AI Vision — FAILURE detected on \${name}**\\n\` +
        \`📄 **Job:** \${jobName} · \${pct}% complete\\n\` +
        \`📊 **Confidence:** \${Math.round((r.confidence || 0) * 100)}%\\n\` +
        \`🔍 **Issues:**\\n• \${issues}\\n\` +
        \`📝 **Analysis:** \${r.description || ''}\` +
        (autoPaused ? '\\n⏸ **Print has been automatically paused.**' : '') +
        (consecCount === 1 ? '\\n⚠️ *First detection — watching for confirmation before pausing.*' : '');
      if (img && img.base64) {
        sendDiscordWatchWithImage(alertText, img.base64);
      } else {
        sendDiscordWatch(alertText);
      }
    } else {
      _vConsecFailures[name] = 0;
      if (r.status === 'warning' && (r.confidence || 0) >= _vThreshold) {
        const issues = (r.issues || []).join('\\n• ') || r.description || '';
        const alertText =
          \`⚠️ **AI Vision — WARNING on \${name}**\\n\` +
          \`📄 **Job:** \${jobName} · \${pct}% complete\\n\` +
          \`📊 **Confidence:** \${Math.round((r.confidence || 0) * 100)}%\\n\` +
          \`🔍 **Issues:**\\n• \${issues}\\n\` +
          \`📝 **Analysis:** \${r.description || ''}\`;
        if (img && img.base64) {
          sendDiscordWatchWithImage(alertText, img.base64);
        } else {
          sendDiscordWatch(alertText);
        }
      }
    }

    _vResults[name]`;

if (!s.includes('sendDiscordWatchWithImage(alertText')) {
  const replaced = s.replace(oldBlock, newBlock);
  if (replaced !== s) {
    s = replaced;
    changed++;
    console.log('  ✓ alert logic updated (image + consecutive guard)');
  } else {
    console.log('  ⚠ Could not match alert block — manual check needed');
  }
} else {
  console.log('  ✓ alert logic already updated');
}

// ── 4. Fix model name ────────────────────────────────────────────────────────
const before4 = s;
s = s.replace(/let _vModel\s*=\s*'[^']*'/, "let _vModel     = 'claude-haiku'");
if (s !== before4) { changed++; console.log('  ✓ _vModel set to claude-haiku'); }

// ── 5. Clean vision-config.json model key (will be done below in node) ───────

fs.writeFileSync(p, s);
console.log(`\nPatch complete — ${changed} change(s) applied`);
NODEEOF

echo "=== Cleaning vision-config.json ==="
node -e "
const fs=require('fs');
const p='vision-config.json';
if(fs.existsSync(p)){
  const c=JSON.parse(fs.readFileSync(p,'utf8'));
  delete c.ollamaModel;delete c.ollamaUrl;
  fs.writeFileSync(p,JSON.stringify(c,null,2));
  console.log('  ✓ Removed stale keys. Keys remaining:',Object.keys(c).join(', '));
}else{console.log('  ✓ No vision-config.json to clean');}
"

echo "=== Restarting pm2 ==="
pm2 restart layerdeck-hub
sleep 4
pm2 logs layerdeck-hub --lines 15 --nostream
echo ""
echo "=== Done! ==="
echo "  • Discord alerts now include camera snapshot image"
echo "  • False-positive guard: printer won't pause until 2 consecutive failures"
echo "  • Model name fixed to Claude Haiku"
