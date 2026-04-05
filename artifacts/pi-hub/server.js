/**
 * LayerDeck Hub — Pi server.js
 * Updated: Section 30 — object boundary data (MQTT obj_list parsing),
 *          skip command support, failureSnapshot on FAILED state.
 *
 * Deploy: scp this file to ~/bambu-hub/server.js on the Pi, then:
 *   pm2 restart layerdeck-hub
 */

const mqtt    = require('mqtt');
const express = require('express');
const cors    = require('cors');
const fs      = require('fs');
const path    = require('path');
const https   = require('https');

const app = express();
app.use(cors());
app.use(express.json());

// ── Load printer config from printers.json (users edit this, not server.js) ──
let PRINTERS = [];
const printersPath = path.join(__dirname, 'printers.json');
if (fs.existsSync(printersPath)) {
  try {
    PRINTERS = JSON.parse(fs.readFileSync(printersPath, 'utf8'));
    console.log(`Loaded ${PRINTERS.length} printers from printers.json`);
  } catch (e) {
    console.error('Failed to parse printers.json:', e.message);
    // Fall back to hardcoded list
    PRINTERS = [
      { name: 'A1',        ip: '192.168.1.171', serial: '03919C452404673', accessCode: 'ed7fd800' },
      { name: 'P1 Room',   ip: '192.168.1.166', serial: '01P09C4C0402468', accessCode: '85467582' },
      { name: 'P1 Closet', ip: '192.168.1.155', serial: '01P09C471500288', accessCode: '33503749' }
    ];
  }
} else {
  // Fallback hardcoded
  PRINTERS = [
    { name: 'A1',        ip: '192.168.1.171', serial: '03919C452404673', accessCode: 'ed7fd800' },
    { name: 'P1 Room',   ip: '192.168.1.166', serial: '01P09C4C0402468', accessCode: '85467582' },
    { name: 'P1 Closet', ip: '192.168.1.155', serial: '01P09C471500288', accessCode: '33503749' }
  ];
}

const CAMERAS = {
  'A1':        'camera_a1',
  'P1 Room':   'camera_p1_room',
  'P1 Closet': 'camera_p1_closet'
};

const PI_PORT        = 3000;
const printerStates  = {};
const printerClients = {};

// Track previous gcode state per printer so we can detect transitions
// (RUNNING → FINISH, * → FAILED) without re-alerting on every poll tick
const _printerPrevGcodeState = {};

// ── Discord alert helpers ──────────────────────────────────────────────────────
// Print alerts (completed/failed) — loaded from config.json or env var.
let DISCORD_ALERTS_URL = process.env.DISCORD_WEBHOOK_PRINT_ALERTS || '';
// Printer connectivity/status alerts (unreachable, back online, MQTT errors).
// Falls back to DISCORD_ALERTS_URL if the dedicated status webhook is not set.
let DISCORD_STATUS_URL = process.env.DISCORD_WEBHOOK_PRINTER_STATUS || '';
const configPath = path.join(__dirname, 'config.json');
if (fs.existsSync(configPath)) {
  try {
    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (cfg.discordWebhookPrintAlerts)   DISCORD_ALERTS_URL = cfg.discordWebhookPrintAlerts;
    if (cfg.discordWebhookPrinterStatus) DISCORD_STATUS_URL = cfg.discordWebhookPrinterStatus;
  } catch (e) { /* ignore */ }
}

