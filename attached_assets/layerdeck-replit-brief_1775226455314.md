# LayerDeck — Replit Implementation Brief

> This document is the complete implementation guide for Replit. All credentials are filled in. All Phase 0 and Phase 1 setup is complete. Build everything in order.

---

# PHASE 2 — REPLIT INTEGRATION BRIEF

> **Read the entire document before writing any code. All credentials are filled in. Build everything in Phase 2 in order.**

> **App Branding — apply throughout the entire app:**
> - App name: **LayerDeck**
> - Tagline beneath the name: **powered by HypedAnubis3D** — smaller, lighter weight font, subtle — not equal prominence to LayerDeck
> - Logo: Thiago will provide the new LayerDeck logo file — use it in the nav header and as the app icon (favicon + PWA icon)
> - Color scheme: existing black and gold aesthetic — do not change
> - Rename every user-facing "LayerStack" reference to "LayerDeck" — nav, page titles, tab titles, browser tab title, toast messages, error messages, Settings page, email subjects, Discord messages, any visible text

> **Supabase Storage public URL format** — confirmed, use this everywhere a Storage URL is constructed:
> ```
> https://rwbnivevzdazkfuxteng.supabase.co/storage/v1/object/public/layerstack-media/{path}
> ```
> Example: path `failures/failure_A1_2026-04-01_14-32.jpg` → full URL is `https://rwbnivevzdazkfuxteng.supabase.co/storage/v1/object/public/layerstack-media/failures/failure_A1_2026-04-01_14-32.jpg`
> Applies to: failure photos, AI detection images, catalog photos, 3MF thumbnails — anything in the `layerstack-media` bucket.

> Replit already knows the LayerDeck codebase. This document covers a large set of additions across the entire app — not just the Bambu printer integration. Read every section before writing any code so you understand how everything connects. Below is a full summary of what needs to be built.

---

## 🔑 All Credentials — Add These to Replit Secrets

Add every value below as a Replit Secret (Tools → Secrets) before writing any code. All Pi scripts read from environment variables — these same values are already in the Pi's `.bashrc`.

```
# Supabase
SUPABASE_URL          = https://rwbnivevzdazkfuxteng.supabase.co
SUPABASE_ANON_KEY     = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3Ym5pdmV2emRhemtmdXh0ZW5nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNzczMDksImV4cCI6MjA4OTg1MzMwOX0.QeSm1wYUfbfUIzMh2pcReGdJ8mPqetuaC2kuGfdm2sU

# Shopify
SHOPIFY_SHOP          = hypedanubis3d-2.myshopify.com
LAYERDECK_API         = https://layerdeck.replit.app

# Meta / Instagram
META_APP_ID           = 4317363561863449
META_APP_SECRET       = 33005bdb7e4e4df3e6954c7d7793a41d
META_ACCESS_TOKEN     = EAA9Wnol4mRkBRHmK6CMZAgtIPJDiUJWyHZC3ipgvCgn4omhMtjyH0slM3w5ndmIZBle1rprbqW7rskhNHGWNaOC2vGBh7soEwOAze2l56ZAusuQfsEwXtU4jgVYRQwtZBimfNvmJrvTlhQ7l6BqJuGZAwOxzebpmNdBbkopKjsevACn0W73hkCLabHlUuZC0CdM4Wo7XBL4sG7QnAZDZD
INSTAGRAM_ACCOUNT_ID  = 17841468821012873

# Gmail
GMAIL_APP_PASSWORD    = urmc vafb bjwo smlr

# Square
SQUARE_ACCESS_TOKEN   = EAAAlyBis2x6kRlmCpQbw9ZlRrd-fr7nP2Y5jbPrOOHHnKGDeP3vWCDIN66szz-4
SQUARE_APP_ID         = sq0idp-snoi-XftnTFSnqQQUsrOKQ
SQUARE_LOCATION_ID    = LBC978ZGBGS2M
SQUARE_WEBHOOK_SIG_KEY= vInOMAJDvy5LHHy0U-BWuw

# Discord Webhooks
DISCORD_WEBHOOK_PRINT_ALERTS      = https://discord.com/api/webhooks/1488581068264181760/KbbRIR0KIOefboWbLcnXys7khB_j0ALLahEU83c-8JvRPmBDXdnpuKlkCeRbTXvEGqSU
DISCORD_WEBHOOK_ORDERS            = https://discord.com/api/webhooks/1488581270391750738/r5iM0UMUAMf9C5Tg8VMOCmZKgRYFyrgRowwfmpzMbJEdsoKapYB7ToYRFigLTHxTqxtc
DISCORD_WEBHOOK_STOCK_ALERTS      = https://discord.com/api/webhooks/1488581384456110140/Oqh5Z0aZDjRQmQ66_p36570rDyOZ1qJPlG69UGtZ6YWNjlYdORESJuwjppwAFipDdvdv
DISCORD_WEBHOOK_DAILY_REPORT      = https://discord.com/api/webhooks/1488581529893470278/_N45bn0nC1dZqypcGC_jAsZ9bZvRGhVabVz-5LdRhBkV3VudgCbAiQ9rWO4CjaWS-DzR
DISCORD_WEBHOOK_CONVENTION_SALES  = https://discord.com/api/webhooks/1489272253991485575/kehmtbgkw862oON6mEi37H7KYXTFvsNR-vmldpRT4Va3n_HbsV0TPeh1t9clhF-g4avd
DISCORD_WEBHOOK_PI_HEALTH         = https://discord.com/api/webhooks/1489272416671895577/U1kifEHt_r3irSEhYimd-vnvINhicZhPSChmXV8Knt9WTwWFHpBmuWWDJTNYRKsVevfN
DISCORD_WEBHOOK_BAMBU_RESTOCK     = https://discord.com/api/webhooks/1489273174251274243/_oagCid4ijnX-zXrALi7nwH6doXnPl7wCr5j5t-2q0RSPgpUouvORjWartYVS0kBcQfZ
DISCORD_WEBHOOK_CONVENTION_PREP   = https://discord.com/api/webhooks/1489273539839266946/TaQG7QBwhKygpXK0Lv1eZELChFgYZ-Jhr2sOtHUoF4GyQJ46HRbQOj4LSglUJy-rTliX
DISCORD_WEBHOOK_PRINT_WATCH       = https://discord.com/api/webhooks/1489273660882682067/U0pFliV3fMBJZx6dZ99XEsF2AWd06bKrETGopoGGFEvHGmeuDQDgxmUSNn9DB9bZfWbm

# Pi Hub (via Tailscale)
PI_URL                = http://100.88.246.109:3000

# Camera RTSP URLs
CAMERA_A1_RTSP        = rtsp://HypedAnubis3D:Tigzaiala1@192.168.1.180:554/stream1
CAMERA_P1_ROOM_RTSP   = rtsp://HypedAnubis3D:Tigzaiala1@192.168.1.182:554/stream1
CAMERA_P1_CLOSET_RTSP = rtsp://HypedAnubis3D:Tigzaiala1@192.168.1.177:554/stream1

# Smart Plugs
PLUG_A1_IP            = 192.168.1.165
PLUG_P1_ROOM_IP       = 192.168.1.162
PLUG_P1_CLOSET_IP     = 192.168.1.172

# Electricity rate ($/kWh — update to your actual rate)
ELECTRICITY_RATE      = 0.13

# N3D / CPL3D APIs (server-side only — never expose in frontend)
N3D_API_KEY           = n3d_sk_6sL6Rb9BdKnzmN7LdotdD3sydeOz3gmn
CPL3D_API_KEY         = pk_d09c56dab52874fb8f0095d9d048916f
```

---

## What This Document Covers

**Printer Integration (Sections 5–12)**
Live Bambu printer monitoring via Raspberry Pi hub — real-time status, progress, temps, AMS filament levels, camera feeds, and pause/resume/stop controls. Integrated into the existing Printers tab (no new tab). Printer cards have two layers: static fields you edit, and live MQTT fields the Pi pushes. Prints screen gets a printer selector for A1, P1 Room, and P1 Closet. Full SaaS-ready setup flow included.

**Pi-Powered Features (Section 13)**
Automated print cost logging on finish, print failure push notifications, auto thumbnail extraction from 3MF files into the 3MF Library tab, and a nightly email summary.

**Complete Filament Database (Section 14)**
Full Bambu Lab and ELEGOO filament catalog with all colors, temps, and prices. Brand filter dropdown, material type filter, and search bar. Two-path spool add flow — from database card or from Spools tab with pre-fill.

**Additional Pi Features (Section 15)**
Desktop Companion always-on host (Pi serves the Desktop Companion 24/7 via Tailscale — accessible from your phone even when your PC is off), nightly Supabase backup with 30-day rotation, Pi as central 3MF file library with upload/download endpoints.

**Colour View + Print Queue Optimizer (Section 15, Feature 9)**
New Colour View tab under Prints — groups queued jobs by filament color per printer, shows AMS slot grid from live MQTT, highlights what's already loaded vs what needs swapping. "Optimize Print Order" button calls the Pi and returns a suggested job sequence minimizing filament swaps across all 3 printers based on their AMS capacity.

**Business & Shopify Automation (Section 16)**
Shopify order sync daemon (Pi polls via LayerDeck proxy every 5 minutes), low stock filament alerts, best seller tracker (daily, 90-day history, shown as new sub-tab in Revenue), competitor price monitor (every 6 hours, shown in Business tab under Price AI), automated social post scheduler (Instagram + TikTok via official APIs, new Social tab with Composer / Queue / Analytics sections).

**Queue, Card & Reporting Enhancements (Section 17)**
Estimated completion time ("Done by 4:30 PM") on printer and queue cards. Auto-promotion of queue cards from In Progress → Done when MQTT reports FINISH. Drag-to-reorder for queued jobs. Printer badge (color-coded: A1=blue, P1 Room=green, P1 Closet=orange) on every queue card. Print failure photo capture (ffmpeg grabs frame, uploads to Supabase Storage, shown on failed job cards). Full nightly HTML email report to hypedanubis3d@gmail.com at 6AM.

**Product Card Margin % (Section 18b)**
Calculated margin percentage shown on every product card — green (≥50%), yellow (25–49%), red (<25%). Derived from existing sale price and cost fields, no new data stored. Updates live as prices are edited.

**Square In-Person Sales Integration (Section 18)**
Square webhook integration for convention and market sales. Transactions sync to the Orders tab instantly with a [SQ] badge. Stock deducts from the active convention's packing list (auto-detected by date, manually overridable). Per-line-item "Ship Later" toggle for out-of-stock items — flagged items auto-add to the print queue with customer and shipping info, and the order updates to "Ready to Ship" when the queue job completes. Square sales included in nightly email report. Credentials route through the LayerDeck server — no Shopify-style OAuth needed.

**Discord Private Operational Alerts (Sections 21 + 21b)**
Six channels total — #print-alerts, #orders, #stock-alerts, #daily-report (Section 21) plus #convention-sales (real-time sales feed during active events with pack list remaining and day total) and #pi-health (5-minute service monitoring with auto-restart attempt before alerting, daily 7AM health check, recovery confirmations). (Section 21b)

**Discord Private Operational Alerts (Section 21)**
Private Discord server with 4 dedicated channels — `#print-alerts`, `#orders`, `#stock-alerts`, `#daily-report`. No bot, no OAuth — pure webhook POSTs. Pi sends print finish/failure alerts (with failure photo attached inline), spool low alerts, and the daily report. LayerDeck server sends new order alerts for both Shopify and Square. Shared helper function used throughout. All webhook URLs stored as Pi environment variables.

**Convention / Event Module Enhancements (Section 20)**
Four improvements to the existing Events section. Checklist tab overhauled — flat 17-item list replaced with 5 grouped sections (Setup, Products, Sales, Marketing, Admin) with per-group progress counters, collapsible groups, and a Custom group for additions. Print time accuracy tracker — Pi silently logs estimated vs actual duration per print, LayerDeck surfaces a rolling +/- % on each printer card with per-material breakdown (3+ prints minimum). Event product search — Product dropdown replaced with a searchable input that filters the current event's pack list in real time and auto-fills sale price on selection. Day Sales unified feed — Square webhook sales and manual entries merged into one chronological feed with consistent Guest fallback, payment method badges, and optional Name/Email fields on manual entries.

**Convention Catalog Tab — Designer Lookbook + Export/Import (Sections 25 + 25b)**
Customer-facing digital lookbook inside each Convention/Event. Grid of design cards from two sources: N3D Melbourne (reuses existing API integration — full customer actions: Order Now, Wishlist, QR) and CPL3D (API, live — same pattern as N3D), Others (manually maintained in new `designCatalog` Supabase collection). Configurable designer sources from Settings — filter bar auto-updates. Per-card: thumbnail, name, price (or "Price TBD"), source badge, in-stock indicator, Order Now / Wishlist / QR buttons. Order Now creates a Convention Order in the Orders tab and decrements pack list. Wishlist is session-based with optional email to customer. QR opens full-screen Shopify product link. N3D API key: n3d_sk_6sL6Rb9BdKnzmN7LdotdD3sydeOz3gmn — stored server-side only, never in frontend. Section 25b adds CSV export (all entries including API as read-only reference rows) and import (preview before commit, match by Name+Source, update not duplicate, unmapped source resolution flow, badge and filter bar auto-update on import).

**AMS Slot Filament Mapping (Section 31)**
Set filament profile per AMS slot from LayerDeck — Pi writes it back to the printer via MQTT so Bambu Studio and Handy read the correct mapping when opened. No manual entry in the slicer needed. Set Filament button on each AMS slot card opens the filament database picker (brand, material, color), sends `ams_filament_setting` MQTT command via Pi. Optional spool linking — deducts from matched spool weight automatically. Mappings saved to Supabase `amsSlotMappings` collection with ✅ badge on slots set via LayerDeck. Mismatch warning if MQTT reports different filament than last saved mapping.

**Skip Object Control + Filament Refund Automation (Section 30)**
Skip Object button on printer cards — visible only when print-by-object MQTT data is present, completely absent otherwise. Confirmation dialog before skip, then skip command sent via existing Pi /control endpoint (new `skip` command added). Filament refund dialog opens automatically post-skip, pre-filled with object completion % and estimated filament refund (exact if per-object data available, proportional fallback if not). Failed print dialog improved — pre-filled automatically from MQTT snapshot taken at failure time (% complete, elapsed time, fail reason). Falls back to manual entry if Pi offline. All object data and failure snapshots stored in printerStates on Pi.

**Tapo P115 Smart Plug Integration (Section 29)**
Remote power control per printer (power on/off buttons on printer cards and Desktop Companion). Auto power-off after FINISH — 2-minute delay then Discord alert with countdown, LayerDeck shows "Auto power-off in X:XX" banner with Keep On and Power Off Now buttons, countdown kept server-side so page refresh doesn't lose it. Never triggers on failures or AI detection — FINISH only. Real wattage polling every 60 seconds during active prints replaces estimated electricity cost. Live wattage shown on printer cards. Nightly report electricity section updated with real P115 kWh data. Scheduled power-on per printer via cron. Plug IPs stored in printers.json alongside existing printer credentials.

**AI Print Failure Detection (Section 28)**
Local vision model running on Pi 5 using Obico's open source ML model (free, no API cost, offline capable). Swappable provider architecture — switch to Claude Vision from Settings at any time without code changes. Monitors MQTT state per printer, captures frames every 10 minutes (configurable) during active prints only. High confidence → auto-pause + Discord #print-watch alert with photo + "Paused by AI" banner in LayerDeck. Medium confidence → alert only + recheck in 3 minutes. Low → silent log. Per-printer enable/disable, configurable thresholds and interval, auto-pause toggle. Camera mount STLs to print before hardware arrives (PETG, MakerWorld).

**UX Improvements (Section 27)**
Three UX fixes: Orders/Quick Add defaults to catalog search (N3D + CPL3D + manual) with manual entry as fallback toggle. Spool scan detects duplicates and prompts "Add to existing" vs "Add as new" before creating. Push Notifications settings replaced with detailed per-type checkboxes across 6 groups (Print, Orders, Stock, Convention, Daily Summary, Pi) — each individually toggleable, saved to Supabase, checked before firing any notification.

**Filament Shop, Convention Velocity, Convention Prep & Spool Filters (Section 26)**
"Restock & Shop List" renamed to "Filament Shop" — velocity section removed from here and moved to Convention Overview tab. Filament Shop gets new Bambu Restock Tracker section — Pi polls Bambu product pages every 15 minutes, alerts on restock via Discord (#bambu-restock) and/or email, once per restock event. Convention Overview gets sales velocity pack suggestions with "Print X more" queue action and manual override. Convention Prep reminders fire via Discord (#convention-prep) at 7, 3, and 1 day before each event — lists only low-stock items, skips if all-set. Spools tab gets remaining filament filter (Critical/Low/OK/Full) with configurable thresholds, stacks with existing filters.

**Navigation Updates (Sections 23 + 24)**
Section 23 — three nav changes: Integrations expanded to Shopify, Square, Discord, and Pi Hub. "Fil. Purchases" → "Filament Purchases". "Revenue, Tax & Power" → "Revenue". Section 24 — Social added to Business nav (wired to existing Social tab from Section 16).

**Convention POS — Square Terminal Integration (Section 22)**
LayerDeck acts as the full POS at conventions. Uses Square Point of Sale API (deep link) with Bluetooth Reader paired to phone — no standalone terminal needed. Day Sales tab gets a current sale builder (searchable pack list, qty adjustable, running total). "Charge via Square" opens Square POS app with amount pre-filled, customer taps/swipes, Square redirects back to LayerDeck with confirmation. Sale recorded and pack list decremented automatically. Cash/Venmo/Other recorded manually. Full fallback if Square app unavailable — a sale is never blocked.

**Desktop Companion Printer Monitoring (Section 19)**
Adds a live printer monitoring section to the existing Desktop Companion below the inventory content. All 3 printers displayed side by side simultaneously — no tapping between them. Each card shows status badge, job name, progress, estimated completion time, nozzle/bed temps, live camera feed, and Pause/Resume/Stop controls. Reuses the exact same Pi endpoints and polling logic built for the main app — small lift for Replit since the data layer is shared. Camera feeds lazy-load when companion opens and stop when closed. Graceful offline state when Pi is unreachable.

---

---

## 🔵 CONTEXT — Section 5: What the Pi Hub Does

A Raspberry Pi 5 runs 24/7 on the local home network. It connects to all 3 Bambu printers via MQTT and exposes a REST API on port 3000. Three Tapo C110 WiFi cameras (one per printer, in different rooms) are served via go2rtc on port 1984. Tailscale provides remote access from anywhere.

**Pi API endpoints:**
```
GET  /status           → live state of all 3 printers (JSON)
GET  /status/:name     → single printer state
GET  /cameras          → go2rtc stream names per printer
POST /control          → { printer: "A1", command: "pause|resume|stop" }
```

**Camera stream URL pattern:**
```
http://100.88.246.109:1984/api/stream.mp4?src=camera_a1
http://100.88.246.109:1984/api/stream.mp4?src=camera_p1_room
http://100.88.246.109:1984/api/stream.mp4?src=camera_p1_closet
```

---

## 🔵 CONTEXT — Section 5b: Where This Lives in the UI

**Do NOT create a new tab or section.**

**Printers tab (existing):**
The 3 Bambu printers (A1, P1 Room, P1 Closet) should appear as printer cards within the existing Printers tab. Each card has two layers — static fields the user edits, and live fields the Pi pushes. These must remain fully independent:

```
Printer Card (e.g. A1)
├── STATIC — stored in printerRecords, user edits these normally
│     ├── Name, Model
│     ├── AMS Units (user-set — drives Colour View slot capacity)
│     ├── Wattage, Electricity rate
│     ├── Nozzle size, Bed size, Max speed
│     └── Notes, Maintenance history, Print count
└── LIVE — pushed by Pi hub via MQTT, display only
      ├── Print state (IDLE / RUNNING / PAUSE / FAILED / FINISH)
      ├── Progress %, Layer count, Time remaining
      ├── Nozzle temp, Bed temp
      ├── Current file name
      ├── AMS colors currently loaded (visual swatches)
      └── Camera feed
```

The user can tap into any printer card and edit all static fields exactly as they do today — the Pi live data layer does not interfere with editing. Tapping "Edit" on a card opens the same Add/Edit Printer form with all existing fields including the AMS Units selector. Saving updates `printerRecords` in Supabase as normal. The live data resumes displaying immediately after save.

**Prints screen (existing):**
When logging a print (manually or auto-logged on FINISH), the printer selector should include the 3 Bambu printers by name (A1, P1 Room, P1 Closet) so the user can select which printer was used. These pull from the existing `printerRecords` collection — the Pi integration should ensure A1, P1 Room, and P1 Closet exist as records there. If they don't exist yet, create them on first connection.

---

## 🔵 CONTEXT — Section 6: Printer Credentials

| Printer | IP | Serial | Access Code |
|---------|----|--------|-------------|
| A1 | `192.168.1.171` | `03919C452404673` | `ed7fd800` |
| P1 Room | `192.168.1.166` | `01P09C4C0402468` | `85467582` |
| P1 Closet | `192.168.1.155` | `01P09C471500288` | `33503749` |

---

## 🔵 CONTEXT — Section 7: MQTT Payload

Key fields from `device/<serial>/report`:
```json
{
  "print": {
    "gcode_state": "IDLE | RUNNING | PAUSE | FAILED | FINISH",
    "mc_percent": 45,
    "mc_remaining_time": 3600,
    "layer_num": 125,
    "total_layer_num": 250,
    "subtask_name": "ShinyBall_Red.3mf",
    "nozzle_temper": 220.5,
    "bed_temper": 60.0,
    "chamber_temper": 35,
    "print_error": 0,
    "nozzle_diameter": "0.4",
    "ams": {
      "ams": [{
        "id": "0",
        "tray": [{
          "id": "0",
          "tray_type": "PLA",
          "tray_color": "FF0000FF",
          "tray_weight": "1000",
          "remain": 72
        }]
      }]
    }
  }
}
```

---

## 🔵 CONTEXT — Section 8: Supabase Integration Points

The Printer Monitor hooks into these existing LayerDeck collections:

| Collection | Action on event |
|------------|----------------|
| `spools` | Deduct estimated grams when print finishes |
| `prints` | Auto-create log entry when print finishes or fails |
| `printQueue` | Move card to In Progress on start, Done on finish |
| `printerRecords` | Increment print count on finish, fail count on fail |
| `wasteLog` | Create entry on print fail (material wasted + reason) |
| `orders` | Prompt user to link a completed print to an order |

**Print log entry schema** (matching existing `prints` collection):
```javascript
{
  id: uuid(),
  date: "2026-03-26",
  productName: p.subtask_name || "",
  filamentUsed: estimatedGrams,
  filamentType: amsData?.tray_type || "PLA",
  printTime: formatDuration(durationMinutes),
  success: true,                          // false if FAILED
  notes: "",
  linkedOrderId: null,                    // set after user prompt
  printerName: "A1 | P1 Room | P1 Closet",
  costBreakdown: {
    filamentCost: 0,
    electricityCost: 0,
    totalCost: 0
  }
}
```

---

## 🔵 CONTEXT — Section 9: State Transition Logic

```
gcode_state → "RUNNING"
  → Snapshot AMS tray states
  → Move matching printQueue card: Queued → In Progress
  → Record print start time

gcode_state → "FINISH"
  → Estimate filament used (Section 11)
  → Deduct grams from matched spool in spools collection
  → Write new entry to prints collection
  → Move queue card → Done
  → Increment printerRecords print count
  → Prompt: "Link this print to an order?"
  → Calculate cost: (gramsUsed × spoolPrice/spoolTotalGrams) + (printHours × 0.12watts × 0.13)

gcode_state → "FAILED"
  → Write to wasteLog (material wasted, printer name, timestamp)
  → Show alert on that printer's card
  → Increment printerRecords fail count
  → Prompt: reprint or cancel?
```

---

## 🟢 CODE — Section 10: Pi Hub server.js

> Already deployed on the Pi. Use as reference for the API Studio Manager calls. All credentials filled in.

```javascript
const mqtt    = require('mqtt');
const express = require('express');
const cors    = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PRINTERS = [
  { name: 'A1',        ip: '192.168.1.171', serial: '03919C452404673', accessCode: 'ed7fd800' },
  { name: 'P1 Room',   ip: '192.168.1.166', serial: '01P09C4C0402468', accessCode: '85467582' },
  { name: 'P1 Closet', ip: '192.168.1.155', serial: '01P09C471500288', accessCode: '33503749' }
];

const CAMERAS = {
  'A1':        'camera_a1',
  'P1 Room':   'camera_p1_room',
  'P1 Closet': 'camera_p1_closet'
};

const PI_PORT = 3000;
const printerStates  = {};
const printerClients = {};

PRINTERS.forEach(printer => {
  printerStates[printer.name] = { online: false };
  const client = mqtt.connect(`mqtts://${printer.ip}:8883`, {
    username: 'bblp',
    password: printer.accessCode,
    rejectUnauthorized: false
  });
  const REPORT_TOPIC  = `device/${printer.serial}/report`;
  const REQUEST_TOPIC = `device/${printer.serial}/request`;
  printerClients[printer.name] = { client, REQUEST_TOPIC };

  client.on('connect', () => {
    printerStates[printer.name].online = true;
    client.subscribe(REPORT_TOPIC);
    client.publish(REQUEST_TOPIC, JSON.stringify({
      pushing: { sequence_id: '0', command: 'pushall' }
    }));
  });
  client.on('message', (topic, message) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.print) {
        printerStates[printer.name] = {
          ...printerStates[printer.name], ...data.print,
          online: true, lastUpdated: Date.now()
        };
      }
    } catch (e) {}
  });
  client.on('error', () => { printerStates[printer.name].online = false; });
});

app.get('/status', (req, res) => res.json(printerStates));
app.get('/status/:name', (req, res) => {
  const state = printerStates[req.params.name];
  if (!state) return res.status(404).json({ error: 'Not found' });
  res.json(state);
});
app.get('/cameras', (req, res) => res.json(CAMERAS));
app.post('/control', (req, res) => {
  const { printer, command } = req.body;
  if (!['pause','resume','stop'].includes(command))
    return res.status(400).json({ error: 'Invalid command' });
  const p = printerClients[printer];
  if (!p) return res.status(404).json({ error: 'Printer not found' });
  p.client.publish(p.REQUEST_TOPIC, JSON.stringify({ print: { sequence_id: '0', command } }));
  res.json({ sent: command, printer });
});

app.listen(PI_PORT, () => console.log(`🚀 LayerDeck Hub on port ${PI_PORT}`));
```

---

## 🟢 CODE — Section 11: Studio Manager Frontend

> Add to Studio Manager as the Printer Monitor section. Wire state transitions to existing Supabase write functions per Section 9.

```javascript
// ── Config ───────────────────────────────────────────
const PI_URL        = 'http://100.88.246.109:3000';
const GO2RTC_URL    = 'http://100.88.246.109:1984';
const PRINTER_NAMES = ['A1', 'P1 Room', 'P1 Closet'];
const CAMERA_STREAMS = {
  'A1':        `${GO2RTC_URL}/api/stream.mp4?src=camera_a1`,
  'P1 Room':   `${GO2RTC_URL}/api/stream.mp4?src=camera_p1_room`,
  'P1 Closet': `${GO2RTC_URL}/api/stream.mp4?src=camera_p1_closet`
};
// ─────────────────────────────────────────────────────

const previousStates = {};

// UI placement: inside the EXISTING Printers tab, enhancing each printer card
// Do NOT create a new tab or section
// Element ID pattern — appended to existing printer card elements:
//   A1        → a1-state, a1-progress, a1-layer, a1-remaining, a1-nozzle, a1-bed, a1-file, a1-camera
//   P1 Room   → p1-room-state, p1-room-progress, p1-room-camera, etc.
//   P1 Closet → p1-closet-state, p1-closet-camera, etc.
// On first connection: ensure A1, P1 Room, P1 Closet exist in printerRecords collection.
// If any are missing, create them with default values so they appear in the Prints screen printer selector.
async function fetchAllPrinterStatus() {
  try {
    const data = await fetch(`${PI_URL}/status`).then(r => r.json());

    PRINTER_NAMES.forEach(name => {
      const p    = data[name];
      if (!p) return;
      const prev = previousStates[name] || {};
      const id   = name.replace(/\s+/g, '-').toLowerCase();
      const el   = s => document.getElementById(`${id}-${s}`);

      if (el('state'))     el('state').textContent     = p.online ? (p.gcode_state || 'IDLE') : 'OFFLINE';
      if (el('progress'))  el('progress').textContent  = (p.mc_percent || 0) + '%';
      if (el('layer'))     el('layer').textContent     = `${p.layer_num || 0} / ${p.total_layer_num || 0}`;
      if (el('remaining')) el('remaining').textContent = Math.round((p.mc_remaining_time || 0) / 60) + ' min';
      if (el('nozzle'))    el('nozzle').textContent    = (p.nozzle_temper || 0) + '°C';
      if (el('bed'))       el('bed').textContent       = (p.bed_temper || 0) + '°C';
      if (el('file'))      el('file').textContent      = p.subtask_name || '—';
      const cam = el('camera');
      if (cam && !cam.src) cam.src = CAMERA_STREAMS[name];

      // State transition hooks
      if (p.gcode_state !== prev.gcode_state) {
        if (p.gcode_state === 'RUNNING')  onPrintStarted(name, p);
        if (p.gcode_state === 'FINISH')   onPrintFinished(name, p, prev);
        if (p.gcode_state === 'FAILED')   onPrintFailed(name, p);
      }

      previousStates[name] = { ...p };
    });
  } catch (e) {
    console.error('Pi unreachable — check Tailscale:', e);
  }
}

// Estimate grams used — call on FINISH
function estimateFilamentUsed(material, durationMinutes) {
  const rates = { PLA: 0.8, PETG: 0.85, ABS: 0.9, TPU: 0.6, ASA: 0.85 };
  return parseFloat(((rates[material] || 0.8) * durationMinutes).toFixed(1));
}

// Match AMS tray to existing spool — call on RUNNING
function mapAMSToSpools(amsData, spoolsDB) {
  if (!amsData?.ams) return [];
  return amsData.ams.flatMap(unit =>
    unit.tray.map(tray => ({
      amsId: unit.id, trayId: tray.id,
      material: tray.tray_type, color: tray.tray_color,
      remain: tray.remain,
      spool: spoolsDB.find(s =>
        s.material === tray.tray_type && s.colorHex === tray.tray_color.slice(0, 6)
      )
    }))
  );
}

function onPrintStarted(printerName, p) {
  // Snapshot AMS, move printQueue card to In Progress
}

function onPrintFinished(printerName, p, prev) {
  // Estimate filament, deduct spool, write to prints, move queue card to Done,
  // increment printerRecords, prompt order link
}

function onPrintFailed(printerName, p) {
  // Write to wasteLog, show alert, increment fail count
}

async function sendControl(printerName, command) {
  await fetch(`${PI_URL}/control`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ printer: printerName, command })
  });
}

fetchAllPrinterStatus();
setInterval(fetchAllPrinterStatus, 5000);
```

---

---

## 🟢 CODE — Section 12: Printer Setup Flow (SaaS-Ready)

> LayerDeck is being built for SaaS. The Bambu integration must not have any credentials hardcoded in the Studio Manager frontend. Instead, build a Printer Setup flow inside the existing Printers tab where each user enters their own Pi and printer details. These are saved to their Supabase account and used at runtime to connect to their hub.

---

### How it works for future customers

Each LayerDeck customer who wants printer integration will:
1. Buy a Raspberry Pi and set it up using the LayerDeck setup guide
2. Buy Tapo C110 cameras (one per printer) and set them up
3. Open the Printers tab in Studio Manager and enter their details
4. The app connects to their Pi hub and everything works — live status, camera feeds, print controls

No code changes needed per customer. The Pi hub server code is identical for everyone — only the credentials differ, and those live in the user's Supabase account.

---

### What to build

Add a **"Connect Pi Hub"** setup flow inside the existing Printers tab. This should feel native to the app — not a separate settings page, just a natural part of managing printers.

**The setup flow should collect:**

```javascript
// Stored in Supabase under the user's account
// Collection: printerHub (new collection, one record per user)
{
  tailscaleIP: "100.88.246.109",        // Pi's Tailscale IP — used as the base URL
  go2rtcPort: 1984,                  // default, allow override
  hubPort: 3000,                     // default, allow override
  printers: [
    {
      name: "A1",                    // user-defined name
      ip: "192.168.1.XXX",          // printer's local IP
      serial: "XXXXXXXXXXXXX",       // from printer screen
      accessCode: "XXXXXXXX",        // from printer screen (LAN Mode)
      cameraStream: "camera_a1"      // go2rtc stream name, user-defined
    }
    // up to N printers — not limited to 3
  ]
}
```

**UI flow inside the Printers tab:**

1. If no hub is configured → show a **"Connect your Pi Hub"** card with a Setup button
2. Setup wizard collects: Tailscale IP, then walks through adding printers one by one (name, IP, serial, access code, camera stream name)
3. On save → write to `printerHub` collection in Supabase
4. App immediately attempts connection to the hub and shows live status
5. If already configured → show the live printer cards as normal, with an Edit button to update credentials

**Runtime behavior:**

```javascript
// On app load, read hub config from Supabase
// Build all URLs dynamically from stored credentials — nothing hardcoded

async function loadHubConfig() {
  const config = await getFromSupabase('printerHub');
  if (!config) return; // no hub set up yet — show setup prompt

  const PI_URL     = `http://${config.tailscaleIP}:${config.hubPort}`;
  const GO2RTC_URL = `http://${config.tailscaleIP}:${config.go2rtcPort}`;

  // Build camera stream map from user's printer list
  const CAMERA_STREAMS = {};
  config.printers.forEach(p => {
    CAMERA_STREAMS[p.name] = `${GO2RTC_URL}/api/stream.mp4?src=${p.cameraStream}`;
  });

  // Start polling with user's config
  startPrinterMonitor(PI_URL, GO2RTC_URL, config.printers, CAMERA_STREAMS);
}
```

**The Pi hub server.js also needs to be user-configurable.** Since each customer runs their own Pi, they need to be able to update the server.js with their own printer credentials without editing code. Two options — implement whichever fits the codebase better:

Option A — The hub reads from a local config file that the user edits (simple, no app changes needed on Pi side):
```javascript
// server.js reads from a local printers.json instead of hardcoded array
const PRINTERS = JSON.parse(fs.readFileSync('./printers.json'));
```

Option B — The Studio Manager pushes the printer config to the Pi hub via an API call when the user saves their setup. The hub stores it locally and uses it. More seamless UX but requires an additional endpoint on the Pi.

> Recommendation: start with Option A for simplicity. The setup guide tells users to edit printers.json on their Pi, which is a single JSON file — much friendlier than editing server.js code directly.

---

### Updated Pi hub server.js (config-file driven)

> Replace the hardcoded PRINTERS array in Section 10's server.js with this version. Users edit printers.json on their Pi instead of touching server.js code.

```javascript
const mqtt    = require('mqtt');
const express = require('express');
const cors    = require('cors');
const fs      = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// ── Load printer config from file — users edit this, not server.js ──
let PRINTERS = [];
let CAMERAS  = {};

try {
  const config = JSON.parse(fs.readFileSync('./printers.json', 'utf8'));
  PRINTERS = config.printers || [];
  CAMERAS  = config.cameras  || {};
  console.log(`📋 Loaded ${PRINTERS.length} printer(s) from printers.json`);
} catch (e) {
  console.error('❌ Could not read printers.json — make sure it exists in ~/bambu-hub/');
  process.exit(1);
}
// ─────────────────────────────────────────────────────────────────────

const PI_PORT = 3000;
const printerStates  = {};
const printerClients = {};

PRINTERS.forEach(printer => {
  printerStates[printer.name] = { online: false };
  const client = mqtt.connect(`mqtts://${printer.ip}:8883`, {
    username: 'bblp',
    password: printer.accessCode,
    rejectUnauthorized: false
  });
  const REPORT_TOPIC  = `device/${printer.serial}/report`;
  const REQUEST_TOPIC = `device/${printer.serial}/request`;
  printerClients[printer.name] = { client, REQUEST_TOPIC };

  client.on('connect', () => {
    console.log(`✅ Connected to ${printer.name}`);
    printerStates[printer.name].online = true;
    client.subscribe(REPORT_TOPIC);
    client.publish(REQUEST_TOPIC, JSON.stringify({
      pushing: { sequence_id: '0', command: 'pushall' }
    }));
  });
  client.on('message', (topic, message) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.print) {
        printerStates[printer.name] = {
          ...printerStates[printer.name], ...data.print,
          online: true, lastUpdated: Date.now()
        };
      }
    } catch (e) {}
  });
  client.on('error', () => { printerStates[printer.name].online = false; });
});

