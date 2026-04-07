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
const _prevStatePath = path.join(__dirname, '.prev_gcode_state.json');
const _printerPrevGcodeState = (() => {
  try {
    if (fs.existsSync(_prevStatePath)) {
      const saved = JSON.parse(fs.readFileSync(_prevStatePath, 'utf8'));
      console.log('[Hub] Restored prev gcode states:', JSON.stringify(saved));
      return saved;
    }
  } catch (e) { console.warn('[Hub] Could not restore prev gcode states:', e.message); }
  return {};
})();
function _savePrevGcodeState() {
  try { fs.writeFileSync(_prevStatePath, JSON.stringify(_printerPrevGcodeState)); } catch(e) {}
}

// ── Discord alert helpers ──────────────────────────────────────────────────────
// Print Alerts channel — completed prints, failed prints, AI vision alerts.
// Consolidated: formerly split between PRINT_ALERTS and PRINT_WATCH.
let DISCORD_ALERTS_URL = process.env.DISCORD_WEBHOOK_PRINT_ALERTS || '';
// Pi Health channel — printer online/offline status, MQTT errors.
// Falls back to DISCORD_ALERTS_URL when not set.
let DISCORD_PI_HEALTH_URL = process.env.DISCORD_WEBHOOK_PI_HEALTH || '';
const configPath = path.join(__dirname, 'config.json');
if (fs.existsSync(configPath)) {
  try {
    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (cfg.discordWebhookPrintAlerts) DISCORD_ALERTS_URL   = cfg.discordWebhookPrintAlerts;
    if (cfg.discordWebhookPiHealth)    DISCORD_PI_HEALTH_URL = cfg.discordWebhookPiHealth;
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

// Printer status (online/offline) — goes to Pi Health channel, not Print Alerts
function sendDiscordStatus(content) {
  _postDiscord(DISCORD_PI_HEALTH_URL || DISCORD_ALERTS_URL, content);
}

function sendDiscordWatch(content) {
  // AI vision alerts — consolidated into Print Alerts channel
  _postDiscord(DISCORD_ALERTS_URL, content);
}

// Send Discord alert with a JPEG image attached (multipart/form-data)
function sendDiscordWatchWithImage(content, base64Jpeg) {
  const webhookUrl = DISCORD_ALERTS_URL;
  if (!webhookUrl) return;
  try {
    const imgBuf   = Buffer.from(base64Jpeg, 'base64');
    const boundary = 'LayerDeckVision' + Date.now();
    const jsonPart = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="payload_json"\r\n\r\n` +
      JSON.stringify({ content }) + `\r\n`
    );
    const filePart = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="files[0]"; filename="snapshot.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`
    );
    const tail     = Buffer.from(`\r\n--${boundary}--\r\n`);
    const body     = Buffer.concat([jsonPart, filePart, imgBuf, tail]);
    const url      = new URL(webhookUrl);
    const req      = https.request({
      hostname: url.hostname,
      path:     url.pathname + url.search,
      method:   'POST',
      headers:  { 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': body.length }
    }, () => {});
    req.on('error', () => {});
    req.write(body);
    req.end();
  } catch (e) { /* silent */ }
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
    sendDiscordStatus(content); // Offline/connection issues → #pi-health
  } else {
    // Print events (complete/failed): debounce to at most once per 5 minutes
    if (_mqttAlertTs[printerName] && now - _mqttAlertTs[printerName] < 5 * 60 * 1000) return;
    _mqttAlertTs[printerName] = now;
    sendDiscordAlert(content);  // Print complete/failed → #print-alerts
  }
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
    // Clear visual-offline block — we're reconnecting and about to request fresh state
    _vVisuallyOffline.delete(printer.name);
    client.subscribe(REPORT_TOPIC);
    // Request full push on connect so we get all current state immediately
    client.publish(REQUEST_TOPIC, JSON.stringify({
      pushing: { sequence_id: '0', command: 'pushall' }
    }));
    console.log(`Connected to ${printer.name}`);
    // Notify Discord only if we previously told it the printer was offline
    if (wasOffline) {
      sendDiscordStatus(`✅ **${printer.name}** is back online`);
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

          const _wasActivelyPrinting = prevState === 'RUNNING' || prevState === 'PAUSE' || prevState === 'PAUSED';
          if (gcodeState === 'FINISH' && _wasActivelyPrinting) {
            // Only alert when transitioning FROM an active print state — prevents
            // duplicate alerts when the printer powers back on and replays FINISH
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
          _savePrevGcodeState();
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
        if (gcodeState === 'RUNNING') {
          // Clear visual-offline flag on every RUNNING message — not just the first.
          // If AI produced a false-positive "empty/dark" result mid-print, this ensures
          // the auto-scan resumes as soon as MQTT confirms the printer is active again
          // rather than staying blocked for the rest of the print session.
          _vVisuallyOffline.delete(printer.name);
          if (!printerStates[printer.name].printStartTime) {
            printerStates[printer.name].printStartTime = Date.now();
            printerStates[printer.name].lastCompletedDurationMins = null; // clear stale
          }
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
      // Connection/protocol error (keepalive timeout, auth, etc.) → printer status channel
      mqttAlert(printer.name, `⚠️ **${printer.name}** MQTT error: ${err.message}`, true);
    }
  });

  client.on('offline', () => {
    printerStates[printer.name].online = false;
    // Only alert if we haven't already flagged this printer as unreachable
    if (!_printerOfflineNotified[printer.name]) {
      mqttAlert(printer.name, `📡 **${printer.name}** went offline (MQTT disconnected)`, true);
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
  // Use live nozzle temp (or safe PLA default). Sending 0/0 can cause some printers to
  // misinterpret the command as an unload. The printer uses curr_temp to know when to
  // retract and tar_temp for the new slot's expected nozzle temp.
  const _state = printerStates[printer] || {};
  const _nozzle = Math.round(_state.nozzle_temper || 0);
  const _currTemp = _nozzle > 170 ? _nozzle : 220;  // default PLA temp if cold
  const _tarTemp  = _currTemp;
  p.client.publish(p.REQUEST_TOPIC, JSON.stringify({
    print: {
      sequence_id: '0',
      command:     'ams_change_filament',
      target:      target,
      curr_temp:   _currTemp,
      tar_temp:    _tarTemp
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

// POST /discord/config — update Discord webhook URLs in config.json (called by LayerDeck app on save)
app.post('/discord/config', (req, res) => {
  try {
    const { discordWebhookPrintWatch, discordWebhookPrintAlerts, discordWebhookPrinterStatus } = req.body;
    let cfg = {};
    if (fs.existsSync(configPath)) {
      try { cfg = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch (_) {}
    }
    if (discordWebhookPrintAlerts  !== undefined) { cfg.discordWebhookPrintAlerts  = discordWebhookPrintAlerts;  DISCORD_ALERTS_URL    = discordWebhookPrintAlerts    || DISCORD_ALERTS_URL; }
    if (discordWebhookPrinterStatus !== undefined){ cfg.discordWebhookPrinterStatus = discordWebhookPrinterStatus; DISCORD_PI_HEALTH_URL = discordWebhookPrinterStatus || DISCORD_PI_HEALTH_URL; }
    fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2));
    console.log('[Config] Discord webhooks updated');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
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
        // tp-link-tapo-connect returns device_on directly (no .result wrapper)
        const raw = info?.result ?? info ?? {};
        return {
          alias,
          ip,
          on:       !!raw.device_on,
          power_mw: raw.current_power ?? null,
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
    if (on) { await device.turnOn(); } else { await device.turnOff(); }
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
const _vModel   = 'claude-haiku'; // always Claude Haiku — not user-configurable
let _vPerPrint  = {};      // { printerName: { enabled: bool } }

// Anthropic API key — read from config.json or ANTHROPIC_API_KEY env var
let _anthropicKey = process.env.ANTHROPIC_API_KEY || '';

const _vCfgPath = path.join(__dirname, 'vision-config.json');
(function _loadVisionCfg() {
  try {
    if (!fs.existsSync(_vCfgPath)) return;
    const c = JSON.parse(fs.readFileSync(_vCfgPath, 'utf8'));
    if (c.enabled             !== undefined) _vEnabled   = !!c.enabled;
    if (c.intervalMins)                      _vIntervalM = parseFloat(c.intervalMins) || 5;
    if (c.confidenceThreshold !== undefined) _vThreshold = parseFloat(c.confidenceThreshold) || 0.55;
    // ollamaModel intentionally ignored — model is always claude-haiku
    if (c.perPrinter)                        _vPerPrint  = c.perPrinter;
  } catch (_) {}
})();

// Also pull anthropicKey from config.json if present
try {
  if (fs.existsSync(configPath)) {
    const _cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (_cfg.anthropicApiKey) _anthropicKey = _cfg.anthropicApiKey;
  }
} catch (_) {}

function _saveVisionCfg() {
  try {
    fs.writeFileSync(_vCfgPath, JSON.stringify({
      enabled: _vEnabled, intervalMins: _vIntervalM,
      confidenceThreshold: _vThreshold,
      perPrinter: _vPerPrint
    }, null, 2));
  } catch (_) {}
}

// ── Vision state ──────────────────────────────────────────────────────────────
const _vResults           = {}; // { printerName: { status, confidence, issues, description, timestamp } }
const _vImages            = {}; // { printerName: { base64, timestamp } }
const _vConsecFailures    = {}; // consecutive failure count per printer (reset on ok/warning)
const _vLogPath        = path.join(__dirname, 'vision-log.json');
const _vLog            = (()=>{ try { if(fs.existsSync(_vLogPath)) return JSON.parse(fs.readFileSync(_vLogPath,'utf8')); } catch(_){} return []; })();
const _vScanning       = new Set();
// Printers where AI confirmed no active print (dark/empty view) — skip auto-scans until MQTT says RUNNING again
const _vVisuallyOffline = new Set();

function _saveVisionLog() {
  try { fs.writeFileSync(_vLogPath, JSON.stringify(_vLog.slice(0,50)), 'utf8'); } catch(_) {}
}

// Keywords suggesting no print in progress (printer off, empty plate, dark image)
const _V_OFFLINE_KEYWORDS = ['empty','no print','no filament','blank','dark','idle','powered off',
  'no active','not printing','off','nothing','no object','printer is off','black image',
  'no 3d print','cannot see','no visible'];

function _isVisuallyOff(description = '', issues = []) {
  const text = (description + ' ' + issues.join(' ')).toLowerCase();
  return _V_OFFLINE_KEYWORDS.some(kw => text.includes(kw));
}

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

// go2rtc port (reads from config if set, defaults to 1984)
let _go2rtcPort = 1984;
try {
  if (fs.existsSync(configPath)) {
    const _cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (_cfg.go2rtcPort) _go2rtcPort = parseInt(_cfg.go2rtcPort) || 1984;
  }
} catch (_) {}

// Try go2rtc HTTP snapshot first (handles Bambu TLS natively),
// fall back to ffmpeg if unavailable.
function _captureFrame(name) {
  // go2rtc stream name from CAMERAS map (e.g. "camera_p1_closet")
  const streamName = CAMERAS[name];
  if (streamName) {
    try {
      const out = `/tmp/ld_vs_${name.replace(/[^a-z0-9]/gi, '_')}.jpg`;
      const result = _spawnSync('curl', [
        '-s', '--max-time', '8',
        '-o', out,
        `http://localhost:${_go2rtcPort}/api/frame.jpeg?src=${encodeURIComponent(streamName)}`
      ], { timeout: 10000 });
      if (result.status === 0 && fs.existsSync(out) && fs.statSync(out).size > 1000) {
        const b64 = fs.readFileSync(out).toString('base64');
        try { fs.unlinkSync(out); } catch (_) {}
        console.log(`[Vision] ${name}: frame via go2rtc (${streamName})`);
        return b64;
      }
      try { fs.unlinkSync(out); } catch (_) {}
      console.warn(`[Vision] go2rtc snapshot failed for ${name}, trying ffmpeg...`);
    } catch (e) {
      console.warn(`[Vision] go2rtc error for ${name}: ${e.message}, trying ffmpeg...`);
    }
  }

  // Fallback: direct ffmpeg using env var RTSP URL (Tapo cameras, not Bambu URLs)
  const envMap = {
    'A1':        process.env.CAMERA_A1_RTSP,
    'P1 Room':   process.env.CAMERA_P1_ROOM_RTSP,
    'P1 Closet': process.env.CAMERA_P1_CLOSET_RTSP
  };
  const url = envMap[name];
  if (!url) {
    console.warn(`[Vision] No RTSP URL for ${name} — set CAMERA_*_RTSP env var or ensure go2rtc is running`);
    return null;
  }
  const out = `/tmp/ld_vs_${name.replace(/[^a-z0-9]/gi, '_')}_ff.jpg`;
  try {
    _spawnSync('ffmpeg', [
      '-rtsp_transport', 'tcp',
      '-allowed_media_types', 'video',
      '-stimeout', '8000000',
      '-i', url,
      '-frames:v', '1', '-q:v', '4', '-vf', 'scale=640:-1',
      '-y', out
    ], { timeout: 15000 });
    if (!fs.existsSync(out)) return null;
    const b64 = fs.readFileSync(out).toString('base64');
    try { fs.unlinkSync(out); } catch (_) {}
    console.log(`[Vision] ${name}: frame via ffmpeg fallback`);
    return b64;
  } catch (e) {
    console.warn(`[Vision] ffmpeg capture failed for ${name}: ${e.message}`);
    return null;
  }
}

function _askOllama(b64, name) {
  return new Promise(resolve => {
    if (!_anthropicKey) {
      console.warn('[Vision] No ANTHROPIC_API_KEY set — set it in config.json as anthropicApiKey or as an env var');
      return resolve({ status: 'error', confidence: 0, issues: [], description: 'No Anthropic API key configured' });
    }
    const body = JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } },
          { type: 'text', text:
            `You are monitoring a Bambu Lab FDM 3D printer named "${name}" via camera during an active print.\n\n` +
            `REAL FAILURE (status:"failure", confidence 0.9+):\n` +
            `- Filament actively tangling AROUND the toolhead/nozzle in a chaotic mass NOT attached to the print\n` +
            `- Print completely detached from the bed and being dragged around by the moving toolhead\n` +
            `- Large molten blob accumulated on the nozzle itself\n\n` +
            `WARNING (status:"warning"):\n` +
            `- Print visibly lifting or curling at edges (warping)\n` +
            `- Clear layer shift — print looks stepped/misaligned\n` +
            `- Partial detachment at one corner while rest is still printing\n\n` +
            `NORMAL — always status:"ok":\n` +
            `- Completed or in-progress parts sitting FLAT on the build plate (very common, not a failure)\n` +
            `- Multiple finished-looking parts on the bed (batch printing is normal)\n` +
            `- Camera showing bed from above with parts that look done or nearly done\n` +
            `- Empty or dark bed (printer idle or between jobs)\n` +
            `- Filament strands that are clearly PART OF the print structure\n\n` +
            `KEY RULE: If you cannot clearly see filament tangled around the toolhead or a print being dragged, use status:"ok". Prefer ok over failure when uncertain.\n\n` +
            `Reply ONLY with valid JSON, no markdown:\n` +
            `{"status":"ok","confidence":0.85,"issues":[],"description":"one sentence describing what you see"}\n` +
            `status: ok|warning|failure   confidence: 0.0–1.0`
          }
        ]
      }]
    });
    try {
      const req = https.request({
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          'x-api-key': _anthropicKey,
          'anthropic-version': '2023-06-01'
        }
      }, res => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => {
          try {
            const outer = JSON.parse(d);
            if (outer.error) {
              console.error('[Vision] Anthropic error:', outer.error.message);
              return resolve({ status: 'error', confidence: 0, issues: [], description: `Anthropic: ${outer.error.message}` });
            }
            const raw = (outer.content?.[0]?.text || '').replace(/```json|```/g, '').trim();
            const start = raw.indexOf('{'), end = raw.lastIndexOf('}');
            if (start === -1 || end === -1) return resolve({ status: 'ok', confidence: 0, issues: [], description: 'AI response parse error' });
            resolve(JSON.parse(raw.slice(start, end + 1)));
          } catch (e) {
            console.error('[Vision] Parse error:', e.message);
            resolve({ status: 'ok', confidence: 0, issues: [], description: 'AI response parse error' });
          }
        });
      });
      req.setTimeout(60000, () => { req.destroy(); resolve(null); });
      req.on('error', e => { console.error('[Vision] HTTPS error:', e.message); resolve(null); });
      req.write(body); req.end();
    } catch (e) { resolve(null); }
  });
}

async function _visionScan(name, manual = false) {
  if (_vScanning.has(name)) return;
  _vScanning.add(name);
  try {
    const st = printerStates[name];

    // Auto-scan guards (manual scans always proceed)
    if (!manual) {
      if (!_vEnabled) return;
      if (_vPerPrint[name]?.enabled === false) return;
      if (!['RUNNING','PAUSE','PAUSED'].includes(st?.gcode_state || '')) return;
      // Skip if AI previously confirmed no active print — wait for MQTT to confirm RUNNING
      if (_vVisuallyOffline.has(name)) {
        console.log(`[Vision] Skipping ${name} — visually confirmed no active print`);
        return;
      }
    }

    console.log(`[Vision] Scanning ${name}${manual ? ' (manual)' : ''}...`);

    const b64 = _captureFrame(name);
    if (!b64) {
      const entry = { status:'error', confidence:0, issues:[],
        description:'No frame captured — check RTSP URL or camera connection', timestamp: Date.now() };
      _vResults[name] = entry;
      _vLog.unshift({ printerName: name, ...entry });
      if (_vLog.length > 50) _vLog.length = 50;
      _saveVisionLog();
      return;
    }
    _vImages[name] = { base64: b64, timestamp: Date.now() };

    const r = await _askOllama(b64, name);
    if (!r) {
      const entry = { status:'error', confidence:0, issues:[],
        description:'Ollama not responding — is ollama running?', timestamp: Date.now() };
      _vResults[name] = entry;
      _vLog.unshift({ printerName: name, ...entry });
      if (_vLog.length > 50) _vLog.length = 50;
      _saveVisionLog();
      return;
    }

    const ts = Date.now();
    const st2 = printerStates[name];
    const jobName = (st2?.subtask_name || '').replace(/\.gcode\.3mf$/i,'').replace(/\.3mf$/i,'') || 'Unknown job';
    const pct = st2?.mc_percent || 0;

    // Detect if AI sees no active print (dark/empty camera view)
    if (_isVisuallyOff(r.description, r.issues)) {
      _vVisuallyOffline.add(name);
      console.log(`[Vision] ${name}: visually offline/empty — auto-scans paused until MQTT confirms RUNNING`);
    } else {
      _vVisuallyOffline.delete(name);
    }

    let autoPaused = false;
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
        console.log(`[Vision] Auto-paused ${name} — ${consecCount} consecutive failures`);
      }
      const issues = (r.issues || []).join('\n• ') || r.description || '';
      const alertText =
        `🚨 **AI Vision — FAILURE detected on ${name}**\n` +
        `📄 **Job:** ${jobName} · ${pct}% complete\n` +
        `📊 **Confidence:** ${Math.round((r.confidence || 0) * 100)}%\n` +
        `🔍 **Issues:**\n• ${issues}\n` +
        `📝 **Analysis:** ${r.description || ''}` +
        (autoPaused ? '\n⏸ **Print has been automatically paused.**' : '') +
        (consecCount === 1 ? '\n⚠️ *First detection — watching for confirmation before pausing.*' : '');
      if (img && img.base64) {
        sendDiscordWatchWithImage(alertText, img.base64);
      } else {
        sendDiscordWatch(alertText);
      }
      // Schedule a quick confirmation scan (90s) so we don't wait the full interval
      if (!manual) {
        console.log(`[Vision] Scheduling confirmation scan for ${name} in 90s`);
        setTimeout(() => _visionScan(name).catch(() => {}), 90 * 1000);
      }
    } else {
      // Reset consecutive failure counter on any non-failure result
      _vConsecFailures[name] = 0;
      if (r.status === 'warning' && (r.confidence || 0) >= _vThreshold) {
        const issues = (r.issues || []).join('\n• ') || r.description || '';
        const alertText =
          `⚠️ **AI Vision — WARNING on ${name}**\n` +
          `📄 **Job:** ${jobName} · ${pct}% complete\n` +
          `📊 **Confidence:** ${Math.round((r.confidence || 0) * 100)}%\n` +
          `🔍 **Issues:**\n• ${issues}\n` +
          `📝 **Analysis:** ${r.description || ''}`;
        if (img && img.base64) {
          sendDiscordWatchWithImage(alertText, img.base64);
        } else {
          sendDiscordWatch(alertText);
        }
        // Schedule a confirmation scan 2 minutes after a warning alert
        if (!manual) {
          console.log(`[Vision] Scheduling confirmation scan for ${name} in 2 min (warning)`);
          setTimeout(() => _visionScan(name).catch(() => {}), 2 * 60 * 1000);
        }
      }
    }

    _vResults[name] = { ...r, timestamp: ts, autoPaused };
    _vLog.unshift({ printerName: name, ...r, timestamp: ts, autoPaused });
    if (_vLog.length > 50) _vLog.length = 50;
    _saveVisionLog();

    console.log(`[Vision] ${name}: ${r.status} (${Math.round((r.confidence||0)*100)}%) — ${r.description}${autoPaused ? ' [AUTO-PAUSED]' : ''}`);
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
// Do an initial scan ~90s after startup (gives MQTT time to reconnect and
// populate printer states) so history is populated immediately after restart
// rather than waiting for the full interval to elapse.
setTimeout(() => {
  if (_vEnabled) {
    console.log('[Vision] Running initial startup scan');
    PRINTERS.forEach(p => _visionScan(p.name).catch(() => {}));
  }
}, 90 * 1000);

// ── Vision endpoints ──────────────────────────────────────────────────────────
app.get('/vision/status', (req, res) => res.json({
  enabled: _vEnabled, intervalMins: _vIntervalM,
  confidenceThreshold: _vThreshold, model: _vModel,
  perPrinter: _vPerPrint, results: _vResults, log: _vLog.slice(0, 20),
  visuallyOffline: [..._vVisuallyOffline]
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
  res.json({ ffmpeg: ff, model: _vModel, anthropicKeySet: !!_anthropicKey });
});

app.post('/vision/config', (req, res) => {
  const { enabled, intervalMins, confidenceThreshold, perPrinter } = req.body;
  if (enabled             !== undefined) _vEnabled   = !!enabled;
  if (intervalMins        !== undefined) _vIntervalM = parseFloat(intervalMins) || 5;
  if (confidenceThreshold !== undefined) _vThreshold = parseFloat(confidenceThreshold) || 0.55;
  if (perPrinter          !== undefined) _vPerPrint  = perPrinter;
  _saveVisionCfg();
  _scheduleVision();
  res.json({ ok: true });
});

app.listen(PI_PORT, () => console.log(`🚀 LayerDeck Hub on port ${PI_PORT}`));
