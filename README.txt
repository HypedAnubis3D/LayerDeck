LayerDeck — powered by HypedAnubis3D
=====================================
A studio management PWA for running a 3D printing collectibles business.
Deployed at: layerdeck.replit.app / app.hypedanubis3d.com


APPS
====

Studio Manager — app.hypedanubis3d.com
  The main app. A single-page PWA covering the full business workflow from
  print to shipping. Works on phone, tablet, or desktop.

Desktop Companion — app.hypedanubis3d.com/companion
  A companion tool designed for use at your PC. Handles 3MF file uploading
  and parsing, and shows a live business overview from the same cloud account.


===========================================
STUDIO MANAGER — FEATURE REFERENCE
===========================================

Dashboard
---------
- Revenue, profit, active prints, pending orders, and low-stock alerts at a
  glance
- Pinnable widgets — choose what stays on the dashboard
- Setup checklist for first-time onboarding
- Monthly revenue goal tracker with visual progress bar

Prints
------
- Log every print job with filament used, time, printer, category, and notes
- Attach a 3MF from the library to auto-fill print time, layer height, nozzle
  size, filament colors, and grams per color
- Auto-calculates material cost, electricity cost, and suggested sell price
- Organize prints into named Groups — assign any print to a group via the
  folder button on each card; purple badge shows the current group
- Filter by status, product, filament, and date range
- Finish workflow captures end time and profit margin

3MF Library
-----------
- Synced from the Desktop Companion — upload files there, they appear here
- Each card shows: model name, printer model, filament color swatches with
  grams per color, print time, layer height, nozzle diameter, support type,
  bed type, part names, and plate names
- Sliced files (exported from Bambu Studio) include print time and per-color
  gram weights; non-sliced files show a warning
- Link any 3MF to one or more catalog products (multiple products can share
  the same 3MF, and one product can have multiple 3MFs linked)
- Purple folder badge on each card shows which folder the file belongs to
- Organize files into named Folders — assign from the folder button on each
  card; two-level folder navigation in the 3MF picker (tap folder → see files
  → tap Back)
- Select mode for bulk delete
- Auto-suggestion: fuzzy-matches unlinked 3MFs to catalog products by name

Print Queue
-----------
- Three-stage kanban: Queued → In Progress → Done
- Queue items pull print time and filament data from linked 3MF automatically
- Priority flags (urgent, high, normal, low)
- Folder grouping — queue items grouped by folder with collapsible sections
- Shopify-linked cards shown with platform badge
- Batch auto-queue from orders
- Direct integration with Pi Hub for live printer status

Orders
------
- Manual orders and Shopify-synced orders in one list
- Etsy orders imported via Gmail/IMAP parsing of sale notification emails
- Fulfillment tracker — mark items packed, shipped, complete
- Order status pipeline with visual badges
- Auto-generates queue items based on catalog product-to-3MF mappings
- Shipping cost tracker per order
- Bulk select and delete

Product Catalog
---------------
- Full product listings with photos, pricing, cost, stock quantities, and
  low-stock thresholds
- Each product links to one or more 3MF files; variants can each have their
  own 3MF
- Shopify product sync — import your Shopify catalog directly
- Bulk add catalog items to an order or queue
- Price AI — AI-powered pricing suggestions based on material cost, time, and
  margin targets
- Stock adjustment buttons directly on each catalog card
- Catalog select mode with bulk delete

Convention POS
--------------
- Full point-of-sale system for conventions, markets, and pop-up events
- Square SDK integration for card payments; cash mode with change calculation
- Per-event sales tracking, inventory deduction on each sale
- Discord alert fires on every sale
- Convention prep checklist and booth cost tracking
- AI-powered event finder — searches for upcoming conventions by location and
  product type

Spools & Filament
-----------------
- Track every spool: brand, material, color, starting weight vs. remaining
- Dry schedule — flags spools not dried in the last 7 days; CF/GF always
  flagged
- QR code scanning for quick spool lookup
- Filament Database — reference library of materials with print settings
- Filament Purchases tracker for spend history
- Low-spool Discord alerts when remaining grams drop below threshold
- Bulk select and delete

Pi Hub Integration
------------------
- Connects to a Raspberry Pi 5 running the LayerDeck hub (pm2: layerdeck-hub,
  port 3000, user: hypedanubis3d)
- Monitors Bambu Lab printers via local network MQTT
- Streams RTSP camera feeds from printers (A1 and P1 cameras)
- Controls Tapo P115 smart plugs (power on/off per printer)
- Pushes print start, finish, and failure events to the app in real time
- Pi health Discord alerts on disconnect or restart

AI Vision Failure Detection
----------------------------
- Camera feeds analyzed by Claude AI vision on a schedule
- Detects spaghetti, layer shifts, detached prints, and other failures
- Sends Discord alert with snapshot description when a failure is detected

Discord Alerts
--------------
Dedicated webhooks configured for:
  - New orders (Shopify, Etsy, manual)
  - Print start / finish / failure
  - AI vision failure detection
  - Low spool stock
  - Bambu filament restock needed
  - Pi Hub health
  - Convention sales (per-sale)
  - Daily summary report

Shopify Integration
-------------------
- Private app token connection (paste shpat_ token — no OAuth setup)
- Token stored server-side only, never in the browser
- Orders sync via webhook in real time
- Push notifications on new Shopify orders
- Product catalog import from your Shopify store
- Shopify order items auto-matched to catalog products by name for queue
  creation