app.get('/status', (req, res) => res.json(printerStates));
app.get('/status/:name', (req, res) => {
  const state = printerStates[req.params.name];
  if (!state) return res.status(404).json({ error: 'Not found' });
  res.json(state);
});
app.get('/cameras', (req, res) => res.json(CAMERAS));
app.post('/control', (req, res) => {
  const { printer, command } = req.body;
  if (!['pause','resume','stop'].includes(command))
    return res.status(400).json({ error: 'Invalid command' });
  const p = printerClients[printer];
  if (!p) return res.status(404).json({ error: 'Printer not found' });
  p.client.publish(p.REQUEST_TOPIC, JSON.stringify({ print: { sequence_id: '0', command } }));
  res.json({ sent: command, printer });
});

app.listen(PI_PORT, () => {
  console.log(`🚀 LayerDeck Hub running on port ${PI_PORT}`);
  console.log(`📡 Connecting to ${PRINTERS.length} printer(s)...`);
});
```

---

### printers.json (user edits this on their Pi)

> This is the file customers edit with their own credentials. It lives at `~/bambu-hub/printers.json`. Add creating this file as a step in the Pi setup guide for future customers.

```json
{
  "printers": [
    {
      "name": "A1",
      "ip": "192.168.1.171",
      "serial": "03919C452404673",
      "accessCode": "ed7fd800",
      "plugIp": "192.168.1.165"
    },
    {
      "name": "P1 Room",
      "ip": "192.168.1.166",
      "serial": "01P09C4C0402468",
      "accessCode": "85467582",
      "plugIp": "192.168.1.162"
    },
    {
      "name": "P1 Closet",
      "ip": "192.168.1.155",
      "serial": "01P09C471500288",
      "accessCode": "33503749",
      "plugIp": "192.168.1.172"
    }
  ],
  "cameras": {
    "A1":        "camera_a1",
    "P1 Room":   "camera_p1_room",
    "P1 Closet": "camera_p1_closet"
  }
}
```

---

---

## 🟢 CODE — Section 13: Extended Pi Hub Features

> Build these features into the LayerDeck Pi integration. Each one hooks into existing LayerDeck collections and the existing push notification system. They should feel like natural extensions of the Printers tab and the broader app — not separate tools bolted on.

---

### Feature 1 — Automated Print Cost Logging

The Pi already detects FINISH state via MQTT. When a print finishes, automatically write the full job record to LayerDeck without the user touching anything.

This replaces the manual "Log a print" flow for prints that run on connected printers — the entry is created automatically, and the user can review or edit it after the fact if needed.

**What gets logged automatically:**
```javascript
// Triggered when gcode_state transitions to "FINISH"
// Writes to the existing `prints` collection in Supabase

function onPrintFinished(printerName, printerData, startTime) {
  const durationMinutes = Math.round((Date.now() - startTime) / 60000);
  const material        = getAMSMaterial(printerData.ams);  // from AMS tray data
  const gramsUsed       = estimateFilamentUsed(material, durationMinutes);
  const spool           = matchSpool(material, printerData.ams, spoolsDB);

  const filamentCost    = spool
    ? parseFloat((gramsUsed * (spool.price / spool.totalGrams)).toFixed(2))
    : 0;
  const electricityCost = parseFloat(((durationMinutes / 60) * 0.12 * 0.13).toFixed(2));

  const printRecord = {
    id:            crypto.randomUUID(),
    date:          new Date().toISOString().split('T')[0],
    productName:   printerData.subtask_name?.replace('.gcode.3mf', '') || 'Unknown',
    filamentUsed:  gramsUsed,
    filamentType:  material,
    printTime:     formatDuration(durationMinutes),
    success:       true,
    notes:         'Auto-logged by LayerDeck Pi Hub',
    linkedOrderId: null,          // user can link after the fact
    printerName:   printerName,
    costBreakdown: {
      filamentCost,
      electricityCost,
      totalCost: parseFloat((filamentCost + electricityCost).toFixed(2))
    }
  };

  // Write to Supabase prints collection
  saveToSupabase('prints', printRecord);

  // Deduct from spool
  if (spool) deductFromSpool(spool.id, gramsUsed);

  // Show in-app notification: "Print finished — A1 completed ShinyBall_Red"
  showToast(`✅ ${printerName} finished: ${printRecord.productName}`);
}

function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
```

---

### Feature 2 — Print Failure Push Notifications

When a print fails while the user is away, fire a push notification to their phone immediately. The existing LayerDeck push notification system (Web Push) should handle delivery — this just triggers it on FAILED state.

```javascript
// Triggered when gcode_state transitions to "FAILED"

async function onPrintFailed(printerName, printerData) {
  const jobName = printerData.subtask_name?.replace('.gcode.3mf', '') || 'Unknown job';

  // Write to wasteLog collection
  await saveToSupabase('wasteLog', {
    id:          crypto.randomUUID(),
    date:        new Date().toISOString().split('T')[0],
    printerName,
    jobName,
    reason:      'Print failure detected via MQTT',
    materialWasted: estimateFilamentUsed(
      getAMSMaterial(printerData.ams),
      getElapsedMinutes(printerData)
    )
  });

  // Fire push notification via existing LayerDeck Web Push system
  // Uses the same push endpoint already built for Shopify order alerts
  await triggerPushNotification({
    title: '⚠️ Print Failed',
    body:  `${printerName} — ${jobName} has failed. Check your printer.`,
    icon:  '/icons/printer-alert.png',
    tag:   `print-fail-${printerName}`   // replaces previous alert for same printer
  });

  // Update printerRecords fail count
  incrementPrinterStat(printerName, 'failCount');
}
```

---

### Feature 3 — Auto Thumbnail Generation from 3MF Files

When a sliced .3mf file is uploaded to the Pi via FTP (from Bambu Studio), automatically extract the preview image embedded in the file and display it on the matching card in LayerDeck's **3MF Library tab**. Every library card will show a real print thumbnail with zero manual effort.

Bambu .3mf files contain a preview image at `Metadata/plate_1.png` inside the ZIP archive.

**What Replit must do in the 3MF Library tab:**
- Each entry in the `tmfLib` Supabase collection should support a `thumbnail` field (base64 data URL string)
- When a `thumbnail` value is present on a `tmfLib` entry, display it as the card's preview image in the 3MF Library tab
- When no thumbnail is present, show the existing placeholder/icon as before
- The thumbnail should update automatically on the card as soon as it arrives from the Pi — no page refresh needed (poll the `tmfLib` collection or use Supabase realtime)

```javascript
// Runs on the Pi whenever a new .3mf file appears in the FTP cache folder
// Requires: npm install chokidar jszip

const chokidar = require('chokidar');
const JSZip    = require('jszip');
const fs       = require('fs');
const path     = require('path');

const FTP_CACHE = '/home/hypedanubis3d/.cache/bambu'; // adjust if needed

chokidar.watch(FTP_CACHE, { ignoreInitial: true }).on('add', async (filePath) => {
  if (!filePath.endsWith('.3mf')) return;

  try {
    const zipData  = fs.readFileSync(filePath);
    const zip      = await JSZip.loadAsync(zipData);
    const preview  = zip.file('Metadata/plate_1.png');
    if (!preview) return;

    const imgBuffer = await preview.async('nodebuffer');
    const base64    = imgBuffer.toString('base64');
    const dataUrl   = `data:image/png;base64,${base64}`;

    const fileName = path.basename(filePath);
    console.log(`📸 Extracted thumbnail for ${fileName}`);

    // POST thumbnail to LayerDeck API so it can update the 3MF library entry
    await fetch('http://localhost:3000/thumbnail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName, thumbnail: dataUrl })
    });

  } catch (e) {
    console.error('Thumbnail extraction failed:', e.message);
  }
});
```

Add the `/thumbnail` endpoint to server.js:
```javascript
// POST /thumbnail — receives extracted thumbnail from Pi file watcher
// Writes thumbnail directly to Supabase tmfLib entry matching the fileName
// Studio Manager 3MF Library tab should reflect this update automatically
app.post('/thumbnail', async (req, res) => {
  const { fileName, thumbnail } = req.body;

  try {
    // Find the matching tmfLib entry by fileName and update its thumbnail field
    // This uses the same Supabase connection already set up for nightly reports
    const { data } = await supabase
      .from('ha3d_user_data')
      .select('payload')
      .eq('collection', 'tmfLib')
      .single();

    const library = JSON.parse(data?.payload || '[]');
    const entry   = library.find(f => f.fileName === fileName || f.name === fileName);

    if (entry) {
      entry.thumbnail = thumbnail;
      await supabase
        .from('ha3d_user_data')
        .update({ payload: JSON.stringify(library) })
        .eq('collection', 'tmfLib');
      console.log(`📸 Thumbnail saved for ${fileName}`);
      res.json({ saved: true, fileName });
    } else {
      res.json({ saved: false, reason: 'No matching tmfLib entry found', fileName });
    }
  } catch (e) {
    console.error('Thumbnail save failed:', e.message);
    res.status(500).json({ error: e.message });
  }
});
```

---

### Feature 4 — Nightly Summary Reports (Scheduled)

A cron job runs every night at a set time and compiles a daily summary of all print activity, then delivers it via push notification or email. Uses data already in the existing LayerDeck collections.

> ✅ This cron job is already registered in Phase 1 Step 14. No action needed here.

**Create the report script:**

> ⚠️ This is a 4-part step.

**a.** Type this and press Enter — a blank editor opens:
```bash
nano ~/bambu-hub/nightly-report.js
```

**b.** Paste the entire code block below into the editor.

**c.** Save: press **Ctrl+X** → **Y** → **Enter**

**d.** Terminal returns to normal. Move on.

```javascript
// nightly-report.js — runs via cron, compiles daily print summary

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function generateNightlyReport() {
  const today = new Date().toISOString().split('T')[0];

  // Pull today's prints from Supabase
  const { data: prints } = await supabase
    .from('ha3d_user_data')
    .select('payload')
    .eq('collection', 'prints');

  const allPrints  = JSON.parse(prints?.[0]?.payload || '[]');
  const todaysPrints = allPrints.filter(p => p.date === today);

  const totalPrints    = todaysPrints.length;
  const successful     = todaysPrints.filter(p => p.success).length;
  const failed         = todaysPrints.filter(p => !p.success).length;
  const totalGrams     = todaysPrints.reduce((sum, p) => sum + (p.filamentUsed || 0), 0);
  const totalRevenue   = todaysPrints.reduce((sum, p) => sum + (p.costBreakdown?.totalCost || 0), 0);

  const summary = [
    `📊 LayerDeck Daily Summary — ${today}`,
    `Prints completed: ${successful} ✅  Failed: ${failed} ❌`,
    `Filament used: ${totalGrams.toFixed(0)}g`,
    `Est. print cost: $${totalRevenue.toFixed(2)}`
  ].join('
');

  console.log(summary);

  // Fire push notification with summary
  // Uses same push system as Shopify order alerts and print failure alerts
  await fetch('http://localhost:3000/push-summary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: '📊 Daily Print Summary',
      body:  `${successful} prints done · ${totalGrams.toFixed(0)}g used · $${totalRevenue.toFixed(2)} cost`
    })
  });
}

generateNightlyReport().catch(console.error);
```

Add the `/push-summary` endpoint to server.js:
```javascript
// POST /push-summary — triggered by nightly cron, fires push notification
app.post('/push-summary', async (req, res) => {
  const { title, body } = req.body;
  // Route through the existing LayerDeck push notification system
  // Same mechanism used for Shopify order alerts
  await triggerPushNotification({ title, body, tag: 'daily-summary' });
  res.json({ sent: true });
});
```

Install the Supabase client on the Pi:
```bash
cd ~/bambu-hub && npm install @supabase/supabase-js tplink-smarthome-api
```

> Supabase credentials are already set in your environment from Step 13 of Phase 1. No action needed here.



---

---

## 🟢 CODE — Section 14: Complete Bambu Lab Filament Database

> The existing Filament Database tab is a static reference library of Bambu filaments that users can browse and click "+ Add to Spools" to pre-fill spool settings. It currently has limited coverage. Replace the existing filament data with this complete dataset covering all current Bambu Lab filament lines and every color variant. Load this into the `filamentDatabase` collection in Supabase (or however the existing tab currently sources its data — match the existing schema).

**What Replit must do:**
- Replace the current limited filament list with the complete dataset below
- Each entry should support: brand, name, material type, color name, hex code, nozzle temp, bed temp, max speed, price per 1000g, notes, and available colors array
- The "+ Add to Spools" button should pre-fill ALL fields including color, hex, and temps when clicked
- The color selector per filament line should show all available colors as visual swatches (colored dots/chips), not just a text dropdown
- Add a **brand filter dropdown** above the filament list with options: All Brands / Bambu Lab / ELEGOO / Polymaker / SUNLU / 3DHoJor / YOOPAI. Selecting a brand filters the list to show only that brand's filaments. This must update in real time as new brands are added to the database via the seed function.
- Add a **search bar** that filters by filament name, material type, or color name as the user types. Search works within the active brand filter (i.e. search + brand filter stack together).
- Add a **material type filter** (All / PLA / PETG / ABS / ASA / TPU / Support) as a second dropdown alongside the brand filter.
- All three filters (brand, material, search) stack together — a user can filter to "ELEGOO → PLA → red" in one step.
- Filter state resets when the user navigates away from the tab.

---

### Complete Bambu Lab Filament Dataset

```javascript
// Load this into the filamentDatabase collection in Supabase
// or replace the existing static filament data array — match the existing schema

const BAMBU_FILAMENT_DATABASE = [

  // ── PLA BASIC ─────────────────────────────────────────────────────
  {
    id: "bambu-pla-basic",
    brand: "Bambu Lab",
    name: "PLA Basic",
    type: "PLA",
    nozzleTemp: 220,
    bedTemp: 35,
    maxSpeed: 500,
    price: 13.99,
    notes: "Reliable all-rounder. Great for most prints. Most popular option.",
    colors: [
      { name: "Bambu Green",     hex: "#4CAF50" },
      { name: "Black",           hex: "#1A1A1A" },
      { name: "White",           hex: "#F5F5F5" },
      { name: "Grey",            hex: "#9E9E9E" },
      { name: "Red",             hex: "#D32F2F" },
      { name: "Blue",            hex: "#1565C0" },
      { name: "Yellow",          hex: "#F9A825" },
      { name: "Orange",          hex: "#E65100" },
      { name: "Pink",            hex: "#E91E63" },
      { name: "Purple",          hex: "#6A1B9A" },
      { name: "Jade White",      hex: "#E8F5E9" },
      { name: "Cobalt Blue",     hex: "#1A237E" },
      { name: "Magenta",         hex: "#AD1457" },
      { name: "Cyan",            hex: "#00838F" },
      { name: "Light Blue",      hex: "#90CAF9" },
      { name: "Beige",           hex: "#D7CCC8" },
      { name: "Brown",           hex: "#5D4037" },
      { name: "Army Green",      hex: "#558B2F" },
      { name: "Sky Blue",        hex: "#81D4FA" },
      { name: "Sakura Pink",     hex: "#F48FB1" },
      { name: "Lime Green",      hex: "#AEEA00" },
      { name: "Mint",            hex: "#B2DFDB" }
    ]
  },

  // ── PLA MATTE ─────────────────────────────────────────────────────
  {
    id: "bambu-pla-matte",
    brand: "Bambu Lab",
    name: "PLA Matte",
    type: "PLA",
    nozzleTemp: 220,
    bedTemp: 35,
    maxSpeed: 500,
    price: 14.99,
    notes: "Beautiful matte finish. Hides layer lines well. Great for display models.",
    colors: [
      { name: "Matte Black",     hex: "#212121" },
      { name: "Matte White",     hex: "#FAFAFA" },
      { name: "Matte Grey",      hex: "#757575" },
      { name: "Charcoal",        hex: "#37474F" },
      { name: "Matte Red",       hex: "#B71C1C" },
      { name: "Matte Blue",      hex: "#0D47A1" },
      { name: "Matte Green",     hex: "#1B5E20" },
      { name: "Matte Yellow",    hex: "#F57F17" },
      { name: "Matte Orange",    hex: "#BF360C" },
      { name: "Matte Pink",      hex: "#880E4F" },
      { name: "Matte Purple",    hex: "#4A148C" },
      { name: "Matte Beige",     hex: "#BCAAA4" },
      { name: "Matte Brown",     hex: "#4E342E" },
      { name: "Matte Cyan",      hex: "#006064" },
      { name: "Desert Tan",      hex: "#D7B899" },
      { name: "Matte Army Green",hex: "#33691E" }
    ]
  },

  // ── PLA SILK+ ─────────────────────────────────────────────────────
  {
    id: "bambu-pla-silk",
    brand: "Bambu Lab",
    name: "PLA Silk+",
    type: "PLA",
    nozzleTemp: 220,
    bedTemp: 35,
    maxSpeed: 400,
    price: 15.99,
    notes: "High gloss shiny finish. Enhanced layer adhesion vs standard silk. Metallic sheen.",
    colors: [
      { name: "Gold",            hex: "#FFD700" },
      { name: "Silver",          hex: "#C0C0C0" },
      { name: "Copper",          hex: "#B87333" },
      { name: "Rainbow",         hex: "#FF6B6B" },
      { name: "Rose Gold",       hex: "#E8A0A0" },
      { name: "Bronze",          hex: "#8C6820" },
      { name: "Champagne",       hex: "#F7E7CE" },
      { name: "Emerald",         hex: "#50C878" },
      { name: "Sapphire",        hex: "#0F52BA" },
      { name: "Ruby",            hex: "#9B111E" },
      { name: "Amethyst",        hex: "#9966CC" },
      { name: "Onyx",            hex: "#353839" },
      { name: "Pearl White",     hex: "#F8F8FF" },
      { name: "Galaxy Black",    hex: "#0D0D0D" }
    ]
  },

  // ── PLA SILK MULTI-COLOR ──────────────────────────────────────────
  {
    id: "bambu-pla-silk-multicolor",
    brand: "Bambu Lab",
    name: "PLA Silk Multi-Color",
    type: "PLA",
    nozzleTemp: 220,
    bedTemp: 35,
    maxSpeed: 300,
    price: 16.99,
    notes: "Dynamic color transitions along the filament length. Note: weaker layer strength, color blending may occur.",
    colors: [
      { name: "Starlight",       hex: "#A8C0FF" },
      { name: "Candy",           hex: "#FFB6C1" },
      { name: "Aurora",          hex: "#77DD77" },
      { name: "Sunset",          hex: "#FF6B35" },
      { name: "Ocean",           hex: "#006994" },
      { name: "Forest",          hex: "#228B22" }
    ]
  },

  // ── PLA METAL ─────────────────────────────────────────────────────
  {
    id: "bambu-pla-metal",
    brand: "Bambu Lab",
    name: "PLA Metal",
    type: "PLA",
    nozzleTemp: 220,
    bedTemp: 35,
    maxSpeed: 300,
    price: 17.99,
    notes: "Tough and impact resistant. Controllable gloss. Metallic look with added strength.",
    colors: [
      { name: "Titanium",        hex: "#878681" },
      { name: "Iron",            hex: "#48494B" },
      { name: "Steel Blue",      hex: "#4682B4" },
      { name: "Antique Bronze",  hex: "#665D1E" },
      { name: "Gunmetal",        hex: "#2C3539" }
    ]
  },

  // ── PLA MARBLE ────────────────────────────────────────────────────
  {
    id: "bambu-pla-marble",
    brand: "Bambu Lab",
    name: "PLA Marble",
    type: "PLA",
    nozzleTemp: 220,
    bedTemp: 35,
    maxSpeed: 300,
    price: 16.99,
    notes: "Rock-like texture with natural stone appearance.",
    colors: [
      { name: "White Marble",    hex: "#F0EDE8" },
      { name: "Black Marble",    hex: "#2D2D2D" },
      { name: "Grey Marble",     hex: "#9E9E9E" }
    ]
  },

  // ── PLA GLOW ──────────────────────────────────────────────────────
  {
    id: "bambu-pla-glow",
    brand: "Bambu Lab",
    name: "PLA Glow",
    type: "PLA",
    nozzleTemp: 220,
    bedTemp: 35,
    maxSpeed: 300,
    price: 15.99,
    notes: "Glow-in-the-dark. Charge under light for best effect.",
    colors: [
      { name: "Glow Green",      hex: "#B5EA7D" },
      { name: "Glow Blue",       hex: "#A0C4FF" },
      { name: "Glow White",      hex: "#E8F5E9" }
    ]
  },

  // ── PLA-CF ────────────────────────────────────────────────────────
  {
    id: "bambu-pla-cf",
    brand: "Bambu Lab",
    name: "PLA-CF",
    type: "PLA-CF",
    nozzleTemp: 220,
    bedTemp: 35,
    maxSpeed: 300,
    price: 24.99,
    notes: "Carbon fiber reinforced PLA. Enhanced strength and stiffness. Requires hardened steel nozzle.",
    colors: [
      { name: "Black",           hex: "#1A1A1A" },
      { name: "Grey",            hex: "#616161" }
    ]
  },

  // ── PETG BASIC ────────────────────────────────────────────────────
  {
    id: "bambu-petg-basic",
    brand: "Bambu Lab",
    name: "PETG Basic",
    type: "PETG",
    nozzleTemp: 230,
    bedTemp: 70,
    maxSpeed: 300,
    price: 15.99,
    notes: "Great balance of strength and ease of printing. Good for functional parts. Slightly flexible.",
    colors: [
      { name: "Black",           hex: "#1A1A1A" },
      { name: "White",           hex: "#F5F5F5" },
      { name: "Grey",            hex: "#9E9E9E" },
      { name: "Red",             hex: "#D32F2F" },
      { name: "Blue",            hex: "#1565C0" },
      { name: "Yellow",          hex: "#F9A825" },
      { name: "Orange",          hex: "#E65100" },
      { name: "Green",           hex: "#2E7D32" },
      { name: "Pink",            hex: "#E91E63" },
      { name: "Purple",          hex: "#6A1B9A" },
      { name: "Transparent",     hex: "#E8F5E9" },
      { name: "Clear Blue",      hex: "#BBDEFB" },
      { name: "Clear Red",       hex: "#FFCDD2" },
      { name: "Clear Green",     hex: "#C8E6C9" },
      { name: "Clear Yellow",    hex: "#FFF9C4" }
    ]
  },

  // ── PETG-CF ───────────────────────────────────────────────────────
  {
    id: "bambu-petg-cf",
    brand: "Bambu Lab",
    name: "PETG-CF",
    type: "PETG-CF",
    nozzleTemp: 240,
    bedTemp: 70,
    maxSpeed: 200,
    price: 27.99,
    notes: "Carbon fiber reinforced PETG. High strength, low warping. Requires hardened steel nozzle.",
    colors: [
      { name: "Black",           hex: "#1A1A1A" },
      { name: "Grey",            hex: "#616161" }
    ]
  },

  // ── PETG HF ───────────────────────────────────────────────────────
  {
    id: "bambu-petg-hf",
    brand: "Bambu Lab",
    name: "PETG HF",
    type: "PETG",
    nozzleTemp: 240,
    bedTemp: 70,
    maxSpeed: 600,
    price: 18.99,
    notes: "High Flow PETG. Designed for Bambu's high-speed printing. Faster than standard PETG.",
    colors: [
      { name: "Black",           hex: "#1A1A1A" },
      { name: "White",           hex: "#F5F5F5" },
      { name: "Grey",            hex: "#9E9E9E" },
      { name: "Red",             hex: "#D32F2F" },
      { name: "Blue",            hex: "#1565C0" }
    ]
  },

  // ── ABS ───────────────────────────────────────────────────────────
  {
    id: "bambu-abs",
    brand: "Bambu Lab",
    name: "ABS",
    type: "ABS",
    nozzleTemp: 270,
    bedTemp: 90,
    maxSpeed: 300,
    price: 15.99,
    notes: "High strength and heat resistance. Best printed in enclosed printer (P1S, X1C). Some warping possible.",
    colors: [
      { name: "Black",           hex: "#1A1A1A" },
      { name: "White",           hex: "#F5F5F5" },
      { name: "Grey",            hex: "#9E9E9E" },
      { name: "Red",             hex: "#D32F2F" },
      { name: "Blue",            hex: "#1565C0" },
      { name: "Yellow",          hex: "#F9A825" },
      { name: "Orange",          hex: "#E65100" },
      { name: "Green",           hex: "#2E7D32" },
      { name: "Pink",            hex: "#E91E63" },
      { name: "Purple",          hex: "#6A1B9A" },
      { name: "Beige",           hex: "#D7CCC8" },
      { name: "Brown",           hex: "#5D4037" },
      { name: "Silver",          hex: "#C0C0C0" },
      { name: "Ivory",           hex: "#FFFFF0" },
      { name: "Army Green",      hex: "#558B2F" },
      { name: "Navy Blue",       hex: "#0D2137" }
    ]
  },

  // ── ASA ───────────────────────────────────────────────────────────
  {
    id: "bambu-asa",
    brand: "Bambu Lab",
    name: "ASA",
    type: "ASA",
    nozzleTemp: 270,
    bedTemp: 90,
    maxSpeed: 200,
    price: 17.99,
    notes: "UV and weather resistant. Great for outdoor parts. Similar to ABS but better UV stability.",
    colors: [
      { name: "Black",           hex: "#1A1A1A" },
      { name: "White",           hex: "#F5F5F5" },
      { name: "Grey",            hex: "#9E9E9E" },
      { name: "Red",             hex: "#D32F2F" },
      { name: "Blue",            hex: "#1565C0" },
      { name: "Yellow",          hex: "#F9A825" },
      { name: "Green",           hex: "#2E7D32" },
      { name: "Orange",          hex: "#E65100" }
    ]
  },

  // ── TPU 95A ───────────────────────────────────────────────────────
  {
    id: "bambu-tpu-95a",
    brand: "Bambu Lab",
    name: "TPU 95A",
    type: "TPU",
    nozzleTemp: 230,
    bedTemp: 35,
    maxSpeed: 150,
    price: 17.99,
    notes: "Flexible and rubber-like. Shore hardness 95A. Great for grips, gaskets, and wearable items.",
    colors: [
      { name: "Black",           hex: "#1A1A1A" },
      { name: "White",           hex: "#F5F5F5" },
      { name: "Red",             hex: "#D32F2F" },
      { name: "Blue",            hex: "#1565C0" },
      { name: "Yellow",          hex: "#F9A825" },
      { name: "Green",           hex: "#2E7D32" },
      { name: "Orange",          hex: "#E65100" },
      { name: "Pink",            hex: "#E91E63" },
      { name: "Transparent",     hex: "#E8F5E9" }
    ]
  },

  // ── PA-CF ─────────────────────────────────────────────────────────
  {
    id: "bambu-pa-cf",
    brand: "Bambu Lab",
    name: "PA-CF",
    type: "PA-CF",
    nozzleTemp: 280,
    bedTemp: 90,
    maxSpeed: 150,
    price: 34.99,
    notes: "Nylon carbon fiber. Extremely strong and stiff. Engineering-grade. Requires hardened steel nozzle and enclosure.",
    colors: [
      { name: "Black",           hex: "#1A1A1A" },
      { name: "Grey",            hex: "#616161" }
    ]
  },

  // ── PPA-CF ────────────────────────────────────────────────────────
  {
    id: "bambu-ppa-cf",
    brand: "Bambu Lab",
    name: "PPA-CF",
    type: "PPA-CF",
    nozzleTemp: 300,
    bedTemp: 100,
    maxSpeed: 100,
    price: 44.99,
    notes: "High-performance polyphthalamide carbon fiber. Exceptional heat resistance and strength. Advanced users only.",
    colors: [
      { name: "Black",           hex: "#1A1A1A" }
    ]
  },

  // ── PPS-CF ────────────────────────────────────────────────────────
  {
    id: "bambu-pps-cf",
    brand: "Bambu Lab",
    name: "PPS-CF",
    type: "PPS-CF",
    nozzleTemp: 330,
    bedTemp: 120,
    maxSpeed: 80,
    price: 59.99,
    notes: "Polyphenylene sulfide carbon fiber. Extreme heat and chemical resistance. Industrial-grade material.",
    colors: [
      { name: "Black",           hex: "#1A1A1A" }
    ]
  },

  // ── PLA AERO ──────────────────────────────────────────────────────
  {
    id: "bambu-pla-aero",
    brand: "Bambu Lab",
    name: "PLA Aero",
    type: "PLA",
    nozzleTemp: 220,
    bedTemp: 45,
    maxSpeed: 150,
    price: 19.99,
    notes: "Lightweight foaming PLA. Expands during printing to create lightweight, slightly spongy parts. Lower density than standard PLA.",
    colors: [
      { name: "White",           hex: "#F5F5F5" },
      { name: "Black",           hex: "#1A1A1A" },
      { name: "Grey",            hex: "#9E9E9E" }
    ]
  },

  // ── ELEGOO PLA ────────────────────────────────────────────────────
  {
    id: "elegoo-pla-rapid",
    brand: "ELEGOO",
    name: "PLA Rapid",
    type: "PLA",
    nozzleTemp: 220,
    bedTemp: 60,
    maxSpeed: 600,
    price: 17.99,
    notes: "High-speed PLA optimized for fast printing. Excellent for Bambu high-speed mode. Great layer adhesion.",
    colors: [
      { name: "Black",          hex: "#1A1A1A" },
      { name: "White",          hex: "#F5F5F5" },
      { name: "Grey",           hex: "#9E9E9E" },
      { name: "Red",            hex: "#D32F2F" },
      { name: "Blue",           hex: "#1565C0" },
      { name: "Yellow",         hex: "#F9A825" },
      { name: "Orange",         hex: "#E65100" },
      { name: "Green",          hex: "#2E7D32" },
      { name: "Pink",           hex: "#E91E63" },
      { name: "Purple",         hex: "#6A1B9A" },
      { name: "Skin",           hex: "#FFCCAA" },
      { name: "Light Blue",     hex: "#90CAF9" },
      { name: "Army Green",     hex: "#558B2F" }
    ]
  },

  {
    id: "elegoo-pla-plus",
    brand: "ELEGOO",
    name: "PLA+",
    type: "PLA",
    nozzleTemp: 220,
    bedTemp: 60,
    maxSpeed: 500,
    price: 15.99,
    notes: "Toughened PLA with improved impact resistance over standard PLA. Great for functional parts.",
    colors: [
      { name: "Black",          hex: "#1A1A1A" },
      { name: "White",          hex: "#F5F5F5" },
      { name: "Grey",           hex: "#9E9E9E" },
      { name: "Dark Grey",      hex: "#424242" },
      { name: "Red",            hex: "#D32F2F" },
      { name: "Blue",           hex: "#1565C0" },
      { name: "Navy Blue",      hex: "#0D2137" },
      { name: "Yellow",         hex: "#F9A825" },
      { name: "Orange",         hex: "#E65100" },
      { name: "Green",          hex: "#2E7D32" },
      { name: "Pink",           hex: "#E91E63" },
      { name: "Purple",         hex: "#6A1B9A" },
      { name: "Beige",          hex: "#D7CCC8" },
      { name: "Brown",          hex: "#5D4037" },
      { name: "Skin",           hex: "#FFCCAA" },
      { name: "Transparent",    hex: "#E8F5E9" }
    ]
  },

  {
    id: "elegoo-pla-matte",
    brand: "ELEGOO",
    name: "PLA Matte",
    type: "PLA",
    nozzleTemp: 220,
    bedTemp: 60,
    maxSpeed: 500,
    price: 16.99,
    notes: "Smooth matte finish with minimal layer line visibility. Great for display models and cosplay props.",
    colors: [
      { name: "Matte Black",    hex: "#212121" },
      { name: "Matte White",    hex: "#FAFAFA" },
      { name: "Matte Grey",     hex: "#757575" },
      { name: "Matte Red",      hex: "#B71C1C" },
      { name: "Matte Blue",     hex: "#0D47A1" },
      { name: "Matte Green",    hex: "#1B5E20" },
      { name: "Matte Yellow",   hex: "#F57F17" },
      { name: "Matte Orange",   hex: "#BF360C" },
      { name: "Matte Pink",     hex: "#880E4F" },
      { name: "Matte Purple",   hex: "#4A148C" },
      { name: "Matte Brown",    hex: "#4E342E" },
      { name: "Matte Beige",    hex: "#BCAAA4" },
      { name: "Charcoal",       hex: "#37474F" }
    ]
  },

  {
    id: "elegoo-pla-silk",
    brand: "ELEGOO",
    name: "PLA Silk",
    type: "PLA",
    nozzleTemp: 220,
    bedTemp: 60,
    maxSpeed: 300,
    price: 17.99,
    notes: "Shiny metallic silk finish. Slower speeds recommended for best surface quality.",
    colors: [
      { name: "Gold",           hex: "#FFD700" },
      { name: "Silver",         hex: "#C0C0C0" },
      { name: "Copper",         hex: "#B87333" },
      { name: "Rose Gold",      hex: "#E8A0A0" },
      { name: "Rainbow",        hex: "#FF6B6B" },
      { name: "Bronze",         hex: "#8C6820" },
      { name: "Blue",           hex: "#1565C0" },
      { name: "Green",          hex: "#2E7D32" },
      { name: "Purple",         hex: "#6A1B9A" },
      { name: "Red",            hex: "#D32F2F" },
      { name: "Black",          hex: "#1A1A1A" },
      { name: "White",          hex: "#F5F5F5" }
    ]
  },

  {
    id: "elegoo-petg",
    brand: "ELEGOO",
    name: "PETG",
    type: "PETG",
    nozzleTemp: 235,
    bedTemp: 70,
    maxSpeed: 300,
    price: 16.99,
    notes: "Strong, slightly flexible, and moisture resistant. Good for functional parts that need some give.",
    colors: [
      { name: "Black",          hex: "#1A1A1A" },
      { name: "White",          hex: "#F5F5F5" },
      { name: "Grey",           hex: "#9E9E9E" },
      { name: "Red",            hex: "#D32F2F" },
      { name: "Blue",           hex: "#1565C0" },
      { name: "Yellow",         hex: "#F9A825" },
      { name: "Green",          hex: "#2E7D32" },
      { name: "Orange",         hex: "#E65100" },
      { name: "Transparent",    hex: "#E8F5E9" },
      { name: "Clear Blue",     hex: "#BBDEFB" }
    ]
  },

  {
    id: "elegoo-abs",
    brand: "ELEGOO",
    name: "ABS",
    type: "ABS",
    nozzleTemp: 240,
    bedTemp: 90,
    maxSpeed: 300,
    price: 15.99,
    notes: "High strength and heat resistance. Best in enclosed printer. Some warping — use enclosure.",
    colors: [
      { name: "Black",          hex: "#1A1A1A" },
      { name: "White",          hex: "#F5F5F5" },
      { name: "Grey",           hex: "#9E9E9E" },
      { name: "Red",            hex: "#D32F2F" },
      { name: "Blue",           hex: "#1565C0" },
      { name: "Yellow",         hex: "#F9A825" },
      { name: "Green",          hex: "#2E7D32" }
    ]
  },

  {
    id: "elegoo-tpu",
    brand: "ELEGOO",
    name: "TPU 95A",
    type: "TPU",
    nozzleTemp: 230,
    bedTemp: 40,
    maxSpeed: 150,
    price: 18.99,
    notes: "Flexible and durable. Shore 95A hardness. Great for grips, gaskets, and wearable items.",
    colors: [
      { name: "Black",          hex: "#1A1A1A" },
      { name: "White",          hex: "#F5F5F5" },
      { name: "Red",            hex: "#D32F2F" },
      { name: "Blue",           hex: "#1565C0" },
      { name: "Yellow",         hex: "#F9A825" },
      { name: "Green",          hex: "#2E7D32" },
      { name: "Orange",         hex: "#E65100" },
      { name: "Transparent",    hex: "#E8F5E9" }
    ]
  },

  // ── SUPPORT FILAMENTS ─────────────────────────────────────────────
  {
    id: "bambu-support-pla",
    brand: "Bambu Lab",
    name: "Support for PLA",
    type: "Support",
    nozzleTemp: 220,
    bedTemp: 35,
    maxSpeed: 200,
    price: 17.99,
    notes: "Breakaway support material for PLA. Easier support removal. Use in AMS slot alongside PLA.",
    colors: [
      { name: "Natural",         hex: "#F5F0E8" }
    ]
  },
  {
    id: "bambu-support-petg",
    brand: "Bambu Lab",
    name: "Support for PETG/ABS",
    type: "Support",
    nozzleTemp: 230,
    bedTemp: 70,
    maxSpeed: 200,
    price: 17.99,
    notes: "Breakaway support material for PETG and ABS. Clean break-away supports.",
    colors: [
      { name: "Natural",         hex: "#F5F0E8" }
    ]
  },
  {
    id: "bambu-support-pa",
    brand: "Bambu Lab",
    name: "Support for PA/PET",
    type: "Support",
    nozzleTemp: 260,
    bedTemp: 80,
    maxSpeed: 150,
    price: 19.99,
    notes: "Water-soluble support for engineering materials. Dissolves in water for complex geometries.",
    colors: [
      { name: "Natural",         hex: "#F5F0E8" }
    ]
  }

  // ── POLYMAKER PANCHROMA MATTE PLA ─────────────────────────────────
  {
    id: "polymaker-panchroma-matte",
    brand: "Polymaker",
    name: "Panchroma Matte PLA",
    type: "PLA",
    nozzleTemp: 215,
    bedTemp: 50,
    maxSpeed: 300,
    price: 19.99,
    notes: "Formerly PolyTerra PLA. Bioplastic-based, beautiful matte finish. Slightly more abrasive than standard PLA — consider hardened nozzle for heavy use. AMS compatible.",
    printSettings: {
      nozzleTempRange:  "190–230°C",
      bedTempRange:     "25–60°C",
      printSpeed:       "up to 300mm/s",
      fanSpeed:         "100%",
      retractionDirect: "1mm @ 20mm/s",
      retractionBowden: "3mm @ 40mm/s",
      drying:           "55°C for 6h if moisture absorbed",
      bambuProfile:     "Generic PLA Matte or PolyTerra PLA profile",
      tips: "Excellent for display pieces and collectibles. Matte finish conceals layer lines beautifully. Full cooling fan for best surface quality."
    },
    colors: [
      { name: "Matte Black",          hex: "#1A1A1A" },
      { name: "Matte White",          hex: "#F0F0F0" },
      { name: "Matte Grey",           hex: "#7A7A7A" },
      { name: "Matte Army Dark Green",hex: "#515234" },
      { name: "Matte Forest Green",   hex: "#519F61" },
      { name: "Matte Lime Green",     hex: "#D0E740" },
      { name: "Matte Arctic Teal",    hex: "#5AABB1" },
      { name: "Matte Sapphire Blue",  hex: "#005AA2" },
      { name: "Matte Pastel Ice",     hex: "#95C5D3" },
      { name: "Matte Red",            hex: "#C0392B" },
      { name: "Matte Sunrise Orange", hex: "#F78E0E" },
      { name: "Matte Yellow",         hex: "#F5D020" },
      { name: "Matte Savannah Yellow",hex: "#F0BE02" },
      { name: "Matte Pastel Banana",  hex: "#F5CF6F" },
      { name: "Matte Sakura Pink",    hex: "#F2A0B0" },
      { name: "Matte Lotus Pink",     hex: "#D4708A" },
      { name: "Matte Purple",         hex: "#7B2D8B" },
      { name: "Matte Wood Brown",     hex: "#AD7441" },
      { name: "Matte Pastel Peach",   hex: "#F2B67A" },
      { name: "Matte Pastel Mint",    hex: "#BEC9A5" },
      { name: "Matte Army Light Green",hex: "#A78403" },
      { name: "Matte Muted Green",    hex: "#656D60" },
    ]
  },

  // ── POLYMAKER PANCHROMA GRADIENT MATTE ────────────────────────────
  {
    id: "polymaker-panchroma-gradient-matte",
    brand: "Polymaker",
    name: "Panchroma Gradient Matte PLA",
    type: "PLA",
    nozzleTemp: 215,
    bedTemp: 50,
    maxSpeed: 300,
    price: 19.99,
    notes: "Formerly PolyTerra Gradient PLA. Seamless color transitions with matte finish. Color cycle length varies per colorway — best on larger prints.",
    printSettings: {
      nozzleTempRange:  "190–230°C",
      bedTempRange:     "25–60°C",
      printSpeed:       "up to 300mm/s",
      fanSpeed:         "100%",
      retractionDirect: "1mm @ 20mm/s",
      retractionBowden: "3mm @ 40mm/s",
      drying:           "55°C for 6h if moisture absorbed",
      bambuProfile:     "Generic PLA Matte",
      tips: "Use on larger prints for the full gradient effect. Avoid small prints where the color cycle won't complete. Full cooling fan on."
    },
    colors: [
      { name: "Pastel Rainbow", hex: "#E8B4D8" },
      { name: "Cappuccino",     hex: "#C4956A" },
      { name: "Spring",         hex: "#A8D8A8" },
      { name: "Summer",         hex: "#FFD166" },
      { name: "Fall",           hex: "#D4826A" },
      { name: "Winter",         hex: "#A8C8E8" },
      { name: "Wood",           hex: "#8B6914" },
      { name: "Tropical Squeeze",hex: "#FF8C42" },
      { name: "Lavender Fizz",  hex: "#C9A9D0" },
      { name: "Mint Splash",    hex: "#88D8B0" },
      { name: "Sky",            hex: "#87CEEB" },
      { name: "Sandstorm",      hex: "#C2A57A" },
      { name: "Tornado",        hex: "#7A9DB0" },
    ]
  },

  // ── SUNLU PLA ─────────────────────────────────────────────────────
  {
    id: "sunlu-pla",
    brand: "SUNLU",
    name: "PLA",
    type: "PLA",
    nozzleTemp: 215,
    bedTemp: 55,
    maxSpeed: 100,
    price: 14.99,
    notes: "Reliable budget PLA. Neat winding, good layer adhesion, minimal warping. Vacuum sealed. ±0.02mm tolerance. Works great in AMS.",
    printSettings: {
      nozzleTempRange:  "200–230°C",
      bedTempRange:     "50–65°C",
      printSpeed:       "50–100mm/s",
      fanSpeed:         "100%",
      retractionDirect: "1mm @ 25mm/s",
      retractionBowden: "4mm @ 40mm/s",
      drying:           "55°C for 6h if moisture absorbed",
      bambuProfile:     "Generic PLA",
      tips: "215°C nozzle / 60°C bed is a reliable all-purpose starting point. Neat winding makes it AMS friendly. Good value pick for non-display prints."
    },
    colors: [
      { name: "Black",       hex: "#1A1A1A" },
      { name: "White",       hex: "#F5F5F5" },
      { name: "Grey",        hex: "#808080" },
      { name: "Red",         hex: "#CC2200" },
      { name: "Blue",        hex: "#1565C0" },
      { name: "Sky Blue",    hex: "#87CEEB" },
      { name: "Green",       hex: "#2E7D32" },
      { name: "Yellow",      hex: "#F9C500" },
      { name: "Orange",      hex: "#E65100" },
      { name: "Pink",        hex: "#F48FB1" },
      { name: "Purple",      hex: "#6A1B9A" },
      { name: "Skin Beige",  hex: "#F5CBA7" },
      { name: "Transparent", hex: "#E8F4F8" },
    ]
  },

  // ── SUNLU PLA+ ────────────────────────────────────────────────────
  {
    id: "sunlu-pla-plus",
    brand: "SUNLU",
    name: "PLA+",
    type: "PLA",
    nozzleTemp: 225,
    bedTemp: 60,
    maxSpeed: 100,
    price: 16.99,
    notes: "Stronger and more flexible than standard PLA. Higher temps required. Good for functional prints that need mild impact resistance.",
    printSettings: {
      nozzleTempRange:  "215–235°C",
      bedTempRange:     "55–65°C",
      printSpeed:       "50–100mm/s",
      fanSpeed:         "100%",
      retractionDirect: "1mm @ 25mm/s",
      retractionBowden: "4mm @ 45mm/s",
      drying:           "55°C for 6h if moisture absorbed",
      bambuProfile:     "Generic PLA",
      tips: "Run 10–15°C hotter than standard PLA. 225°C / 60°C is a good starting point. More flexible than PLA — better for clips and snap-fits."
    },
    colors: [
      { name: "Black",       hex: "#1A1A1A" },
      { name: "White",       hex: "#F5F5F5" },
      { name: "Grey",        hex: "#808080" },
      { name: "Red",         hex: "#CC2200" },
      { name: "Blue",        hex: "#1565C0" },
      { name: "Green",       hex: "#2E7D32" },
      { name: "Yellow",      hex: "#F9C500" },
      { name: "Orange",      hex: "#E65100" },
      { name: "Pink",        hex: "#F48FB1" },
      { name: "Purple",      hex: "#6A1B9A" },
      { name: "Transparent", hex: "#E8F4F8" },
    ]
  },

  // ── SUNLU MATTE PLA ───────────────────────────────────────────────
  {
    id: "sunlu-pla-matte",
    brand: "SUNLU",
    name: "PLA Matte",
    type: "PLA",
    nozzleTemp: 215,
    bedTemp: 55,
    maxSpeed: 600,
    price: 17.99,
    notes: "Smooth matte finish. Reduced layer line appearance. High-speed capable up to 600mm/s. Less brittle than standard PLA. Great for display models and collectibles.",
    printSettings: {
      nozzleTempRange:  "200–230°C",
      bedTempRange:     "50–65°C",
      printSpeed:       "up to 600mm/s (use 150–200mm/s for detail)",
      fanSpeed:         "100%",
      retractionDirect: "1mm @ 25mm/s",
      retractionBowden: "4mm @ 40mm/s",
      drying:           "55°C for 6h if moisture absorbed",
      bambuProfile:     "Generic PLA Matte",
      tips: "Can push high speeds on the P1S but dial back to 150mm/s for detailed figurines. Matte finish hides layer lines exceptionally well."
    },
    colors: [
      { name: "Matte Black",  hex: "#1A1A1A" },
      { name: "Matte White",  hex: "#F0F0F0" },
      { name: "Matte Grey",   hex: "#808080" },
      { name: "Matte Red",    hex: "#C0392B" },
      { name: "Matte Blue",   hex: "#1565C0" },
      { name: "Matte Green",  hex: "#2E7D32" },
      { name: "Matte Yellow", hex: "#F9C500" },
      { name: "Matte Orange", hex: "#E65100" },
      { name: "Matte Pink",   hex: "#F48FB1" },
      { name: "Matte Purple", hex: "#6A1B9A" },
    ]
  },

  // ── 3DHOJOR MATTE PLA ─────────────────────────────────────────────
  {
    id: "3dhojor-matte-pla",
    brand: "3DHoJor",
    name: "Matte PLA",
    type: "PLA",
    nozzleTemp: 215,
    bedTemp: 50,
    maxSpeed: 100,
    price: 14.99,
    notes: "Known for pastel and earthy matte tones. Higher toughness than standard PLA. Odorless and vacuum sealed. Good for display prints and COSPLAY props.",
    printSettings: {
      nozzleTempRange:  "190–230°C (recommended 215°C)",
      bedTempRange:     "45–60°C",
      printSpeed:       "40–100mm/s",
      fanSpeed:         "100%",
      retractionDirect: "1mm @ 20mm/s",
      retractionBowden: "3.5mm @ 40mm/s",
      drying:           "55°C for 6h if moisture absorbed",
      bambuProfile:     "Generic PLA Matte",
      tips: "215°C is the sweet spot. Full fan on. Excellent for pastel display models. Lower warp than standard PLA. Great bang for buck on matte colors."
    },
    colors: [
      { name: "Matte White",      hex: "#F0F0F0" },
      { name: "Matte Black",      hex: "#1A1A1A" },
      { name: "Matte Grey",       hex: "#808080" },
      { name: "Matte Red",        hex: "#C0392B" },
      { name: "Matte Orange",     hex: "#E8630A" },
      { name: "Matte Yellow",     hex: "#F5D020" },
      { name: "Matte Green",      hex: "#519F61" },
      { name: "Matte Teal",       hex: "#5AABB1" },
      { name: "Matte Blue",       hex: "#1565C0" },
      { name: "Matte Light Blue", hex: "#87CEEB" },
      { name: "Matte Purple",     hex: "#7B2D8B" },
      { name: "Matte Pink",       hex: "#F4A7B9" },
      { name: "Matte Beige",      hex: "#F5CBA7" },
      { name: "Matte Brown",      hex: "#8B6914" },
    ]
  },

  // ── YOOPAI MATTE PLA+ ─────────────────────────────────────────────
  {
    id: "yoopai-matte-pla-plus",
    brand: "YOOPAI",
    name: "Matte PLA Plus",
    type: "PLA",
    nozzleTemp: 220,
    bedTemp: 60,
    maxSpeed: 300,
    price: 15.99,
    notes: "Matte PLA+ with strong layer adhesion and minimal layer lines. Low warping formula. ±0.02mm tolerance. Budget-friendly matte option for display prints.",
    printSettings: {
      nozzleTempRange:  "200–230°C",
      bedTempRange:     "50–65°C",
      printSpeed:       "50–300mm/s",
      fanSpeed:         "100%",
      retractionDirect: "1mm @ 25mm/s",
      retractionBowden: "4mm @ 40mm/s",
      drying:           "55°C for 6h if moisture absorbed",
      bambuProfile:     "Generic PLA Matte",
      tips: "220°C / 60°C is a solid starting point. Matte finish conceals layer lines well. Good budget option for figurines and display models."
    },
    colors: [
      { name: "Matte Black",      hex: "#1A1A1A" },
      { name: "Matte White",      hex: "#F0F0F0" },
      { name: "Matte Grey",       hex: "#808080" },
      { name: "Matte Red",        hex: "#C0392B" },
      { name: "Matte Orange",     hex: "#E65100" },
      { name: "Matte Yellow",     hex: "#F9C500" },
      { name: "Matte Green",      hex: "#2E7D32" },
      { name: "Matte Blue",       hex: "#1565C0" },
      { name: "Matte Ice Blue",   hex: "#87CEEB" },
      { name: "Matte Pink",       hex: "#F48FB1" },
      { name: "Matte Purple",     hex: "#6A1B9A" },
      { name: "Matte Light Brown",hex: "#AD7441" },
    ]
  },

];
```

---

### How to seed this into the app

```javascript
// Run this once to populate/replace the filamentDatabase collection in Supabase
// Can be triggered from a Settings panel button: "Refresh Filament Database"

