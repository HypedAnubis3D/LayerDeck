LayerStack — 3D Printing Business Platform
===========================================

A full business management suite for a Bambu Lab 3D printing collectibles
operation. Two apps, one shared cloud account, built to run together.


APPS
====

Studio Manager — layerstack.replit.app
  The main app. A single-page PWA covering the full business workflow from
  print to shipping.

Desktop Companion — layerstack.replit.app/companion
  A focused companion tool designed for use at the PC. Handles 3MF file
  management and shows a live business overview pulled from the same cloud
  account.


===========================================
STUDIO MANAGER — FEATURE REFERENCE
===========================================

Dashboard
---------
- Revenue, profit, active prints, pending orders, and low-stock alerts at a glance
- Pinnable widgets — choose what stays on the dashboard
- Setup checklist for first-time onboarding
- Monthly revenue goal tracker with visual progress bar

Spools & Filament
-----------------
- Track every spool: brand, material, color, weight bought vs remaining
- Dry schedule — flags spools not dried in the last 7 days; CF/GF always
  marked as needing drying
- QR code scanning for quick spool lookup
- Bulk select and delete
- Filament Database — reference library of materials with settings and notes
- Filament Purchases tracker for spend history

Print Log
---------
- Log prints with filament used, time, product linked, success/fail
- Attach a 3MF from the library to auto-fill print time, layer height,
  nozzle size, filament data
- Print time display (hours and minutes)
- Filter by status, product, filament type

3MF Library
-----------
- Synced from the Desktop Companion — files are uploaded and parsed there,
  then appear here
- Each card shows: model name, printer model, filament color swatches with
  grams per color, print time, layer height, nozzle diameter, support type,
  AMS unit count, bed type, part names, plate names
- Sliced files (exported from Bambu Studio) include print time and per-color
  gram weights; non-sliced files show a warning
- Link any 3MF to a catalog product for auto-fill when logging prints
- Individual delete with confirmation dialog
- Bulk delete via Select mode — tap cards, delete the batch

Print Queue (Kanban)
--------------------
- Three-stage kanban: Queued > In Progress > Done
- Each card shows product name, linked order, filament, estimated time
- Priority flags (high/low)
- Shopify-linked cards shown with a badge
- Bulk select and delete

Orders
------
- Manual orders and Shopify-synced orders in one list
- Quick-add mode for fast order entry at conventions
- Etsy CSV import with deduplication by Etsy order ID
- Fulfillment tracker — mark items packed, shipped, complete
- Order status pipeline with visual badges
- Bulk select and delete

Customers
---------
- Auto-built from order history
- Lifetime value, order count, last order date

Mystery Prints
--------------
- Manage mystery print subscriptions separately from regular orders

Shiny Tracker
-------------
- Log special/shiny print rolls with timestamps
- Delete individual roll history entries

Revenue, Tax & Power
--------------------
- Monthly and all-time revenue totals
- Tax calculation with configurable rates
- Power cost tracking per print (wattage x time x rate)

Product Catalog
---------------
- Full product listings with photos, pricing, category, linked 3MF file,
  cost breakdown
- Shopify product sync — import your Shopify catalog directly
- Bulk add catalog items to an order
- Price AI — AI-powered pricing suggestions based on material cost, time,
  and margin targets
- Catalog select mode with bulk delete

Conventions
-----------
- Upcoming and past convention tracker
- Date, venue, booth cost, notes
- AI-powered event finder — searches for relevant conventions based on your
  location and product type
- Dashboard badge shows count of upcoming events

Labels
------
- Print shipping and product labels
- Multiple paper/printer size presets (Avery, Dymo, A4) with persistent
  selection

Fail Rates & Waste
------------------
- Log failed prints with reason and material wasted
- Per-material fail rate breakdown
- Waste cost calculator

Maintenance & Nozzles
---------------------
- Nozzle change log with date and filament type at swap
- Printer maintenance records

Printers
--------
- Track each printer: model, name, status, print count
- Maintenance history per printer

Forecast
--------
- Revenue and print volume projections based on historical data

Restock & Shop List
-------------------
- Auto-generated restock suggestions based on spool levels
- Manual shop list for consumables and supplies

Shipping
--------
- Shipping cost tracker per order

Fulfillment
-----------
- Separate fulfillment workflow view for packing and dispatch

Integrations — Shopify
-----------------------
- Connect via private app token (no OAuth setup required — paste your
  shpat_ token)
- Token stored server-side only, never in the browser
- Orders sync in real time via webhooks
- Push notifications on new Shopify orders
- Product catalog import from your Shopify store

Cloud Sync
----------
- Supabase-backed — all data syncs across devices automatically
- Push and Pull controls in the Settings panel
- Sync status indicator in the header (connected / syncing / error)
- Auto-retry on Supabase cold-start timeouts
- Auto-pull on app visibility restore (if more than 2 minutes since last sync)

Push Notifications
------------------
- Subscribe to browser push notifications
- Receive alerts for new Shopify orders and low stock