Etsy Integration
----------------
- Parses Etsy "You made a sale!" notification emails via Gmail IMAP
- Imports orders without requiring an official Etsy API key
- Deduplicates by Etsy order ID

Labels & Shipping
-----------------
- Print shipping and product labels
- Multiple paper/printer size presets (Avery, Dymo, A4)

Maintenance & Nozzles
---------------------
- Nozzle change log with date and filament type at swap
- Printer maintenance records per machine

Fail Rates & Waste
------------------
- Log failed prints with reason and material wasted
- Per-material fail rate breakdown and waste cost calculator

Backup & Restore
----------------
- Full JSON export of all data (spools, prints, orders, library, settings)
- Selective restore by data type
- Reset individual collections independently

Cloud Sync
----------
- Supabase-backed — all data syncs across devices automatically
- Push and Pull controls in Settings
- Sync status indicator in header (connected / syncing / error)
- Auto-pull on app visibility restore if more than 2 minutes since last sync

Push Notifications
------------------
- Browser push subscription
- Alerts for new Shopify orders and low stock


===========================================
DESKTOP COMPANION — FEATURE REFERENCE
===========================================

Designed to be open at your PC while working in Bambu Studio. All data syncs
to Studio Manager via the shared Supabase account.

Business Overview
-----------------
Six live stat cards:
  - 3MF Library count
  - Catalog item count
  - Open orders
  - Active print queue jobs
  - Spool stock count
  - Upcoming conventions

3MF File Upload
---------------
- Drag and drop .3mf files onto the drop zone, or click to browse
- Upload entire folders at once — all files in the folder are parsed and
  grouped automatically under the folder name
- Folder groups are collapsible in the preview list
- "Sync Folder (N)" button uploads all files in a folder group in one click

What gets parsed from each file:
  - Model name (from internal metadata)
  - Object/part names and count
  - Print time (requires sliced export from Bambu Studio)
  - Filament color swatches per slot
  - Grams used per color (from slice info)
  - Layer height, nozzle diameter, printer model
  - Plate names, support type, AMS unit count, bed type

Sliced vs. unsliced:
  Sliced .3mf exports (right-click plate → Export Plate Sliced File) include
  print time and per-color gram data. Project .3mf exports parse model
  metadata but show a warning about missing print time.

3MF Cloud Library
-----------------
- Shows all files currently saved to your Supabase account
- Cyan folder badge on library cards that belong to a folder
- Individual and bulk delete (syncs back to Studio Manager)
- Push and Pull sync controls

Session persistence:
  Parsed cards survive browser close — metadata is saved locally so you don't
  need to re-drop files. Status (In Library / Add) re-checks live on each load.

Duplicate prevention:
  Dropping the same file again shows a notification instead of duplicating.


===========================================
SHARED DATA MODEL
===========================================

Both apps read and write the same Supabase table:

  Table: ha3d_user_data
    user_id    (uuid — Supabase auth UID)
    collection (text — collection name)
    payload    (text — JSON array)
    updated_at (timestamptz)
    PRIMARY KEY (user_id, collection)

Row-level security ensures each user only sees their own data.

Key collections:
  tmfLib          3MF library files (with folderId, folderName, tmfIds)
  tmfFolders      3MF folder definitions
  catalog         Product catalog (tmfIds array per product)
  orders          Orders
  printQueue      Print queue items
  spools          Filament spools
  prints          Print log
  printGroups     Print group definitions
  conventions     Convention events
  sales           Sales records
  printerRecords  Printer records


===========================================
TECH STACK
===========================================

Studio Manager
  - Vanilla JS, single HTML file (~22,000+ lines)
  - Vite (static file server)
  - JSZip (CDN) for 3MF parsing
  - Supabase JS client for auth and data sync
  - Square Web Payments SDK for convention POS
  - Anthropic Claude API for AI vision and event finder

Desktop Companion
  - React 18 + TypeScript
  - Vite + Tailwind CSS
  - Framer Motion (animations), Lucide React (icons)
  - @supabase/supabase-js, jszip, react-dropzone
  - TanStack React Query

API Server
  - Express 5, Drizzle ORM + PostgreSQL
  - Shopify order/product/webhook proxy
  - Anthropic Claude for AI features
  - Web Push for browser push notifications

Pi Hub (Raspberry Pi 5)
  - Node.js, pm2 (process: layerdeck-hub)
  - Bambu Lab MQTT bridge
  - Tapo P115 smart plug control
  - RTSP camera stream relay


===========================================
TYPICAL WORKFLOW
===========================================

Standard print-to-ship workflow:
  1. Design model > slice in Bambu Studio > export sliced .3mf
  2. Drop the .3mf into the Desktop Companion > inspect parsed metadata
  3. Click "Add to Library" > file appears in Studio Manager 3MF Library
  4. Link the 3MF to a catalog product from the 3MF card
  5. When an order comes in (Shopify, Etsy, or manual), it auto-queues
     using the linked 3MF
  6. Move the queue item: Queued > In Progress > Done
  7. Mark the order fulfilled > ship > done

At a convention:
  1. Open Convention POS on phone/tablet
  2. Select items from catalog > tap Square or Cash
  3. Payment processed > stock decremented > Discord alert fires
  4. Sales tracked per event with revenue summary