async function seedFilamentDatabase() {
  await supabase
    .from('ha3d_user_data')
    .upsert({
      collection: 'filamentDatabase',
      payload: JSON.stringify(BAMBU_FILAMENT_DATABASE),
      updated_at: new Date().toISOString()
    }, { onConflict: 'collection' });

  console.log(`✅ Seeded ${BAMBU_FILAMENT_DATABASE.length} filament types`);
}
```

> Add a **"Refresh Filament Database"** button in the Filament Database tab settings to re-run if Bambu releases new filaments. This replaces the entire dataset in one operation.

---

### What to Show When Clicking Into a Filament Entry

Tapping any filament card opens a detail panel showing all fields including recommended print settings and tips.

**UI layout:**

```
┌─────────────────────────────────────────────┐
│  Polymaker Panchroma Matte PLA      [← Back] │
│  PLA · $19.99/kg                            │
│                                             │
│  COLORS                                     │
│  ● Matte Black  ● Matte White  ● Matte Grey │
│  ● Matte Red    ● Forest Green  ...         │
│  (tappable — pre-selects color on Add)      │
│                                             │
│  RECOMMENDED PRINT SETTINGS                 │
│  Nozzle:       190–230°C                    │
│  Bed:          25–60°C                      │
│  Speed:        up to 300mm/s                │
│  Fan:          100%                         │
│  Retraction:   1mm direct / 3mm Bowden      │
│  Bambu Studio: Generic PLA Matte            │
│  Drying:       55°C for 6h if needed        │
│                                             │
│  💡 Excellent for display pieces and        │
│     collectibles. Matte finish conceals     │
│     layer lines beautifully.                │
│                                             │
│  NOTES                                      │
│  Formerly PolyTerra PLA. Slightly more      │
│  abrasive than standard PLA.                │
│                                             │
│  [+ Add to Spools]                          │
└─────────────────────────────────────────────┘
```

**What Replit needs to render from the `printSettings` block:**
- Nozzle temp range, bed temp range, print speed, fan speed
- Retraction — show both direct and Bowden values so user reads the right one for their printer
- Bambu Studio profile callout if `bambuProfile` field is present
- Tips block shown as a highlighted card with 💡 icon
- Drying instructions
- Color swatches are tappable — tapping a color pre-selects it when "+ Add to Spools" is clicked
- If `printSettings` is absent on an entry (legacy entries without it), hide that section gracefully

---

### Spool Add Flow — Filament Database Integration

There are two ways a user should be able to add a spool, both pre-filling from the filament database:

---

**Path 1 — Add Spool from the Filament Database tab**

Every filament card in the database already has a "+ Add to Spools" button. When clicked:

1. Open the Add Spool modal/form
2. Pre-fill these fields from the filament database entry:
   - Brand → `entry.brand`
   - Material name → `entry.name`
   - Material type → `entry.type`
   - Nozzle temp → `entry.nozzleTemp`
   - Bed temp → `entry.bedTemp`
   - Price per 1000g → `entry.price`
3. Show a **color selector** populated with all colors for that filament line — display as visual swatches (colored circles), not a plain text dropdown. When the user picks a color:
   - Color name → `color.name`
   - Hex code → `color.hex`
4. The only fields left to fill manually: spool weight bought, remaining weight, purchase date, brand/store notes
5. Save button writes to `spools` collection in Supabase

---

**Path 2 — Add Spool from the Spools tab (manual add)**

When a user clicks "+ Add Spool" from the Spools tab directly:

1. Show a **"Select from Filament Database"** option at the top of the form
2. Clicking it opens a searchable dropdown or modal that lists all filament database entries (searchable by name, material type, color)
3. When the user selects a filament + color:
   - All the same fields pre-fill as Path 1
4. The user completes the remaining manual fields and saves

The user should never have to manually type brand, temps, or material type when adding a Bambu Lab spool — the database handles all of that.

---

---

## 🟢 CODE — Section 15: Additional Pi-Powered Features

---

### Feature 6 — Desktop Companion Always-On Host

**The problem:** The Desktop Companion (`layerdeck.replit.app/companion`) currently depends on your PC being on. When your PC is off, stocktake mode, inventory updates, and 3MF file management are unavailable from your phone.

**The solution:** Move the companion server process to the Pi so it runs 24/7. Since the Pi is always on and accessible via Tailscale, the companion becomes available from your phone anywhere, anytime — PC off or on doesn't matter.

**What Replit needs to do:**

The Desktop Companion is a React + Vite app. Replit should build a production version of it and serve it from the Pi hub server as a static site alongside the existing API.

Add this to server.js on the Pi:

```javascript
const path = require('path');

// Serve the built Desktop Companion as a static site
// Build output from: cd companion && npm run build → dist/
// Copy dist/ to ~/bambu-hub/companion-dist/
app.use('/companion', express.static(path.join(__dirname, 'companion-dist')));

// Fallback for React client-side routing
app.get('/companion/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'companion-dist', 'index.html'));
});
```

**Access from phone via Tailscale:**
```
http://100.88.246.109:3000/companion
```

**Build and deploy steps** (run these after completing Phase 1 Pi setup):

```bash
# On your PC — build the companion
cd companion
npm run build

# Copy the build output to Pi via SCP (run on your PC, not SSH)
scp -r dist/ hypedanubis3d@layerdeck-hub.local:~/bambu-hub/companion-dist/
```

> Whenever the companion is updated, re-run the build and scp steps to push the new version to the Pi. PM2 will serve the updated files immediately — no restart needed.

---

### Feature 7 — Nightly Supabase Data Backup

**The problem:** All LayerDeck data lives in Supabase. If the Supabase project is accidentally deleted, a collection is corrupted, or data is lost during a bad sync, there is currently no recovery path.

**The solution:** A nightly cron job on the Pi exports a full JSON snapshot of all Supabase collections and saves it locally with a timestamp. Backups rotate — keeping the last 30 days. If something goes wrong, you have a dated export you can restore from using LayerDeck's existing Backup & Restore feature.

> ✅ This cron job is already registered in Phase 1 Step 14. No action needed here.

**Create the backup script:**
```bash
nano ~/bambu-hub/nightly-backup.js
```

```javascript
// nightly-backup.js — exports all Supabase collections to a dated JSON file

const { createClient } = require('@supabase/supabase-js');
const fs   = require('fs');
const path = require('path');

const supabase  = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const BACKUP_DIR = path.join(process.env.HOME, 'layerdeck-backups');
const MAX_BACKUPS = 30; // keep 30 days of backups

const COLLECTIONS = [
  'tmfLib', 'catalog', 'orders', 'printQueue', 'spools',
  'prints', 'conventions', 'sales', 'usageHist', 'shinyRolls',
  'maintLog', 'wasteLog', 'printerRecords', 'catalogItems',
  'filamentDatabase', 'printerHub'
];

async function runBackup() {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const backup    = { exportedAt: new Date().toISOString(), collections: {} };
  let   totalRows = 0;

  for (const collection of COLLECTIONS) {
    const { data, error } = await supabase
      .from('ha3d_user_data')
      .select('payload')
      .eq('collection', collection)
      .single();

    if (!error && data?.payload) {
      backup.collections[collection] = JSON.parse(data.payload);
      totalRows += backup.collections[collection].length || 0;
    }
  }

  // Write timestamped backup file
  const fileName = `layerdeck-backup-${new Date().toISOString().split('T')[0]}.json`;
  const filePath = path.join(BACKUP_DIR, fileName);
  fs.writeFileSync(filePath, JSON.stringify(backup, null, 2));
  console.log(`✅ Backup saved: ${fileName} (${totalRows} records)`);

  // Rotate — delete backups older than MAX_BACKUPS days
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('layerdeck-backup-'))
    .sort();

  if (files.length > MAX_BACKUPS) {
    const toDelete = files.slice(0, files.length - MAX_BACKUPS);
    toDelete.forEach(f => {
      fs.unlinkSync(path.join(BACKUP_DIR, f));
      console.log(`🗑️  Rotated old backup: ${f}`);
    });
  }
}

runBackup().catch(console.error);
```

**Add a backup status endpoint to server.js** so Studio Manager can show when the last backup ran:

```javascript
// GET /backup-status — returns last backup info
app.get('/backup-status', (req, res) => {
  const backupDir = path.join(process.env.HOME, 'layerdeck-backups');
  try {
    const files = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('layerdeck-backup-'))
      .sort();
    const latest = files[files.length - 1];
    const stats  = fs.statSync(path.join(backupDir, latest));
    res.json({
      lastBackup: latest,
      fileSize:   `${(stats.size / 1024).toFixed(1)} KB`,
      totalBackups: files.length
    });
  } catch (e) {
    res.json({ lastBackup: null, totalBackups: 0 });
  }
});
```

**What Replit should add to Studio Manager:**

In the Settings panel, add a **"Pi Backup"** status card showing:
- Last backup date and file size (pulled from `/backup-status`)
- A **"Download Latest Backup"** button that fetches the most recent backup JSON from the Pi and triggers a browser download — this gives a local copy you can restore from using the existing Backup & Restore feature

---

### Feature 8 — Pi as Central 3MF Library Host

**The problem:** 3MF files currently only live on your PC. If you add a second workstation, get a new PC, or your drive fails, the files are gone. The Desktop Companion uploads metadata to Supabase but the actual .3mf files stay local.

**The solution:** The Pi becomes the master 3MF file store. Files are uploaded to the Pi once and synced to any PC automatically. The Pi serves files to Bambu Studio directly via its local IP, so you can slice from any machine on your network without copying files around.

**What Replit needs to add to the Desktop Companion:**

When a user adds a .3mf file to the library, also upload the actual file to the Pi (not just the metadata). Add an upload endpoint to server.js:

```javascript
const multer = require('multer');
const upload = multer({ dest: path.join(process.env.HOME, '3mf-library') });

// POST /3mf/upload — receives actual .3mf file from Desktop Companion
app.post('/3mf/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file received' });

  // Rename to original filename
  const dest = path.join(process.env.HOME, '3mf-library', req.file.originalname);
  fs.renameSync(req.file.path, dest);

  console.log(`📁 Stored: ${req.file.originalname}`);
  res.json({ stored: true, fileName: req.file.originalname });
});

// GET /3mf/files — list all stored 3MF files
app.get('/3mf/files', (req, res) => {
  const dir   = path.join(process.env.HOME, '3mf-library');
  if (!fs.existsSync(dir)) return res.json([]);
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.3mf'));
  res.json(files.map(f => ({
    name: f,
    size: fs.statSync(path.join(dir, f)).size,
    url:  `/3mf/download/${encodeURIComponent(f)}`
  })));
});

// GET /3mf/download/:filename — download a specific file
app.get('/3mf/download/:filename', (req, res) => {
  const filePath = path.join(process.env.HOME, '3mf-library', req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });
  res.download(filePath);
});
```

Install multer on the Pi:
```bash
cd ~/bambu-hub && npm install multer
```

**What Replit should add to Studio Manager / Desktop Companion:**

- When adding a file to the 3MF Library, the actual .3mf file is uploaded to the Pi via `POST /3mf/upload` in addition to the metadata going to Supabase
- In the 3MF Library tab, each card gets a **"Download"** button that fetches the file from the Pi via Tailscale — works from any device, not just the PC the file was originally on
- A **"Sync to PC"** button that downloads all Pi-stored 3MF files to the local machine in one operation — useful when setting up a new workstation

---

---

### Feature 9 — Colour View + Pi-Optimized Print Queue

**Background:** Colour View exists in an older Electron desktop app. It groups queued parts by filament color so you can see at a glance which colors to load for your next print run. This needs to be built fresh in LayerDeck and extended with a Pi-powered optimization layer.

**Key detail — printer AMS capacity:**

| Printer | AMS Type | AMS Units | Slots |
|---------|----------|-----------|-------|
| A1 | AMS Lite | 1 | 4 |
| P1 Room | AMS | 1 | 4 |
| P1 Closet | AMS | 2 | 8 |

AMS count is stored per printer in the existing `printerRecords` collection as `amsUnits` — the user sets this in the Add/Edit Printer form (None / 1 / 2 / 3 / 4 AMS). The Colour View reads this value directly from `printerRecords`. Do NOT try to detect AMS count from MQTT — the user-set value is the source of truth and handles future additions/removals cleanly.

When the user updates their AMS count in the Printers tab (e.g. adds a 3rd AMS to P1 Closet), the Colour View automatically reflects the new slot capacity with no code changes.

```javascript
// Get AMS slot capacity from printerRecords — NOT from MQTT
function getPrinterSlotCapacity(printerRecord) {
  const amsUnits = printerRecord?.amsUnits || 0; // 0 = no AMS
  return amsUnits * 4; // 4 trays per AMS unit
}

// Get currently loaded colors from live MQTT state (for visual display only)
function getLoadedColors(printerState) {
  return (printerState?.ams?.ams || []).flatMap(unit =>
    unit.tray.map(tray => ({
      amsId:    unit.id,
      trayId:   tray.id,
      color:    tray.tray_color,
      material: tray.tray_type,
      remain:   tray.remain
    }))
  ).filter(t => t.color && t.color !== '00000000'); // filter empty slots
}
```

---

**What Replit needs to build:**

Add a **"Colour View"** tab under the Prints section in Studio Manager. This is a new view of the existing `printQueue` collection — no new data stored, just a smarter presentation.

**Part 1 — Colour View per printer:**

The view is filtered by printer. At the top, show a printer selector (A1 / P1 Room / P1 Closet). When a printer is selected:

- Show that printer's AMS slots as a visual grid (4 slots per AMS unit, stacked if multiple units)
- Each slot shows what's currently loaded (color swatch + material name) from live MQTT data
- Below the AMS grid, show all queued jobs assigned to that printer, grouped by filament color
- Jobs requiring colors already loaded in the AMS are highlighted green (ready to print)
- Jobs requiring colors not loaded are highlighted yellow (swap needed)

```javascript
// Build Colour View for a specific printer
// printerRecord = the matching entry from printerRecords collection (has amsUnits)
// printerState  = live MQTT data from Pi hub (has current AMS colors loaded)
function buildColourViewForPrinter(printerName, printQueue, printerRecord, printerState) {
  const capacity     = getPrinterSlotCapacity(printerRecord); // from printerRecords
  const loadedColors = getLoadedColors(printerState);         // from live MQTT
  const loadedHexes  = new Set(loadedColors.map(c => c.color));

  // Jobs assigned to this printer that are queued
  const printerJobs = printQueue.filter(j =>
    j.printerName === printerName &&
    (j.status === 'Queued' || j.status === 'In Progress')
  );

  // Group by filament color
  const colorGroups = {};
  printerJobs.forEach(job => {
    const filaments = job.filaments ||
      [{ color: job.filamentColor, colorHex: job.colorHex, material: job.filamentType }];

    filaments.forEach(f => {
      const key = f.colorHex || f.color || 'Unknown';
      if (!colorGroups[key]) {
        colorGroups[key] = {
          colorName:   f.color || 'Unknown',
          colorHex:    f.colorHex || '#999999',
          material:    f.material || '',
          alreadyLoaded: loadedHexes.has(f.colorHex),
          jobs:        []
        };
      }
      colorGroups[key].jobs.push(job);
    });
  });

  const totalColorsNeeded = Object.keys(colorGroups).length;
  const fitsWithoutSwap   = totalColorsNeeded <= capacity;

  return {
    printerName,
    capacity,           // total AMS slots
    loadedColors,       // what's currently in the AMS
    colorGroups: Object.values(colorGroups).sort((a, b) =>
      (b.alreadyLoaded - a.alreadyLoaded) || // already loaded first
      (b.jobs.length - a.jobs.length)         // then by job count
    ),
    totalColorsNeeded,
    fitsWithoutSwap,
    swapsNeeded: Math.max(0, totalColorsNeeded - capacity)
  };
}
```

**UI for Colour View tab:**
- Printer selector tabs at top (A1 / P1 Room / P1 Closet) — each shows a badge with pending job count
- AMS slot grid — visual representation of physical AMS slots, showing current load from live MQTT
- Color groups below — each group shows a large color swatch, name, material, job count, and whether it's already loaded
- Jobs within each group show: product name, part name, quantity, linked order, estimated print time
- Summary bar: `X colors needed · Y slots available · Z swaps required`
- If total colors needed exceed AMS capacity: show a warning with how many swaps are required and suggested batching order

---

**Part 2 — Pi-Optimized Print Order:**

The Pi knows each printer's live AMS state and slot capacity. The optimizer assigns queued jobs to printers in the most efficient order, matching already-loaded colors first and respecting each printer's actual capacity.

Add this endpoint to server.js on the Pi:

```javascript
// POST /optimize-queue
// Body: { jobs: [...printQueue items] }
// Returns: optimized job assignments per printer respecting AMS capacity

app.post('/optimize-queue', (req, res) => {
  const { jobs } = req.body;
  if (!jobs?.length) return res.json({ optimized: [], summary: {} });

  // Build printer profiles
  // IMPORTANT: slotCapacity comes from printerRecords (user-set amsUnits field)
  // NOT from MQTT — user controls their AMS count in the Printers tab
  // The Pi receives printerRecords from the Studio Manager in the request body
  const { jobs, printerRecords = [] } = req.body;

  const printerProfiles = Object.entries(printerStates).map(([name, state]) => {
    // Match to printerRecords by name to get user-configured AMS count
    const record      = printerRecords.find(r => r.name === name) || {};
    const amsUnits    = record.amsUnits || 0;
    const slotCap     = amsUnits * 4;

    // Loaded colors still come from live MQTT (what's physically in the AMS right now)
    const loadedColors = (state?.ams?.ams || [])
      .flatMap(u => u.tray.map(t => t.tray_color))
      .filter(c => c && c !== '00000000');

    return {
      name,
      online:        state.online,
      idle:          ['IDLE','FINISH'].includes(state.gcode_state),
      slotCapacity:  slotCap,   // from printerRecords
      loadedColors:  new Set(loadedColors), // from live MQTT
      assignedJobs:  []
    };
  });

  const idlePrinters = printerProfiles.filter(p => p.online && p.idle);
  const queuedJobs   = jobs.filter(j => j.status === 'Queued');
  const optimized    = [];
  const assigned     = new Set();

  // Pass 1 — assign jobs whose colors are already loaded on an idle printer
  idlePrinters.forEach(printer => {
    queuedJobs.forEach(job => {
      if (assigned.has(job.id)) return;
      const jobColors  = (job.filaments || [{ colorHex: job.colorHex }]).map(f => f.colorHex);
      const allLoaded  = jobColors.every(c => printer.loadedColors.has(c));
      const fits       = (printer.assignedJobs.length + 1) <= printer.slotCapacity;

      if (allLoaded && fits) {
        printer.assignedJobs.push(job);
        optimized.push({ ...job, suggestedPrinter: printer.name, swapRequired: false });
        assigned.add(job.id);
      }
    });
  });

  // Pass 2 — batch remaining jobs by color, assign to printer with most available slots
  const remaining = queuedJobs.filter(j => !assigned.has(j.id));

  // Group remaining by color
  const colorBatches = {};
  remaining.forEach(job => {
    const key = job.colorHex || job.filamentColor || 'unknown';
    if (!colorBatches[key]) colorBatches[key] = [];
    colorBatches[key].push(job);
  });

  // Assign each color batch to the printer with the most available capacity
  Object.values(colorBatches)
    .sort((a, b) => b.length - a.length)
    .forEach(batch => {
      const bestPrinter = idlePrinters
        .filter(p => p.slotCapacity - p.assignedJobs.length > 0)
        .sort((a, b) => b.slotCapacity - b.assignedJobs.length - (a.slotCapacity - a.assignedJobs.length))[0];

      batch.forEach(job => {
        if (!assigned.has(job.id)) {
          if (bestPrinter) bestPrinter.assignedJobs.push(job);
          optimized.push({
            ...job,
            suggestedPrinter: bestPrinter?.name || null,
            swapRequired: true
          });
          assigned.add(job.id);
        }
      });
    });

  res.json({
    optimized,
    summary: {
      totalJobs:     optimized.length,
      readyNow:      optimized.filter(j => !j.swapRequired).length,
      swapsRequired: optimized.filter(j =>  j.swapRequired).length,
      byPrinter: idlePrinters.map(p => ({
        name:          p.name,
        slotCapacity:  p.slotCapacity,
        assignedJobs:  p.assignedJobs.length
      }))
    }
  });
});
```

**What the Colour View UI shows after clicking "Optimize Print Order":**

```javascript
async function optimizePrintOrder(queuedJobs) {
  const res = await fetch(`${PI_URL}/optimize-queue`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ jobs: queuedJobs })
  });
  const { optimized, summary } = await res.json();

  // Display results grouped by suggested printer:
  // A1 (4 slots):        3 jobs ready · 0 swaps
  // P1 Room (4 slots):   2 jobs ready · 1 swap
  // P1 Closet (12 slots): 8 jobs ready · 0 swaps
  //
  // Each job shows:
  // ✅ Green badge  — "Ready — colors already loaded"
  // 🔄 Yellow badge — "Swap required — load [color swatch] [color name]"
  //
  // Summary line:
  // "13 prints optimized · 13 ready to start now · 1 filament swap needed"
  return { optimized, summary };
}
```

---

---

## 🟢 CODE — Section 16: Business & Shopify Automation

---

### Feature 10 — Shopify Order Sync Daemon

**The problem:** LayerDeck syncs Shopify orders via webhooks, which requires Replit to be running and reachable. If Replit goes down, you have an outage, or you lose internet, orders that come in during that window can be missed or delayed.

**The solution:** A lightweight script on the Pi polls the Shopify API every 5 minutes and writes new orders directly to Supabase. This runs independently of Replit — it's a local safety net that ensures every order is captured even when nothing else is working.

> ✅ This cron job is already registered in Phase 1 Step 14. No action needed here.

**Create the sync script:**
```bash
nano ~/bambu-hub/shopify-sync.js
```

```javascript
// shopify-sync.js
// Polls Shopify for new orders every 5 minutes and syncs to Supabase
// Runs independently of Replit — Pi-local safety net

const { createClient } = require('@supabase/supabase-js');