Backup & Restore
----------------
- Full JSON export of all data (spools, prints, orders, library, settings)
- Selective restore by data type
- Reset individual collections independently


===========================================
DESKTOP COMPANION — FEATURE REFERENCE
===========================================

Designed to be open at your PC while working in Bambu Studio. Everything
syncs back to Studio Manager via Supabase.

Business Overview
-----------------
Six live stat cards pulled from your cloud data:
  - 3MF Library count
  - Catalog item count
  - Open orders
  - Active print queue jobs
  - Spool stock count
  - Upcoming conventions

3MF Library (Cloud)
-------------------
The persistent library of files added to your account. Everything here is
also visible in the Studio Manager's 3MF Library tab.

  - Color swatches with grams per color slot
  - Print time, object count, upload date
  - Individual delete (hover to reveal trash icon)
  - Bulk delete — Select button > click cards > Delete (N)
  - Pull — refresh from Supabase cloud
  - Push — force-write local state back to cloud

Deletions sync both ways: delete here and Studio Manager reflects it; delete
from Studio Manager and the "Add to Library" button becomes active again in
the companion automatically.

3MF File Session
----------------
Drop .3mf files from your PC onto the companion to parse and inspect them
before adding to the library.

What gets parsed from each file:
  - Model name (from internal metadata)
  - Object/part names and count
  - Print time (from Metadata/slice_info.config — requires a sliced export)
  - Filament color swatches per slot (from Metadata/project_settings.config)
  - Grams used per color (from Metadata/slice_info.config)
  - Layer height and nozzle diameter
  - Printer model
  - Plate names
  - Support type, AMS unit count, bed type

Sliced vs unsliced:
  Bambu Studio files exported as sliced .3mf contain print time and per-color
  gram data. Files exported as project .3mf (without slicing) will parse model
  metadata but show a warning about missing print time.

Session persistence:
  Parsed file cards survive browser close and reopen — metadata is saved
  locally so you don't need to re-upload files if you're away from your PC.
  Status (In Library / Add to Library) is rechecked against the live Supabase
  library each time.

Add to Library:
  Saves the full parsed metadata to Supabase tmfLib collection. Studio Manager
  reads from the same collection — files appear there immediately after the
  next sync.

Sync All to Library:
  Adds all unsynced files in the session in one operation.

Duplicate prevention:
  Dropping the same file again shows a notification instead of creating a
  duplicate card. The library check is done by filename both at drop-time and
  in the add hooks.

Session management:
  - Hover any card — X button removes that card from the session (doesn't
    affect the library)
  - "Clear all" button wipes the entire session list


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

Collection names:
  tmfLib          3MF library files
  catalog         Product catalog
  orders          Orders
  printQueue      Print queue items
  spools          Filament spools
  prints          Print log
  conventions     Convention events
  sales           Sales records
  usageHist       Filament usage history
  shinyRolls      Shiny tracker entries
  maintLog        Maintenance log
  wasteLog        Fail/waste log
  printerRecords  Printer records
  catalogItems    Catalog items (alias)


===========================================
TECH STACK
===========================================

Studio Manager
  - Vanilla JS, single HTML file (~12,800 lines)
  - Vite (static file server only, HMR disabled)
  - JSZip (CDN) for 3MF parsing
  - Supabase JS client for auth and data sync
  - DOMParser for XML parsing inside .3mf archives

Desktop Companion
  - React 18 + TypeScript
  - Vite
  - Tailwind CSS
  - Framer Motion (animations)
  - Lucide React (icons)
  - @supabase/supabase-js
  - jszip
  - react-dropzone
  - @tanstack/react-query (data fetching and cache)

API Server
  - Express 5
  - Drizzle ORM + PostgreSQL
  - Shopify API proxy (orders, products, webhooks)
  - Anthropic Claude for AI event finder and price suggestions
  - Web Push for browser push notifications


===========================================
ENVIRONMENT VARIABLES
===========================================

  SUPABASE_URL       Both apps    Supabase project URL
  SUPABASE_ANON_KEY  Both apps    Supabase public anon key
  BAMBU_EMAIL        Stored only  Bambu account (not actively used)
  BAMBU_PASSWORD     Stored only  Bambu account (not actively used)

Shopify credentials are stored server-side in the database after connection —
not in environment variables.


===========================================
TYPICAL WORKFLOW
===========================================

Standard print workflow:
  1. Design model > slice in Bambu Studio > export sliced .3mf
  2. Drop the .3mf into the Desktop Companion > inspect parsed data
  3. Click "Add to Library" > file appears in Studio Manager's 3MF Library
  4. When logging a print in Studio Manager, select the 3MF > fields auto-fill
  5. Move print through Queue: Queued > In Progress > Done
  6. Attach to an order > mark fulfilled > ship

Away from PC:
  - Open Studio Manager on phone/tablet
  - 3MF Library shows all files synced from the companion
  - Full order management, queue control, and revenue tracking available