function _postDiscord(webhookUrl, content) {
  if (!webhookUrl) return;
  try {
    const body = JSON.stringify({ content });
    const url  = new URL(webhookUrl);
    const req  = https.request({
      hostname: url.hostname,
      path:     url.pathname + url.search,
      method:   'POST',
      headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, () => {});
    req.on('error', () => {});
    req.write(body);
    req.end();
  } catch (e) { /* silent */ }
}

function sendDiscordAlert(content) {
  _postDiscord(DISCORD_ALERTS_URL, content);
}

function sendDiscordStatus(content) {
  _postDiscord(DISCORD_STATUS_URL || DISCORD_ALERTS_URL, content);
}

// Debounce: at most one MQTT error alert per printer per 5 minutes for real errors
const _mqttAlertTs = {};
// Track which printers we've already sent an "offline/unreachable" alert for.
// Suppresses repeated EHOSTUNREACH spam when printer is powered off overnight.
// Cleared when the printer reconnects.
const _printerOfflineNotified = {};

function mqttAlert(printerName, content, isOfflineAlert) {
  const now = Date.now();
  if (isOfflineAlert) {
    // Already told Discord this printer is down — don't repeat until it comes back
    if (_printerOfflineNotified[printerName]) return;
    _printerOfflineNotified[printerName] = now;
  } else {
    // Real errors: debounce to at most once per 5 minutes
    if (_mqttAlertTs[printerName] && now - _mqttAlertTs[printerName] < 5 * 60 * 1000) return;
    _mqttAlertTs[printerName] = now;
  }
  sendDiscordStatus(content);
  console.warn(content);
}

// ── Section 30: Parse object boundary data from MQTT ──
function parseObjectData(mqttPayload) {
  if (!mqttPayload || !mqttPayload.print) return null;
  const print = mqttPayload.print;

  // Bambu MQTT may use obj_list or subtask_obj_list depending on firmware
  const objList = print.obj_list || print.subtask_obj_list || null;

  if (!objList || !Array.isArray(objList) || objList.length === 0) return null;

  // s_obj holds the current object being printed (index or id depending on firmware)
  const sObj = print.s_obj;

  // Determine current object index — some firmware versions send current_obj_id or current_obj_idx
  let currentObjectIdx = print.current_obj_idx != null ? print.current_obj_idx : 0;
  let currentObjectId  = print.current_obj_id  != null ? print.current_obj_id  : (objList[0]?.id || null);

  // Fallback: s_obj may directly be the current index
  if (sObj != null && print.current_obj_idx == null) {
    currentObjectIdx = typeof sObj === 'number' ? sObj : 0;
  }

  return {
    objectList:       objList,
    currentObjectId:  currentObjectId,
    currentObjectIdx: currentObjectIdx,
    totalObjects:     objList.length,
    hasObjectData:    true,
    rawSOBJ:          sObj   // keep raw for debugging
  };
}

// ── Connect each printer via MQTT ──
PRINTERS.forEach(printer => {
  printerStates[printer.name] = { online: false };

  const client = mqtt.connect(`mqtts://${printer.ip}:8883`, {
    username:           'bblp',
    password:           printer.accessCode,
    rejectUnauthorized: false
  });

  const REPORT_TOPIC  = `device/${printer.serial}/report`;
  const REQUEST_TOPIC = `device/${printer.serial}/request`;
  printerClients[printer.name] = { client, REQUEST_TOPIC };

  client.on('connect', () => {
    const wasOffline = !!_printerOfflineNotified[printer.name];
    printerStates[printer.name].online = true;
    // Clear offline flag so the next power-off will alert again
    delete _printerOfflineNotified[printer.name];
    client.subscribe(REPORT_TOPIC);
    // Request full push on connect so we get all current state immediately
    client.publish(REQUEST_TOPIC, JSON.stringify({
      pushing: { sequence_id: '0', command: 'pushall' }
    }));
    console.log(`Connected to ${printer.name}`);
    // Notify Discord only if we previously told it the printer was offline
    if (wasOffline) {
      sendDiscordAlert(`✅ **${printer.name}** is back online`);
    }
  });

  client.on('message', (topic, message) => {
    try {
      const mqttPayload = JSON.parse(message.toString());

      if (mqttPayload.print) {
        // Merge MQTT print fields into printerStates.
        // Preserve AMS data: incremental updates often omit ams entirely — don't clobber
        // a good pushall payload with an empty/missing ams from a progress update.
        const prevAms = printerStates[printer.name].ams;
        const newAms  = mqttPayload.print.ams;
        const keepAms = (newAms && newAms.ams && newAms.ams.length > 0) ? newAms : (prevAms || newAms);
        printerStates[printer.name] = {
          ...printerStates[printer.name],
          ...mqttPayload.print,
          ams:         keepAms,
          online:      true,
          lastUpdated: Date.now()
        };

        // Section 30: parse and store object boundary data on every message
        const objData = parseObjectData(mqttPayload);
        if (objData) {
          // Current message had obj_list — store it
          printerStates[printer.name].objectData = objData;
        } else {
          // Current message didn't have obj_list — try accumulated state
          // (obj_list is only sent in pushall; incremental updates only have s_obj)
          const accList = printerStates[printer.name].obj_list;
          if (Array.isArray(accList) && accList.length > 0) {
            const sObj = printerStates[printer.name].s_obj;
            const curIdx = typeof sObj === 'number' ? sObj : 0;
            const existing = printerStates[printer.name].objectData;
            if (!existing || !existing.hasObjectData) {
              // First time building from accumulated state
              printerStates[printer.name].objectData = {
                objectList:       accList,
                currentObjectId:  accList[curIdx] ? accList[curIdx].id : null,
                currentObjectIdx: curIdx,
                totalObjects:     accList.length,
                hasObjectData:    true,
                rawSOBJ:          sObj
              };
            } else if (typeof sObj === 'number' && sObj !== existing.rawSOBJ) {
              // s_obj changed — update current object pointer
              printerStates[printer.name].objectData = {
                ...existing,
                currentObjectIdx: sObj,
                currentObjectId:  accList[sObj] ? accList[sObj].id : null,
                rawSOBJ:          sObj
              };
            }
          } else if (!printerStates[printer.name].objectData) {
            printerStates[printer.name].objectData = { hasObjectData: false };
          }
        }

        // ── Print complete / failed Discord alerts ──────────────────────────
        const gcodeState = mqttPayload.print.gcode_state;
        if (gcodeState && gcodeState !== _printerPrevGcodeState[printer.name]) {
          const prevState = _printerPrevGcodeState[printer.name];
          const jobName = (mqttPayload.print.subtask_name || printerStates[printer.name].subtask_name || '')
            .replace(/\.gcode\.3mf$/i, '').replace(/\.3mf$/i, '') || 'Unknown job';

          if (gcodeState === 'FINISH' && prevState) {
            // Only alert on a real transition FROM a known prior state (not first connect)
            const _st = printerStates[printer.name].printStartTime;
            const _dur = _st ? Math.round((Date.now() - _st) / 60000) : 0;
            const _durStr = _dur > 0 ? `${Math.floor(_dur/60)}h ${_dur%60}m` : '—';
            mqttAlert(printer.name,
              `✅ **Print Complete — ${printer.name}**\nJob: ${jobName}\nDuration: ${_durStr}`,
              false);
          } else if (gcodeState === 'FAILED' && prevState) {
            const pct = mqttPayload.print.mc_percent || printerStates[printer.name].mc_percent || 0;
            mqttAlert(printer.name,
              `❌ **${printer.name}** print **FAILED** at ${pct}%\n📄 ${jobName}`,
              false);
          }

          _printerPrevGcodeState[printer.name] = gcodeState;
        }

        // Section 30: snapshot full state on FAILED for post-failure dialog
        if (gcodeState === 'FAILED') {
          printerStates[printer.name].failureSnapshot = {
            mcPercent:   mqttPayload.print.mc_percent      || 0,
            failReason:  mqttPayload.print.print_error     || '',
            subtaskName: mqttPayload.print.subtask_name    || '',
            failedAt:    new Date().toISOString(),
            startTime:   printerStates[printer.name].printStartTime || null
          };
        }

        // Track print start time for duration calculations
        if (gcodeState === 'RUNNING' && !printerStates[printer.name].printStartTime) {
          printerStates[printer.name].printStartTime = Date.now();
          printerStates[printer.name].lastCompletedDurationMins = null; // clear stale
        }
        // When print ends: save duration BEFORE clearing start time so the app
        // can retrieve it on the next poll (avoids "Duration: —" when app missed RUNNING)
        if (['FINISH', 'FAILED', 'IDLE'].includes(gcodeState)) {
          const st = printerStates[printer.name].printStartTime;
          if (st && gcodeState === 'FINISH') {
            printerStates[printer.name].lastCompletedDurationMins = Math.round((Date.now() - st) / 60000);
          }
          printerStates[printer.name].printStartTime = null;
          // Clear object data when print ends — next print may not be print-by-object
          if (['FINISH', 'IDLE'].includes(gcodeState)) {
            printerStates[printer.name].objectData = { hasObjectData: false };
          }
        }
      }
    } catch (e) {
      // Ignore parse errors — some MQTT messages are binary or malformed
    }
  });

  client.on('error', (err) => {
    printerStates[printer.name].online = false;
    const unreachable = err.code === 'EHOSTUNREACH' || err.code === 'ECONNREFUSED'
      || err.code === 'ETIMEDOUT' || err.code === 'ENOTFOUND'
      || (err.message || '').includes('EHOSTUNREACH')
      || (err.message || '').includes('ECONNREFUSED');
    if (unreachable) {
      // Printer is powered off or unreachable — alert ONCE, then silence until back online
      mqttAlert(printer.name, `🔴 **${printer.name}** is unreachable (powered off or network issue)`, true);
    } else {
      // Genuine error (auth, protocol, etc.) — debounced real alert
      mqttAlert(printer.name, `⚠️ **${printer.name}** MQTT error: ${err.message}`, false);
    }
  });

  client.on('offline', () => {
    printerStates[printer.name].online = false;
    // Only alert if we haven't already flagged this printer as unreachable
    if (!_printerOfflineNotified[printer.name]) {
      mqttAlert(printer.name, `📡 **${printer.name}** went offline (MQTT disconnected)`, false);
    }
  });
});

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /status — all printers with object data and failure snapshot
app.get('/status', (req, res) => {
  const response = Object.fromEntries(
    Object.entries(printerStates).map(([name, state]) => [
      name,
      {
        ...state,
        objectData:      state.objectData      || { hasObjectData: false },
        failureSnapshot: state.failureSnapshot || null
      }
    ])
  );
  res.json(response);
});

// GET /status/:name — single printer
app.get('/status/:name', (req, res) => {
  const state = printerStates[req.params.name];
  if (!state) return res.status(404).json({ error: 'Not found' });
  res.json({
    ...state,
    objectData:      state.objectData      || { hasObjectData: false },
    failureSnapshot: state.failureSnapshot || null
  });
});

// GET /cameras — camera stream name map
app.get('/cameras', (req, res) => res.json(CAMERAS));

// POST /control — pause | resume | stop | skip | calibration | light_on | light_off
app.post('/control', (req, res) => {
  const { printer, command, objectId, option } = req.body;

  const VALID = ['pause','resume','stop','skip','calibration','light_on','light_off'];
  if (!VALID.includes(command)) {
    return res.status(400).json({ error: 'Invalid command' });
  }

  const p = printerClients[printer];
  if (!p) return res.status(404).json({ error: 'Printer not found' });

  let payload;

  if (command === 'skip') {
    if (!objectId) return res.status(400).json({ error: 'objectId required for skip' });
    payload = JSON.stringify({
      print: { sequence_id: '0', command: 'skip_objects', obj_list: [objectId] }
    });
  } else if (command === 'calibration') {
    // option bitmask: 1=bed leveling, 2=vibration compensation, 4=flow calibration, 7=all
    payload = JSON.stringify({
      print: { sequence_id: '0', command: 'calibration', option: option || 7 }
    });
  } else if (command === 'light_on' || command === 'light_off') {
    payload = JSON.stringify({
      system: {
        sequence_id: '0',
        command:  'ledctrl',
        led_node: 'work_light',
        led_mode: command === 'light_on' ? 'on' : 'off'
      }
    });
  } else {
    payload = JSON.stringify({
      print: { sequence_id: '0', command }
    });
  }

  p.client.publish(p.REQUEST_TOPIC, payload);
  console.log(`Control: ${printer} → ${command}${objectId ? ' obj:'+objectId : ''}${option ? ' opt:'+option : ''}`);
  res.json({ ok: true, sent: command, printer });
});

// POST /ams/set-slot — set filament type/color for an AMS slot
app.post('/ams/set-slot', (req, res) => {
  const { printer, amsId, trayId, filamentType, color } = req.body;
  const p = printerClients[printer];
  if (!p) return res.status(404).json({ error: 'Printer not found' });
  p.client.publish(p.REQUEST_TOPIC, JSON.stringify({
    print: {
      sequence_id: '0',
      command:     'ams_filament_setting',
      ams_id:      amsId,
      tray_id:     trayId,
      tray_info_idx: filamentType || 'GFL99',
      tray_color:  color || 'FFFFFFFF'
    }
  }));
  res.json({ ok: true });
});

// POST /ams/load — load filament from AMS slot or external/virtual spool
// amsId=255 means external/virtual spool (printer without AMS)
app.post('/ams/load', (req, res) => {
  const { printer, amsId, trayId } = req.body;
  const p = printerClients[printer];
  if (!p) return res.status(404).json({ error: 'Printer not found' });
  const isExternal = (amsId === 255 || amsId === -1);
  const target = isExternal ? 255 : ((amsId || 0) * 4 + (trayId || 0));
  p.client.publish(p.REQUEST_TOPIC, JSON.stringify({
    print: {
      sequence_id: '0',
      command:     'ams_change_filament',
      target:      target,
      curr_temp:   0,
      tar_temp:    0
    }
  }));
  res.json({ ok: true });
});

// POST /ams/unload — unload current filament
// target=255 is the universal Bambu unload signal (AMS, AMS Lite, external spool)
app.post('/ams/unload', (req, res) => {
  const { printer } = req.body;
  const p = printerClients[printer];
  if (!p) return res.status(404).json({ error: 'Printer not found' });
  p.client.publish(p.REQUEST_TOPIC, JSON.stringify({
    print: {
      sequence_id: '0',
      command:     'ams_change_filament',
      target:      255,
      curr_temp:   220,
      tar_temp:    220
    }
  }));
  res.json({ ok: true });
});

// POST /ams/set-ext-spool — set color/type metadata for external/virtual spool
// Used when a printer has no AMS (e.g. P1S with direct spool)
app.post('/ams/set-ext-spool', (req, res) => {
  const { printer, color, type, brand } = req.body;
  const p = printerClients[printer];
  if (!p) return res.status(404).json({ error: 'Printer not found' });
  const col = (color || '#1A1A1A').replace('#', '').toUpperCase().slice(0, 6) + 'FF';
  p.client.publish(p.REQUEST_TOPIC, JSON.stringify({
    print: {
      sequence_id:     '0',
      command:         'ams_filament_setting',
      ams_id:          255,
      tray_id:         254,
      tray_color:      col,
      tray_type:       type || 'PLA',
      tray_sub_brands: brand || '',
      setting_id:      '',
      tray_info_idx:   ''
    }
  }));
  res.json({ ok: true });
});

// GET /health — quick health check
app.get('/health', (req, res) => {
  res.json({
    ok:       true,
    uptime:   process.uptime(),
    printers: PRINTERS.map(p => ({
      name:   p.name,
      online: printerStates[p.name]?.online || false
    }))
  });
});

// POST /health/cron — update the pi-health.js crontab frequency from LayerDeck
app.post('/health/cron', (req, res) => {
  const { frequency } = req.body; // '5' | '15' | '30' | '60' | 'off'
  const { execSync } = require('child_process');

  const valid = ['5', '15', '30', '60', 'off'];
  if (!valid.includes(String(frequency))) {
    return res.status(400).json({ error: 'Invalid frequency. Use: 5, 15, 30, 60, off' });
  }

  try {
    let currentCron = '';
    try { currentCron = execSync('crontab -l', { encoding: 'utf8' }); }
    catch (e) { currentCron = ''; }

    // Remove existing pi-health.js entries so we can cleanly re-add them
    const lines = currentCron
      .split('\n')
      .filter(l => !l.includes('pi-health.js') && l.trim() !== '');

    // Always keep the daily 7AM health report (even when frequency is 'off')
    lines.push('0 7 * * * node ~/bambu-hub/pi-health.js daily');

    // Add the polling interval entry unless disabled
    if (frequency !== 'off') {
      const expr = frequency === '60' ? '0 * * * *' : `*/${frequency} * * * *`;
      lines.push(`${expr} node ~/bambu-hub/pi-health.js`);
    }

    const newCron = lines.join('\n') + '\n';
    execSync(`echo "${newCron.replace(/"/g, '\\"')}" | crontab -`);

    console.log(`Health check frequency updated: ${frequency}`);
    res.json({ ok: true, frequency });
  } catch (e) {
    console.error('Failed to update crontab:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Section 31: Tapo P115 local control (cloud-offline fallback) ───────────────
// Plugs are on the local LAN; cloud passthrough fails when they lack internet
// access. Pi Hub reaches them directly via local KLAP protocol.
//
// Deploy note: run `npm install tp-link-tapo-connect` in ~/bambu-hub/ once,
// then this block activates automatically.

const TAPO_PLUG_IPS = {
  // alias (lowercase)  → local IP
  'a1 plug':        '192.168.1.165',
  'p1 closet plug': '192.168.1.172',
  'p1s room plug':  '192.168.1.162',
  'p1 room plug':   '192.168.1.162', // alternate naming
};

let _tapoLib = null;
function _getTapoLib() {
  if (_tapoLib) return _tapoLib;
  try {
    _tapoLib = require('tp-link-tapo-connect');
    console.log('[Tapo] tp-link-tapo-connect loaded');
  } catch (e) {
    console.warn('[Tapo] tp-link-tapo-connect not installed — run: npm install tp-link-tapo-connect');
  }
  return _tapoLib;
}

async function _tapoLocalDevice(alias) {
  const lib = _getTapoLib();
  if (!lib) throw new Error('tp-link-tapo-connect not installed on Pi Hub');
  const email    = process.env.TAPO_EMAIL;
  const password = process.env.TAPO_PASSWORD;
  if (!email || !password) throw new Error('TAPO_EMAIL / TAPO_PASSWORD env vars not set on Pi');
  const ip = TAPO_PLUG_IPS[alias.toLowerCase().trim()];
  if (!ip) throw new Error(`No local IP found for plug alias: "${alias}"`);
  // tp-link-tapo-connect v3+: loginDeviceByIp(email, password, ip)
  return await lib.loginDeviceByIp(email, password, ip);
}

// GET /tapo/devices — returns on/off + wattage via local protocol
app.get('/tapo/devices', async (req, res) => {
  const results = await Promise.all(
    Object.entries(TAPO_PLUG_IPS).map(async ([alias, ip]) => {
      try {
        const device = await _tapoLocalDevice(alias);
        const info   = await device.getDeviceInfo();
        return {
          alias,
          ip,
          on:       !!info?.result?.device_on,
          power_mw: info?.result?.current_power ?? null,
          error:    null,
        };
      } catch (e) {
        return { alias, ip, on: null, power_mw: null, error: e.message };
      }
    })
  );
  res.json({ ok: true, devices: results });
});

// POST /tapo/power — { alias: "A1 Plug", on: true }
app.post('/tapo/power', async (req, res) => {
  const { alias, on } = req.body;
  if (!alias || typeof on !== 'boolean') {
    return res.status(400).json({ ok: false, error: 'alias (string) and on (boolean) required' });
  }
  try {
    const device = await _tapoLocalDevice(alias);
    await device.setPowerState(on);
    console.log(`[Tapo] ${alias} → ${on ? 'ON' : 'OFF'}`);
    res.json({ ok: true, alias, on });
  } catch (e) {
    console.error(`[Tapo] Power command failed for "${alias}":`, e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── Section 28: AI Print Failure Detection ────────────────────────────────────
// Requirements:
//   1. ffmpeg  — sudo apt install ffmpeg
//   2. Ollama  — curl https://ollama.ai/install.sh | sh
//   3. Vision model — ollama pull llava:latest  (or llava-phi3 for faster/smaller)
// Camera RTSP URLs: add  rtspUrl  field to each printer in printers.json, or set
// env vars on Pi: CAMERA_A1_RTSP, CAMERA_P1_ROOM_RTSP, CAMERA_P1_CLOSET_RTSP

const { spawnSync: _spawnSync } = require('child_process');
const http_node = require('http');

// ── Vision config (persisted to vision-config.json) ──────────────────────────
let _vEnabled   = true;
let _vIntervalM = 5;       // minutes between auto-scans
let _vThreshold = 0.55;    // min confidence to send Discord alert
let _vModel     = 'llava:latest';
let _vOllamaUrl = 'http://localhost:11434';
let _vPerPrint  = {};      // { printerName: { enabled: bool } }

const _vCfgPath = path.join(__dirname, 'vision-config.json');
(function _loadVisionCfg() {
  try {
    if (!fs.existsSync(_vCfgPath)) return;
    const c = JSON.parse(fs.readFileSync(_vCfgPath, 'utf8'));
    if (c.enabled           !== undefined) _vEnabled   = !!c.enabled;
    if (c.intervalMins)                    _vIntervalM = parseFloat(c.intervalMins) || 5;
    if (c.confidenceThreshold !== undefined) _vThreshold = parseFloat(c.confidenceThreshold) || 0.55;
    if (c.ollamaModel)                     _vModel     = c.ollamaModel;
    if (c.ollamaUrl)                       _vOllamaUrl = c.ollamaUrl;
    if (c.perPrinter)                      _vPerPrint  = c.perPrinter;
  } catch (_) {}
})();

function _saveVisionCfg() {
  try {
    fs.writeFileSync(_vCfgPath, JSON.stringify({
      enabled: _vEnabled, intervalMins: _vIntervalM,
      confidenceThreshold: _vThreshold, ollamaModel: _vModel,
      ollamaUrl: _vOllamaUrl, perPrinter: _vPerPrint
    }, null, 2));
  } catch (_) {}
}

// ── Vision state ──────────────────────────────────────────────────────────────
const _vResults  = {}; // { printerName: { status, confidence, issues, description, timestamp } }
const _vImages   = {}; // { printerName: { base64, timestamp } }
const _vLog      = []; // [{ printerName, status, confidence, description, timestamp }] — last 50
const _vScanning = new Set();

// ── Helpers ───────────────────────────────────────────────────────────────────
function _getRtspUrl(name) {
  const pr = PRINTERS.find(p => p.name === name);
  if (pr && pr.rtspUrl) return pr.rtspUrl;
  // Env var: e.g. CAMERA_P1_ROOM_RTSP for "P1 Room"
  const envKey = 'CAMERA_' + name.replace(/[\s()]/g, '_').replace(/_+/g, '_').toUpperCase() + '_RTSP';
  if (process.env[envKey]) return process.env[envKey];
  // Named fallbacks
  const MAP = {
    'A1':        process.env.CAMERA_A1_RTSP,
    'P1 Room':   process.env.CAMERA_P1_ROOM_RTSP,
    'P1 Closet': process.env.CAMERA_P1_CLOSET_RTSP
  };
  return MAP[name] || null;
}

function _captureFrame(name) {
  const url = _getRtspUrl(name);
  if (!url) return null;
  const out = `/tmp/ld_vs_${name.replace(/[^a-z0-9]/gi, '_')}.jpg`;
  try {
    _spawnSync('ffmpeg', [
      '-rtsp_transport', 'tcp', '-i', url,
      '-frames:v', '1', '-q:v', '4', '-vf', 'scale=640:-1',
      '-y', out
    ], { timeout: 12000 });
    if (!fs.existsSync(out)) return null;
    const b64 = fs.readFileSync(out).toString('base64');
    try { fs.unlinkSync(out); } catch (_) {}
    return b64;
  } catch (e) {
    console.warn(`[Vision] capture failed for ${name}: ${e.message}`);
    return null;
  }
}

function _askOllama(b64, name) {
  return new Promise(resolve => {
    const prompt =
      `You monitor a 3D printer named "${name}" for failures. Analyze this camera image.\n` +
      `Detect: spaghetti (filament extruded into air), layer shift, warping, adhesion failure, nozzle clog, stringing, blobs.\n` +
      `Reply ONLY with JSON (no markdown):\n` +
      `{"status":"ok","confidence":0.9,"issues":[],"description":"one sentence"}\n` +
      `status: ok|warning|failure   confidence: 0.0–1.0`;
    const body = JSON.stringify({ model: _vModel, prompt, images: [b64], stream: false });
    try {
      const u   = new URL(`${_vOllamaUrl}/api/generate`);
      const req = http_node.request({
        hostname: u.hostname, port: parseInt(u.port) || 11434, path: u.pathname,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
      }, res => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => {
          try {
            const outer = JSON.parse(d);
            const raw   = (outer.response || '').replace(/```json|```/g, '').trim();
            resolve(JSON.parse(raw));
          } catch (_) { resolve({ status: 'ok', confidence: 0, issues: [], description: 'Parse error' }); }
        });
      });
      req.setTimeout(45000, () => { req.destroy(); resolve(null); });
      req.on('error', () => resolve(null));
      req.write(body); req.end();
    } catch (e) { resolve(null); }
  });
}

async function _visionScan(name, manual = false) {
  if (_vScanning.has(name)) return;
  _vScanning.add(name);
  try {
    const st = printerStates[name];
    if (!manual && !['RUNNING','PAUSE','PAUSED'].includes(st?.gcode_state || '')) return;
    if (!manual && !_vEnabled) return;
    if (!manual && _vPerPrint[name]?.enabled === false) return;

    console.log(`[Vision] Scanning ${name}${manual ? ' (manual)' : ''}...`);

    const b64 = _captureFrame(name);
    if (!b64) {
      _vResults[name] = { status:'error', confidence:0, issues:[],
        description:'No frame captured — check RTSP URL or camera connection', timestamp: Date.now() };
      return;
    }
    _vImages[name] = { base64: b64, timestamp: Date.now() };

    const r = await _askOllama(b64, name);
    if (!r) {
      _vResults[name] = { status:'error', confidence:0, issues:[],
        description:'Ollama not responding — run: ollama serve', timestamp: Date.now() };
      return;
    }

    const ts = Date.now();
    _vResults[name] = { ...r, timestamp: ts };
    _vLog.unshift({ printerName: name, ...r, timestamp: ts });
    if (_vLog.length > 50) _vLog.length = 50;

    console.log(`[Vision] ${name}: ${r.status} (${Math.round((r.confidence||0)*100)}%) — ${r.description}`);

    // Discord alert when failure/warning exceeds threshold
    if ((r.status === 'failure' || r.status === 'warning') && (r.confidence || 0) >= _vThreshold) {
      const emoji  = r.status === 'failure' ? '🚨' : '⚠️';
      const issues = (r.issues || []).join(', ') || r.description || '';
      sendDiscordAlert(
        `${emoji} **AI Vision — ${r.status === 'failure' ? 'Failure' : 'Warning'} on ${name}**\n` +
        `${issues}\nConfidence: ${Math.round((r.confidence || 0) * 100)}%`
      );
    }
  } finally {
    _vScanning.delete(name);
  }
}

let _vTimer = null;
function _scheduleVision() {
  if (_vTimer) clearInterval(_vTimer);
  const ms = Math.max(1, _vIntervalM) * 60000;
  _vTimer = setInterval(() => {
    if (!_vEnabled) return;
    PRINTERS.forEach(p => _visionScan(p.name).catch(() => {}));
  }, ms);
  console.log(`[Vision] auto-scan every ${_vIntervalM} min`);
}
_scheduleVision();

// ── Vision endpoints ──────────────────────────────────────────────────────────
app.get('/vision/status', (req, res) => res.json({
  enabled: _vEnabled, intervalMins: _vIntervalM,
  confidenceThreshold: _vThreshold, ollamaModel: _vModel, ollamaUrl: _vOllamaUrl,
  perPrinter: _vPerPrint, results: _vResults, log: _vLog.slice(0, 20)
}));

app.get('/vision/snapshot/:printer', (req, res) => {
  const img = _vImages[req.params.printer];
  if (!img) return res.status(404).json({ error: 'No snapshot yet' });
  res.json({ base64: img.base64, timestamp: img.timestamp });
});

app.post('/vision/scan', (req, res) => {
  const { printer } = req.body;
  if (!printer || !PRINTERS.find(p => p.name === printer))
    return res.status(400).json({ error: 'Valid printer name required' });
  _visionScan(printer, true).catch(() => {});
  res.json({ ok: true, scanning: printer });
});

app.get('/vision/check', (req, res) => {
  const ff = (() => { try { return _spawnSync('which',['ffmpeg'],{timeout:2000}).status===0; } catch(_){return false;} })();
  const ol = (() => {
    try {
      const r = _spawnSync('curl',['-s','-o','/dev/null','-w','%{http_code}',`${_vOllamaUrl}/api/tags`],{timeout:3000});
      return (r.stdout||'').toString().trim() === '200';
    } catch (_) { return false; }
  })();
  res.json({ ffmpeg: ff, ollama: ol, model: _vModel, ollamaUrl: _vOllamaUrl });
});

app.post('/vision/config', (req, res) => {
  const { enabled, intervalMins, confidenceThreshold, ollamaModel, ollamaUrl, perPrinter } = req.body;
  if (enabled             !== undefined) _vEnabled   = !!enabled;
  if (intervalMins        !== undefined) _vIntervalM = parseFloat(intervalMins) || 5;
  if (confidenceThreshold !== undefined) _vThreshold = parseFloat(confidenceThreshold) || 0.55;
  if (ollamaModel         !== undefined) _vModel     = ollamaModel;
  if (ollamaUrl           !== undefined) _vOllamaUrl = ollamaUrl;
  if (perPrinter          !== undefined) _vPerPrint  = perPrinter;
  _saveVisionCfg();
  _scheduleVision();
  res.json({ ok: true });
});

app.listen(PI_PORT, () => console.log(`🚀 LayerDeck Hub on port ${PI_PORT}`));