const supabase      = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
// Pi calls LayerDeck server proxy for all Shopify data
// No Shopify credentials needed on Pi — server is already authenticated
const SHOPIFY_SHOP    = process.env.SHOPIFY_SHOP;      // hypedanubis3d-2.myshopify.com
const LAYERDECK_API  = process.env.LAYERDECK_API;    // https://layerdeck.replit.app

async function syncOrders() {
  // Get the timestamp of our most recent synced order to avoid duplicates
  const { data: existing } = await supabase
    .from('ha3d_user_data')
    .select('payload')
    .eq('collection', 'orders')
    .single();

  const orders       = JSON.parse(existing?.payload || '[]');
  const existingIds  = new Set(orders.map(o => o.shopifyId?.toString()));
  const lastSync     = orders
    .filter(o => o.shopifyId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]?.createdAt;

  // Fetch recent orders via LayerDeck server proxy — already authenticated with Shopify
  // Pi uses Supabase anon key for auth, server handles Shopify credentials internally
  const since = lastSync ? `&created_at_min=${lastSync}` : '';
  const res   = await fetch(
    `${process.env.LAYERDECK_API}/api/shopify/orders?status=any&limit=50${since}`,
    {
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
        'x-shop':        process.env.SHOPIFY_SHOP
      }
    }
  );

  if (!res.ok) {
    console.error(`Shopify API error: ${res.status}`);
    return;
  }

  const { orders: shopifyOrders } = await res.json();
  const newOrders = shopifyOrders.filter(o => !existingIds.has(o.id.toString()));

  if (!newOrders.length) {
    console.log(`[${new Date().toISOString()}] No new orders`);
    return;
  }

  // Map Shopify orders to LayerDeck order format
  const mapped = newOrders.map(o => ({
    id:           crypto.randomUUID(),
    shopifyId:    o.id.toString(),
    orderNumber:  `#${o.order_number}`,
    customer:     `${o.customer?.first_name || ''} ${o.customer?.last_name || ''}`.trim() || 'Guest',
    email:        o.email || '',
    total:        parseFloat(o.total_price),
    status:       'pending',
    items:        o.line_items.map(i => ({
      name:     i.name,
      qty:      i.quantity,
      price:    parseFloat(i.price)
    })),
    createdAt:    o.created_at,
    source:       'shopify',
    syncedByPi:   true
  }));

  // Write to Supabase orders collection
  const updated = [...orders, ...mapped];
  await supabase
    .from('ha3d_user_data')
    .upsert({ collection: 'orders', payload: JSON.stringify(updated) }, { onConflict: 'collection' });

  console.log(`[${new Date().toISOString()}] Synced ${mapped.length} new order(s) from Shopify`);

  // Fire push notification for each new order
  for (const order of mapped) {
    await fetch('http://localhost:3000/push-summary', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        title: '🛍️ New Shopify Order',
        body:  `${order.orderNumber} — ${order.customer} · $${order.total.toFixed(2)}`
      })
    });
  }
}

syncOrders().catch(console.error);
```

> Shopify credentials are already set in your environment from Step 13 of Phase 1. No action needed here.

---

### Feature 11 — Low Stock Filament Alerts

**What Replit needs to add to Studio Manager:**

Extend the existing push notification system to monitor spool levels. Each spool in the `spools` collection has a remaining weight. When remaining weight drops below a user-defined threshold, fire a push notification.

This runs as part of the existing nightly summary cron job (Feature 4) and also triggers immediately when a spool is deducted after a print finishes.

```javascript
// Called after every print finish deduction AND in the nightly report
// spoolsDB = full spools array from Supabase
// threshold = grams remaining before alert (default 100g, user-configurable in Settings)

async function checkLowStockAlerts(spoolsDB, threshold = 100) {
  const lowSpools = spoolsDB.filter(s => {
    const remaining = s.remainingWeight || s.weightRemaining || 0;
    return remaining > 0 && remaining <= threshold && !s.lowStockAlertSent;
  });

  for (const spool of lowSpools) {
    const remaining = spool.remainingWeight || spool.weightRemaining;

    await triggerPushNotification({
      title: '🧵 Low Filament Alert',
      body:  `${spool.brand} ${spool.colorName} ${spool.material} — ${remaining}g remaining`,
      tag:   `low-stock-${spool.id}`  // prevents duplicate alerts for same spool
    });

    // Mark as alerted so we don't spam (reset when spool is restocked)
    spool.lowStockAlertSent = true;
  }

  // Update spools with alert flags
  if (lowSpools.length) {
    await saveToSupabase('spools', spoolsDB);
  }

  return lowSpools;
}
```

**Add to Settings panel:**
- A **"Low Stock Threshold"** input (default 100g) — when any spool drops below this, alert fires
- A **"Low Stock"** section in the Dashboard showing all spools currently below threshold with a restock button

---

### Feature 12 — Best Seller Tracker

The Pi polls your Shopify store's analytics API on a daily schedule and builds a local history of which products are trending. This gives you a rolling view of what's selling — useful for deciding what to restock, what to print more of, and what to promote.

> ✅ This cron job is already registered in Phase 1 Step 14. No action needed here.

**Create the script:**

> ⚠️ This is a 4-part step.

**a.** Type this and press Enter — a blank editor opens:
```bash
nano ~/bambu-hub/best-sellers.js
```

**b.** Paste the entire code block below into the editor.

**c.** Save: press **Ctrl+X** → **Y** → **Enter**

**d.** Terminal returns to normal. Move on.

```javascript
// best-sellers.js
// Fetches Shopify product analytics and tracks sales velocity over time

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase      = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
const SHOPIFY_TOKEN = process.env.SHOPIFY_TOKEN;
const HISTORY_FILE  = path.join(process.env.HOME, 'bambu-hub', 'best-seller-history.json');

async function trackBestSellers() {
  // Fetch orders via LayerDeck server proxy — already authenticated with Shopify
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const res   = await fetch(
    `${process.env.LAYERDECK_API}/api/shopify/orders?status=any&limit=250&created_at_min=${since}`,
    {
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
        'x-shop':        process.env.SHOPIFY_SHOP
      }
    }
  );

  if (!res.ok) { console.error('Shopify API error:', res.status); return; }

  const { orders } = await res.json();

  // Tally sales per product
  const salesMap = {};
  orders.forEach(order => {
    order.line_items.forEach(item => {
      const id = item.product_id?.toString();
      if (!id) return;
      if (!salesMap[id]) salesMap[id] = { id, title: item.title, unitsSold: 0, revenue: 0 };
      salesMap[id].unitsSold += item.quantity;
      salesMap[id].revenue  += parseFloat(item.price) * item.quantity;
    });
  });

  const ranked = Object.values(salesMap)
    .sort((a, b) => b.unitsSold - a.unitsSold)
    .slice(0, 20); // top 20

  // Load existing history
  const history = fs.existsSync(HISTORY_FILE)
    ? JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'))
    : [];

  // Append today's snapshot
  history.push({ date: new Date().toISOString().split('T')[0], topSellers: ranked });

  // Keep last 90 days
  const trimmed = history.slice(-90);
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(trimmed, null, 2));

  // Write to Supabase so Studio Manager can display it
  await supabase
    .from('ha3d_user_data')
    .upsert({ collection: 'bestSellerHistory', payload: JSON.stringify(trimmed) }, { onConflict: 'collection' });

  console.log(`[${new Date().toISOString()}] Top seller: ${ranked[0]?.title} (${ranked[0]?.unitsSold} units)`);
}

trackBestSellers().catch(console.error);
```

**What Replit should add to Studio Manager:**

Add a **"Best Sellers"** sub-tab inside the existing **Revenue** tab. This is the most natural home — the user is already thinking about money when they're in Revenue, and seeing which products are driving it is a direct extension of that context.

The Best Sellers sub-tab should show:
- Top 10 products ranked by units sold in the last 30 days, displayed as a ranked list with position number, product name, units sold, and total revenue
- A week-over-week trend indicator per product: **↑ Trending Up** (green) / **↓ Trending Down** (red) / **→ Stable** (grey) based on comparing last 7 days vs previous 7 days from the history data
- A simple bar chart showing the top 5 products side by side for quick visual comparison
- A "Last updated" timestamp showing when the Pi last ran the tracker
- Data sourced from the `bestSellerHistory` Supabase collection — auto-refreshes when the collection updates
- A filter for time range: Last 7 days / Last 30 days / Last 90 days (uses the stored history snapshots)

---

### Feature 13 — Competitor Price Monitor

Monitors competitor Shopify stores for price changes and new product listings. Uses Shopify's publicly available storefront JSON endpoint — no scraping, no login required. Polls every 6 hours to stay conservative and avoid being rate-limited.

> **Important:** Only monitors publicly listed prices. This is equivalent to manually checking a competitor's website — it reads the same data any visitor sees. Polling is kept at 6-hour intervals to be respectful and avoid IP blocks.

> ✅ This cron job is already registered in Phase 1 Step 14. No action needed here.

**Create the competitor list file:**
```bash
nano ~/bambu-hub/competitors.json
```

```json
{
  "competitors": [
    {
      "name": "Competitor Store Name",
      "domain": "competitorstore.myshopify.com",
      "watchKeywords": ["pokemon", "creature ball", "pokeball"]
    }
  ]
}
```

**Create the script:**

> ⚠️ This is a 4-part step.

**a.** Type this and press Enter — a blank editor opens:
```bash
nano ~/bambu-hub/competitor-monitor.js
```

**b.** Paste the entire code block below into the editor.

**c.** Save: press **Ctrl+X** → **Y** → **Enter**

**d.** Terminal returns to normal. Move on.

```javascript
// competitor-monitor.js
// Monitors competitor Shopify stores for price changes and new products

const { createClient } = require('@supabase/supabase-js');
const fs   = require('fs');
const path = require('path');

const supabase       = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const COMPETITORS    = JSON.parse(fs.readFileSync(path.join(process.env.HOME, 'bambu-hub', 'competitors.json'))).competitors;
const SNAPSHOT_FILE  = path.join(process.env.HOME, 'bambu-hub', 'competitor-snapshots.json');

async function monitorCompetitors() {
  const snapshots = fs.existsSync(SNAPSHOT_FILE)
    ? JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf8'))
    : {};

  const alerts = [];

  for (const competitor of COMPETITORS) {
    try {
      // Shopify public products endpoint — available on all Shopify stores
      const url = `https://${competitor.domain}/products.json?limit=250`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'LayerDeck-Monitor/1.0' }
      });

      if (!res.ok) {
        console.warn(`Could not reach ${competitor.name}: ${res.status}`);
        continue;
      }

      const { products } = await res.json();
      const prev = snapshots[competitor.domain] || {};

      products.forEach(product => {
        const keywords = competitor.watchKeywords || [];
        const relevant = keywords.length === 0 ||
          keywords.some(k => product.title.toLowerCase().includes(k.toLowerCase()));
        if (!relevant) return;

        const currentPrice = parseFloat(product.variants?.[0]?.price || 0);
        const prevPrice    = prev[product.id]?.price;
        const isNew        = !prev[product.id];

        if (isNew) {
          alerts.push({
            type:       'new_product',
            competitor: competitor.name,
            title:      product.title,
            price:      currentPrice,
            url:        `https://${competitor.domain}/products/${product.handle}`
          });
        } else if (prevPrice && Math.abs(currentPrice - prevPrice) > 0.01) {
          alerts.push({
            type:       'price_change',
            competitor: competitor.name,
            title:      product.title,
            oldPrice:   prevPrice,
            newPrice:   currentPrice,
            change:     currentPrice - prevPrice,
            url:        `https://${competitor.domain}/products/${product.handle}`
          });
        }

        // Update snapshot
        if (!snapshots[competitor.domain]) snapshots[competitor.domain] = {};
        snapshots[competitor.domain][product.id] = { price: currentPrice, title: product.title };
      });

    } catch (e) {
      console.error(`Error monitoring ${competitor.name}:`, e.message);
    }
  }

  // Save updated snapshots
  fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(snapshots, null, 2));

  // Fire alerts
  for (const alert of alerts) {
    const body = alert.type === 'new_product'
      ? `${alert.competitor} listed a new product: "${alert.title}" at $${alert.price.toFixed(2)}`
      : `${alert.competitor} changed price on "${alert.title}": $${alert.oldPrice?.toFixed(2)} → $${alert.newPrice.toFixed(2)} (${alert.change > 0 ? '+' : ''}${alert.change.toFixed(2)})`;

    await fetch('http://localhost:3000/push-summary', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ title: '👀 Competitor Alert', body })
    });

    console.log(body);
  }

  // Save alert history to Supabase for Studio Manager display
  if (alerts.length) {
    const { data } = await supabase
      .from('ha3d_user_data')
      .select('payload')
      .eq('collection', 'competitorAlerts')
      .single();

    const history = JSON.parse(data?.payload || '[]');
    history.unshift(...alerts.map(a => ({ ...a, detectedAt: new Date().toISOString() })));

    await supabase
      .from('ha3d_user_data')
      .upsert({ collection: 'competitorAlerts', payload: JSON.stringify(history.slice(0, 200)) }, { onConflict: 'collection' });
  }

  console.log(`[${new Date().toISOString()}] Competitor check done. ${alerts.length} alert(s).`);
}

monitorCompetitors().catch(console.error);
```

**What Replit should add to Studio Manager:**

Add a **"Competitor Pricing"** section inside the existing **Business tab, directly below Price AI**. This is the most natural home — Price AI already helps you set prices based on your costs, and competitor pricing data is the external context that completes that picture. Having both in the same place means you can look at what it costs you to make something, what the AI suggests, and what competitors are charging — all without switching tabs.

**Competitor Pricing section (below Price AI in the Business tab):**
- A live feed of recent competitor alerts (new products, price changes) with timestamps, sorted newest first
- Each alert shows: competitor name, product name, old price → new price (or "New listing"), and a direct link to the product page
- Alert cards use color coding: 🟡 yellow for price drops (potential pressure on you), 🔴 red for new competing products, 🟢 green for price increases (competitor got more expensive — opportunity for you)
- A filter to view alerts by competitor or alert type
- A **"Manage Competitors"** button that opens a modal to add/remove competitors and edit watch keywords — saves to `competitors.json` on the Pi via `POST /competitors` on server.js

**Add this endpoint to server.js on the Pi:**
```javascript
const competitorsPath = path.join(process.env.HOME, 'bambu-hub', 'competitors.json');

// GET /competitors — returns current competitor list
app.get('/competitors', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(competitorsPath, 'utf8'));
    res.json(data);
  } catch (e) {
    res.json({ competitors: [] });
  }
});

// POST /competitors — saves updated competitor list from Studio Manager
app.post('/competitors', (req, res) => {
  try {
    fs.writeFileSync(competitorsPath, JSON.stringify(req.body, null, 2));
    res.json({ saved: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
```

---

---

### Feature 14 — Automated Social Post Scheduler

Posts to Instagram and TikTok on a schedule from the Pi — no paid tools like Buffer or Later needed. Uses the official Meta Graph API for Instagram (requires Meta Business account + connected Instagram Professional account) and TikTok Content Posting API.

**How it works end to end:**
1. In LayerDeck Studio Manager, you write a caption and queue a post with a scheduled time
2. Post is saved to a `socialQueue` collection in Supabase with the caption, image URL, platforms, and scheduled time
3. Pi runs a cron job every 15 minutes, checks `socialQueue` for posts due to go out
4. Pi fires the post via the appropriate API and marks it as sent

> ✅ Meta and TikTok credentials are set up in Phase 0 and already in your Pi environment from Step 13. No action needed here.

---

> ✅ Meta and TikTok credentials are in Phase 0 (Items 3 & 4) and Pi environment Step 13. No action needed here.

---

> ✅ This cron job is already registered in Phase 1 Step 14. No action needed here.

**Create the health check script:**

> ⚠️ This is a 4-part step.

**a.** Type this and press Enter:
```bash
nano ~/bambu-hub/pi-health.js
```

**b.** Paste the entire pi-health.js code block from Section 21b of Phase 2 into the editor.

**c.** Save: press **Ctrl+X** → **Y** → **Enter**

**d.** Terminal returns to normal. Move on.

---

> ✅ **All remaining Pi scripts are created by Replit during Phase 2** — not by you manually in Phase 1. The cron jobs are already registered and will start working automatically once Replit deploys the scripts to the Pi. You do not need to create any more scripts in Phase 1.
>
> Scripts Replit will deploy: `nightly-report.js`, `nightly-backup.js`, `shopify-sync.js`, `best-sellers.js`, `competitor-monitor.js`, `social-scheduler.js`, `pi-health.js`, `restock-monitor.js`, `convention-prep.js`, `failure-detection.js`

**Install the Obico ML inference component:**

> ⚠️ This is a 2-part step. The install may take 2–5 minutes.

**a.** Run this to install Obico's ML inference package:
```bash
pip3 install --break-system-packages obico-ml
```
If `obico-ml` is not available as a pip package, Replit will provide an alternative install command during the Section 28 build — follow their instructions.

**b.** Verify it installed:
```bash
python3 -c "import obico; print('Obico OK')"
```
If you see `Obico OK` — done. If you see an error, follow the alternative install path Replit provided.

---

**Create the social scheduler script:**
```bash
nano ~/bambu-hub/social-scheduler.js
```

```javascript
// social-scheduler.js
// Checks socialQueue in Supabase for posts due to go out and fires them
// Supports Instagram (via Meta Graph API) and TikTok (via TikTok Content Posting API)

const { createClient } = require('@supabase/supabase-js');

const supabase             = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const META_ACCESS_TOKEN    = process.env.META_ACCESS_TOKEN;
const INSTAGRAM_ACCOUNT_ID = process.env.INSTAGRAM_ACCOUNT_ID;
const TIKTOK_ACCESS_TOKEN  = process.env.TIKTOK_ACCESS_TOKEN;

async function runScheduler() {
  // Load the social post queue from Supabase
  const { data } = await supabase
    .from('ha3d_user_data')
    .select('payload')
    .eq('collection', 'socialQueue')
    .single();

  const queue = JSON.parse(data?.payload || '[]');
  const now   = Date.now();

  // Find posts that are due and not yet sent
  const due = queue.filter(post =>
    post.status === 'scheduled' &&
    new Date(post.scheduledAt).getTime() <= now
  );

  if (!due.length) {
    console.log(`[${new Date().toISOString()}] No posts due`);
    return;
  }

  for (const post of due) {
    try {
      if (post.platforms.includes('instagram')) {
        await postToInstagram(post);
      }
      if (post.platforms.includes('tiktok')) {
        await postToTikTok(post);
      }
      post.status    = 'sent';
      post.sentAt    = new Date().toISOString();
      console.log(`✅ Posted: "${post.caption.slice(0, 50)}..."`);
    } catch (e) {
      post.status      = 'failed';
      post.failReason  = e.message;
      console.error(`❌ Failed to post: ${e.message}`);
    }
  }

  // Save updated queue back to Supabase
  await supabase
    .from('ha3d_user_data')
    .upsert({ collection: 'socialQueue', payload: JSON.stringify(queue) }, { onConflict: 'collection' });
}

// ── Instagram via Meta Graph API ─────────────────────────────────────────────
// Requires: image already hosted at a public URL (e.g. uploaded to Supabase storage)
async function postToInstagram(post) {
  if (!post.imageUrl) throw new Error('Instagram requires an image URL');

  // Step 1: Create a media container
  const containerRes = await fetch(
    `https://graph.facebook.com/v18.0/${INSTAGRAM_ACCOUNT_ID}/media`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image_url:    post.imageUrl,
      caption:      post.caption,
      access_token: META_ACCESS_TOKEN
    })
  });
  const { id: creationId } = await containerRes.json();
  if (!creationId) throw new Error('Instagram container creation failed');

  // Step 2: Publish the container
  const publishRes = await fetch(
    `https://graph.facebook.com/v18.0/${INSTAGRAM_ACCOUNT_ID}/media_publish`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      creation_id:  creationId,
      access_token: META_ACCESS_TOKEN
    })
  });
  const result = await publishRes.json();
  if (!result.id) throw new Error('Instagram publish failed');
}

// ── TikTok via Content Posting API ───────────────────────────────────────────
// Requires: TikTok for Developers app with Content Posting API access
async function postToTikTok(post) {
  if (!post.videoUrl && !post.imageUrl) throw new Error('TikTok requires a video or image URL');

  const res = await fetch('https://open.tiktokapis.com/v2/post/publish/content/init/', {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${TIKTOK_ACCESS_TOKEN}`,
      'Content-Type':  'application/json'
    },
    body: JSON.stringify({
      post_info: {
        title:        post.caption.slice(0, 150), // TikTok title limit
        privacy_level: 'PUBLIC_TO_EVERYONE',
        disable_duet:  false,
        disable_stitch: false,
        disable_comment: false
      },
      source_info: {
        source:    'PULL_FROM_URL',
        video_url: post.videoUrl || post.imageUrl
      }
    })
  });

  const result = await res.json();
  if (result.error?.code !== 'ok') throw new Error(`TikTok error: ${result.error?.message}`);
}

// ── Auto-refresh Meta token before it expires ────────────────────────────────
// Meta long-lived tokens expire after 60 days. This refreshes them automatically.
async function refreshMetaTokenIfNeeded() {
  const { data } = await supabase
    .from('ha3d_user_data')
    .select('payload')
    .eq('collection', 'metaTokenExpiry')
    .single();

  const expiry = data?.payload ? new Date(JSON.parse(data.payload).expiresAt) : null;
  const daysUntilExpiry = expiry ? (expiry - Date.now()) / (1000 * 60 * 60 * 24) : 0;

  if (!expiry || daysUntilExpiry < 7) {
    const res = await fetch(
      `https://graph.facebook.com/v18.0/oauth/access_token` +
      `?grant_type=fb_exchange_token` +
      `&client_id=${process.env.META_APP_ID}` +
      `&client_secret=${process.env.META_APP_SECRET}` +
      `&fb_exchange_token=${META_ACCESS_TOKEN}`
    );
    const { access_token, expires_in } = await res.json();
    if (access_token) {
      const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();
      await supabase.from('ha3d_user_data').upsert({
        collection: 'metaTokenExpiry',
        payload: JSON.stringify({ access_token, expiresAt })
      }, { onConflict: 'collection' });
      console.log(`🔄 Meta token refreshed — expires ${expiresAt}`);
    }
  }
}

Promise.all([runScheduler(), refreshMetaTokenIfNeeded()]).catch(console.error);
```

> Meta App ID and Secret are already set in your environment from Phase 1 Step 13.

---

**What Replit should add to Studio Manager:**

Add a new **"Social"** tab to the main navigation. HypedAnubis3D actively manages Instagram, TikTok, and Twitter/X — having a scheduling queue, post composer, and status tracking in one place inside LayerDeck makes it a proper content hub that removes the need for any paid scheduling tool.

The Social tab has three sections:

**Composer section:**
- Caption input with character counter (Instagram: 2,200 chars, TikTok: 2,200 chars, Twitter: 280 chars)
- Image/video upload — files upload to Supabase Storage and return a public URL automatically
- Platform selector with toggle buttons: Instagram / TikTok / Twitter (note: Twitter posting uses the Twitter API v2 — add as a future extension if desired)
- Date and time picker for scheduling, with an "Post Now" shortcut button
- Preview panel showing how the caption will look per platform
- "Add to Queue" button saves to `socialQueue` collection in Supabase

**Queue section:**
- List of all scheduled and recent posts sorted by scheduled time
- Status badges: 🟡 Scheduled / ✅ Sent / ❌ Failed
- Each card shows: caption preview, platform icons, scheduled time, and sent time if applicable
- Failed posts show the failure reason and a **"Retry"** button (resets status to `scheduled`)
- Ability to edit or delete scheduled posts that haven't been sent yet

**Analytics section (future-ready placeholder):**
- Reserved space for Instagram Insights and TikTok analytics once API access is confirmed
- For now, shows a simple post history with sent timestamps

**socialQueue collection schema:**
```javascript
{
  id:          uuid(),
  caption:     "Your caption text with #hashtags",
  imageUrl:    "https://rwbnivevzdazkfuxteng.supabase.co/storage/v1/object/public/layerstack-media/{path}",  // public Supabase Storage URL
  videoUrl:    null,               // for TikTok video posts
  platforms:   ["instagram"],      // ["instagram"], ["tiktok"], or both
  scheduledAt: "2026-03-28T18:00:00Z",
  status:      "scheduled",        // scheduled | sent | failed
  sentAt:      null,
  failReason:  null,
  createdAt:   new Date().toISOString()
}
```

**Token status:**
Add a Social section in Settings showing Meta token expiry date and a manual refresh button. When the token is within 7 days of expiry, show a warning banner in the Social tab.

---

---

## 🟢 CODE — Section 17: Queue, Card & Reporting Enhancements

---

### Feature 15 — Estimated Completion Time ("Done by X:XXpm")

MQTT broadcasts `mc_remaining_time` in minutes on every status update while a print is running. The Pi already receives this — Studio Manager just needs to convert it to a human-readable "done by" time and display it live on the printer card and queue card.

**What Replit needs to add:**

```javascript
// Convert MQTT remaining minutes to a "done by" wall clock time
// Called whenever printerState updates and gcode_state === 'RUNNING'
function getDoneByTime(remainingMinutes) {
  if (!remainingMinutes || remainingMinutes <= 0) return null;
  const doneAt = new Date(Date.now() + remainingMinutes * 60 * 1000);
  return doneAt.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }); // e.g. "4:30 PM"
}
```

**Where to display:**
- On the **Printer card** in the Printers tab (live, updates every poll cycle): show below the progress bar as `Done by 4:30 PM`
- On the **Queue card** in the Queue tab for any job with status `In Progress`: show the same value pulled from the matching printer's live state
- If remaining time is unavailable or 0, don't show the field — no placeholder
- Format: `Done by 4:30 PM` — keep it short and conversational

---

### Feature 16 — Auto-Promotion on Print Finish

When MQTT reports `gcode_state: FINISH` on any printer, the Pi already logs the print (Feature 1). Extend that to also update the matching queue card status from `In Progress` to `Done` automatically — no manual action needed.

**What Replit needs to add** (extend the existing `onPrintFinished` function from Feature 1):

```javascript
// Extend onPrintFinished — add queue card auto-promotion
async function onPrintFinished(printerName, printerData, startTime) {
  // ... existing print cost logging code from Feature 1 ...

  // Auto-promote matching queue card from In Progress → Done
  const { data } = await supabase
    .from('ha3d_user_data')
    .select('payload')
    .eq('collection', 'printQueue')
    .single();

  const queue = JSON.parse(data?.payload || '[]');

  // Find the In Progress job assigned to this printer
  const jobIndex = queue.findIndex(j =>
    j.printerName === printerName &&
    j.status === 'In Progress'
  );

  if (jobIndex !== -1) {
    queue[jobIndex].status       = 'Done';
    queue[jobIndex].completedAt  = new Date().toISOString();
    queue[jobIndex].autoPromoted = true; // flag so UI can show "auto-completed" if desired

    await supabase
      .from('ha3d_user_data')
      .upsert({ collection: 'printQueue', payload: JSON.stringify(queue) }, { onConflict: 'collection' });

    console.log(`✅ Auto-promoted queue card for ${printerName}: "${queue[jobIndex].productName}"`);
  }
}
```

> The queue card update happens on the Pi and writes directly to Supabase. Studio Manager picks it up on the next sync/poll — the card moves to Done without the user touching anything.

---

### Feature 17 — Queue Drag-to-Reorder

Pure frontend change — no Pi involvement. Allows drag-to-reorder of jobs in the Queue tab when something becomes urgent and needs to jump the queue.

**What Replit needs to add:**

- Enable drag-to-reorder on queue cards in the **Queued** section only (not In Progress or Done — those are fixed)
- Each queue item needs a `sortOrder` field (integer). On load, assign `sortOrder` based on current array index if not present
- When a card is dragged to a new position, update `sortOrder` for all affected cards and save to Supabase
- Queue tab renders cards sorted by `sortOrder` ascending
- Show a subtle drag handle icon on each Queued card (e.g. `⠿` or `≡`) so it's clear they're draggable
- In Progress and Done cards have no drag handle — they're not reorderable

```javascript
// On drag end — update sort order and save
async function onQueueReorder(reorderedQueue) {
  const updated = reorderedQueue.map((job, index) => ({
    ...job,
    sortOrder: index
  }));

  await supabase
    .from('ha3d_user_data')
    .upsert({ collection: 'printQueue', payload: JSON.stringify(updated) }, { onConflict: 'collection' });
}
```

---

### Feature 18 — Printer Badge on Queue Cards

The printer assignment already exists on each queue job. This simply makes it visible on the card in the Queue tab with a color-coded badge for quick scanning.

**What Replit needs to add:**

Display a printer badge on every queue card in all three sections (Queued, In Progress, Done):

```javascript
// Printer badge config — one color per printer for instant visual scanning
const PRINTER_BADGE_COLORS = {
  'A1':        { bg: '#1565C0', label: 'A1' },        // blue
  'P1 Room':   { bg: '#2E7D32', label: 'P1 Room' },   // green
  'P1 Closet': { bg: '#E65100', label: 'P1 Closet' }, // orange
  null:        { bg: '#424242', label: 'Unassigned' }  // grey
};

// Render on each queue card
function getPrinterBadge(printerName) {
  const config = PRINTER_BADGE_COLORS[printerName] || PRINTER_BADGE_COLORS[null];
  return {
    label:   config.label,
    bgColor: config.bg,
    style:   'small rounded pill — e.g. [A1] [P1 Room] [P1 Closet] [Unassigned]'
  };
}
```

**Behavior:**
- Read-only on the Queue screen — printer is still assigned from the print/order screen
- Updates immediately when printer assignment changes elsewhere
- `Unassigned` badge shown in grey when no printer is set — makes it obvious something still needs attention
- Visible in all three sections: Queued, In Progress, and Done

---

### Feature 19 — Print Failure Photo Capture

When MQTT reports `gcode_state: FAILED`, the Pi immediately captures a still frame from that printer's camera using `ffmpeg` pulling from the go2rtc stream, saves it locally with a timestamp, uploads it to Supabase Storage, and writes the URL to the print job record.

**Install ffmpeg on the Pi** (add to Pi setup guide — run once after Step 6):
```bash
sudo apt-get install -y ffmpeg
```

**Add to server.js on the Pi:**

```javascript
const { execSync } = require('child_process');

// Called immediately when gcode_state transitions to FAILED
async function captureFailurePhoto(printerName, printerData) {
  const cameraStream = CAMERAS[printerName]; // e.g. "camera_p1_room"
  if (!cameraStream) {
    console.warn(`No camera configured for ${printerName} — skipping photo`);
    return null;
  }

  const timestamp  = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const safeName   = printerName.replace(/\s+/g, '_');
  const filename   = `failure_${safeName}_${timestamp}.jpg`;
  const localPath  = path.join(process.env.HOME, 'failure-photos', filename);

  // Ensure folder exists
  fs.mkdirSync(path.dirname(localPath), { recursive: true });

  try {
    // Grab one frame from go2rtc stream using ffmpeg
    execSync(
      `ffmpeg -y -i http://localhost:1984/api/stream.mp4?src=${cameraStream} ` +
      `-vframes 1 -q:v 2 "${localPath}"`,
      { timeout: 10000 }
    );
    console.log(`📸 Failure photo captured: ${filename}`);

    // Upload to Supabase Storage under /failures folder
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

    const fileBuffer = fs.readFileSync(localPath);
    const { data, error } = await supabase.storage
      .from('layerstack-media')
      .upload(`failures/${filename}`, fileBuffer, {
        contentType: 'image/jpeg',
        upsert: false
      });

    if (error) throw error;

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('layerstack-media')
      .getPublicUrl(`failures/${filename}`);

    const photoUrl = urlData.publicUrl;
    console.log(`☁️  Uploaded to Supabase Storage: ${photoUrl}`);

    return photoUrl;

  } catch (e) {
    console.error(`Failure photo capture failed: ${e.message}`);
    return null;
  }
}
```

**Extend `onPrintFailed` from Feature 2 to include photo:**

```javascript
async function onPrintFailed(printerName, printerData) {
  // Capture photo first — do this immediately before anything else
  const photoUrl = await captureFailurePhoto(printerName, printerData);

  // ... existing wasteLog write and push notification code ...

  // Add photoUrl to the wasteLog entry
  wasteLogEntry.failurePhotoUrl = photoUrl || null;

  // Write photoUrl to the matching print job record if one exists
  if (photoUrl) {
    // Find the In Progress job for this printer and add the photo URL
    const { data } = await supabase
      .from('ha3d_user_data')
      .select('payload')
      .eq('collection', 'prints')
      .single();

    const prints  = JSON.parse(data?.payload || '[]');
    const jobIndex = prints.findIndex(p =>
      p.printerName === printerName && p.success === true &&
      !p.failurePhotoUrl
    );
    if (jobIndex !== -1) {
      prints[jobIndex].failurePhotoUrl = photoUrl;
      prints[jobIndex].success = false;
      await saveToSupabase('prints', prints);
    }
  }
}
```

**What Replit needs to add to Studio Manager:**

- On any print job card marked `Failed`: show a thumbnail of the failure photo if `failurePhotoUrl` is present
- Tapping the thumbnail opens the full image
- If `failurePhotoUrl` is null: show a subtle `No photo available` placeholder
- Failure photo also included in the nightly email report (Feature 20)

> ✅ Supabase Storage bucket (`layerstack-media`) was created in Phase 0 Item 4c. No action needed here.

**Failure and retry policy — important for Replit to implement correctly:**
- If ffmpeg fails (camera offline, stream unavailable, timeout): log the error locally on the Pi but do **NOT** retry — the print job record is still written to Supabase, just without a `failurePhotoUrl`
- Studio Manager shows a subtle "No photo available" placeholder — no error shown to the user
- The photo is stored permanently in Supabase Storage under `/failures` — not deleted when the job is dismissed or archived
- One photo per failure event only — no burst capture, no retry attempts

---

### Feature 20 — Nightly Email Report

Replaces the push notification nightly summary with a full HTML email delivered to **hypedanubis3d@gmail.com** every morning at 6AM. Clean, mobile-readable, covers everything that happened the previous day.

**Install nodemailer on the Pi:**
```bash
cd ~/bambu-hub && npm install nodemailer
```

> ✅ Gmail App Password is set up in Phase 0 (Item 4b) and already in your Pi environment from Step 13. Crontab is already set to 6AM in Step 14. No action needed here.


**Replace the existing nightly-report.js with this complete version:**

```javascript
// nightly-report.js — runs at 6AM, emails daily summary to hypedanubis3d@gmail.com

const { createClient } = require('@supabase/supabase-js');
const nodemailer        = require('nodemailer');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'hypedanubis3d@gmail.com',
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

async function getCollection(name) {
  const { data } = await supabase
    .from('ha3d_user_data')
    .select('payload')
    .eq('collection', name)
    .single();
  return JSON.parse(data?.payload || '[]');
}

