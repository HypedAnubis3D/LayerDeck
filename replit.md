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

### `artifacts/studio-manager` (HypedAnubis3D Studio Manager)

- Vanilla JS single-page app served by Vite as a static HTML entry point
- No React or Tailwind processing — Vite plugins stripped to avoid CSS transform conflicts with inline `<style>` blocks
- The `index.html` is the ~9,500-line v19 app with an OAuth integration script injected before `</body>`
- The injected script overrides `connectShopify`, `disconnectShopify`, `pollShopifyOrders`, and `renderShopify` to use backend routes instead of direct browser API calls
- OAuth callback: URL params `?shopify_connected=true&shop=...` or `?shopify_error=true&error_message=...` trigger UI updates on load
- Shopify access token is **never** sent to the browser — stored server-side only in PostgreSQL

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health` (full path: `/api/health`)
- Shopify routes: `src/routes/shopify.ts` handles all Shopify OAuth and API proxy endpoints:
  - `GET /api/shopify/oauth/start?shop=...` — begins OAuth redirect
  - `GET /api/shopify/oauth/callback` — exchanges code for token, stores in DB
  - `GET /api/shopify/config` — returns connection status (no token exposed)
  - `GET /api/shopify/orders/sync` — proxies Shopify orders API
  - `GET /api/shopify/products` — proxies Shopify products API
  - `POST /api/shopify/webhooks/orders/create` — receives HMAC-verified webhooks
  - `DELETE /api/shopify/disconnect` — clears server-side credentials
- Required env vars for Shopify: `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_WEBHOOK_SECRET` (optional), `SHOPIFY_REDIRECT_URI` (optional, auto-detected if not set)
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

### `artifacts/studio-manager` — HypedAnubis3D Studio Manager

Single-file HTML PWA for managing a Bambu Lab 3D printing collectibles business (hypedanubis3d-2.myshopify.com). All code is in `index.html` (~9,650+ lines). No frameworks — vanilla JS with JSZip (CDN) for 3MF parsing.

**UI state (v19+):**
- Dark theme: gold (#c9a227), purple (#7c3aed), near-black (#09070a); Share Tech Mono + Orbitron fonts
- Sidebar with collapsible section groups; bottom nav bar (5 items)
- `hmr: false` in vite.config.ts — manual reload required after code changes
- `fmtDried(dateStr)` utility: formats ISO dates to "Feb 10" style for dried badges

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
