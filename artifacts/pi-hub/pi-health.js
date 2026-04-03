#!/usr/bin/env node
/**
 * pi-health.js — LayerDeck Pi Health Monitor
 *
 * Runs via crontab on the Pi. Two modes:
 *   node pi-health.js          — 5-min service check (posts only on failure/recovery)
 *   node pi-health.js daily    — 7AM daily summary (posts always if all healthy)
 *
 * Install crontab (LayerDeck Discord settings page does this automatically once
 * server.js is deployed):
 *   0 7 * * *      node ~/bambu-hub/pi-health.js daily
 *   */5 * * * *    node ~/bambu-hub/pi-health.js
 */

const { execSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

// ── Config ──────────────────────────────────────────────────────────────────
const WEBHOOK = process.env.DISCORD_WEBHOOK_PI_HEALTH;
const SERVICES = ['layerdeck-hub', 'cameras'];          // PM2 process names
const STATE_FILE = path.join(process.env.HOME, 'bambu-hub', '.health-state.json');
const DAILY_MODE = process.argv[2] === 'daily';

// ── Discord helper ───────────────────────────────────────────────────────────
async function postToDiscord(message) {
  if (!WEBHOOK) {
    console.log('[pi-health] DISCORD_WEBHOOK_PI_HEALTH not set — skipping Discord post');
    return;
  }
  try {
    const { default: fetch } = await import('node-fetch').catch(() => ({ default: null }));
    const _fetch = fetch || globalThis.fetch;
    if (!_fetch) { console.error('[pi-health] No fetch available'); return; }
    await _fetch(WEBHOOK, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ content: message })
    });
  } catch (e) {
    console.error('[pi-health] Discord post failed:', e.message);
  }
}

// ── Service checks ───────────────────────────────────────────────────────────
function checkService(name) {
  try {
    const result = execSync('pm2 jlist', { encoding: 'utf8' });
    const procs  = JSON.parse(result);
    const proc   = procs.find(p => p.name === name);
    return proc?.pm2_env?.status === 'online';
  } catch (e) { return false; }
}

function checkTailscale() {
  try {
    const result = execSync('tailscale status --json', { encoding: 'utf8' });
    const status = JSON.parse(result);
    return status.BackendState === 'Running';
  } catch (e) { return false; }
}

function getTailscaleIP() {
  try { return execSync('tailscale ip', { encoding: 'utf8' }).trim().split('\n')[0]; }
  catch (e) { return 'unknown'; }
}

function getUptime() {
  try {
    const secs = parseFloat(execSync('cat /proc/uptime', { encoding: 'utf8' }).split(' ')[0]);
    const d = Math.floor(secs / 86400);
    const h = Math.floor((secs % 86400) / 3600);
    const m = Math.floor((secs % 3600) / 60);
    return d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m`;
  } catch (e) { return 'unknown'; }
}

// ── State persistence (prevents repeat alerts) ───────────────────────────────
function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
  catch (e) { return {}; }
}

function saveState(state) {
  try { fs.writeFileSync(STATE_FILE, JSON.stringify(state)); }
  catch (e) { console.error('[pi-health] Failed to save state:', e.message); }
}

// ── Auto-restart attempt ─────────────────────────────────────────────────────
async function attemptRestart(name) {
  try {
    execSync(`pm2 restart ${name}`);
    // Wait 60 seconds for the service to come back up
    await new Promise(r => setTimeout(r, 60000));
    return checkService(name);
  } catch (e) { return false; }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const hubOnline       = checkService('layerdeck-hub');
  const camsOnline      = checkService('cameras');
  const tailscaleOnline = checkTailscale();
  const allHealthy      = hubOnline && camsOnline && tailscaleOnline;
  const tailscaleIP     = getTailscaleIP();
  const uptime          = getUptime();
  const state           = loadState();

  // ── Daily 7AM report ──────────────────────────────────────────────────────
  if (DAILY_MODE) {
    if (allHealthy) {
      await postToDiscord(
        '✅ Pi Health Check — All systems running\n' +
        `Hub server:  ✅ Online (port 3000)\n` +
        `go2rtc:      ✅ Online (port 1984)\n` +
        `Tailscale:   ✅ Connected (${tailscaleIP})\n` +
        `Uptime:      ${uptime}`
      );
      console.log('[pi-health] Daily check posted — all healthy');
    } else {
      // Something is already down — the 5-min check will have already alerted.
      // Daily report only posts the positive summary; failures are handled below.
      console.log('[pi-health] Daily check — issues detected, 5-min checker handles alerts');
    }
    return;
  }

  // ── 5-min polling check ───────────────────────────────────────────────────
  const serviceMap = {
    'layerdeck-hub': { label: 'Hub server (port 3000)', online: hubOnline },
    'cameras':       { label: 'go2rtc (port 1984)',     online: camsOnline },
    'tailscale':     { label: 'Tailscale',              online: tailscaleOnline }
  };

  const recoveryLabels = {
    'layerdeck-hub': 'Hub server recovered — printer monitoring back online',
    'cameras':       'go2rtc recovered — camera feeds back online',
    'tailscale':     'Tailscale reconnected — remote access restored'
  };

  const newIssues = [];

  for (const [key, svc] of Object.entries(serviceMap)) {
    if (!svc.online && !state[key + '_alerted']) {
      // Attempt auto-restart for PM2 services (not Tailscale)
      let recovered = false;
      if (key !== 'tailscale') {
        console.log(`[pi-health] ${key} is down — attempting PM2 restart…`);
        recovered = await attemptRestart(key);
        if (recovered) {
          console.log(`[pi-health] ${key} recovered after restart`);
        }
      }

      if (!recovered) {
        newIssues.push(key);
        state[key + '_alerted'] = true;
      }
    }

    // Recovery — was alerted, now back online
    if (svc.online && state[key + '_alerted']) {
      await postToDiscord(`✅ ${recoveryLabels[key]}`);
      delete state[key + '_alerted'];
    }
  }

  // Post a single alert if any new issues remain after restart attempts
  if (newIssues.length > 0) {
    const lines = ['🚨 Pi Alert — Service Down'];
    for (const [key, svc] of Object.entries(serviceMap)) {
      lines.push(`${svc.label}: ${svc.online ? '✅ Online' : '❌ Not responding'}`);
    }
    if (newIssues.includes('cameras')) {
      lines.push('\nCamera feeds unavailable until go2rtc recovers.');
    }
    if (newIssues.includes('tailscale')) {
      lines.push('\nRemote access (Tailscale) is down — Pi may be unreachable from LayerDeck.');
    }
    lines.push(`\nUptime: ${uptime}`);
    await postToDiscord(lines.join('\n'));
    console.log('[pi-health] Alert posted for:', newIssues.join(', '));
  } else if (newIssues.length === 0 && Object.keys(state).length === 0) {
    // All healthy, nothing to report
    console.log('[pi-health] All services healthy — no alert needed');
  }

  saveState(state);
}

main().catch(e => console.error('[pi-health] Uncaught error:', e.message));