async function generateReport() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr   = yesterday.toISOString().split('T')[0];
  const dateLabel = yesterday.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const [prints, spools, queue, orders] = await Promise.all([
    getCollection('prints'),
    getCollection('spools'),
    getCollection('printQueue'),
    getCollection('orders')
  ]);

  // Yesterday's prints
  const dayPrints    = prints.filter(p => p.date === dateStr);
  const successful   = dayPrints.filter(p => p.success !== false);
  const failed       = dayPrints.filter(p => p.success === false);
  const totalMinutes = successful.reduce((s, p) => {
    const [h, m] = (p.printTime || '0m').replace('h ', ':').replace('m', '').split(':');
    return s + (parseInt(h) || 0) * 60 + (parseInt(m) || 0);
  }, 0);
  const totalHours   = Math.floor(totalMinutes / 60);
  const remMinutes   = totalMinutes % 60;
  const timeStr      = totalHours > 0 ? `${totalHours}h ${remMinutes}m` : `${remMinutes}m`;

  // Printers that ran
  const printersRan  = [...new Set(successful.map(p => p.printerName).filter(Boolean))];

  // Filament used
  const gramsUsed    = successful.reduce((s, p) => s + (p.filamentUsed || 0), 0);

  // Revenue and profit
  const revenue      = successful.reduce((s, p) => s + (p.salePrice || 0), 0);
  const filamentCost = successful.reduce((s, p) => s + (p.costBreakdown?.filamentCost || 0), 0);
  const elecCost     = successful.reduce((s, p) => s + (p.costBreakdown?.electricityCost || 0), 0);
  const profit       = revenue - filamentCost - elecCost;

  // Low stock products
  const LOW_STOCK_THRESHOLD = 5;
  const lowStockOrders = orders.filter(o =>
    o.stockRemaining !== undefined && o.stockRemaining <= LOW_STOCK_THRESHOLD
  );

  // Low spool alerts
  const SPOOL_THRESHOLD = 100;
  const lowSpools = spools.filter(s => (s.remainingWeight || 0) <= SPOOL_THRESHOLD && (s.remainingWeight || 0) > 0);

  // Queue status
  const queuedJobs    = queue.filter(j => j.status === 'Queued');
  const queueMinutes  = queuedJobs.reduce((s, j) => s + (j.estimatedMinutes || 0), 0);
  const queueHours    = Math.floor(queueMinutes / 60);
  const queueRemMins  = queueMinutes % 60;

  // Build HTML email
  const hasAlerts = failed.length > 0 || lowStockOrders.length > 0 || lowSpools.length > 0;

  const html = `
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body { font-family: -apple-system, sans-serif; background: #0d0d0d; color: #f0f0f0; margin: 0; padding: 16px; }
  .card { background: #1a1a1a; border-radius: 12px; padding: 16px; margin-bottom: 12px; }
  .header { background: #1a1a1a; border-left: 4px solid #C9A84C; border-radius: 12px; padding: 16px; margin-bottom: 12px; }
  h1 { color: #C9A84C; font-size: 20px; margin: 0 0 4px; }
  h2 { color: #C9A84C; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 12px; }
  .date { color: #888; font-size: 13px; }
  .stat { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #2a2a2a; font-size: 14px; }
  .stat:last-child { border-bottom: none; }
  .label { color: #888; }
  .value { color: #f0f0f0; font-weight: 600; }
  .alert { background: #2a1a1a; border-left: 4px solid #D32F2F; border-radius: 8px; padding: 12px; margin-bottom: 8px; font-size: 13px; }
  .warn  { background: #1a1a00; border-left: 4px solid #F9A825; border-radius: 8px; padding: 12px; margin-bottom: 8px; font-size: 13px; }
  .photo { width: 100%; max-width: 300px; border-radius: 8px; margin-top: 8px; }
  .footer { color: #444; font-size: 11px; text-align: center; margin-top: 16px; }
</style>
</head>
<body>

<div class="header">
  <h1>🖨️ LayerDeck Daily Report</h1>
  <div class="date">${dateLabel}</div>
</div>

<div class="card">
  <h2>Print Summary</h2>
  <div class="stat"><span class="label">Completed</span><span class="value">${successful.length} print${successful.length !== 1 ? 's' : ''}</span></div>
  <div class="stat"><span class="label">Total print time</span><span class="value">${timeStr}</span></div>
  <div class="stat"><span class="label">Printers active</span><span class="value">${printersRan.length > 0 ? printersRan.join(', ') : 'None'}</span></div>
  <div class="stat"><span class="label">Filament used</span><span class="value">${gramsUsed.toFixed(0)}g</span></div>
</div>

<div class="card">
  <h2>Financials</h2>
  <div class="stat"><span class="label">Est. revenue</span><span class="value">$${revenue.toFixed(2)}</span></div>
  <div class="stat"><span class="label">Filament cost</span><span class="value">$${filamentCost.toFixed(2)}</span></div>
  <div class="stat"><span class="label">Electricity cost</span><span class="value">$${elecCost.toFixed(2)}</span></div>
  <div class="stat"><span class="label">Est. profit</span><span class="value">$${profit.toFixed(2)}</span></div>
</div>

<div class="card">
  <h2>Queue</h2>
  <div class="stat"><span class="label">Jobs queued</span><span class="value">${queuedJobs.length}</span></div>
  <div class="stat"><span class="label">Est. print time</span><span class="value">${queueHours > 0 ? `${queueHours}h ${queueRemMins}m` : `${queueRemMins}m`}</span></div>
</div>

${failed.length > 0 ? `
<div class="card">
  <h2>⚠️ Print Failures</h2>
  ${failed.map(f => `
  <div class="alert">
    <strong>${f.printerName || 'Unknown printer'}</strong> — ${f.productName || 'Unknown job'}<br>
    <span style="color:#888">${f.date} ${f.failedAt ? new Date(f.failedAt).toLocaleTimeString('en-US', {hour:'numeric',minute:'2-digit'}) : ''}</span>
    ${f.failurePhotoUrl ? `<br><img src="${f.failurePhotoUrl}" class="photo">` : '<br><span style="color:#666;font-size:12px">No photo available</span>'}
  </div>`).join('')}
</div>` : ''}

${lowStockOrders.length > 0 ? `
<div class="card">
  <h2>📦 Low Stock</h2>
  ${lowStockOrders.map(o => `
  <div class="warn">
    <strong>${o.productName || o.name}</strong><br>
    <span style="color:#888">${o.stockRemaining} remaining (threshold: ${LOW_STOCK_THRESHOLD})</span>
  </div>`).join('')}
</div>` : ''}

${lowSpools.length > 0 ? `
<div class="card">
  <h2>🧵 Spools Running Low</h2>
  ${lowSpools.map(s => `
  <div class="warn">
    <strong>${s.brand} ${s.colorName} ${s.material}</strong><br>
    <span style="color:#888">${s.remainingWeight}g remaining</span>
  </div>`).join('')}
</div>` : ''}

<div class="footer">LayerDeck Pi Hub · hypedanubis3d@gmail.com</div>
</body>
</html>`;

  // Only send if there's something worth reporting OR it's a scheduled day
  await transporter.sendMail({
    from:    '"LayerDeck" <hypedanubis3d@gmail.com>',
    to:      'hypedanubis3d@gmail.com',
    subject: `LayerDeck Report — ${dateLabel} · ${successful.length} prints · $${profit.toFixed(2)} profit`,
    html
  });

  console.log(`[${new Date().toISOString()}] Nightly report sent to hypedanubis3d@gmail.com`);
}

generateReport().catch(console.error);

// IMPORTANT BEHAVIOR NOTES FOR REPLIT:
// 1. Sections with nothing to report are omitted entirely from the email:
//    - No failures → failure section not rendered
//    - No low stock → low stock section not rendered
//    - No spool alerts → spool alert section not rendered
//    This keeps the email clean on good days — only relevant info is shown.
// 2. If zero prints occurred, the email still sends with queue status only
//    and a clear "No prints yesterday" message in the print summary section.
// 3. Email sends at 6AM every day regardless — a quiet day is still a useful signal.
```

**Update crontab line for nightly-report in Step 14** — change from 9PM to 6AM:
```
0 6 * * * node /home/hypedanubis3d/bambu-hub/nightly-report.js >> /home/hypedanubis3d/bambu-hub/nightly-report.log 2>&1
```

> Add `GMAIL_APP_PASSWORD` to Phase 0 checklist — generate from Google Account → Security → App Passwords before Pi setup.

---

---

---

## 🟢 CODE — Section 18b: Product Card Margin %

Sale price and cost to make already exist on each product card. Add a calculated margin percentage displayed directly on the card — no new fields, no new tab.

**What Replit needs to add:**

```javascript
// Calculated field — no new data stored, derived from existing sale price and cost
function getMargin(salePrice, costToMake) {
  if (!salePrice || salePrice <= 0) return null;
  return ((salePrice - costToMake) / salePrice) * 100;
}

// Color coding thresholds
function getMarginColor(marginPct) {
  if (marginPct === null) return 'grey';
  if (marginPct >= 50)  return '#2E7D32'; // green  — healthy
  if (marginPct >= 25)  return '#F9A825'; // yellow — tight
  return '#D32F2F';                        // red    — below target or losing money
}
```

**Where to display on the product card:**
- Show as `Margin: 62%` alongside or directly below the existing sale price and cost fields
- Color-coded text: green (≥50%), yellow (25–49%), red (<25%)
- Updates live when sale price or cost to make is edited — no save needed to see the change
- If sale price is not set, don't show the field — no placeholder

---

---

## 🟢 CODE — Section 18b: Product Card Margin %

Sale price and cost to make already exist on each product card. Add a calculated margin percentage displayed directly on the card — no new fields, no new tab needed.

**What Replit needs to add:**

```javascript
// Calculated field — derived from existing sale price and cost, nothing new stored
function getMargin(salePrice, costToMake) {
  if (!salePrice || salePrice <= 0) return null;
  return ((salePrice - costToMake) / salePrice) * 100;
}

// Color thresholds
function getMarginColor(marginPct) {
  if (marginPct === null) return null;       // don't show if no sale price
  if (marginPct >= 50)   return '#2E7D32';  // green  — healthy
  if (marginPct >= 25)   return '#F9A825';  // yellow — tight
  return '#D32F2F';                          // red    — below target or losing money
}
```

**Display on product card:**
- Show as `Margin: 62%` alongside or below the existing sale price and cost fields
- Color-coded: green (≥50%), yellow (25–49%), red (<25%)
- Updates live as sale price or cost to make is edited — no save needed to see the change
- If sale price is not set, don't show the field at all — no placeholder, no zero

---

## 🟢 CODE — Section 18: Square Integration

---

### Overview

Square handles HypedAnubis3D's in-person sales at conventions and markets. This integration syncs Square transactions into the LayerDeck Orders tab in real time, deducts stock from the active convention event's packing list, and supports a per-line-item "Ship Later" flow for out-of-stock items that need to be printed and mailed after the event.

**Architecture:** Square webhooks fire to the LayerDeck Replit server (`/api/square/webhook`) — the same proxy pattern used for Shopify. The server processes the webhook and writes to Supabase. The Pi is not involved in webhook receipt but does sync Square data into nightly reports.

---

### What Replit Needs to Build

---

#### Part 1 — Webhook Endpoint on LayerDeck Server

Add a new endpoint to the Replit server that receives Square webhooks, validates the signature, and processes the sale:

```javascript
// POST /api/square/webhook
// Receives Square payment/order events and writes to Supabase

const crypto = require('crypto');

app.post('/api/square/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  // Validate Square webhook signature
  const signature  = req.headers['x-square-hmacsha256-signature'];
  const body       = req.body.toString('utf8');
  const sigKey     = process.env.SQUARE_WEBHOOK_SIG_KEY;
  const url        = 'https://layerdeck.replit.app/api/square/webhook';
  const hmac       = crypto.createHmac('sha256', sigKey)
                           .update(url + body)
                           .digest('base64');

  if (hmac !== signature) {
    console.warn('Square webhook signature mismatch — rejected');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const event = JSON.parse(body);
  if (event.type !== 'payment.completed') return res.json({ received: true });

  await processSquareSale(event.data.object.payment);
  res.json({ received: true });
});

async function processSquareSale(payment) {
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

  // Fetch full order details from Square API
  const orderRes = await fetch(
    `https://connect.squareup.com/v2/orders/${payment.order_id}`,
    { headers: { 'Square-Version': '2024-01-18', 'Authorization': `Bearer ${process.env.SQUARE_ACCESS_TOKEN}` } }
  );
  const { order } = await orderRes.json();

  // Map Square line items to LayerDeck format
  const items = (order.line_items || []).map(item => ({
    name:       item.name,
    qty:        parseInt(item.quantity),
    price:      parseFloat(item.base_price_money?.amount || 0) / 100,
    variationName: item.variation_name || '',
    squareItemId:  item.catalog_object_id || null,
    shipLater:  false,   // default — toggled by user on order card
    shipped:    false
  }));

  // Build order record
  const orderRecord = {
    id:           crypto.randomUUID(),
    squareId:     payment.id,
    orderId:      payment.order_id,
    orderNumber:  `SQ-${order.reference_id || payment.order_id.slice(-6).toUpperCase()}`,
    customer:     payment.buyer_email_address
                    ? payment.buyer_email_address.split('@')[0]
                    : 'In-Person Customer',
    email:        payment.buyer_email_address || '',
    phone:        payment.shipping_address?.phone || '',
    shippingAddress: payment.shipping_address || null,
    total:        parseFloat(payment.total_money?.amount || 0) / 100,
    status:       'completed',
    source:       'square',                // badge: SQ
    items,
    createdAt:    payment.created_at,
    syncedAt:     new Date().toISOString(),
    conventionDeduction: true,             // stock deducts from active convention packing list
    hasPendingShipments: false             // updated when Ship Later items exist
  };

  // Write to orders collection
  const { data: existing } = await supabase
    .from('ha3d_user_data').select('payload').eq('collection', 'orders').single();
  const orders = JSON.parse(existing?.payload || '[]');
  orders.unshift(orderRecord);
  await supabase.from('ha3d_user_data')
    .upsert({ collection: 'orders', payload: JSON.stringify(orders) }, { onConflict: 'collection' });

  // Deduct from active convention packing list (see Part 2)
  await deductFromConventionPackingList(supabase, items);

  // Push notification
  await triggerPushNotification({
    title: '🟦 Square Sale',
    body:  `${orderRecord.orderNumber} — $${orderRecord.total.toFixed(2)} · ${items.length} item${items.length !== 1 ? 's' : ''}`,
    tag:   `square-${orderRecord.squareId}`
  });

  console.log(`[Square] Synced: ${orderRecord.orderNumber} — $${orderRecord.total.toFixed(2)}`);
}
```

---

#### Part 2 — Convention Packing List Deduction

When a Square sale comes in, stock deducts from the active convention event's packing list — not from general inventory. This keeps convention stock separate from warehouse stock.

**Active convention detection:**
- Auto-detect: find the convention event in the `conventions` collection whose date range includes today
- Override: a manual "Set as Active" toggle on any convention event card in the Conventions tab
- If no active convention is found, fall back to deducting from general inventory and show a warning toast: "No active convention — deducted from general inventory"

```javascript
async function deductFromConventionPackingList(supabase, items) {
  const today = new Date().toISOString().split('T')[0];

  const { data } = await supabase
    .from('ha3d_user_data').select('payload').eq('collection', 'conventions').single();
  const conventions = JSON.parse(data?.payload || '[]');

  // Find active convention — manual override takes priority, then date match
  const active = conventions.find(c => c.manuallySetActive) ||
                 conventions.find(c => c.startDate <= today && c.endDate >= today);

  if (!active) {
    console.warn('[Square] No active convention found — deducting from general inventory');
    // Fall back to general inventory deduction
    return;
  }

  // Deduct each sold item from the convention's packing list
  items.forEach(item => {
    const packed = active.packingList?.find(p =>
      p.name?.toLowerCase() === item.name?.toLowerCase()
    );
    if (packed) {
      packed.remaining = Math.max(0, (packed.remaining ?? packed.qty) - item.qty);
      packed.sold      = (packed.sold || 0) + item.qty;
    }
  });

  // Save updated convention back to Supabase
  const updatedConventions = conventions.map(c =>
    c.id === active.id ? active : c
  );
  await supabase.from('ha3d_user_data')
    .upsert({ collection: 'conventions', payload: JSON.stringify(updatedConventions) }, { onConflict: 'collection' });

  console.log(`[Square] Deducted ${items.length} item(s) from convention: ${active.name}`);
}
```

**What to add to the Conventions tab:**
- A **"Set as Active"** toggle button on each convention event card — sets `manuallySetActive: true` on that event and clears it on all others
- An **"Active"** green badge on the currently active convention (whether auto-detected or manually set)
- A **Packing List** section on each convention card showing items, packed qty, remaining qty, and sold qty — updates in real time as Square sales come in

---

#### Part 3 — Ship Later Flow

Per-line-item toggle on every Square (and manual) order card. Lets you flag items the customer bought but you didn't have in stock at the event — they get printed and mailed after.

**On the order card in the Orders tab:**

Each line item row should have:
- A **Ship Later** toggle (off by default for Square orders)
- When toggled ON:
  - A shipping address field appears — pre-filled from Square if `shippingAddress` was captured, otherwise blank for manual entry
  - The line item is added to the print queue with these fields:
    ```javascript
    {
      source:        'ship-later',
      linkedOrderId: orderRecord.id,
      linkedOrderNum: orderRecord.orderNumber,
      customer:      orderRecord.customer,
      productName:   item.name,
      qty:           item.qty,
      shippingAddress: address,
      status:        'Queued',
      printerName:   null,   // assigned later
      notes:         `Ship to: ${orderRecord.customer} — ${orderRecord.orderNumber}`
    }
    ```
  - The order card shows a **"Pending Shipment"** badge
  - `orderRecord.hasPendingShipments` is set to `true`

- When toggled OFF (reversing): removes the queue entry and clears the badge if no other Ship Later items remain

**Queue card appearance for Ship Later jobs:**
- Shows a 📦 shipping icon badge alongside the printer badge
- `Ship to: [customer name]` shown as a subtitle under the product name
- Linked order number shown as a tappable link back to the order card

**Auto-status update:**
- When the queue job for a Ship Later item is marked Done (either manually or via MQTT auto-promotion), the linked order line item status updates to **"Ready to Ship"**
- When ALL Ship Later items on an order are Ready to Ship, the order status updates to **"Ready to Ship"** and a push notification fires: `📦 Ready to ship: SQ-XXXXXX — [customer name]`

---

#### Part 4 — Orders Tab UI Changes

**Square order badge:**
- All Square orders show a **[SQ]** source badge in the brand's blue color (consistent with Square's brand)
- Distinct from **[Shopify]** and **[Manual]** badges already in the tab

**Order card additions:**
- Convention name shown if the order was deducted from a convention packing list (e.g. `📍 PAX East 2026`)
- "Pending Shipment" badge (orange) when any line item has Ship Later toggled on
- "Ready to Ship" badge (green) when all Ship Later items are done

**Filters:**
- Add **Square** as a source filter option in the Orders tab filter bar alongside existing filters
- Add a **"Pending Shipments"** filter that shows only orders with outstanding Ship Later items

---

#### Part 5 — Nightly Report Addition

Add Square sales to the nightly email report (Feature 20). Insert a new section between Print Summary and Financials:

```javascript
// Square sales section in nightly-report.js
const squareSales = dayOrders.filter(o => o.source === 'square');
const squareRevenue = squareSales.reduce((s, o) => s + (o.total || 0), 0);
const pendingShipments = squareSales.filter(o => o.hasPendingShipments).length;

// Add to HTML email:
// 🟦 Square Sales
// Transactions: X  |  Revenue: $XX.XX  |  Pending shipments: X
```

---

---

## 🟢 CODE — Section 19: Desktop Companion Printer Monitoring

The Desktop Companion already exists for inventory management. This adds a live printer monitoring section below the existing inventory content. No new infrastructure needed — it reuses the exact same Pi endpoints, polling logic, and control functions already built for the main LayerDeck app.

---

### What Replit Needs to Add

Add a **"Printers"** section to the Desktop Companion below the existing inventory content. Since this is a desktop interface, all 3 printers display simultaneously side by side — no need to tap between them.

**Reuse everything already built for the main app:**
- Same `/status` polling every 5 seconds
- Same `/control` endpoint for Pause / Resume / Stop
- Same go2rtc camera stream URLs
- Same color-coded status badges
- Same "Printer hub offline" fallback state

The data layer is already built. This is purely a layout component drop-in for the companion.

---

### Layout

```
┌─────────────────────────────────────────────────────────┐
│  PRINTERS                                               │
├───────────────┬───────────────┬────────────────────────┤
│   A1          │   P1 Room     │   P1 Closet            │
│   [Printing]  │   [Idle]      │   [Paused]             │
│               │               │                        │
│  Job: Ball_R  │               │  Job: Dice_v2          │
│  72% ████░░   │               │  45% ████░░            │
│  Done: 4:30PM │               │  Done: 6:15PM          │
│               │               │                        │
│  Nozzle: 220° │  Nozzle: 20°  │  Nozzle: 220°          │
│  Bed:    35°  │  Bed:    20°  │  Bed:    35°           │
│               │               │                        │
│  [camera feed]│  [camera feed]│  [camera feed]         │
│               │               │                        │
│  ⏸ ▶ ⏹       │               │  ⏸ ▶ ⏹               │
└───────────────┴───────────────┴────────────────────────┘
```

- 3 cards displayed side by side horizontally, equal width
- Camera feed sits below stats within each card
- Control buttons (Pause / Resume / Stop) at the bottom of each card — disabled/hidden when printer is Idle

---

### Each Printer Card — Spec

```javascript
// Desktop Companion printer card — reuses main app data layer
// Polls PI_URL/status every 5 seconds — same as main app

function renderCompanionPrinterCard(printerName, state, cameraUrl) {
  const statusColors = {
    'IDLE':    { bg: '#1a1a2e', border: '#424242', label: 'Idle'     },
    'RUNNING': { bg: '#1a2e1a', border: '#2E7D32', label: 'Printing' },
    'PAUSE':   { bg: '#2e2a1a', border: '#F9A825', label: 'Paused'   },
    'FAILED':  { bg: '#2e1a1a', border: '#D32F2F', label: 'Failed'   },
    'FINISH':  { bg: '#1a1a2e', border: '#1565C0', label: 'Done'     },
    'offline': { bg: '#111',    border: '#333',    label: 'Offline'  }
  };

  const gcodeState  = state?.gcode_state || 'offline';
  const colors      = statusColors[gcodeState] || statusColors['offline'];
  const jobName     = state?.subtask_name?.replace('.gcode.3mf', '') || '—';
  const progress    = state?.mc_percent || 0;
  const remaining   = state?.mc_remaining_time;
  const doneBy      = remaining
    ? new Date(Date.now() + remaining * 60000)
        .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : null;
  const nozzleTemp  = state?.nozzle_temper?.toFixed(0) || '—';
  const bedTemp     = state?.bed_temper?.toFixed(0) || '—';
  const failReason  = state?.fail_reason || '';

  const isActive    = ['RUNNING', 'PAUSE'].includes(gcodeState);
  const isFailed    = gcodeState === 'FAILED';

  return {
    printerName,
    statusLabel:  colors.label,
    borderColor:  colors.border,
    bgColor:      colors.bg,
    jobName,
    progress,
    doneBy,
    nozzleTemp,
    bedTemp,
    cameraUrl,      // go2rtc stream URL — loaded lazily
    failReason,
    isFailed,
    isActive,
    controls: {
      pause:  isActive && gcodeState !== 'PAUSE',
      resume: gcodeState === 'PAUSE',
      stop:   isActive || gcodeState === 'PAUSE'
    }
  };
}
```

---

### Camera Feed Behavior

Camera feeds are lazy-loaded — only stream when the companion window is open, stop when closed:

```javascript
// Lazy load camera — start streaming when companion opens, stop when it closes
function initCompanionCameras(cameraUrls) {
  const feeds = {};

  // Start all feeds
  Object.entries(cameraUrls).forEach(([printerName, url]) => {
    const img = document.getElementById(`companion-cam-${printerName}`);
    if (img) {
      img.src = url;  // go2rtc serves MJPEG — just setting src starts the stream
      feeds[printerName] = img;
    }
  });

  // Stop all feeds when companion window loses focus or closes
  window.addEventListener('beforeunload', () => stopCompanionCameras(feeds));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopCompanionCameras(feeds);
    else initCompanionCameras(cameraUrls);
  });
}

