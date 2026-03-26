# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   └── api-server/         # Express API server
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Artifacts

### `artifacts/studio-manager` (LayerStack)

- Vanilla JS single-page app served by Vite as a static HTML entry point; no React or Tailwind — Vite plugins stripped to avoid CSS transform conflicts with inline `<style>` blocks
- All Shopify logic lives directly in `index.html` — no IIFE overrides
- Shopify uses **custom app / private app token flow** (no OAuth keys required): user pastes `shpat_` token, `POST /api/shopify/connect` validates it against Shopify then stores it server-side
- Shopify token is **never** stored in the browser — only the domain and `connected:true` state are in localStorage
- "Integrations" sidebar group (id `sbg-integrations`) houses the Shopify nav button; Shopify tab registered in ALL_TABS
- OAuth callback params `?shopify_connected=true&shop=...` or `?shopify_error=true` still handled via `checkShopifyOAuthCallback()` on load
- `checkShopifyConfig()` called after login to verify server-side token is still valid

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health` (full path: `/api/health`)
- Shopify routes: `src/routes/shopify.ts` handles all Shopify API proxy endpoints:
  - `POST /api/shopify/connect` — validates custom app token against Shopify, stores in DB (token never echoed back)
  - `GET /api/shopify/oauth/start?shop=...` — begins OAuth redirect (kept for future use)
  - `GET /api/shopify/oauth/callback` — exchanges OAuth code for token, stores in DB
  - `GET /api/shopify/config` — returns connection status (no token exposed)
  - `GET /api/shopify/orders/sync` — proxies Shopify orders API server-side
  - `GET /api/shopify/products` — proxies Shopify products API server-side
  - `POST /api/shopify/webhooks/orders/create` — receives HMAC-verified webhooks
  - `DELETE /api/shopify/disconnect` — clears server-side credentials
- Shopify env vars (`SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`) only needed for OAuth flow; custom app token approach requires none
- Raw body middleware at `/api/shopify/webhooks/*` for HMAC verification (must come before `express.json()`)
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)
- Build bundles an allowlist of deps (express, cors, pg, drizzle-orm, zod, etc.) and externalizes the rest

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `src/schema/<modelname>.ts` — table definitions with `drizzle-zod` insert schemas (no models definitions exist right now)
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `healthCheck`).

### `artifacts/studio-manager` — LayerStack

Single-file HTML PWA for managing a Bambu Lab 3D printing collectibles business (hypedanubis3d-2.myshopify.com). All code is in `index.html` (~9,650+ lines). No frameworks — vanilla JS with JSZip (CDN) for 3MF parsing.

**UI state (v20+):**
- Deep navy palette: `--bg:#07090f`, `--surf:#0d1120`, `--txt:#c8d8f0` (cool blue-white), `--gold:#f0b429`; Inter (body) + Orbitron (numbers/headings) + Share Tech Mono (code) fonts
- All cards: 12px border-radius, larger fonts (10-13px), hover shadows; buttons 8px radius with glow; modals 14px radius with blur backdrop
- Status pills, badges, tags: rounded pill style (border-radius:20px), min 9px font
- Etsy CSV import: orange badge, filter pill, deduplication via etsyId
- Dashboard widget pinning, push notifications, convention management, Shopify sync all functional
- Sidebar with collapsible section groups; bottom nav bar (5 items)
- `hmr: false` in vite.config.ts — manual reload required after code changes
- `fmtDried(dateStr)` utility: formats ISO dates to "Feb 10" style for dried badges

**Recent updates (brainstorm batch + settings refactor):**
- Logo in header is clickable → goes to Dashboard
- Old cloud sync button + separate sync-dot replaced with unified "⚙ Settings" button (with embedded sync dot). `toggleSettingsPanel()` / `updateSettingsPanel()` / `closeSettingsPanel()`. Legacy `toggleCloudPanel()` / `updateCloudPanel()` are aliases.
- Settings dropdown shows: email, sync state (coloured), Settings & Sync link, Push to Cloud, Pull from Cloud, Sign Out / Sign In
- `#settings-wrap`, `#settings-btn`, `#settings-panel` are the canonical HTML ids
- Push Notifications panel moved from Backup tab → top of Sync tab (static HTML so `_setPushStatus` always finds elements)
- Backup & Restore section added as a collapsible `<details>` block at the bottom of Sync tab (`#sync-backup-details`)
- Labels nav item moved from System group → Business group in sidebar (more logical location)
- Reviews tab nav item removed (tab still exists for data safety, just not accessible via nav)
- Shiny roll history cards now have a ✕ delete button; `deleteShinyRoll(idOrTs)` calls `saveShiny()`
- Labels tab has a paper size/printer selector dropdown with 5 presets; selection persists in localStorage; `applyLabelSize(size)` sets `--lbl-cols` CSS variable
- Event finder now AI-powered: `searchEvents()` is async, calls `POST /api/events/search` (api-server → Anthropic claude-haiku-4-5). Returns structured JSON (name, date, venue, type, attendance, boothCost, website, notes) rendered as cards inside the modal. Anthropic provisioned via `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` + `AI_INTEGRATIONS_ANTHROPIC_API_KEY`.
- New order push notification: `ingestShopifyOrder` fires `POST /api/push/notify-order` after ingesting a Shopify order → server calls `sendPushToAll` with order ID, customer, item summary
- `sbWithTimeout` timeout increased 15s → 30s; message softened to "may be waking up, will retry"
- `pullFromCloud` catch block: auto-retries once after 5s on timeout (Supabase cold-start recovery)
- `visibilitychange` listener added: only triggers `pullFromCloud(silent)` if > 2 minutes since last sync
- Service worker keep-alive ping: `setInterval` every 25s posts `{type:'keepalive'}` to SW controller
- `addToOrderFromCatalog(id)` now uses `addOrderItemRow('catalog', {...})` instead of textarea hack
- Catalog select mode now shows "→ Add to Order" button in bulk bar; `bulkCatalogToOrder()` opens order modal with all selected items pre-filled via `addOrderItemRow`

**Tab merges applied:**
| Merged Into | Includes (via navTo redirect) | Sidebar Label |
|---|---|---|
| `maint` | `nozzle` | Maintenance & Nozzles |
| `failrate` | `waste` | Fail Rates & Waste |
| `restock` | `shop` | Restock & Shop List |
| `revenue` | `tax`, `power` | Revenue, Tax & Power |

`navTo()` has a `MERGED_TABS` map: `{nozzle:'maint', waste:'failrate', shop:'restock', tax:'revenue', power:'revenue'}`. Old tab divs kept as empty shells to avoid ALL_TABS issues.

**Supabase Auth + Sync (v19.5+):**
- Auth is fully handled by Supabase Auth — no manual credential entry UI
- `SUPABASE_URL` and `SUPABASE_ANON_KEY` injected into HTML via custom `transformIndexHtml` Vite plugin (NOT Vite `define` — that only works for module-bundled JS, not inline scripts)
- Boot sequence: `loadSyncCfg()` → `initSupabase()` at end of boot chain. `initSupabase()` creates the Supabase client and registers `onAuthStateChange` listener
- `onAuthStateChange`: signed-in → `hideAuthScreen()` + `pullFromCloud()` + `render()`; signed-out → `showAuthScreen()`
- Auth screen overlay (`#auth-screen`): always rendered in HTML body, hidden/shown via `display:none`/`display:flex`
- Single unified table: `ha3d_user_data (user_id uuid, collection text, payload text, updated_at timestamptz, PRIMARY KEY (user_id, collection))` with RLS `using (auth.uid() = user_id)` — replaces old 12-table design
- `queueSync(collection, data)` — guards on `currentUser` being set; upserts to `ha3d_user_data`
- `processSyncQueue()` — syncs all queued collections to `ha3d_user_data` table, scoped by `currentUser.id`
- `pullFromCloud()` — fetches all collections for `currentUser.id`, overrides localStorage + in-memory arrays
- `signOutUser()` — shows confirm dialog, calls `supabaseClient.auth.signOut()`, clears state
- SQL for new table is shown in the Sync tab when signed in, with a "Copy SQL" button
- Old `connectSupabase()`/`disconnectSupabase()` functions removed; old manual credential UI removed from Sync tab

**Key patterns:**
- Use `showConfirm()` not `confirm()`, `prompt()`, or `alert()`; use `toast()` for notifications
- `showForgotPassword()` now shows an inline auth form panel (`#auth-form-forgot`) — no `prompt()`
- Auth inputs are wrapped in `<form onsubmit="event.preventDefault();authSubmit()">` — supports Enter key + password managers
- No nested backtick template literals
- No `const _orig = fn; function fn()` override pattern — use `window.fn = ...`
- OAuth override script re-injected before `</body>` for Shopify/Etsy
- Never use `syncCfg.url` or `syncCfg.anonKey` — those fields are removed; use `__SUPABASE_URL__` / `__SUPABASE_ANON_KEY__` globals directly for edge function calls

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.