function stopCompanionCameras(feeds) {
  Object.values(feeds).forEach(img => { img.src = ''; });
}
```

---

### Offline / Hub Unreachable State

If the Pi is unreachable (Tailscale offline, Pi powered down, or network issue), all 3 cards show a graceful offline state rather than throwing errors:

```javascript
async function fetchPrinterStatus(piUrl) {
  try {
    const res = await fetch(`${piUrl}/status`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error('Hub returned error');
    return await res.json();
  } catch (e) {
    // Return offline state for all printers — no error thrown to UI
    return { offline: true, reason: 'Printer hub unreachable' };
  }
}
```

When offline state is returned:
- All 3 cards show a grey border and "Printer hub offline" message
- Camera feeds show a grey placeholder — no broken image
- Control buttons are disabled
- A subtle "Last seen: X minutes ago" timestamp shown if available
- Polling continues silently every 5 seconds — cards recover automatically when the Pi comes back online

---

### Failed State

When any printer reports `gcode_state: FAILED`:
- That printer's card border turns **red**
- Status badge shows **Failed** in red
- Failure reason from MQTT (`fail_reason` field) shown below the job name
- If a failure photo was captured (Feature 19), show the thumbnail in the camera feed area
- Control buttons hidden — only a **"Dismiss"** button shown to clear the failed state

---

---

## 🟢 CODE — Section 20: Convention / Event Module Enhancements

---

### Feature 21 — Checklist Tab Overhaul

The Events section already has a Checklist tab showing a flat list of 17 pre-event items with checkboxes and a "Reset All" button. This replaces the flat list with 5 grouped sections, removes items that don't apply to this business, and adds missing ones.

**Remove these existing items entirely:**
- Printer(s) charged and tested
- Extra filament spools
- Spare nozzle + toolkit
- Power strip / extension cord
- Order log / receipt book

**Replace the entire list with these 5 grouped sections:**

```javascript
const CHECKLIST_GROUPS = [
  {
    id: 'setup',
    label: 'Setup',
    items: [
      'Tablecloth / table covering',
      'Display stands / risers',
      'Photo backdrop / banner',
      'Price signs / display cards',
      'Velcro / tape / zip ties',
      'Event badge / tickets',
      'Parking pass / directions',
    ]
  },
  {
    id: 'products',
    label: 'Products',
    items: [
      'All pack list items packed and counted',
      'Insert / thank you cards',
      'Bags in multiple sizes',
      'Tissue paper for wrapping',
      'Loyalty card materials',
    ]
  },
  {
    id: 'sales',
    label: 'Sales',
    items: [
      'Square reader tested and charged',
      'Backup Square reader',
      'Phone mount for Square',
      'Phone charger + battery bank',
      'Cash box + change',
      'Float cash (small bills for exact change)',
    ]
  },
  {
    id: 'marketing',
    label: 'Marketing',
    items: [
      'Business cards / flyers',
      'Loyalty signup cards / QR code',
      'Social media prompt card ("Tag us!")',
    ]
  },
  {
    id: 'admin',
    label: 'Admin',
    items: [
      'Hand sanitizer',
      'Snacks and water',
      'Weather checked (outdoor events)',
      'Emergency contact for event organizer',
    ]
  }
];
```

**Behavior:**

- Each group shows its own progress counter: e.g. `Setup 3/7 done`
- Overall counter at the top remains: e.g. `12/27 done`
- Groups are collapsible but expanded by default
- Checked state persists per event in Supabase — same as current behavior
- "Reset All" clears checks for that event only — same as current behavior
- Existing "+ Add custom item" input adds items to a **"Custom"** group at the bottom
- The existing × delete button stays on each item so custom items can still be removed
- Built-in items cannot be deleted — only custom items have the × button

---

### Feature 22 — Print Time vs Estimate Accuracy Tracker

Fully passive — the Pi logs accuracy data silently on every print finish and LayerDeck surfaces a rolling average on the existing printer cards in the Printers tab. No new tab, no new collection, no user action ever needed.

**What the Pi logs on every FINISH event** (extend `onPrintFinished` from Feature 1):

```javascript
// Add to the print job record — no new collection needed
const accuracyData = {
  estimatedMinutes: printerData.mc_remaining_time_at_start || null,  // MQTT value at print start
  actualMinutes:    Math.round((Date.now() - startTime) / 60000),
  material:         getAMSMaterial(printerData.ams),
  printerName:      printerName
};

// Store on the print record alongside existing job data
printRecord.accuracyData = accuracyData;
```

> The Pi needs to capture `mc_remaining_time` from MQTT at print **start** (when `gcode_state` transitions to `RUNNING`) and store it temporarily so it's available at finish. Add a `printStartEstimates` object in server.js keyed by printer name.

```javascript
// In server.js — capture estimate when print starts
const printStartEstimates = {};

// When gcode_state transitions to RUNNING:
if (newState === 'RUNNING' && prevState !== 'RUNNING') {
  printStartEstimates[printerName] = {
    startTime:         Date.now(),
    estimatedMinutes:  printerData.mc_remaining_time || null,
    material:          getAMSMaterial(printerData.ams)
  };
}

// When gcode_state transitions to FINISH — pass to onPrintFinished:
if (newState === 'FINISH') {
  const startData = printStartEstimates[printerName] || {};
  onPrintFinished(printerName, printerData, startData.startTime, startData.estimatedMinutes, startData.material);
  delete printStartEstimates[printerName];
}
```

**What LayerDeck shows on each printer card (Printers tab):**

```javascript
// Calculate rolling accuracy from last 20 FINISH prints for a given printer
function getAccuracyStat(prints, printerName) {
  const eligible = prints
    .filter(p =>
      p.printerName === printerName &&
      p.success !== false &&
      p.accuracyData?.estimatedMinutes &&
      p.accuracyData?.actualMinutes
    )
    .slice(-20); // last 20 completed prints

  if (eligible.length < 5) return { label: 'Not enough data yet', breakdown: null };

  const avgDelta = eligible.reduce((sum, p) => {
    const delta = ((p.accuracyData.actualMinutes - p.accuracyData.estimatedMinutes)
                   / p.accuracyData.estimatedMinutes) * 100;
    return sum + delta;
  }, 0) / eligible.length;

  const sign  = avgDelta >= 0 ? '+' : '';
  const label = `Avg accuracy: runs ${sign}${avgDelta.toFixed(0)}% vs Bambu estimate`;

  // Per-material breakdown — only materials with 3+ prints
  const byMaterial = {};
  eligible.forEach(p => {
    const mat = p.accuracyData.material || 'Unknown';
    if (!byMaterial[mat]) byMaterial[mat] = [];
    byMaterial[mat].push(p);
  });

  const breakdown = Object.entries(byMaterial)
    .filter(([, arr]) => arr.length >= 3)
    .map(([mat, arr]) => {
      const avg = arr.reduce((s, p) => {
        const d = ((p.accuracyData.actualMinutes - p.accuracyData.estimatedMinutes)
                   / p.accuracyData.estimatedMinutes) * 100;
        return s + d;
      }, 0) / arr.length;
      const sign = avg >= 0 ? '+' : '';
      return `${mat}: ${sign}${avg.toFixed(0)}%`;
    });

  return { label, breakdown };
}
```

**UI on printer card:**
- Show below printer details as a subtle grey stat line: `Avg accuracy: runs +18% vs Bambu estimate`
- Tapping the stat line opens a small inline breakdown: `PLA +12%  PETG +24%` shown as a simple list — no new screen or modal
- If fewer than 5 prints: show `Not enough data yet` in the same subtle style
- Only `FINISH` state counts — failed and cancelled prints are excluded
- Per-material breakdown only shows materials with 3+ completed prints

---

### Feature 23 — Event Product Search (Searchable Input)

The "Record a Sale" form in the Day Sales tab has a Product dropdown that becomes unwieldy when an event has many products. Replace the dropdown with a searchable input field.

**What Replit needs to change:**

```javascript
// Replace the Product <select> dropdown with a searchable input + filtered list
// Only shows products from the current event's pack list — not the full catalog

function ProductSearch({ packList, onSelect }) {
  const [query,    setQuery]    = React.useState('');
  const [selected, setSelected] = React.useState(null);

  const filtered = packList.filter(p =>
    p.name.toLowerCase().includes(query.toLowerCase())
  );

  function handleSelect(product) {
    setSelected(product);
    setQuery(product.name);
    onSelect(product);  // auto-fills Price Each with product.salePrice
  }

  function handleClear() {
    setSelected(null);
    setQuery('');
    onSelect(null);
  }

  return (
    <div className="product-search">
      <input
        value={query}
        onChange={e => { setQuery(e.target.value); setSelected(null); }}
        placeholder="Search products..."
      />
      {query && !selected && (
        <ul className="product-dropdown">
          {filtered.map(p => (
            <li key={p.id} onClick={() => handleSelect(p)}>
              {p.name}
            </li>
          ))}
          {filtered.length === 0 && <li className="no-results">No products found</li>}
        </ul>
      )}
      {selected && (
        <button onClick={handleClear} className="clear-btn">✕</button>
      )}
    </div>
  );
}
```

**Behavior:**
- Typing filters products instantly by name — no delay
- Only shows products in the current event's pack list, not the entire catalog
- Selecting a product auto-fills the Price Each field with its set sale price
- Manual price override still allowed after selection
- Clear button (✕) resets the field to search again
- If the pack list is empty, show "No products in pack list" as the only result

---

### Feature 24 — Day Sales: Unified Feed + Square Integration + Customer Info

Currently the Day Sales tab only shows manually recorded sales. With Square integration live (Section 18), Day Sales should show one unified chronological feed of all sales for the day — Square and manual — so there is one complete picture without cross-referencing two places.

**What Replit needs to build:**

Replace the current manual-only list with a unified feed that merges Square webhook sales and manual entries in reverse chronological order.

```javascript
// Build unified day sales feed
function buildDaySalesFeed(manualSales, squareOrders, todayDate) {
  // Filter Square orders for today
  const squareSalesToday = squareOrders
    .filter(o => o.source === 'square' && o.createdAt?.startsWith(todayDate))
    .map(o => ({
      id:            o.id,
      source:        'square',
      badge:         'SQ',
      time:          o.createdAt,
      customer:      o.customer || 'Guest',
      email:         o.email || '',
      items:         o.items,
      total:         o.total,
      paymentMethod: 'Card',
      linkedOrderId: o.id,   // links to Orders tab
    }));

  // Manual sales for today
  const manualSalesToday = manualSales
    .filter(s => s.date === todayDate)
    .map(s => ({
      id:            s.id,
      source:        'manual',
      badge:         s.paymentMethod || 'Manual',  // Cash / Venmo / Other
      time:          s.createdAt,
      customer:      s.customerName || 'Guest',
      email:         s.customerEmail || '',
      items:         s.items,
      total:         s.total,
      paymentMethod: s.paymentMethod,
      linkedOrderId: s.linkedOrderId || null,
    }));

  // Merge and sort reverse chronological
  return [...squareSalesToday, ...manualSalesToday]
    .sort((a, b) => new Date(b.time) - new Date(a.time));
}
```

**Square sale entries in the feed show:**
- Product name, qty, price
- Payment method: `Card`
- `[SQ]` source badge
- Customer name and email if captured by Square — `Guest` if not (tap/swipe with no Square profile)
- `→ Order` link to the full order record in the Orders tab

**Manual sale entries in the feed show:**
- Product name, qty, price
- Payment method badge: `[Cash]` / `[Venmo]` / `[Other]` — matches selection in form
- Customer name and email if entered — `Guest` if left blank
- `→ Order` link works the same as current behavior

**Updates to the "Record a Sale" form:**
- Add optional **Name** field (text input, not required)
- Add optional **Email** field (text input, not required)
- These appear below the existing product/qty/price fields
- When left blank, the sale entry shows `Guest` consistently with Square behavior

**General behavior:**
- All sales (Square + manual) in one chronological feed — no cross-referencing
- Square sales appear automatically via webhook — no manual entry needed for card sales
- Manual form stays for cash, Venmo, and any transaction Square doesn't capture
- `Guest` used consistently across both sources when customer info is absent

---

---

## 🟢 CODE — Section 21: Discord Private Operational Alerts

All alerts use simple Discord webhook POST requests — no bot, no OAuth, no approval process. The Pi sends print and spool alerts directly. The LayerDeck server sends order alerts. Both use the same helper function.

**Shared Discord helper — add to both server.js on the Pi and the LayerDeck server:**

```javascript
async function postToDiscord(webhookUrl, message, imageUrl = null) {
  if (!webhookUrl) return; // skip gracefully if webhook not configured

  const body = {
    content: message,
    ...(imageUrl && {
      embeds: [{ image: { url: imageUrl } }]
    })
  };

  try {
    await fetch(webhookUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body)
    });
  } catch (e) {
    console.error(`Discord post failed: ${e.message}`);
    // Never throws — Discord failure should never break the main flow
  }
}
```

---

### Channel: #print-alerts

Pi posts to this channel on every FINISH or FAILED event from any printer. Extend `onPrintFinished` (Feature 1) and `onPrintFailed` (Feature 2) to include Discord posts.

**On FINISH — extend `onPrintFinished`:**

```javascript
const finishMessage = [
  `✅ Print Complete — ${printerName}`,
  `Job: ${printRecord.productName}`,
  `Duration: ${printRecord.printTime} (estimated ${formatDuration(startEstimatedMinutes || 0)})`,
  `Filament used: ~${printRecord.filamentUsed}g ${printRecord.filamentType}`
].join('
');

await postToDiscord(process.env.DISCORD_WEBHOOK_PRINT_ALERTS, finishMessage);
```

**On FAILED — extend `onPrintFailed`:**

```javascript
const elapsed = Math.round((Date.now() - (printStartEstimates[printerName]?.startTime || Date.now())) / 60000);
const failedMessage = [
  `❌ Print Failed — ${printerName}`,
  `Job: ${jobName}`,
  `Time into print: ${formatDuration(elapsed)}`,
  `Reason: ${printerData.fail_reason || 'Unknown'}`
].join('
');

// Attach failure photo inline if captured
await postToDiscord(
  process.env.DISCORD_WEBHOOK_PRINT_ALERTS,
  failedMessage,
  photoUrl || null  // photoUrl from captureFailurePhoto() — null if unavailable
);
```

**Behavior:**
- Failure photo attached as an image embed — visible inline in Discord without clicking a link
- If no photo available, image embed is omitted cleanly — no broken link
- Printer name always shown so you know which machine at a glance

---

### Channel: #orders

LayerDeck server posts to this channel when the order sync daemon picks up a new Shopify order. Extend `processSquareSale` and the Shopify sync function to include Discord posts.

**On new Shopify order — extend shopify-sync.js:**

```javascript
for (const order of mapped) {
  // Format customer name — last initial only for privacy
  const nameParts = (order.customer || '').split(' ');
  const displayName = nameParts.length > 1
    ? `${nameParts[0]} ${nameParts[nameParts.length - 1][0]}.`
    : order.customer || 'Guest';

  const itemList = order.items
    .map(i => `${i.name} x${i.qty}`)
    .join(', ');

  const orderMessage = [
    `🛍️ New Shopify Order — ${order.orderNumber}`,
    `Customer: ${displayName}`,
    `Items: ${itemList}`,
    `Total: $${order.total.toFixed(2)}`,
    `→ View: https://layerdeck.replit.app/orders/${order.id}`
  ].join('
');

  await postToDiscord(process.env.DISCORD_WEBHOOK_ORDERS, orderMessage);
}
```

**On new Square order — extend processSquareSale in server.js:**

```javascript
const sqDisplayName = orderRecord.customer !== 'In-Person Customer'
  ? orderRecord.customer
  : 'Guest';

const sqItemList = orderRecord.items.map(i => `${i.name} x${i.qty}`).join(', ');

const sqMessage = [
  `🟦 New Square Sale — ${orderRecord.orderNumber}`,
  `Customer: ${sqDisplayName}`,
  `Items: ${sqItemList}`,
  `Total: $${orderRecord.total.toFixed(2)}`
].join('
');

await postToDiscord(process.env.DISCORD_WEBHOOK_ORDERS, sqMessage);
```

**Behavior:**
- Fires within 5 minutes of a Shopify order being placed (next sync cycle)
- Square sales fire instantly when webhook is received
- Customer last name initial only for privacy
- Guest shown when customer name not available

---

### Channel: #stock-alerts

Pi posts to this channel when a product hits its low stock threshold OR a spool drops below 100g. Extend `checkLowStockAlerts` (Feature 11) and the print finish deduction logic.

**On low product stock — extend checkLowStockAlerts:**

```javascript
for (const item of lowStockItems) {
  const stockMessage = [
    `⚠️ Low Stock — ${item.productName || item.name}`,
    `Current qty: ${item.stockRemaining} (threshold: ${LOW_STOCK_THRESHOLD})`,
    `→ Consider adding to print queue`
  ].join('
');

  await postToDiscord(process.env.DISCORD_WEBHOOK_STOCK_ALERTS, stockMessage);
}
```

**On low spool — extend spool deduction after print finish:**

```javascript
for (const spool of lowSpools) {
  const spoolMessage = [
    `🧵 Spool Running Low — ${spool.brand} ${spool.name} ${spool.colorName}`,
    `Remaining: ~${spool.remainingWeight}g`,
    `Printer: ${spool.assignedPrinter || 'Unassigned'}`
  ].join('
');

  await postToDiscord(process.env.DISCORD_WEBHOOK_STOCK_ALERTS, spoolMessage);
}
```

**Behavior:**
- Each alert fires once per threshold crossing — `lowStockAlertSent` flag prevents repeat alerts
- Alert does not re-fire unless item is restocked and drops below threshold again
- Both product and spool alerts go to the same `#stock-alerts` channel

---

### Channel: #daily-report

Pi posts a plain text version of the daily report to `#daily-report` at 6AM — same time as the email. Extend `nightly-report.js` to include the Discord post after the email sends.

```javascript
// Add to nightly-report.js after email sends

async function postDailyReportToDiscord(data) {
  const {
    dateLabel, successful, timeStr, printersRan,
    gramsUsed, revenue, profit,
    failed, lowStockOrders, lowSpools, queuedJobs,
    queueHours, queueRemMins
  } = data;

  const lines = [
    `📊 LayerDeck Daily Report — ${dateLabel}`,
    `──────────────────────────`,
  ];

  // Prints
  lines.push(`🖨️ Prints Completed: ${successful.length} (total ${timeStr})`);
  if (printersRan.length > 0) {
    lines.push(`   ${printersRan.join(' | ')}`);
  }

  // Filament
  lines.push(`
🧵 Filament Used: ${gramsUsed.toFixed(0)}g total`);

  // Financials
  lines.push(`
💰 Est. Revenue: $${revenue.toFixed(2)}`);
  lines.push(`💵 Est. Profit: $${profit.toFixed(2)} (after filament + electricity)`);

  // Failures — only if any
  if (failed.length > 0) {
    lines.push(`
❌ Print Failures: ${failed.length}`);
    failed.forEach(f => lines.push(`   ${f.printerName} — ${f.productName}`));
  }

  // Low stock — only if any
  if (lowStockOrders.length > 0) {
    lines.push(`
⚠️ Low Stock:`);
    lowStockOrders.forEach(o => lines.push(`   ${o.productName} (${o.stockRemaining} left)`));
  }

  // Spool alerts — only if any
  if (lowSpools.length > 0) {
    lines.push(`
🧵 Spools Running Low:`);
    lowSpools.forEach(s => lines.push(`   ${s.brand} ${s.colorName} (~${s.remainingWeight}g)`));
  }

  // Queue
  const queueTime = queueHours > 0 ? `${queueHours}h ${queueRemMins}m` : `${queueRemMins}m`;
  lines.push(`
📋 Queue: ${queuedJobs.length} jobs pending (~${queueTime} total)`);
  lines.push(`──────────────────────────`);

  // Clean close
  if (failed.length === 0 && lowStockOrders.length === 0 && lowSpools.length === 0) {
    lines.push(`No alerts today ✅`);
  }

  await postToDiscord(
    process.env.DISCORD_WEBHOOK_DAILY_REPORT,
    lines.join('
')
  );
}
```

**Behavior:**
- Posts at 6AM same time as the email — both go out together
- Sections with nothing to report are omitted — same logic as email
- Zero-print days still post with queue status only
- Plain text with emoji — not HTML, formatted for Discord readability

---

---

## 🟢 CODE — Section 21b: Discord — Additional Channels

Two new channels added to the existing LayerDeck Discord server. The shared `postToDiscord()` helper from Section 21 is used throughout — no new infrastructure needed.

Add both new webhook env vars to the shared helper call pattern:
```javascript
// New env vars alongside existing ones
process.env.DISCORD_WEBHOOK_CONVENTION_SALES  // #convention-sales
process.env.DISCORD_WEBHOOK_PI_HEALTH         // #pi-health
```

---

### Channel: #convention-sales

Posts every sale recorded in Day Sales during an active convention event — card, cash, and Venmo. Separate from #orders so during a live event you have a dedicated real-time feed of the day without it being mixed with regular Shopify online orders.

**Extend `recordSale()` (Section 22, Part 5) to include Discord post:**

```javascript
async function postConventionSale(saleItems, total, paymentMethod, conventionName, packListAfter) {
  const today     = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  const badgeMap  = { square: '[SQ]', cash: '[Cash]', venmo: '[Venmo]', other: '[Other]' };
  const badge     = badgeMap[paymentMethod] || '[Manual]';

  const lines = [`💰 Sale — ${conventionName} · ${today}`];

  if (saleItems.length === 1) {
    lines.push(`${saleItems[0].name} x${saleItems[0].qty} — $${(saleItems[0].price * saleItems[0].qty).toFixed(2)} ${badge}`);
  } else {
    saleItems.forEach(i => lines.push(`${i.name} x${i.qty} — $${(i.price * i.qty).toFixed(2)}`));
    lines.push(`Total: $${total.toFixed(2)} ${badge}`);
  }

  // Pack list remaining per product sold
  const remaining = saleItems
    .map(i => {
      const afterQty = packListAfter.find(p => p.name === i.name)?.remaining ?? '?';
      return `${i.name} ${afterQty}`;
    })
    .join(' · ');
  lines.push(`Pack list remaining: ${remaining}`);

  // Running day total
  const dayTotal   = await getDayTotal(); // sum of all Day Sales for today
  const dayCount   = await getDaySaleCount();
  lines.push(`Today's total: $${dayTotal.toFixed(2)} across ${dayCount} sale${dayCount !== 1 ? 's' : ''}`);

  await postToDiscord(process.env.DISCORD_WEBHOOK_CONVENTION_SALES, lines.join('
'));
}
```

**Behavior:**
- Only fires when an active convention event exists — does not post for regular Shopify orders
- Active event auto-detected by date, same logic as Square integration (Section 18, Part 2)
- Payment method badge shown on every sale: `[SQ]`, `[Cash]`, `[Venmo]`
- Pack list remaining shown per product sold after deduction
- Running day total shown as footer after every sale
- If no active convention, skip silently — never post to this channel for online orders

---

### Channel: #pi-health

Pi monitors its own critical services every 5 minutes and posts to this channel. One daily confirmation when healthy, immediate alert when something goes down.

**Create a new script on the Pi:**

```bash
nano ~/bambu-hub/pi-health.js
```

```javascript
// pi-health.js
// Checks Pi services every 5 minutes, posts to Discord on issues
// Daily healthy check at 7AM via crontab

const { execSync } = require('child_process');

const SERVICES = ['layerdeck-hub', 'cameras']; // PM2 process names

async function postToDiscord(url, message) {
  if (!url) return;
  try {
    await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ content: message })
    });
  } catch (e) {
    console.error('Discord post failed:', e.message);
  }
}

function checkService(name) {
  try {
    const result = execSync(`pm2 jlist`, { encoding: 'utf8' });
    const processes = JSON.parse(result);
    const proc = processes.find(p => p.name === name);
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
  try {
    return execSync('tailscale ip', { encoding: 'utf8' }).trim();
  } catch (e) { return 'unknown'; }
}

function getUptime() {
  try {
    const seconds = parseFloat(execSync('cat /proc/uptime', { encoding: 'utf8' }).split(' ')[0]);
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${d}d ${h}h ${m}m`;
  } catch (e) { return 'unknown'; }
}

async function attemptRestart(serviceName) {
  try {
    execSync(`pm2 restart ${serviceName}`);
    await new Promise(r => setTimeout(r, 60000)); // wait 60 seconds
    return checkService(serviceName); // return true if recovered
  } catch (e) { return false; }
}

// STATE FILE — tracks which services are already in alert state to avoid spam
const STATE_FILE = require('path').join(process.env.HOME, 'bambu-hub', '.health-state.json');
const fs = require('fs');

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
  catch (e) { return {}; }
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state));
}

async function runHealthCheck(dailyReport = false) {
  const hubOnline       = checkService('layerdeck-hub');
  const camsOnline      = checkService('cameras');
  const tailscaleOnline = checkTailscale();
  const allHealthy      = hubOnline && camsOnline && tailscaleOnline;
  const tailscaleIP     = getTailscaleIP();
  const uptime          = getUptime();
  const state           = loadState();
  const WEBHOOK         = process.env.DISCORD_WEBHOOK_PI_HEALTH;

  if (dailyReport) {
    // Only post daily check if all healthy — if something is down, alert takes priority
    if (allHealthy) {
      const msg = [
        '✅ Pi Health Check — All systems running',
        `Hub server:  ✅ Online (port 3000)`,
        `go2rtc:      ✅ Online (port 1984)`,
        `Tailscale:   ✅ Connected (${tailscaleIP})`,
        `Uptime:      ${uptime}`
      ].join('
');
      await postToDiscord(WEBHOOK, msg);
    }
    return;
  }

  // Check each service — alert if down and not already alerted
  const issues = [];
  const serviceMap = {
    'layerdeck-hub': { label: 'Hub server', online: hubOnline },
    'cameras':        { label: 'go2rtc',     online: camsOnline },
    'tailscale':      { label: 'Tailscale',  online: tailscaleOnline }
  };

  for (const [key, svc] of Object.entries(serviceMap)) {
    if (!svc.online && !state[key + '_alerted']) {
      // Attempt PM2 restart for hub and cameras (not Tailscale)
      let recovered = false;
      if (key !== 'tailscale') {
        console.log(`Attempting PM2 restart for ${key}...`);
        recovered = await attemptRestart(key === 'layerdeck-hub' ? 'layerdeck-hub' : 'cameras');
      }

      if (!recovered) {
        issues.push(key);
        state[key + '_alerted'] = true;
      } else {
        console.log(`${key} recovered after restart — no alert needed`);
      }
    }

    // Recovery — was alerted, now back online
    if (svc.online && state[key + '_alerted']) {
      const recoveryLabels = {
        'layerdeck-hub': 'Hub server recovered — printer monitoring back online',
        'cameras':        'go2rtc recovered — camera feeds back online',
        'tailscale':      'Tailscale reconnected — remote access restored'
      };
      await postToDiscord(WEBHOOK, `✅ ${recoveryLabels[key]}`);
      delete state[key + '_alerted'];
    }
  }

  // Post alert if any new issues
  if (issues.length > 0) {
    const lines = ['🚨 Pi Alert — Service Down'];
    for (const [key, svc] of Object.entries(serviceMap)) {
      lines.push(`${svc.label}: ${svc.online ? '✅ Online' : '❌ Not responding'}`);
    }
    if (issues.includes('cameras')) lines.push('
Camera feeds unavailable until go2rtc recovers.');
    if (issues.includes('layerdeck-hub')) lines.push('
Printer monitoring unavailable until hub server recovers.');
    lines.push('Auto-restart attempted via PM2.');
    await postToDiscord(WEBHOOK, lines.join('
'));
  }

  saveState(state);
}

// Run mode determined by argument
const isDailyReport = process.argv.includes('--daily');
runHealthCheck(isDailyReport).catch(console.error);
```

**Add to crontab — 2 entries:**

> ✅ The 5-minute health check is already registered in Phase 1 Step 14. The daily report entry needs to be added.

The crontab in Step 14 already has:
```
# Pi health check — every 5 minutes (already registered)
```

Add this to Step 14 crontab block alongside existing entries:
```
# Pi health daily report — 7AM every morning
0 7 * * * node /home/hypedanubis3d/bambu-hub/pi-health.js --daily >> /home/hypedanubis3d/bambu-hub/pi-health.log 2>&1

# Pi health check — every 5 minutes
*/5 * * * * node /home/hypedanubis3d/bambu-hub/pi-health.js >> /home/hypedanubis3d/bambu-hub/pi-health.log 2>&1
```

---

## 🟢 CODE — Section 22: Convention POS — LayerDeck + Square Reader Integration

LayerDeck acts as the full POS interface at conventions. The Square Bluetooth Reader paired to Thiago's phone is used for card payments. LayerDeck uses the **Square Point of Sale API** (mobile deep-link) to hand off payment to the Square POS app, which processes the card on the Bluetooth reader and returns confirmation back to LayerDeck.

> **Why Point of Sale API instead of Terminal API:** Thiago has a Square Bluetooth Reader (2nd gen), not a standalone Square Terminal device. The Terminal API only works with Square's dedicated hardware terminals. The Point of Sale API works with the Bluetooth reader via the Square POS app on his phone — same customer experience, simpler implementation.

---

### Architecture

```
LayerDeck (Day Sales tab — open in phone browser)
    ↓ user builds sale, taps Charge
Square Point of Sale API (deep link)
    ↓ opens Square POS app on phone with amount pre-filled
Square POS app + Bluetooth Reader
    ↑ customer taps/swipes card on reader
Square POS app
    ↑ redirects back to LayerDeck with payment result in URL
LayerDeck
    ↑ reads result from URL params, records sale, decrements pack list
```

> The Square POS app needs to be installed on Thiago's phone and the Bluetooth reader paired. Both are already set up since he uses Square today.

---

### Part 1 — Square POS App Setup (One-Time)

No Device ID needed. The only setup required:

1. Square POS app is installed on Thiago's phone ✅ (already done — he uses Square today)
2. Bluetooth reader is paired to the phone ✅ (already done)
3. In LayerDeck Settings, add a **"Square Callback URL"** field — this is the URL Square redirects back to after payment. Set it to:
   ```
   https://layerdeck.replit.app/square/callback
   ```
   Replit needs to add this as a registered callback URL in the Square Developer app settings (App Dashboard → Point of Sale API → Add Web Callback URL).

No credentials beyond what's already in the doc. No Device ID needed.

---

### Part 2 — Day Sales POS Flow

The Day Sales tab already has a product search (Feature 23) and a Record a Sale form. This extends it into a full POS flow.

**Updated Day Sales UI — what Replit needs to add:**

```
┌─────────────────────────────────────────────┐
│  DAY SALES                    [+ Record Manual Sale] │
│                                              │
│  🔍 Search products...                       │
│                                              │
│  ┌─────────────────────────────────────┐    │
│  │ Current Sale                         │    │
│  │                                     │    │
│  │  Shiny Creature Ball    x1   $24.99 │    │
│  │  Batman Duck            x2   $19.98 │    │
│  │                          ─────────  │    │
│  │                  Total:  $44.97     │    │
│  │                                     │    │
│  │  [💳 Charge via Terminal]            │    │
│  │  [💵 Cash]  [📱 Venmo]  [Other]     │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  TODAY'S SALES ─────────────────────────    │
│  [unified feed — Square + manual]            │
└─────────────────────────────────────────────┘
```

**Flow:**

1. User searches pack list, taps a product to add it to the current sale
2. Qty adjustable with +/- buttons on each line item
3. User taps **Charge via Terminal** for card payments
4. LayerDeck sends checkout request to Square terminal (see Part 3)
5. Terminal prompts customer to tap/swipe
6. On confirmation → sale recorded, pack list decremented
7. For Cash/Venmo/Other → record immediately with no terminal interaction

---

### Part 3 — Square Point of Sale API Integration

The Point of Sale API uses a deep link to open the Square POS app with the payment pre-filled. When done, Square redirects back to LayerDeck with the result in the URL.

**Step 1 — Register callback URL in Square Developer dashboard:**

✅ Already registered. The callback URL `https://layerdeck.replit.app/square/callback` has been added to the Square Developer app under Point of Sale API → Web Callback URLs. Replit does not need to do this step.

**Step 2 — Build the deep link (client-side, no server needed):**

```javascript
// Called when user taps "Charge via Square" in Day Sales
function chargeViaSquare(saleItems, totalAmount) {
  // Store current sale in sessionStorage so we can restore it after redirect
  sessionStorage.setItem('pendingSale', JSON.stringify({ saleItems, totalAmount }));

  const amountCents = Math.round(totalAmount * 100);
  const callbackUrl = encodeURIComponent('https://layerdeck.replit.app/square/callback');
  const note        = encodeURIComponent(saleItems.map(i => `${i.name} x${i.qty}`).join(', '));

  // Square Point of Sale deep link — opens Square POS app on phone
  const squareUrl = `square-commerce-v1://payment/create?amount_money=${amountCents}` +
    `&currency_code=USD` +
    `&callback_url=${callbackUrl}` +
    `&description=${note}` +
    `&notes=${note}` +
    `&options={"supported_tender_types":["CREDIT_CARD","DEBIT_CARD","CASH"],"skip_receipt_screen":false}`;

  window.location.href = squareUrl;
}
```

**Step 3 — Handle callback when Square returns to LayerDeck:**

```javascript
// Add to LayerDeck server — GET /square/callback
// Square redirects here after payment with result in query params

app.get('/square/callback', (req, res) => {
  // Redirect to the Day Sales page with result params
  // The client-side code reads these and records the sale
  const { status, transaction_id, error_code } = req.query;
  res.redirect(`/events/day-sales?square_status=${status}&txn_id=${transaction_id || ''}&error=${error_code || ''}`);
});
```

```javascript
// Client-side — on Day Sales page load, check for Square callback result
function checkSquareCallback() {
  const params = new URLSearchParams(window.location.search);
  const status = params.get('square_status');
  if (!status) return; // not a callback

  const pending = JSON.parse(sessionStorage.getItem('pendingSale') || 'null');
  sessionStorage.removeItem('pendingSale');

  // Clean URL
  window.history.replaceState({}, '', window.location.pathname);

  if (status === 'ok' && pending) {
    const txnId = params.get('txn_id');
    recordSale(pending.saleItems, pending.totalAmount, 'square', txnId);
    decrementPackList(pending.saleItems);
    showToast('✅ Payment confirmed');
  } else {
    const error = params.get('error');
    showFallbackPrompt(`Payment ${status === 'cancel' ? 'cancelled' : 'failed'} — record manually if needed`);
  }
}
```

---

### Part 4 — UI Flow

**Button label:** "💳 Charge via Square" (not "Terminal")

**What happens when tapped:**
1. LayerDeck saves the current sale to `sessionStorage`
2. Deep link opens Square POS app on the phone
3. Square POS shows the amount and description
4. Customer taps/swipes on Bluetooth reader
5. Square POS closes and redirects back to LayerDeck
6. LayerDeck reads the result from URL params and records the sale

**Fallback:** If the Square app is not installed or the deep link fails, show:
> "Square app not found — record payment manually"
> Manual payment buttons (Cash / Venmo / Other) re-enable so the sale is never lost

**After successful payment:**
- Sale added to unified Day Sales feed with `[SQ]` badge
- Current sale cleared
- Pack list qty decremented
- Toast: "✅ Payment confirmed"

---

### Part 5 — Sale Recording + Pack List Decrement

On confirmed payment (Square terminal or manual), record the sale and update pack list:

```javascript
async function recordSale(items, total, paymentMethod, squarePaymentId = null) {
  // Write to Orders tab (existing orders collection)
  const orderRecord = {
    id:            crypto.randomUUID(),
    orderNumber:   `POS-${Date.now().toString().slice(-6)}`,
    source:        paymentMethod === 'square' ? 'square' : 'manual',
    paymentMethod, // 'square' | 'cash' | 'venmo' | 'other'
    squarePaymentId,
    items:         items.map(i => ({ name: i.name, qty: i.qty, price: i.price })),
    total,
    customer:      'Guest',  // POS sales are walk-up — no customer info captured
    createdAt:     new Date().toISOString(),
    conventionSale: true
  };

  await saveToSupabase('orders', orderRecord);
}

async function decrementPackList(items) {
  // Find active convention and decrement each item's remaining qty
  // Uses same logic as the Square webhook deduction (Part 2, Section 18)
  // Calls deductFromConventionPackingList(supabase, items)
  await deductFromConventionPackingList(supabase, items);
}
```

---

### Part 6 — What Is NOT Needed

Explicitly tell Replit not to build these:
- No Square product catalog setup or sync
- No Shopify inventory sync for convention sales
- No product matching between Square and Shopify
- Square dashboard will show transaction totals and revenue but no item-level detail — that all lives in LayerDeck only

---

---

## 🟢 CODE — Section 23: Navigation Updates

Three navigation changes. All are simple label/structure updates — no new data, no new collections.

---

### Update 1 — Integrations Section: Add Square, Discord, Pi Hub

The Integrations section currently shows Shopify only. Add Square, Discord, and Pi Hub as their own entries alongside it.

**What Replit needs to do:**

Add 3 new entries to the Integrations nav section:
- **Shopify** ← existing, unchanged
- **Square** ← new
- **Discord** ← new
- **Pi Hub** ← new

Each entry links to a settings/status page for that integration. Build these pages consistent with however the Shopify integration page is currently built.

**Square integration page — show:**
```
Square Integration
Status: ✅ Connected
Store: hypedanubis3d.com
Location ID: LBC978ZGBGS2M
Webhook: Active

[Update credentials]
```

**Discord integration page — show:**

The Discord integration page has two sections: channel management and per-alert-type configuration.

**Section 1 — Channels**

Each channel is shown as a card with:
- Channel name and webhook URL (partially masked for security)
- Enable/disable toggle — when disabled, no alerts post to that channel
- Edit webhook URL button
- Delete channel button

A **"+ Add Channel"** button at the bottom allows adding new channels without touching code:
- User enters: channel name, webhook URL, and which alert types should post to it
- New channel immediately appears in the list and starts receiving selected alert types
- No code changes needed to add new channels — fully managed from the UI

```
Discord Integration
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

#print-alerts     ✅ Enabled   [Edit URL] [Delete]
  discord.com/api/webhooks/1488581068.../Kbb***

#orders           ✅ Enabled   [Edit URL] [Delete]
  discord.com/api/webhooks/1488581270.../r5i***

#stock-alerts     ✅ Enabled   [Edit URL] [Delete]
#daily-report     ✅ Enabled   [Edit URL] [Delete]
#convention-sales ✅ Enabled   [Edit URL] [Delete]
#pi-health        ✅ Enabled   [Edit URL] [Delete]
#bambu-restock    ✅ Enabled   [Edit URL] [Delete]
#convention-prep  ✅ Enabled   [Edit URL] [Delete]

[+ Add Channel]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Section 2 — Alert Type Routing**

Each alert type has a toggle and a channel selector. This controls which channel each alert type posts to, and whether it posts at all.

```
ALERT ROUTING

Print Alerts
  Print completed        ✅  → #print-alerts    [change channel ▾]
  Print failed           ✅  → #print-alerts    [change channel ▾]
  Print time overrun     ✅  → #print-alerts    [change channel ▾]

Orders
  New Shopify order      ✅  → #orders          [change channel ▾]
  New Square sale        ✅  → #orders          [change channel ▾]
  Convention sale        ✅  → #convention-sales [change channel ▾]

Stock & Filament
  Product low stock      ✅  → #stock-alerts    [change channel ▾]
  Spool running low      ✅  → #stock-alerts    [change channel ▾]
  Bambu restock          ✅  → #bambu-restock   [change channel ▾]

Daily Summary
  Nightly report         ✅  → #daily-report    [change channel ▾]

Convention Prep
  7-day reminder         ✅  → #convention-prep [change channel ▾]
  3-day reminder         ✅  → #convention-prep [change channel ▾]
  1-day reminder         ✅  → #convention-prep [change channel ▾]

Pi & System
  Pi service down        ✅  → #pi-health       [change channel ▾]
  Pi daily health check  ✅  → #pi-health       [change channel ▾]
  Pi service recovered   ✅  → #pi-health       [change channel ▾]
```

**Behavior:**
- Toggling an alert type off silently skips that alert — no posts to any channel
- Channel selector dropdown shows all configured channels — user can route any alert to any channel
- All routing config saved to Supabase under `discordAlertRouting`
- Pi and LayerDeck server check `discordAlertRouting` before posting — if type is disabled or channel has no webhook, post is skipped silently
- Adding a new channel via "+ Add Channel" immediately makes it available in all channel selectors
- Defaults: all alert types enabled, routed to their default channels as shown above

**Pi Hub integration page — show:**
```
Pi Hub
Status: ✅ Connected  (or ❌ Unreachable)
Tailscale IP: [from printerHub collection]
Hub server:  port 3000
go2rtc:      port 1984
Printers:    A1 · P1 Room · P1 Closet

[Edit Pi Hub settings]
[Test connection]
```

- Status for each integration is live — pulled from the same data already available in the app (Supabase for Square/Discord credentials, Pi `/status` endpoint for Pi Hub)
- If a connection is unhealthy or credentials are missing, show ❌ with a clear message and a button to fix it
- Consistent styling with existing Shopify integration page — same card layout, same status indicators

---

### Update 2 — Rename "Fil. Purchases" to "Filament Purchases"

Simple label rename. Every other nav item is fully spelled out — this is the only abbreviated one.

**What Replit needs to do:**
- Find every instance of `"Fil. Purchases"` in the nav, sidebar, and any breadcrumbs
- Rename to `"Filament Purchases"` — nothing else changes, same page, same data, same functionality

---

### Update 3 — Rename "Revenue, Tax & Power" to "Revenue"

The current label is too long for a nav item and lists sub-sections that are better discovered by navigating into the page.

**What Replit needs to do:**
- Rename the nav label from `"Revenue, Tax & Power"` to `"Revenue"` — or whatever the current exact label is in the codebase
- The page content stays exactly the same — Tax and Power remain as sections within the page
- Nothing else changes — same route, same data, same functionality

---

---

## 🟢 CODE — Section 24: Nav Additions — Social + Loyalty

---

### Update 1 — Add Social to Business Nav Section

The Social tab is fully built in Section 16 (Feature 14) but has no nav entry. Wire it up.

**What Replit needs to do:**

Add **Social** to the Business section in the nav alongside Conventions, Product Catalog, Revenue, Price AI, Labels, and Fail Rates & Waste.

```
Business
├── Conventions
├── Product Catalog
├── Revenue
├── Price AI
├── Competitor Pricing
├── Labels
├── Fail Rates & Waste
└── Social          ← ADD THIS
```

- **Nav label:** Social
- **Icon:** megaphone or calendar icon — consistent with existing Business nav icon style
- **Links to:** the existing Social tab built in Section 16 — Composer, Queue, and Analytics sections
- No new page needed — just wire the nav entry to the existing route

---


---

---

## 🟢 CODE — Section 25: Convention Catalog Tab — Designer Lookbook

A customer-facing digital lookbook inside each Convention/Event. Customers browse available designs, place orders on the spot, scan QR codes to buy online, or add to a wishlist. Three sources: N3D Melbourne (API), CPL3D (API), and Others (manual).

---

### Tab location

Inside the Convention/Event section alongside Pack List, Checklist, Day Sales, Reconcile, and Price Tags. Add a new **Catalog** tab — no top-level nav entry needed.

---

### Designer Source Configuration (Settings)

Designer sources are configurable from Settings — not hardcoded. New sources can be added without code changes.

Each source record:
```javascript
{
  id:          uuid(),
  name:        'N3D Melbourne',   // display name
  slug:        'n3d',             // used for filter bar and badge
  type:        'api',             // 'api' or 'manual'
  apiKey:      'XXXX',            // stored server-side only if type === 'api'
  active:      true,
  color:       '#1565C0'          // badge color
}
```

**Behavior:**
- Filter bar at top of Catalog tab updates automatically from configured sources
- Manual sources can be upgraded to API type from Settings without data loss — existing manual entries are retained and can be retired or kept as fallback once API is live
- Adding a new source in Settings immediately adds it to the filter bar and the manual entry form's source dropdown

---

### Layout

```
┌────────────────────────────────────────┐
│  CATALOG  [All] [N3D] [CPL3D] [Other]  │
│  🔍 Search designs...                  │
├──────────────────┬─────────────────────┤
│  [img]           │  [img]              │
│  Design Name     │  Design Name        │
│  $24.99 [N3D]    │  Price TBD [CPL3D]  │
│  ✅ In Stock     │                     │
│  [Order] [♥] [QR]│  [Order] [♥] [QR]  │
├──────────────────┴─────────────────────┤
│  ...more cards...                      │
├────────────────────────────────────────┤
│  WISHLIST (3 items)           [Clear]  │
│  Batman Duck · Dragon Ball · Anubis    │
│  [Email wishlist to customer]          │
└────────────────────────────────────────┘
```

- 2 cards per row on mobile
- Source badge on every card
- "In Stock" green indicator if item exists in LayerDeck inventory with qty > 0
- Wishlist strip at bottom, persists per session, clears on "New Customer" button

---

### Source 1 — N3D Melbourne (API)

N3D already has an existing API integration in LayerDeck for importing designs. The Catalog tab reuses this same connection to display the N3D catalog — no importing into LayerDeck needed. Customers can Order Now, Add to Wishlist, and scan QR codes on N3D cards exactly the same as any other source.

**What Replit needs to do:**

Reuse the existing N3D API connection already built in LayerDeck. The Catalog tab calls the same N3D endpoints already wired up — no new auth setup needed. The N3D API key is already stored server-side.

> ⚠️ Do NOT expose the N3D API key (`n3d_sk_6sL6Rb9BdKnzmN7LdotdD3sydeOz3gmn`) in frontend code. All N3D calls must go through the LayerDeck server proxy as they do today.

**Per N3D design card — display:**
```javascript
{
  thumbnail:    design.thumbnail_url,
  name:         design.name,
  printTime:    design.print_time    || null,
  filamentInfo: design.filament_info || null,
  salePrice:    matchedLayerDeckProduct?.salePrice || null,  // null = "Price TBD"
  badge:        'N3D',
  inStock:      matchedLayerDeckProduct?.stockQty > 0 || false,
  shopifyUrl:   matchedLayerDeckProduct?.shopifyUrl || null   // for QR
}
```

**Matching logic:**
- Match N3D design to LayerDeck product by name (case-insensitive, fuzzy match acceptable)
- If matched: show your sale price and in-stock status
- If not matched: show "Price TBD", no stock indicator

---

### Source 2 — CPL3D (API)

CPL3D has an API. The Catalog tab pulls CPL3D designs live via API — same pattern as N3D. Customers can Order Now, Add to Wishlist, and scan QR codes on CPL3D cards exactly the same as N3D and manual entries.

**CPL3D API Key:** `pk_d09c56dab52874fb8f0095d9d048916f`

> ⚠️ Store server-side only — never expose in frontend code. Route all CPL3D API calls through the LayerDeck server proxy.

**What Replit needs to do:**
Wire up CPL3D as an API source alongside N3D. Check CPL3D's API documentation to determine the correct endpoints for fetching the design catalog, thumbnails, and design details. The API key above authenticates all requests.

Per CPL3D design card — display same fields as N3D:
- Thumbnail (from CPL3D API)
- Design name
- Your sale price (matched from LayerDeck product if exists, otherwise "Price TBD")
- CPL3D source badge
- "In Stock" indicator if matched LayerDeck product has qty > 0
- QR button if matched Shopify listing exists

**Matching logic:** same as N3D — match by design name to LayerDeck product (case-insensitive).

---

### Source 3 — Others (Manual)

For any designer source without an API. These designs are maintained manually inside LayerDeck.

**New Supabase collection: `designCatalog`**

**New Supabase collection: `designCatalog`**

```javascript
{
  id:          uuid(),
  name:        'Batman Duck',
  source:      'cpl3d',          // matches source slug from Settings
  category:    'Keychain',       // Pokéball / Figure / Keychain / Dice Tower / Other
  imageUrl:    'https://rwbnivevzdazkfuxteng.supabase.co/storage/v1/object/public/layerstack-media/{path}',  // uploaded to Supabase Storage or external URL
  salePrice:   14.99,
  notes:       'Shiny variant available',
  available:   true,             // false = hidden from catalog without deleting
  shopifyUrl:  'https://hypedanubis3d.com/products/batman-duck',  // for QR — optional
  createdAt:   new Date().toISOString()
}
```

**Manual entry form** — accessible from within the Catalog tab (+ Add Design button):
- Design name
- Photo upload (uploads to `layerstack-media` Supabase Storage) or image URL
- Designer / Source — dropdown pulled from configured sources in Settings
- Category — Pokéball / Figure / Keychain / Dice Tower / Other
- Sale price
- Notes
- Available toggle — hides without deleting
- Shopify URL (optional) — enables QR button if provided

---

### Customer Actions

**Order Now:**

Opens a simple order overlay with:
```javascript
{
  customerName:  '',       // required
  phone:         '',       // optional
  email:         '',       // optional
  design:        selectedDesign,
  qty:           1,
  notes:         '',
  status:        'pending',
  source:        'convention-order',
  eventId:       currentEvent.id
}
```
- Creates a pending order in the Orders tab tagged `[Convention Order]`
- If design is in pack list with qty > 0: decrements by qty sold
- If not in pack list or qty is 0: flags order as "Made to Order"
- Fires to `#convention-sales` Discord channel (Section 21b)

**Add to Wishlist:**
- Adds design to a session-level wishlist array (React state — not persisted to Supabase)
- Wishlist strip shows at bottom of Catalog tab with item count
- "New Customer" button clears wishlist and resets session
- "Email wishlist" button — if customer provides email, sends a simple list of design names and prices via the LayerDeck server using nodemailer (same Gmail setup as nightly report)
- Wishlist email format:
```
Subject: Your HypedAnubis3D Wishlist

Hi there! Here's your wishlist from today's event:

• Batman Duck — $14.99
• Dragon Creature Ball — $24.99
• Anubis Keychain — $12.99

Shop online: https://hypedanubis3d.com
— HypedAnubis3D
```

**QR to Buy Online:**
- If design has a `shopifyUrl` (either matched from LayerDeck products or manually set): show a full-screen QR code linking to that URL
- QR generated client-side using a QR library (e.g. `qrcode.react` or similar)
- Tapping the QR button opens a full-screen overlay — large QR, design name shown below
- If no Shopify URL: show "Not listed online yet" in place of the QR button — greyed out, no action

---

### N3D API Key

```
N3D API Key: n3d_sk_6sL6Rb9BdKnzmN7LdotdD3sydeOz3gmn
```

> This is the API key for the existing N3D Melbourne integration. Replit should use this for all N3D catalog calls in the Convention Catalog tab — same key already used for the existing import feature.

---

## 🟢 CODE — Section 25b: Convention Catalog — Export / Import

Extends Section 25. Add bulk export and import to the Design Catalog for managing manual entries efficiently.

---

### Export

**What Replit needs to add:**

An **Export** button in the Catalog tab header or settings area. Exports all manual catalog entries as a CSV file — downloaded directly in the browser.

```javascript
// CSV columns — in this exact order
const CSV_HEADERS = ['Name', 'Source', 'Category', 'Price', 'Notes', 'Available', 'Photo URL'];

function exportCatalogCSV(designCatalog, configuredSources) {
  // Include manual entries — editable
  const manualRows = designCatalog
    .filter(d => d.sourceType !== 'api')
    .map(d => [
      d.name,
      d.source,
      d.category    || '',
      d.salePrice   || '',
      d.notes       || '',
      d.available   ? 'true' : 'false',
      d.imageUrl    || ''
    ]);

  // Include API-sourced entries as read-only reference rows
  // Clearly marked so they can't be accidentally re-imported
  const apiRows = designCatalog
    .filter(d => d.sourceType === 'api')
    .map(d => [
      d.name,
      `${d.source} (API - read only)`,  // marked so import skips them
      d.category    || '',
      d.salePrice   || '',
      '',
      'true',
      d.imageUrl    || ''
    ]);

  const allRows   = [CSV_HEADERS, ...manualRows, ...apiRows];
  const csvString = allRows.map(row =>
    row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
  ).join('
');

  // Trigger browser download
  const blob = new Blob([csvString], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `layerdeck-catalog-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
```

---

### Import

**What Replit needs to add:**

An **Import** button alongside Export. Accepts CSV in the same format as the export. Full preview before committing — no surprises.

```javascript
async function importCatalogCSV(file, existingCatalog, configuredSources) {
  const text = await file.text();
  const rows = text.trim().split('
').map(r =>
    r.split(',').map(cell => cell.replace(/^"|"$/g, '').replace(/""/g, '"').trim())
  );

  const headers  = rows[0].map(h => h.toLowerCase().replace(/\s/g, '_'));
  const dataRows = rows.slice(1);

  const results = {
    toAdd:    [],  // new entries
    toUpdate: [],  // existing entries — matched by Name + Source
    skipped:  [],  // rows with errors
    unmappedSources: new Set()
  };

  const sourceNames = configuredSources.map(s => s.name.toLowerCase());

  for (const [i, row] of dataRows.entries()) {
    const entry = Object.fromEntries(headers.map((h, j) => [h, row[j] || '']));

    // Skip API read-only rows
    if (entry.source?.includes('(API - read only)')) continue;

    // Validate required fields
    if (!entry.name || !entry.source) {
      results.skipped.push({ row: i + 2, reason: 'Missing required field: Name or Source', data: entry });
      continue;
    }

    // Check source is recognized
    const sourceMatch = configuredSources.find(
      s => s.name.toLowerCase() === entry.source.toLowerCase()
    );
    if (!sourceMatch) {
      results.unmappedSources.add(entry.source);
      results.skipped.push({ row: i + 2, reason: `Unrecognized source: "${entry.source}"`, data: entry });
      continue;
    }

    // Match by Name + Source — update if exists, add if new
    const existing = existingCatalog.find(
      d => d.name.toLowerCase() === entry.name.toLowerCase() &&
           d.source.toLowerCase() === entry.source.toLowerCase()
    );

    const mapped = {
      name:      entry.name,
      source:    sourceMatch.slug,
      sourceName: sourceMatch.name,
      category:  entry.category  || '',
      salePrice: parseFloat(entry.price) || null,
      notes:     entry.notes     || '',
      available: entry.available?.toLowerCase() !== 'false',
      imageUrl:  entry.photo_url || '',
    };

    if (existing) {
      results.toUpdate.push({ ...existing, ...mapped });
    } else {
      results.toAdd.push({ id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...mapped });
    }
  }

  return results;
}
```

**Import UI flow:**

```
Step 1 — User selects CSV file → import runs, returns results object

Step 2 — Preview shown before saving:
┌─────────────────────────────────────────────┐
│  Import Preview                              │
│                                             │
│  ✅ 12 new entries to add                   │
│  🔄 3 existing entries to update            │
│  ⚠️  2 rows skipped (errors below)          │
│                                             │
│  Skipped rows:                              │
│  Row 4 — Missing Source field               │
│  Row 9 — Unrecognized source: "FDM_World"  │
│    → [Map to existing source ▾] [Add as new source] │
│                                             │
│  [Cancel]              [Confirm Import]     │
└─────────────────────────────────────────────┘

Step 3 — User resolves unmapped sources (or skips them)
Step 4 — Confirm Import → writes to Supabase designCatalog collection
Step 5 — Catalog refreshes immediately — new badges and filter bar updated
```

**Unmapped source resolution:**
- If CSV contains an unrecognized source, show it inline in the preview with two options:
  - **Map to existing source** — dropdown of configured sources
  - **Add as new source** — creates it in Settings with a default color, user can customize later
- Rows with unresolved sources are skipped until the user maps them

**Post-import behavior:**
- New entries added, existing entries updated — nothing deleted
- Imported entries immediately get the correct source badge
- Filter bar updates automatically to show any new sources
- A summary toast: "Import complete — 12 added, 3 updated, 2 skipped"

---

### Badges and Filtering — All Entry Types

Applies to all designs regardless of how they were added.

**What Replit needs to ensure:**

```javascript
// Badge color comes from the source config in Settings
function getSourceBadge(sourceSlug, configuredSources) {
  const source = configuredSources.find(s => s.slug === sourceSlug);
  return {
    label: source?.name  || sourceSlug,
    color: source?.color || '#9E9E9E'  // grey fallback for unknown sources
  };
}

// Filter bar — one button per configured source + All
function buildFilterBar(configuredSources) {
  return [
    { label: 'All', slug: null },
    ...configuredSources.filter(s => s.active).map(s => ({
      label: s.name,
      slug:  s.slug,
      color: s.color
    }))
  ];
}
```

- Every card shows a badge — N3D, CPL3D, manual, imported — all treated equally
- Filter bar shows All + one button per active source
- Badge colors assigned per source in Settings — each designer visually distinct
- API-sourced (N3D) and manual entries filtered the same way

---

## 🟢 CODE — Section 26: Filament Shop, Convention Velocity, Convention Prep & Spool Filters

---

### Feature A — Rename "Restock & Shop List" → "Filament Shop" + Restructure

**What Replit needs to do:**

1. Rename `"Restock & Shop List"` to `"Filament Shop"` everywhere — nav label, page title, breadcrumbs, any internal references
2. Remove the sales velocity restock suggestions section from this page — it moves to Convention Overview (Feature B below)
3. What remains on the page — two sections:

**Section 1 — Shop List (existing, unchanged)**
Spools under 30% remaining with Shop links to Bambu Lab store. No changes.

**Section 2 — Bambu Restock Tracker (new, add below Shop List)**

Watch list UI:
```
BAMBU RESTOCK TRACKER

[+ Add Item]

┌──────────────────────────────────────────────┐
│ PLA Matte Black          🔴 Out of Stock      │
│ Last checked: 4 mins ago                      │
│ Alert: Discord + Email                        │
│ bambulab.com/en-us/filaments/...  [Remove]   │
├──────────────────────────────────────────────┤
│ PETG Basic White         🟢 In Stock          │
│ Last checked: 4 mins ago                      │
│ Alert: Discord                                │
│ bambulab.com/en-us/filaments/...  [Remove]   │
└──────────────────────────────────────────────┘
```

Add item form:
- Filament type (text)
- Color name (text)
- Color hex (color picker)
- Bambu product URL
- Alert method: Discord / Email / Both

Stored in new Supabase collection `restockWatchlist`:
```javascript
{
  id:          uuid(),
  filamentType: 'PLA Matte',
  colorName:   'Matte Black',
  colorHex:    '#212121',
  bambuUrl:    'https://bambulab.com/en-us/filaments/...',
  alertMethod: 'both',        // 'discord' | 'email' | 'both'
  lastStatus:  'out_of_stock', // 'in_stock' | 'out_of_stock' | 'unknown'
  lastChecked: new Date().toISOString(),
  alertSent:   false          // true = already alerted this restock cycle
}
```

**Pi script — restock-monitor.js:**

```javascript
// restock-monitor.js
// Polls Bambu product pages every 15 minutes, alerts on restock

const { createClient } = require('@supabase/supabase-js');
const nodemailer        = require('nodemailer');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function postToDiscord(url, message) {
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: message })
    });
  } catch (e) { console.error('Discord error:', e.message); }
}

async function checkStockStatus(url) {
  try {
    const res  = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LayerDeck/1.0)' },
      signal: AbortSignal.timeout(10000)
    });
    const html = await res.text();

    // Check for "Add to Cart" button = in stock
    // Check for "Notify Me" or disabled button = out of stock
    // Note: Replit should inspect Bambu's actual page structure when building
    // and update these selectors to match. Handle gracefully if structure changes.
    if (html.includes('Add to Cart') && !html.includes('notify-me')) {
      return 'in_stock';
    } else if (html.includes('Notify Me') || html.includes('notify-me') || html.includes('sold-out')) {
      return 'out_of_stock';
    }
    return 'unknown';
  } catch (e) {
    return 'unknown';
  }
}

async function runRestockMonitor() {
  const { data } = await supabase
    .from('ha3d_user_data')
    .select('payload')
    .eq('collection', 'restockWatchlist')
    .single();

  const watchlist = JSON.parse(data?.payload || '[]');
  let   changed   = false;
  let   scraperBroken = 0;

  for (const item of watchlist) {
    const newStatus = await checkStockStatus(item.bambuUrl);
    const now       = new Date().toISOString();

    if (newStatus === 'unknown') scraperBroken++;

    // Restock detected — was out of stock, now in stock, haven't alerted yet
    if (item.lastStatus === 'out_of_stock' && newStatus === 'in_stock' && !item.alertSent) {
      const message = [
        `🟢 RESTOCK — Bambu ${item.filamentType} ${item.colorName}`,
        `Just came back in stock — go now before it sells out`,
        `→ ${item.bambuUrl}`
      ].join('
');

      if (['discord', 'both'].includes(item.alertMethod)) {
        await postToDiscord(process.env.DISCORD_WEBHOOK_BAMBU_RESTOCK, message);
      }

      if (['email', 'both'].includes(item.alertMethod)) {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: { user: 'hypedanubis3d@gmail.com', pass: process.env.GMAIL_APP_PASSWORD }
        });
        await transporter.sendMail({
          from:    '"LayerDeck" <hypedanubis3d@gmail.com>',
          to:      'hypedanubis3d@gmail.com',
          subject: `🟢 RESTOCK — Bambu ${item.filamentType} ${item.colorName}`,
          text:    message
        });
      }

      item.alertSent = true;
    }

    // Reset alertSent when item goes back out of stock (ready to alert next restock)
    if (newStatus === 'out_of_stock') item.alertSent = false;

    item.lastStatus  = newStatus;
    item.lastChecked = now;
    changed = true;
  }

  // If all items returning unknown — scraper likely broken, alert once
  if (scraperBroken === watchlist.length && watchlist.length > 0) {
    await postToDiscord(
      process.env.DISCORD_WEBHOOK_BAMBU_RESTOCK,
      '⚠️ Bambu restock tracker needs attention — unable to read product pages. Bambu may have changed their page structure.'
    );
  }

  if (changed) {
    await supabase.from('ha3d_user_data').upsert({
      collection: 'restockWatchlist',
      payload: JSON.stringify(watchlist)
    }, { onConflict: 'collection' });
  }

  console.log(`[${new Date().toISOString()}] Restock check done — ${watchlist.length} items checked`);
}

runRestockMonitor().catch(console.error);
```

---

### Feature B — Sales Velocity Restock → Convention Overview Tab

**What Replit needs to do:**

1. Remove the velocity suggestions section from the Filament Shop page
2. Add it to the **Overview tab** of each individual Convention/Event — above or below existing event summary stats

**Display on Convention Overview:**

```
📦 Suggested Pack Quantities
Based on your sales velocity and current stock

Batman Duck          Bring 8   (avg 6/event, stock 3 — print 5 more)
Dragon Creature Ball Bring 12  (avg 10/event, stock 7 — print 5 more)
Shiny Ball Red       Bring 4   (avg 4/event, stock 4 — all set ✅)
```

**Behavior:**
- Updates in real time as stock changes
- "Print X more" — tapping adds that product to the print queue with recommended qty pre-filled
- No sales history yet → show "No data yet" instead of a suggestion
- Suggestions are per-event — user can tap any row to manually override the recommended qty for that event

---

### Feature C — Convention Prep Reminders (Pi)

Pi checks daily at 7AM for upcoming conventions and fires Discord reminders at 7, 3, and 1 day out.

**Pi script — convention-prep.js:**

```javascript
// convention-prep.js — runs daily at 7AM
// Checks for upcoming conventions and fires Discord prep reminders

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const THRESHOLDS = [7, 3, 1]; // days before event

async function postToDiscord(url, message) {
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: message })
    });
  } catch (e) { console.error('Discord error:', e.message); }
}

async function runConventionPrep() {
  const { data } = await supabase
    .from('ha3d_user_data')
    .select('payload')
    .eq('collection', 'conventions')
    .single();

  const conventions = JSON.parse(data?.payload || '[]');
  const today       = new Date();
  today.setHours(0, 0, 0, 0);

  for (const event of conventions) {
    if (!event.startDate || !event.packList?.length) continue;

    const eventDate  = new Date(event.startDate);
    eventDate.setHours(0, 0, 0, 0);
    const daysAway   = Math.round((eventDate - today) / (1000 * 60 * 60 * 24));

    if (!THRESHOLDS.includes(daysAway)) continue;

    // Check if reminder already sent for this threshold
    const sentKey = `reminderSent_${daysAway}d`;
    if (event[sentKey]) continue;

    // Build low stock list using velocity suggestions
    const lowItems = event.packList
      .map(item => {
        const suggested = item.suggestedQty || item.qty || 0;
        const inStock   = item.stockQty     || 0;
        const needed    = Math.max(0, suggested - inStock);
        return needed > 0 ? { name: item.name, suggested, inStock, needed } : null;
      })
      .filter(Boolean);

    const dateLabel = eventDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    const lines     = [
      `📦 Convention Prep — ${event.name}`,
      `${daysAway} day${daysAway !== 1 ? 's' : ''} away · ${dateLabel}`,
      ``,
      `Based on your sales velocity your pack list may need attention.`
    ];

    if (lowItems.length > 0) {
      lines.push(`Low stock items:`);
      lowItems.forEach(i => {
        lines.push(`  • ${i.name} — stock ${i.inStock}, suggested ${i.suggested} (print ${i.needed} more)`);
      });
    } else {
      lines.push(`All pack quantities look good ✅`);
    }

    lines.push(``, `→ Review pack quantities in LayerDeck`);

    await postToDiscord(process.env.DISCORD_WEBHOOK_CONVENTION_PREP, lines.join('
'));

    // Mark reminder as sent — update convention record
    event[sentKey] = true;
    console.log(`[Convention Prep] Sent ${daysAway}-day reminder for ${event.name}`);
  }

  // Save updated convention records back to Supabase
  await supabase.from('ha3d_user_data').upsert({
    collection: 'conventions',
    payload: JSON.stringify(conventions)
  }, { onConflict: 'collection' });
}

runConventionPrep().catch(console.error);
```

**Behavior:**
- Each threshold (7d, 3d, 1d) fires once — `reminderSent_7d`, `reminderSent_3d`, `reminderSent_1d` flags on the convention record
- Only fires if the convention has items in its pack list
- Only lists items where stock < suggested qty — all-set items omitted
- Reuses velocity suggestion data from Feature B

---

### Feature D — Spools Tab: Filter by Filament Remaining

Add a dedicated remaining filament level filter to the Spools tab alongside existing search and material/printer/stock filters.

**Filter options:**
```javascript
const SPOOL_FILTERS = [
  { label: 'All',      min: 0,   max: Infinity },
  { label: 'Critical', min: 0,   max: 100   },  // under 100g
  { label: 'Low',      min: 100, max: 250   },  // 100–250g
  { label: 'OK',       min: 250, max: 500   },  // 250–500g
  { label: 'Full',     min: 500, max: Infinity } // over 500g
];
```

**Behavior:**
- Works alongside existing search and material/printer filters simultaneously — all filters stack
- Selected filter persists while on Spools tab, resets on navigation away
- Critical and Low spools retain their existing red/yellow visual treatment regardless of filter
- Empty state: "No spools at this level" when filter returns nothing
- Thresholds configurable in Settings (100g Critical, 250g Low, 500g Full boundary) — not hardcoded. Read from settings at runtime:

```javascript
// Read thresholds from Settings — fall back to defaults if not configured
const thresholds = settings?.spoolFilterThresholds || {
  critical: 100,
  low:      250,
  full:     500
};
```

---

## 🟢 CODE — Section 27: UX Improvements

---

### Feature A — Orders & Quick Add: Catalog as Default with Manual Option

When adding a new order or using Quick Add, the product selection should default to the design catalog (N3D, CPL3D, and manual entries) rather than a blank form. Manual entry remains available as a fallback.

**What Replit needs to change:**

In the Order creation form and Quick Add flow:

1. **Default state** — show a searchable catalog picker (same search component as the Convention Catalog tab, Feature 23). Searches across all catalog sources: N3D, CPL3D, and `designCatalog` collection.

2. **On catalog selection** — auto-fills: product name, sale price (from matched LayerDeck product or catalog entry), source badge.

3. **Manual option** — a **"Enter manually"** toggle/link below the catalog search. Switching to manual shows the existing free-text name and price fields. Switching back to catalog clears manual entries.

4. **Behavior:**
   - Catalog search filters to products already in the user's LayerDeck product list first, then shows full catalog results below
   - If catalog is empty or API unavailable, fall back to manual entry automatically with a subtle notice
   - Selection persists if user edits other fields — doesn't reset on other field interactions

---

### Feature B — Spool Scan: Duplicate Detection + Add to Existing

When adding a spool via barcode/QR scan, if a spool with the same filament type, color, and brand already exists in the `spools` collection, prompt the user before creating a duplicate.

**What Replit needs to add:**

After a scan resolves to a filament type and color:

```javascript
// Check for existing spool match
function findExistingSpool(spools, scannedData) {
  return spools.find(s =>
    s.brand?.toLowerCase()     === scannedData.brand?.toLowerCase() &&
    s.material?.toLowerCase()  === scannedData.material?.toLowerCase() &&
    s.colorName?.toLowerCase() === scannedData.colorName?.toLowerCase()
  );
}
```

If a match is found, show a prompt:

```
┌─────────────────────────────────────────┐
│  Spool already exists                   │
│                                         │
│  Bambu PLA Matte Black                  │
│  Current remaining: 312g                │
│                                         │
│  What would you like to do?             │
│                                         │
│  [Add to existing spool]                │
│  [Add as new spool]                     │
│  [Cancel]                               │
└─────────────────────────────────────────┘
```

**"Add to existing spool"** — opens a simple form pre-filled with the existing spool, allowing the user to update the remaining weight (e.g. top up to 1000g for a new roll added to the same spool record). Saves to the existing record — does not create a new one.

**"Add as new spool"** — proceeds with normal spool creation flow, creating a separate record.

**Behavior:**
- Match is by brand + material + color name — case-insensitive
- If multiple matches found (e.g. two Bambu PLA Matte Black spools), show all matches in the prompt so user can pick which one to update
- If no match found, proceed directly to new spool creation — no prompt shown

---

### Feature C — Push Notifications: Detailed Settings with Checkboxes

The Push Notifications section in Settings currently shows a simple "What you'll get" list. Replace this with a detailed, configurable list of notification types — each individually toggleable.

**What Replit needs to replace the current "What you'll get" section with:**

```
NOTIFICATIONS — WHAT YOU'LL RECEIVE

Print Alerts
  ☑ Print completed (per printer)
  ☑ Print failed (per printer)  
  ☑ Print running 25%+ over estimated time
  ☐ Print started

Orders
  ☑ New Shopify order received
  ☑ New Square sale (convention)
  ☐ Order marked as shipped
  ☑ Aging order alert (pending 3+ days)

Stock & Filament  
  ☑ Product low stock (at threshold)
  ☑ Spool running low (under 100g)
  ☐ Spool empty (0g remaining)

Convention
  ☑ Convention prep reminder (7 days before)
  ☑ Convention prep reminder (3 days before)
  ☑ Convention prep reminder (1 day before)
  ☐ Convention prep reminder (18 hours before)
  ☑ Convention prep reminder (1 hour before)

Daily Summary
  ☑ Nightly print summary (push notification)
  ☐ Filament consumed daily total

Pi & Printers
  ☑ Printer failed / error state
  ☑ Pi service down (hub or cameras)
  ☐ Printer connected / disconnected
  ☑ Bambu filament restock alert

Social
  ☐ Scheduled post sent
  ☑ Scheduled post failed
```

**Behavior:**
- Each checkbox saves to Supabase under a `notificationPreferences` key in the user's settings
- All notifications default to ON except those marked ☐ above (which default off)
- The Pi and LayerDeck server check these preferences before firing any notification — if a type is unchecked, that notification is silently skipped
- Settings persist across sessions
- Group headers are non-toggleable labels — individual items have the checkboxes
- "Send Test" button at top remains — fires a test for all currently enabled notification types

---

---

## 🟢 CODE — Section 28: AI Print Failure Detection

Zero ongoing cost by default — all inference runs locally on the Pi using Obico's open source ML model. Claude Vision available as an optional upgrade switchable from Settings at any time without code changes.

---

### Hardware Setup Note

> 📦 **Print before cameras arrive (Phase 0, Item 4f):**
> - P1S printers: Tapo C110 LCD Mount by "Worstest Nongineer" on MakerWorld
> - A1: Tapo C100/C110 A1 LCD Mount by "Amorphous" on MakerWorld
> - Print in **PLA** — mounts sit outside the printer on the LCD frame, not inside the enclosure, so no heat resistance needed
>
> These position the camera directly above the print bed at the optimal angle for failure detection.

---

### Architecture

```
Pi (MQTT listener)
  ↓ printer enters RUNNING state
failure-detection.js — starts monitoring that printer
  ↓ every 10 minutes (configurable)
ffmpeg — captures still frame from go2rtc stream
  ↓
inference-provider.js — routes to active provider
  ├── Local: Obico ML model (default, free, offline)
  └── Claude: Claude Vision via Anthropic API (optional)
  ↓
Normalized result: { failure_detected, confidence, failure_type, description }
  ↓
Pi acts based on confidence threshold
  ├── High → pause printer + alert + upload photo + LayerDeck banner
  ├── Medium → alert only + second check in 3 minutes
  └── Low → log silently, continue monitoring
```

---

### Part 1 — Obico ML Setup

> ⚠️ Note to Replit: Obico's full platform includes a web server, database, and cloud sync — none of that is needed. Only the ML inference component is required. Review **github.com/TheSpaghettiDetective/obico-server** and extract only the detection model and inference code.
>
> If a clean standalone pip package is not available, evaluate:
> 1. Their Docker image with only the ML service enabled
> 2. YOLOv8 fine-tuned on 3D printing failures as fallback
>
> Pi 5 handles both options comfortably. Inference takes 2–5 seconds per frame — well within the 10-minute check interval.

```bash
# Preferred — standalone pip install
pip3 install --break-system-packages obico-ml

# Alternative — clone and use inference only
git clone https://github.com/TheSpaghettiDetective/obico-server
# Replit to identify the minimal inference entrypoint
```

Run the detection service as a persistent PM2 process:
```bash
pm2 start failure-detection.js --name "failure-detection"
pm2 save
```

---

### Part 2 — inference-provider.js

```javascript
// ~/bambu-hub/inference-provider.js
// Swappable provider — switch between local and Claude Vision from Settings
// Core detection pipeline never changes regardless of provider

const { execSync }  = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function getDetectionProvider() {
  // Read from Supabase settings — 'local' or 'claude'
  try {
    const { data } = await supabase
      .from('ha3d_user_data')
      .select('payload')
      .eq('collection', 'detectionSettings')
      .single();
    const settings = JSON.parse(data?.payload || '{}');
    return settings.provider || 'local';
  } catch (e) {
    return 'local'; // safe default
  }
}

async function runLocalModel(imagePath) {
  // Obico ML inference — adjust entrypoint based on Replit's install approach
  try {
    const result = execSync(
      `python3 ~/bambu-hub/obico-infer.py "${imagePath}"`,
      { encoding: 'utf8', timeout: 30000 }
    );
    const parsed = JSON.parse(result.trim());
    const score  = parsed.score || 0;

    return {
      failure_detected: score >= 0.5,
      confidence:       score >= 0.8 ? 'high' : score >= 0.5 ? 'medium' : 'low',
      failure_type:     parsed.failure_type || (score >= 0.5 ? 'detected' : 'none'),
      description:      parsed.description  || `Obico score: ${score.toFixed(2)}`,
      raw_score:        score
    };
  } catch (e) {
    console.error('Local model error:', e.message);
    return { failure_detected: false, confidence: 'low', failure_type: 'none', description: 'Model error' };
  }
}

async function runClaudeVision(imagePath) {
  const fs   = require('fs');
  const img  = fs.readFileSync(imagePath).toString('base64');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method:  'POST',
    headers: {
      'x-api-key':         process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type':      'application/json'
    },
    body: JSON.stringify({
      model:      'claude-haiku-4-5',
      max_tokens: 256,
      messages: [{
        role:    'user',
        content: [
          {
            type:       'image',
            source:     { type: 'base64', media_type: 'image/jpeg', data: img }
          },
          {
            type: 'text',
            text: `You are a 3D print failure detection system. Analyze this image from a printer camera.
Respond ONLY with valid JSON, no other text:
{
  "failure_detected": true/false,
  "confidence": "high/medium/low",
  "failure_type": "spaghetti/bed_adhesion/layer_shift/none",
  "description": "one brief sentence"
}`
          }
        ]
      }]
    })
  });

  const data  = await response.json();
  const text  = data.content?.[0]?.text || '{}';
  try {
    return JSON.parse(text);
  } catch (e) {
    return { failure_detected: false, confidence: 'low', failure_type: 'none', description: 'Parse error' };
  }
}

// Main export — always returns same normalized shape
async function analyzeFrame(imagePath) {
  const provider = await getDetectionProvider();
  return provider === 'claude'
    ? await runClaudeVision(imagePath)
    : await runLocalModel(imagePath);
}

module.exports = { analyzeFrame };
```

---

### Part 3 — failure-detection.js

```javascript
// ~/bambu-hub/failure-detection.js
// Monitors MQTT state, captures frames on active printers, runs inference

const { execSync }   = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const path           = require('path');
const fs             = require('fs');
const { analyzeFrame } = require('./inference-provider');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// Read from printers.json — same config used by hub server
const PRINTERS = require('./printers.json');

// State per printer
const state = {};
PRINTERS.forEach(p => {
  state[p.name] = {
    active:         false,
    checkTimer:     null,
    pendingRecheck: false
  };
});

async function getSettings() {
  try {
    const { data } = await supabase
      .from('ha3d_user_data')
      .select('payload')
      .eq('collection', 'detectionSettings')
      .single();
    return JSON.parse(data?.payload || '{}');
  } catch (e) { return {}; }
}

async function captureFrame(printer) {
  const tmpPath = `/tmp/detection_${printer.name.replace(/\s/g, '_')}_${Date.now()}.jpg`;
  try {
    execSync(
      `ffmpeg -y -i "${printer.cameraUrl}" -frames:v 1 -q:v 2 "${tmpPath}"`,
      { timeout: 15000 }
    );
    return tmpPath;
  } catch (e) {
    console.error(`Frame capture failed for ${printer.name}:`, e.message);
    return null;
  }
}

async function uploadToSupabase(imagePath, printerName) {
  const filename = `failures/ai_${printerName.replace(/\s/g, '_')}_${Date.now()}.jpg`;
  const buffer   = fs.readFileSync(imagePath);
  const { data } = await supabase.storage
    .from('layerstack-media')
    .upload(filename, buffer, { contentType: 'image/jpeg', upsert: false });
  const { data: urlData } = supabase.storage
    .from('layerstack-media')
    .getPublicUrl(filename);
  return urlData.publicUrl;
}

async function postToDiscord(message, imageUrl = null) {
  const url = process.env.DISCORD_WEBHOOK_PRINT_WATCH;
  if (!url) return;
  try {
    await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        content: message,
        ...(imageUrl && { embeds: [{ image: { url: imageUrl } }] })
      })
    });
  } catch (e) { console.error('Discord error:', e.message); }
}

async function handleHighConfidence(printer, result, imagePath) {
  console.log(`[AI Detection] HIGH confidence failure on ${printer.name} — pausing`);

  // 1. Pause printer via hub server
  try {
    await fetch(`http://localhost:3000/control`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ printer: printer.name, command: 'pause' })
    });
  } catch (e) { console.error('Pause failed:', e.message); }

  // 2. Upload photo to Supabase
  const photoUrl = await uploadToSupabase(imagePath, printer.name);

  // 3. Discord alert with photo
  const msg = [
    `🤖 Failure Detected — ${printer.name}`,
    `Type: ${result.failure_type}`,
    `Confidence: High (${result.raw_score ? Math.round(result.raw_score * 100) + '%' : 'High'})`,
    `Print paused automatically.`,
    ``,
    `→ Resume or cancel in LayerDeck`
  ].join('
');
  await postToDiscord(msg, photoUrl);

  // 4. Write failed record to Supabase — LayerDeck picks it up and shows banner
  await supabase.from('ha3d_user_data').upsert({
    collection: `aiFailure_${printer.name}`,
    payload: JSON.stringify({
      printerName:   printer.name,
      failureType:   result.failure_type,
      confidence:    'high',
      description:   result.description,
      photoUrl,
      timestamp:     new Date().toISOString(),
      status:        'paused_by_ai',  // LayerDeck shows "Paused by AI" banner when this is set
      dismissed:     false
    })
  }, { onConflict: 'collection' });

  // Cleanup temp file
  try { fs.unlinkSync(imagePath); } catch (e) {}
}

async function handleMediumConfidence(printer, result, imagePath) {
  console.log(`[AI Detection] MEDIUM confidence on ${printer.name} — alerting, scheduling recheck`);

  const photoUrl = await uploadToSupabase(imagePath, printer.name);
  const msg = [
    `👀 Print Watch — ${printer.name}`,
    `Confidence: Medium (${result.raw_score ? Math.round(result.raw_score * 100) + '%' : 'Medium'}) — possible issue detected`,
    `Running second check in 3 minutes — no action taken yet.`
  ].join('
');
  await postToDiscord(msg, photoUrl);

  try { fs.unlinkSync(imagePath); } catch (e) {}

  // Schedule recheck in 3 minutes
  if (!state[printer.name].pendingRecheck) {
    state[printer.name].pendingRecheck = true;
    setTimeout(async () => {
      state[printer.name].pendingRecheck = false;
      await runDetectionCycle(printer, true); // isRecheck = true
    }, 3 * 60 * 1000);
  }
}

async function runDetectionCycle(printer, isRecheck = false) {
  const settings = await getSettings();
  const enabled  = settings.enabledPrinters?.[printer.name] !== false;
  if (!enabled) return;

  const imagePath = await captureFrame(printer);
  if (!imagePath) return;

  const result = await analyzeFrame(imagePath);
  console.log(`[AI Detection] ${printer.name}: ${result.confidence} — ${result.failure_type}`);

  if (result.confidence === 'high') {
    await handleHighConfidence(printer, result, imagePath);
    clearInterval(state[printer.name].checkTimer);
    state[printer.name].checkTimer = null;
    state[printer.name].active     = false;
  } else if (result.confidence === 'medium') {
    if (isRecheck) {
      // Recheck still medium or worse — escalate to high flow
      await handleHighConfidence(printer, result, imagePath);
      clearInterval(state[printer.name].checkTimer);
      state[printer.name].checkTimer = null;
      state[printer.name].active     = false;
    } else {
      await handleMediumConfidence(printer, result, imagePath);
    }
  } else {
    // Low — log silently, continue
    console.log(`[AI Detection] ${printer.name}: low confidence — continuing`);
    try { fs.unlinkSync(imagePath); } catch (e) {}
  }
}

function startMonitoring(printer, intervalMinutes) {
  if (state[printer.name].active) return;
  console.log(`[AI Detection] Starting monitoring for ${printer.name} every ${intervalMinutes} min`);
  state[printer.name].active = true;
  state[printer.name].checkTimer = setInterval(
    () => runDetectionCycle(printer),
    intervalMinutes * 60 * 1000
  );
}

function stopMonitoring(printer) {
  if (!state[printer.name].active) return;
  console.log(`[AI Detection] Stopping monitoring for ${printer.name}`);
  clearInterval(state[printer.name].checkTimer);
  state[printer.name].active     = false;
  state[printer.name].checkTimer = null;
}

// Poll hub server for MQTT state and start/stop monitoring accordingly
async function pollPrinterStates() {
  const settings = await getSettings();
  const interval = settings.checkIntervalMinutes || 10;

  try {
    const res    = await fetch('http://localhost:3000/status');
    const status = await res.json();

    for (const printer of PRINTERS) {
      const printerStatus = status[printer.name];
      const gcodeState    = printerStatus?.gcode_state;
      const isRunning     = gcodeState === 'RUNNING';

      if (isRunning && !state[printer.name].active) {
        startMonitoring(printer, interval);
      } else if (!isRunning && state[printer.name].active) {
        stopMonitoring(printer);
      }
    }
  } catch (e) {
    console.error('[AI Detection] Could not reach hub server:', e.message);
  }
}

// Poll MQTT state every 30 seconds
setInterval(pollPrinterStates, 30 * 1000);
pollPrinterStates(); // run immediately on start
console.log('[AI Detection] Service started');
```

---

### Part 4 — LayerDeck: "Paused by AI" Banner

When `aiFailure_{printerName}` record exists in Supabase with `status: 'paused_by_ai'` and `dismissed: false`, LayerDeck shows a banner on that printer's card:

```
┌─────────────────────────────────────────────┐
│  🤖 Paused by AI — possible failure detected │
│  Type: Spaghetti  ·  Confidence: High        │
│  [thumbnail photo]                           │
│                                              │
│  [▶ Resume Print]    [⏹ Cancel Print]        │
│  [Dismiss]                                   │
└─────────────────────────────────────────────┘
```

- **Resume** — calls `/control` with `command: 'resume'` for that printer, then sets `dismissed: true`
- **Cancel** — calls `/control` with `command: 'stop'`, sets `dismissed: true`
- **Dismiss** — sets `dismissed: true` without sending any command (if user handles it physically)
- Once dismissed, banner disappears and monitoring resumes on next print

---

### Part 5 — AI Detection Settings (Printers Settings Page)

Add an **AI Detection** section to the Printers settings page:

```
AI DETECTION

Enable per printer:
  A1         ✅ Enabled
  P1 Room    ✅ Enabled
  P1 Closet  ✅ Enabled

Check interval:    [10 min ▾]   (5 / 10 / 15 / 20 / 30)
Auto-pause:        ✅ On   (disable for alerts-only without auto-pause)

High confidence threshold:   [0.8 ▾]   (0.6 / 0.7 / 0.8 / 0.9)
Medium confidence threshold: [0.5 ▾]   (0.3 / 0.4 / 0.5 / 0.6)

Detection Provider:
  ● Local Model (Free)
    Obico ML running on Pi · No API cost
    Status: ✅ Model loaded and running

  ○ Claude Vision (API)
    Claude Haiku 4.5 · ~$7–14/month at current settings
    Anthropic API Key: [••••••••••••••••]  [Edit]
```

- Settings saved to `detectionSettings` collection in Supabase
- Switching providers takes effect on next check cycle — no restart needed
- Model status indicator polls `/model-status` endpoint on the Pi hub
- Estimated Claude cost calculated from: check interval × active print hours × ~$0.0004/image
- Anthropic API key stored server-side only — never in frontend code

Add to Pi hub server.js:
```javascript
// Model status endpoint — lets LayerDeck show detection status
app.get('/model-status', (req, res) => {
  try {
    // Check if Obico process or detection service is running
    const pm2List = require('child_process')
      .execSync('pm2 jlist', { encoding: 'utf8' });
    const procs   = JSON.parse(pm2List);
    const detect  = procs.find(p => p.name === 'failure-detection');
    res.json({
      detection_running: detect?.pm2_env?.status === 'online',
      model:             'obico-local'
    });
  } catch (e) {
    res.json({ detection_running: false, model: 'unknown' });
  }
});
```

---

---

## 🟢 CODE — Section 29: Tapo P115 Smart Plug Integration

Remote power control per printer, real wattage logging replacing estimated electricity cost, auto power-off after prints, and scheduled power-on. Uses the same Tapo ecosystem already in place for cameras — no new credentials needed.

---

### Part 1 — Plug Connection (server.js)

Add plug connection alongside existing printer MQTT connections on hub server startup. Plugs stored in `printers.json` via `plugIp` field already added in Phase 1.

```javascript
// Add to server.js — import
const { Client } = require('tplink-smarthome-api');
const tapoClient = new Client();

// Plug state per printer
const plugs = {};

// Connect to all plugs on startup
async function connectPlugs() {
  for (const printer of PRINTERS) {
    if (!printer.plugIp) continue;
    try {
      const plug = await tapoClient.getDevice({ host: printer.plugIp });
      plugs[printer.name] = plug;
      console.log(`[Plug] Connected: ${printer.name} @ ${printer.plugIp}`);
    } catch (e) {
      console.error(`[Plug] Failed to connect ${printer.name}:`, e.message);
      plugs[printer.name] = null;
    }
  }
}
connectPlugs();

// Auto-power-off timers — kept server-side so page refresh doesn't lose state
const powerOffTimers = {};
```

---

### Part 2 — Plug API Endpoints (server.js)

```javascript
// GET /plugs — live state of all 3 plugs
app.get('/plugs', async (req, res) => {
  const states = {};
  for (const [name, plug] of Object.entries(plugs)) {
    if (!plug) { states[name] = { online: false }; continue; }
    try {
      const info   = await plug.getSysInfo();
      const energy = await plug.emeter.getRealtime();
      states[name] = {
        online:     true,
        powered:    info.relay_state === 1,
        wattage:    energy.power    || 0,
        voltage:    energy.voltage  || 0,
        current:    energy.current  || 0,
        pendingOff: !!powerOffTimers[name],
        offInSecs:  powerOffTimers[name]?.remainingSecs || null
      };
    } catch (e) {
      states[name] = { online: false };
    }
  }
  res.json(states);
});

// POST /plugs/:name/on
app.post('/plugs/:name/on', async (req, res) => {
  const plug = plugs[req.params.name];
  if (!plug) return res.status(404).json({ error: 'Plug not found' });
  await plug.setPowerState(true);
  postToDiscord(process.env.DISCORD_WEBHOOK_PRINT_ALERTS,
    `🔌 ${req.params.name} powered ON remotely
Via LayerDeck`);
  res.json({ ok: true });
});

// POST /plugs/:name/off
app.post('/plugs/:name/off', async (req, res) => {
  const plug = plugs[req.params.name];
  if (!plug) return res.status(404).json({ error: 'Plug not found' });
  await plug.setPowerState(false);
  // Clear any pending auto power-off timer
  if (powerOffTimers[req.params.name]) {
    clearTimeout(powerOffTimers[req.params.name].timer);
    delete powerOffTimers[req.params.name];
  }
  postToDiscord(process.env.DISCORD_WEBHOOK_PRINT_ALERTS,
    `🔌 ${req.params.name} powered OFF remotely
Via LayerDeck`);
  res.json({ ok: true });
});

// POST /plugs/:name/cancel-poweroff — cancels pending auto power-off
app.post('/plugs/:name/cancel-poweroff', async (req, res) => {
  const name = req.params.name;
  if (powerOffTimers[name]) {
    clearTimeout(powerOffTimers[name].timer);
    delete powerOffTimers[name];
    console.log(`[Plug] Auto power-off cancelled for ${name}`);
  }
  res.json({ ok: true });
});

// GET /plugs/:name/energy — energy usage data
app.get('/plugs/:name/energy', async (req, res) => {
  const plug = plugs[req.params.name];
  if (!plug) return res.status(404).json({ error: 'Plug not found' });
  try {
    const energy = await plug.emeter.getDayStats(
      new Date().getFullYear(), new Date().getMonth() + 1
    );
    res.json(energy);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
```

---

### Part 3 — Auto Power-Off After Print Completes

Extend `onPrintFinished` (Feature 1, Section 13) to start the auto power-off countdown.

```javascript
// Add inside onPrintFinished — after existing finish handling
async function scheduleAutoPowerOff(printerName, jobName, printDuration) {
  const settings = await getDetectionSettings(); // reuse settings fetch
  const printerSettings = settings.plugSettings?.[printerName] || {};
  const autoPowerOff    = printerSettings.autoPowerOff !== false; // default on
  const cooldownMins    = printerSettings.cooldownMinutes || 10;
  const cooldownMs      = cooldownMins * 60 * 1000;

  if (!autoPowerOff || !plugs[printerName]) return;

  // 2-minute delay before sending Discord alert
  setTimeout(async () => {
    // Send Discord alert with countdown info
    await postToDiscord(process.env.DISCORD_WEBHOOK_PRINT_ALERTS, [
      `✅ Print Complete — ${printerName}`,
      `${jobName} · ${printDuration}`,
      ``,
      `Auto power-off in ${cooldownMins} minutes.`,
      `Starting another print? Open LayerDeck to keep it on.`,
      `→ https://layerdeck.replit.app`
    ].join('
'));

    // Write pending power-off state to Supabase so LayerDeck shows banner
    const offAt = Date.now() + cooldownMs - (2 * 60 * 1000); // already waited 2 min
    await supabase.from('ha3d_user_data').upsert({
      collection: `pendingPowerOff_${printerName}`,
      payload: JSON.stringify({
        printerName,
        offAt: new Date(offAt).toISOString(),
        cooldownMins,
        dismissed: false
      })
    }, { onConflict: 'collection' });

  }, 2 * 60 * 1000);

  // Set the actual power-off timer
  const startedAt = Date.now();
  const timer = setTimeout(async () => {
    const plug = plugs[printerName];
    if (plug) {
      await plug.setPowerState(false);
      await postToDiscord(process.env.DISCORD_WEBHOOK_PRINT_ALERTS,
        `🔌 ${printerName} powered off automatically — bed cooldown complete`
      );
    }
    // Clear Supabase pending state
    await supabase.from('ha3d_user_data').upsert({
      collection: `pendingPowerOff_${printerName}`,
      payload: JSON.stringify({ dismissed: true })
    }, { onConflict: 'collection' });
    delete powerOffTimers[printerName];
  }, cooldownMs);

  powerOffTimers[printerName] = {
    timer,
    startedAt,
    cooldownMs,
    get remainingSecs() {
      return Math.max(0, Math.round((cooldownMs - (Date.now() - startedAt)) / 1000));
    }
  };
}

// CRITICAL: Auto power-off must NEVER be called from failure handlers
// Only called from onPrintFinished (FINISH state)
// onPrintFailed and AI detection → pause only, no power-off
```

---

### Part 4 — Wattage Polling During Active Prints

```javascript
// Add to server.js — poll wattage every 60 seconds during RUNNING state
const wattageLog = {}; // { printerName: [{ ts, watts }] }

setInterval(async () => {
  for (const printer of PRINTERS) {
    const status = printerStatus[printer.name];
    if (status?.gcode_state !== 'RUNNING') continue;
    if (!plugs[printer.name]) continue;

    try {
      const energy = await plugs[printer.name].emeter.getRealtime();
      const watts  = energy.power || 0;

      if (!wattageLog[printer.name]) wattageLog[printer.name] = [];
      wattageLog[printer.name].push({ ts: Date.now(), watts });

      // Attach running wattage to printer status so LayerDeck can display it
      if (!printerStatus[printer.name]) printerStatus[printer.name] = {};
      printerStatus[printer.name].liveWatts = watts;
    } catch (e) {
      console.error(`[Wattage] ${printer.name}:`, e.message);
    }
  }
}, 60 * 1000);

// Calculate actual electricity cost from wattage log for a completed print
function calculateRealElectricityCost(printerName, startTime, endTime, ratePerKwh) {
  const log      = (wattageLog[printerName] || [])
    .filter(r => r.ts >= startTime && r.ts <= endTime);

  if (log.length === 0) return null; // fall back to estimate if no readings

  // Average watts × hours = kWh
  const avgWatts  = log.reduce((s, r) => s + r.watts, 0) / log.length;
  const hours     = (endTime - startTime) / 3_600_000;
  const kwh       = (avgWatts * hours) / 1000;
  const cost      = kwh * ratePerKwh;

  return { kwh: parseFloat(kwh.toFixed(3)), cost: parseFloat(cost.toFixed(4)) };
}
```

---

### Part 5 — LayerDeck UI Changes

**Printer card — power button and live wattage:**
- Add a power toggle button (🔌) to each printer card alongside Pause/Resume/Stop
- Show current wattage on card: `Nozzle: 220°  Bed: 35°  Power: 43W`
- Power state indicator: green dot = powered on, grey dot = off
- When powering off an active printer (RUNNING state): show confirmation dialog — "Printer is active — are you sure?"

**Pending power-off banner on printer card:**
```
🔌 Auto power-off in 9:32
[Keep On]  [Power Off Now]
```
- Banner appears when `pendingPowerOff_{printerName}` Supabase record has `dismissed: false`
- Countdown reads `offAt` timestamp from Supabase record
- **Keep On** → calls `POST /plugs/:name/cancel-poweroff` → dismisses banner
- **Power Off Now** → calls `POST /plugs/:name/off` → dismisses banner
- If countdown reaches 0 with no action, Pi handles the power-off and updates Supabase

**Desktop Companion:** Same power button and wattage display on each printer card — same endpoints, no extra work since companion reuses main app data layer.

---

### Part 6 — Settings (Printers Settings Page)

Add a **Smart Plug** section:

```
SMART PLUG — POWER SETTINGS

A1
  Auto power-off after print:  ✅ On
  Cooldown duration:           [10 min ▾]  (0–60 min)
  Scheduled power-on:          Daily at [9:00 AM ▾]
  Days:  [Mon] [Tue] [Wed] [Thu] [Fri] [Sat] [Sun]

P1 Room
  Auto power-off after print:  ✅ On
  Cooldown duration:           [10 min ▾]
  Scheduled power-on:          Off

P1 Closet
  Auto power-off after print:  ✅ On
  Cooldown duration:           [10 min ▾]
  Scheduled power-on:          Off
```

- Settings saved to Supabase under `plugSettings` key
- Scheduled power-on generates cron entries on the Pi — Replit to add a `/plugs/update-schedule` endpoint that rewrites the relevant crontab entries when schedule settings change

---

### Part 7 — Nightly Report Electricity Section

Update `nightly-report.js` to use real P115 data instead of estimated wattage:

```javascript
// Replace estimated electricity section with real P115 readings
async function getDailyEnergyData(date) {
  const results = {};
  for (const printer of PRINTERS) {
    if (!plugs[printer.name]) continue;
    try {
      const stats = await plugs[printer.name].emeter.getDayStats(
        date.getFullYear(), date.getMonth() + 1
      );
      const dayEntry = stats.day_list?.find(d => d.day === date.getDate());
      const kwh      = dayEntry?.energy || 0;
      const rate     = parseFloat(process.env.ELECTRICITY_RATE || '0.13');
      results[printer.name] = {
        kwh:  parseFloat(kwh.toFixed(3)),
        cost: parseFloat((kwh * rate).toFixed(4))
      };
    } catch (e) {
      results[printer.name] = { kwh: 0, cost: 0, error: true };
    }
  }
  return results;
}

// In the nightly email and Discord report, replace estimated electricity with:
// ⚡ Electricity Today
// A1:        0.42 kWh · $0.05
// P1 Room:   0.38 kWh · $0.07
// P1 Closet: 0.51 kWh · $0.07
// Total:     1.31 kWh · $0.17
```

> Add `ELECTRICITY_RATE` to `.bashrc` in Step 13 — default `0.13` ($/kWh). User configures their actual rate in LayerDeck Settings → Revenue.

---

---

## 🟢 CODE — Section 30: Skip Object Control + Filament Refund Automation

---

### Part 1 — Parse Object Boundary Data from MQTT (server.js)

When a print-by-object sliced file is running, Bambu's MQTT payload includes object boundary data. Parse and store this on every MQTT message update.

```javascript
// Add to MQTT message handler in server.js
// Inside the handler where printerStates[printerName] is updated

function parseObjectData(mqttPayload) {
  // Check for object list in payload — field name to confirm against OpenBambuAPI docs
  // Likely field: print.obj_list or print.subtask_obj_list
  const objList = mqttPayload?.print?.obj_list || mqttPayload?.print?.subtask_obj_list || null;

  if (!objList || objList.length === 0) return null;

  return {
    objectList:       objList,           // full list of objects on plate
    currentObjectId:  mqttPayload?.print?.current_obj_id || objList[0]?.id || null,
    currentObjectIdx: mqttPayload?.print?.current_obj_idx || 0,
    totalObjects:     objList.length,
    hasObjectData:    true
  };
}

// Store in printerStates alongside existing MQTT fields
printerStates[printerName].objectData = parseObjectData(mqttData) || { hasObjectData: false };

// On FAILED state — snapshot full MQTT state for dialog pre-fill
// User may open the dialog minutes after failure, state may have changed
if (mqttData?.print?.gcode_state === 'FAILED') {
  printerStates[printerName].failureSnapshot = {
    mcPercent:   mqttData?.print?.mc_percent      || 0,
    failReason:  mqttData?.print?.fail_reason      || '',
    failedAt:    new Date().toISOString(),
    startTime:   printerStates[printerName].printStartTime || null
  };
}
```

> ⚠️ Note to Replit: Cross-reference the exact field names for object boundary data and current object ID against the OpenBambuAPI docs (linked in References). If field names differ from above, adjust accordingly. Test against a print-by-object sliced file and inspect raw MQTT messages to confirm before building the UI.

---

### Part 2 — Skip Command on Pi Hub (server.js)

Extend the existing `/control` endpoint to handle the `skip` command:

```javascript
// In the /control endpoint — add skip alongside pause | resume | stop
app.post('/control', (req, res) => {
  const { printer, command, objectId } = req.body;

  if (!['pause', 'resume', 'stop', 'skip'].includes(command)) {
    return res.status(400).json({ error: 'Invalid command' });
  }

  const p = printers[printer];
  if (!p) return res.status(404).json({ error: 'Printer not found' });

  let payload;

  if (command === 'skip') {
    if (!objectId) return res.status(400).json({ error: 'objectId required for skip' });
    payload = JSON.stringify({
      print: {
        sequence_id: '0',
        command:     'skip_objects',
        obj_list:    [objectId]
      }
    });
  } else {
    // Existing pause/resume/stop handling — unchanged
    payload = JSON.stringify({
      print: {
        sequence_id: '0',
        command
      }
    });
  }

  p.client.publish(p.REQUEST_TOPIC, payload);
  res.json({ ok: true });
});
```

Also expose object state via the `/status` endpoint so LayerDeck always has it:

```javascript
// In GET /status response — add objectData per printer
res.json(
  Object.fromEntries(
    Object.entries(printerStates).map(([name, state]) => [
      name,
      {
        ...state,
        objectData:      state.objectData      || { hasObjectData: false },
        failureSnapshot: state.failureSnapshot || null
      }
    ])
  )
);
```

---

### Part 3 — Skip Object Button on Printer Card (LayerDeck)

**Button visibility logic — show only when object data is present:**

```javascript
// In the printer card render — Skip Object button
function renderControls(printerState) {
  const { gcode_state, objectData } = printerState;
  const isActive = ['RUNNING', 'PAUSE'].includes(gcode_state);

  return {
    showPause:      isActive && gcode_state !== 'PAUSE',
    showResume:     gcode_state === 'PAUSE',
    showStop:       isActive,
    showSkipObject: isActive && objectData?.hasObjectData === true
    // Skip is ABSENT (not disabled) when object data unavailable — never shown greyed out
  };
}
```

**Printer card display when object data present:**

```
Current object: 3 of 7 — ShinyBall_Red_obj3
[Pause]  [Resume]  [Stop]  [Skip Object]
```

**Printer card display without object data:**

```
[Pause]  [Resume]  [Stop]
```

**Skip Object button tap flow:**

```javascript
async function handleSkipObject(printerName, printerState) {
  const { currentObjectId, currentObjectIdx, totalObjects, objectList } =
    printerState.objectData;

  // 1. Confirmation dialog
  const confirmed = await showDialog({
    title:   'Skip current object?',
    message: 'Skip current object and move to next? This cannot be undone.',
    confirm: 'Skip Object',
    cancel:  'Cancel'
  });
  if (!confirmed) return;

  // 2. Send skip command
  await fetch(`${PI_URL}/control`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      printer:  printerName,
      command:  'skip',
      objectId: currentObjectId
    })
  });

  // 3. Toast
  showToast('Object skipped — printing next object');

  // 4. Open filament refund dialog scoped to skipped object
  const skippedObject = objectList.find(o => o.id === currentObjectId);
  openSkipRefundDialog({
    printerName,
    skippedObject,
    mcPercent:   printerState.mc_percent,
    totalFilament: printerState.totalFilamentEstimate || null,
    totalObjects,
    objectIdx:   currentObjectIdx
  });
}
```

---

### Part 4 — Filament Refund Dialog: Skipped Object

Opens automatically after skip is confirmed. Pre-filled — no manual entry needed.

**Filament estimate logic (fallback to proportional):**

```javascript
function estimateSkippedObjectRefund(skippedObject, totalFilamentG, totalObjects, mcPercent) {
  // Preferred: use per-object filament from MQTT if available
  const perObjectFilament = skippedObject?.filament_g || null;

  // Fallback: proportional estimate — divide total evenly
  const objectFilament = perObjectFilament || (totalFilamentG / totalObjects);

  // Refund = object's estimated filament × (1 - completion%)
  const completionFraction = (mcPercent || 0) / 100;
  const refundG = Math.round(objectFilament * (1 - completionFraction));

  return {
    objectFilamentG:   Math.round(objectFilament),
    usedG:             Math.round(objectFilament * completionFraction),
    refundG,
    isProportional:    !perObjectFilament  // flag if estimate was proportional
  };
}
```

**Dialog display:**

```
Object skipped at 40% completion

FILAMENT REFUND PREVIEW
ShinyBall_Red_obj3    5g used / 12g total    +7g refund
⚠️ Estimated proportionally (per-object data unavailable)  ← shown if isProportional

Total refund:  +7g

[Confirm]  [Cancel]
```

**On confirm — log to print job record in Supabase:**

```javascript
// Append to existing print job record
const update = {
  skippedObjects: [
    ...(existingRecord.skippedObjects || []),
    {
      objectId:               skippedObject.id,
      name:                   skippedObject.name || `Object ${objectIdx + 1}`,
      estimatedGramsRefunded: refund.refundG,
      percentComplete:        mcPercent,
      isProportionalEstimate: refund.isProportional,
      skippedAt:              new Date().toISOString()
    }
  ],
  filamentRefunded: (existingRecord.filamentRefunded || 0) + refund.refundG
};
await updatePrintRecord(existingRecord.id, update);
```

---

### Part 5 — Failed Print Dialog: Pre-fill from MQTT Snapshot

The existing "Mark Print as Finished" dialog currently requires manual input. Auto-fill it when Pi data is available.

**On MQTT FAILED state or AI detection pause:**

```javascript
// When opening the failed print dialog — check for Pi snapshot first
async function openFailedPrintDialog(printerName) {
  const status = await fetch(`${PI_URL}/status`).then(r => r.json());
  const snapshot = status[printerName]?.failureSnapshot;

  const prefill = snapshot ? {
    mcPercent:   snapshot.mcPercent,
    timeElapsed: snapshot.startTime
      ? formatDuration(Math.round((new Date(snapshot.failedAt) - new Date(snapshot.startTime)) / 60000))
      : null,
    failReason:  snapshot.failReason || '',
    hasData:     true
  } : {
    hasData: false  // fall back to manual entry — no regression
  };

  showFailedPrintDialog(prefill);
}
```

**Dialog behavior:**
- If `hasData: true` — fields pre-filled, user reviews and optionally edits fail reason, taps Confirm
- If `hasData: false` — fields blank, manual entry exactly as today — no regression
- Filament refund preview calculates instantly from pre-filled `mcPercent`
- Dialog opens automatically on FAILED state detection — user doesn't need to find it manually

---

**Important note for Thiago:**
Skip Object only works on prints sliced with **"Print by Object"** enabled in Bambu Studio — not "Print by Layer." Make this a habit when slicing multi-object plates to ensure the Skip Object button is always available when you need it.

---

---

## 🟢 CODE — Section 31: AMS Slot Filament Mapping

When you load a spool and assign it to an AMS slot in LayerDeck, the Pi writes the filament profile back to the printer via MQTT — the same way Bambu Handy does it. When you then open Bambu Studio or Handy and load a file, the AMS reads the correct filament already mapped. You confirm in the slicer but the mapping is already right — no manual entry needed.

---

### How It Works

```
LayerDeck — user selects filament from database for a slot
    ↓
Pi hub server — POST /ams/set-slot
    ↓
MQTT publish to printer REQUEST_TOPIC
    ↓
Printer AMS tray updated with filament profile
    ↓
Bambu Studio / Handy reads the updated AMS state
    ↓
Filament already mapped when user opens slicer ✅
```

---

### Part 1 — Pi Hub: /ams/set-slot Endpoint

Add to server.js alongside existing `/control` and `/plugs` endpoints:

```javascript
// POST /ams/set-slot
// Writes filament profile to a specific AMS tray on a specific printer
// Body: { printer, amsId, trayId, filamentName, filamentType, color, nozzleTemp, bedTemp }

app.post('/ams/set-slot', async (req, res) => {
  const { printer, amsId, trayId, filamentName, filamentType, color, nozzleTemp, bedTemp } = req.body;

  const p = printers[printer];
  if (!p) return res.status(404).json({ error: 'Printer not found' });

  // MQTT payload to set AMS tray filament
  // Field names to verify against OpenBambuAPI docs — adjust if needed
  const payload = JSON.stringify({
    print: {
      sequence_id: '0',
      command:     'ams_filament_setting',
      ams_id:      amsId,       // AMS unit index (0, 1...)
      tray_id:     trayId,      // tray slot index within AMS unit (0–3)
      tray_color:  color.replace('#', '').toUpperCase() + 'FF', // RRGGBBAA format
      nozzle_temp_min: nozzleTemp - 10,
      nozzle_temp_max: nozzleTemp + 20,
      tray_type:   filamentType,  // 'PLA', 'PETG', 'ABS', etc.
      tray_sub_brands: filamentName, // displayed in Bambu Studio / Handy
      bed_temp:    bedTemp,
      bed_temp_type: '0',
      drying_temp: 55,
      drying_time: '0'
    }
  });

  p.client.publish(p.REQUEST_TOPIC, payload);

  console.log(`[AMS] Set slot ${amsId}/${trayId} on ${printer}: ${filamentName} ${color}`);
  res.json({ ok: true });
});
```

> ⚠️ Note to Replit: Verify the exact MQTT field names for `ams_filament_setting` against the OpenBambuAPI docs linked in References. The field names above match what's documented for X-series printers — confirm they apply to A1 as well. Color format is RRGGBBAA (e.g. `1A1A1AFF` for black). If field names differ, adjust to match what the printer actually accepts.
>
> **External spool:** Use `tray_id: 254` for the external/bypass spool slot — this is Bambu's reserved ID for filament fed directly into the printer bypassing the AMS. Confirm this value against OpenBambuAPI docs.

---

### Part 5 — Load / Unload Filament Commands

Add load and unload buttons to each AMS slot card and the external spool slot. This is especially useful for the external spool where you can't trigger load/unload from the AMS unit itself.

**Add to `/control` endpoint alongside pause/resume/stop/skip:**

```javascript
// Load filament into a specific AMS tray or external spool
if (command === 'load') {
  payload = JSON.stringify({
    print: {
      sequence_id: '0',
      command:     'ams_load',
      ams_id:      req.body.amsId,    // AMS unit index (0, 1...) — use 255 for external spool
      tray_id:     req.body.trayId    // tray slot (0–3) — use 254 for external spool
    }
  });
}

// Unload filament from a specific AMS tray or external spool
if (command === 'unload') {
  payload = JSON.stringify({
    print: {
      sequence_id: '0',
      command:     'ams_unload'
      // No ams_id/tray_id needed — unloads whatever is currently loaded
    }
  });
}
```

> ⚠️ Note to Replit: Verify `ams_load` and `ams_unload` command names against OpenBambuAPI docs. The printer must be idle (not printing) for load/unload commands to execute. If the printer is busy, return an error to LayerDeck so the UI can show a clear message.

**Updated AMS slot card UI:**

```
┌──────────────────────────────────────────┐
│  P1 Room — AMS                           │
│                                          │
│  Slot 1  ██ Bambu PLA Matte Black  ✅    │
│          [Set Filament] [Load] [Unload]  │
│                                          │
│  Slot 2  ░░ Empty                        │
│          [Set Filament] [Load]           │
│                                          │
│  ── External Spool ──────────────────    │
│  ██ Polymaker Matte Red  ✅              │
│          [Set Filament] [Load] [Unload]  │
└──────────────────────────────────────────┘
```

**Button visibility logic:**
```javascript
{
  showLoad:   slot.filamentSet && !slot.currentlyLoaded,  // has filament assigned but not loaded
  showUnload: slot.currentlyLoaded,                        // currently loaded — can unload
  showSet:    true                                         // always available
}
```

**Behavior:**
- **Load** — sends `ams_load` command for that slot. Printer pulls filament in and purges. Only available when printer is idle
- **Unload** — sends `ams_unload` command. Printer retracts filament back into the AMS or out of the external feed path. Only available when printer is idle
- If printer is not idle, buttons are disabled with a tooltip: "Printer must be idle to load/unload"
- Both commands fire a Discord alert to `#print-alerts`: `🔄 A1 — Loading filament in Slot 2` / `🔄 A1 — Unloading filament`
- External spool load/unload is identical flow — uses the same commands with `tray_id: 254`
- After load/unload completes (detected via MQTT state change), the slot card updates automatically from the next status poll

---

### Part 1b — Pi Hub: Load / Unload Endpoints

Add load and unload endpoints to server.js alongside `/ams/set-slot`. These send the physical filament movement commands to the printer — the same commands Bambu Handy uses when you tap "Load" or "Unload" in the app.

```javascript
// POST /ams/load
// Triggers physical filament load on a specific AMS slot or external spool
// Body: { printer, amsId, trayId }

app.post('/ams/load', async (req, res) => {
  const { printer, amsId, trayId } = req.body;
  const p = printers[printer];
  if (!p) return res.status(404).json({ error: 'Printer not found' });

  const isExternal = trayId === 254;

  // MQTT payload for filament load
  // Note to Replit: verify exact command name against OpenBambuAPI docs
  // May be 'ams_load' or 'load_filament' — confirm before building
  const payload = JSON.stringify({
    print: {
      sequence_id: '0',
      command:     'ams_load',
      ams_id:      isExternal ? 255 : amsId,   // 255 = external on some firmware versions
      tray_id:     isExternal ? 254 : trayId
    }
  });

  p.client.publish(p.REQUEST_TOPIC, payload);
  console.log(`[AMS] Load: ${printer} ams:${amsId} tray:${trayId}`);
  res.json({ ok: true });
});


// POST /ams/unload
// Triggers physical filament unload — retracts filament back into AMS or out of extruder
// Body: { printer }
// Note: unload always retracts whatever is currently loaded — no slot targeting needed

app.post('/ams/unload', async (req, res) => {
  const { printer } = req.body;
  const p = printers[printer];
  if (!p) return res.status(404).json({ error: 'Printer not found' });

  const payload = JSON.stringify({
    print: {
      sequence_id: '0',
      command:     'ams_unload'
      // Note to Replit: verify exact command name against OpenBambuAPI docs
    }
  });

  p.client.publish(p.REQUEST_TOPIC, payload);
  console.log(`[AMS] Unload: ${printer}`);
  res.json({ ok: true });
});
```

> ⚠️ Note to Replit: Load/unload command names (`ams_load`, `ams_unload`) need to be verified against OpenBambuAPI docs. These are physical movement commands — the printer nozzle must be at operating temp before load will succeed. LayerDeck should warn the user if the printer is cold (nozzle temp below ~170°C) before sending a load command.

---

### Part 2 — LayerDeck: "Set Filament" on AMS Slot Cards

The existing Colour View tab (Section 10) and Printers tab already show AMS slots. Extend each slot card with a **"Set Filament"** button.

**AMS slot card — updated:**

```
┌───────────────────────────────────────────────┐
│  P1 Room — AMS                                │
│                                               │
│  Slot 1  ██ Bambu PLA Matte Black             │
│          Loaded from MQTT                     │
│          [Set Filament]  [Load]  [Unload]     │
│                                               │
│  Slot 2  ██ Bambu PLA Basic White             │
│          Loaded from MQTT                     │
│          [Set Filament]  [Load]  [Unload]     │
│                                               │
│  Slot 3  ░░ Empty                             │
│          [Set Filament]  [Load]               │
│                                               │
│  Slot 4  ██ Polymaker Matte Red  ✅           │
│          ← Set via LayerDeck                 │
│          [Set Filament]  [Load]  [Unload]     │
│                                               │
│  ── External Spool ──────────────────────     │
│  ░░ Not set                                   │
│          [Set Filament]  [Load]  [Unload]     │
└───────────────────────────────────────────────┘
```

**Load / Unload button behavior:**
- **Load** — sends the physical load command for that slot. Pi publishes `ams_load` MQTT command. Printer retracts any current filament and feeds the selected slot's filament to the nozzle.
- **Unload** — sends `ams_unload` to the printer. The printer handles the full sequence automatically — identical to tapping Unload in Bambu Handy:
  1. Heats nozzle to unload temp if not already hot
  2. Purges a small amount of filament to clear the melt zone
  3. Cuts the filament (on printers with a cutter)
  4. **AMS slots** — retracts filament back into the AMS hub automatically
  5. **External spool** — printer displays "Ready to remove" on its screen and LayerDeck shows the same message: "Filament ready to pull out"
  
  LayerDeck just sends the command — the printer does all of this itself, no extra logic needed.

- Both buttons show a spinner and "Unloading..." status while the sequence is in progress — MQTT `gcode_state` updates when complete, spinner clears automatically
- **Temperature warning** — if nozzle temp is below 170°C when Load or Unload is tapped, show a warning: "Printer nozzle is cold — heat to printing temp before loading filament." with a **Heat & Load** / **Heat & Unload** option that sends a preheat command first, then triggers load/unload once temp is reached
- **Load hidden when slot is empty** (no filament set) — can't load an unassigned slot
- **Unload always available** when a printer is idle — useful for swapping filament mid-session
- **External spool unload** — after the sequence completes, LayerDeck shows a persistent banner on that printer card: "✂️ Filament cut — ready to pull out" until dismissed

**External spool specifics:**
- Load and Unload work the same way for external spool as AMS slots
- Particularly useful for bypassing the AMS entirely — load external, print, unload when done
- External slot shown as the last row below all AMS slots, always visible regardless of AMS state

**External Spool slot:**
- Always shown as a fixed option below the AMS slots — not a numbered tray, labelled "External Spool"
- Represents filament fed directly into the printer bypassing the AMS — used when AMS is down, jammed, or you're printing with a filament that doesn't run well through the AMS
- "Set Filament" works identically to AMS slots — opens the filament picker, writes the profile to the printer via MQTT using `tray_id: 254` (Bambu's reserved ID for the external/bypass spool)
- Shows the same ✅ badge and spool linking as AMS slots
- Colour View tab shows the external spool as a separate row alongside the AMS grid

**"Set Filament" button tap flow:**

```javascript
async function handleSetAMSFilament(printer, amsId, trayId) {
  const isExternal = trayId === 254;
  const slotLabel  = isExternal
    ? `${printer} — External Spool`
    : `${printer} — AMS ${amsId + 1}, Slot ${trayId + 1}`;

  // 1. Open filament picker modal — same searchable catalog from Section 14
  const selected = await openFilamentPicker({
    title:       `Set filament for ${slotLabel}`,
    preSelected: currentSlotData || null  // pre-select if slot already has data
  });

  if (!selected) return; // user cancelled

  // 2. If filament has multiple colors, show color picker
  let color = selected.colors[0].hex;  // default to first color
  if (selected.colors.length > 1) {
    const selectedColor = await openColorPicker(selected.colors);
    if (!selectedColor) return;
    color = selectedColor.hex;
  }

  // 3. Send to Pi
  await fetch(`${PI_URL}/ams/set-slot`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      printer,
      amsId,
      trayId,
      filamentName: `${selected.brand} ${selected.name}`,
      filamentType: selected.type,
      color,
      nozzleTemp:   selected.nozzleTemp,
      bedTemp:      selected.bedTemp
    })
  });

  // 4. Show confirmation
  showToast(`✅ ${selected.brand} ${selected.name} set in Slot ${trayId + 1}`);

  // 5. Also save to Supabase so LayerDeck remembers this mapping
  await saveAMSMapping({
    printer, amsId, trayId,
    filamentId:   selected.id,
    filamentName: `${selected.brand} ${selected.name}`,
    color,
    setAt:        new Date().toISOString(),
    setVia:       'layerdeck'
  });
}
```

---

### Part 3 — Spool Integration

When the user selects a filament to set on a slot, if they have an existing spool record in the Spools tab that matches, link the AMS slot to that spool record:

```javascript
// After setting the AMS slot, check for a matching spool
function findMatchingSpool(spools, filamentName, color) {
  return spools.find(s =>
    s.brand?.toLowerCase()     === filamentName.split(' ')[0].toLowerCase() &&
    s.colorHex?.toLowerCase()  === color.toLowerCase()
  ) || null;
}

// If a matching spool is found, show a prompt:
// "Link this slot to your existing [Bambu PLA Matte Black] spool?
//  LayerDeck will track weight consumed from that spool during prints."
// [Link Spool] [Skip]

// If linked — wattage and filament deduction from prints on this printer
// will automatically deduct from the linked spool's remaining weight
```

---

### Part 4 — Persistence and Display

Save AMS slot assignments to Supabase under `amsSlotMappings` collection:

```javascript
{
  id:           uuid(),
  printer:      'P1 Room',
  amsId:        0,
  trayId:       1,
  filamentId:   'polymaker-panchroma-matte',
  filamentName: 'Polymaker Panchroma Matte PLA',
  colorName:    'Matte Red',
  colorHex:     '#C0392B',
  nozzleTemp:   215,
  bedTemp:      50,
  linkedSpoolId: 'spool_uuid_here',  // null if not linked
  isExternal:   false,               // true = external spool bypass (tray_id 254)
  setAt:        '2026-04-01T14:32:00Z',
  setVia:       'layerdeck'  // 'layerdeck' | 'bambu_handy' | 'mqtt_read'
}
```

**On the printer card and Colour View** — slots set via LayerDeck show a ✅ badge and the filament name from the database. Slots with filament data coming only from MQTT (set via Handy/Studio) show the raw MQTT data as before with no badge.

**On LayerDeck startup** — read MQTT AMS state and compare to saved `amsSlotMappings`. If MQTT shows a different filament than what was last set via LayerDeck, show a subtle warning on that slot: "Slot may have changed — verify in Handy."

---

## References
- [OpenBambuAPI MQTT docs](https://github.com/Doridian/OpenBambuAPI/blob/main/mqtt.md)
- [go2rtc](https://github.com/AlexxIT/go2rtc)
- [Tapo RTSP setup](https://www.tp-link.com/us/support/faq/2680/)
- [Tailscale](https://tailscale.com)
- [Square Developer docs](https://developer.squareup.com/docs)
- [Square Terminal API](https://developer.squareup.com/docs/terminal-api/overview)
