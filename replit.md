# Overview

This is a pnpm workspace monorepo utilizing TypeScript, designed to manage a 3D printing collectibles business. It includes a robust API server, a vanilla JavaScript single-page application for studio management, and a React-based desktop companion application. The project aims to streamline business operations, from Shopify integration and order management to 3D print queue handling and inventory.

**Key Capabilities:**

*   **Monorepo Management:** Uses pnpm workspaces for efficient dependency management and shared libraries.
*   **API Services:** Provides a RESTful API with strong validation and persistence using Express, PostgreSQL, and Drizzle ORM.
*   **Studio Management (LayerDeck):** A PWA for managing Shopify integrations, order intake, print queue, and inventory, accessible via `artifacts/studio-manager`.
*   **Desktop Companion (LayerDeck Desktop Companion):** A React application offering a comprehensive business dashboard, 3MF file management, and real-time Bambu Lab printer status via `/companion/`.
*   **Code Generation:** Automates API client and Zod schema generation from an OpenAPI specification using Orval.

# User Preferences

I prefer iterative development with clear communication on significant changes. Please ask before making major architectural decisions or introducing new external dependencies. I appreciate detailed explanations when new patterns or complex solutions are implemented. Ensure all new features align with the established UI/UX guidelines and maintain consistency across applications.

# System Architecture

## Core Technologies

*   **Monorepo Tool:** pnpm workspaces
*   **Node.js:** v24
*   **TypeScript:** v5.9
*   **API Framework:** Express 5
*   **Database:** PostgreSQL with Drizzle ORM
*   **Validation:** Zod (v4) and `drizzle-zod`
*   **API Codegen:** Orval (from OpenAPI spec)
*   **Bundler:** esbuild (CJS bundle)
*   **Frontend Frameworks:** Vanilla JS (Studio Manager), React (Desktop Companion)
*   **Styling (Desktop Companion):** Tailwind CSS
*   **State Management (Desktop Companion):** TanStack React Query

## Monorepo Structure

The monorepo is organized into `artifacts/` (deployable applications), `lib/` (shared libraries), and `scripts/` (utility scripts).

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications (api-server, studio-manager, desktop-companion)
├── lib/                    # Shared libraries (api-spec, api-client-react, api-zod, db)
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml     # pnpm workspace configuration
├── tsconfig.base.json      # Shared TypeScript configuration
├── tsconfig.json           # Root TypeScript project references
└── package.json            # Root package for hoisted dev dependencies
```

## TypeScript & Composite Projects

All packages extend `tsconfig.base.json` with `composite: true`. The root `tsconfig.json` defines project references, ensuring correct cross-package type checking and build order. Type checking is performed from the root using `tsc --build --emitDeclarationOnly` to generate `.d.ts` files, while actual JS bundling is handled by esbuild/Vite.

## API Server (`@workspace/api-server`)

An Express 5 server handling API requests, utilizing `@workspace/api-zod` for validation and `@workspace/db` for persistence. It includes health checks and dedicated routes for Shopify integration, including connection, OAuth (for future use), configuration, order/product syncing, and webhook processing. Raw body middleware is used for HMAC verification of Shopify webhooks.

## Database Layer (`@workspace/db`)

Manages PostgreSQL interactions via Drizzle ORM. It exports a Drizzle client and schema models. Production migrations are handled by Replit, while development uses `drizzle-kit push`.

## API Specification & Code Generation (`@workspace/api-spec`, `@workspace/api-zod`, `@workspace/api-client-react`)

`@workspace/api-spec` holds the OpenAPI 3.1 specification (`openapi.yaml`) and Orval configuration. Running codegen generates:
*   `@workspace/api-client-react`: React Query hooks and a fetch client.
*   `@workspace/api-zod`: Zod schemas for request and response validation.

## Studio Manager (`artifacts/studio-manager`)

A vanilla JavaScript single-page application (served by Vite) designed as a PWA. It manages Bambu Lab 3D printing collectibles, supporting Shopify custom app integration (token-based, server-side storage only), Etsy CSV import, and various UI elements like a dashboard, sidebar navigation, and modals.
*   **UI/UX:** Deep navy palette, Inter/Orbitron/Share Tech Mono fonts, rounded elements, hover shadows, and blur backdrops for modals.
*   **State Management:** Primarily uses `localStorage` for UI state and `Supabase Auth + Sync` for persistent user data.
*   **Feature Highlights:** Dashboard widget pinning, push notifications, convention management, Shopify sync, AI-powered event finder (via Anthropic), and specialized tab merges for streamlined navigation.
*   **Supabase Integration:** Full authentication and data synchronization via Supabase Auth and a single `ha3d_user_data` table with RLS. Data is queued and processed for sync to the cloud.

## Desktop Companion (`artifacts/desktop-companion`)

A React + Vite application providing a comprehensive business dashboard and 3MF file management.
*   **Authentication:** Uses Supabase email/password, sharing accounts with the Studio Manager.
*   **Data Layer:** `useCompanionData()` hook fetches all user collections from Supabase, with dedicated hooks for dashboard metrics and 3MF library CRUD.
*   **Tabbed Navigation:** Includes Home, Library, Queue, Events, Orders, and Printers tabs.
*   **Features:**
    *   **Home:** Stat tiles, 3MF drag-and-drop upload, session file management.
    *   **Library:** Searchable and filterable 3MF library with bulk actions and cloud sync.
    *   **Queue:** Displays print jobs grouped by status.
    *   **Events:** Manages events with countdowns and progress.
    *   **Orders:** Summarizes revenue and lists orders.
    *   **Printers:** Shows nozzle wear and live Bambu Cloud printer status via `/api/bambu/status`.
*   **Bambu API Integration:** `/api/bambu/status` in the `api-server` authenticates with Bambu Cloud using environment variables to provide device status.

## Pi Hub (`artifacts/pi-hub/server.js`)

Raspberry Pi Node.js server (pm2: `layerdeck-hub`) with direct Bambu Lab MQTT connections, deployed separately to the Pi.

**Section 28 — AI Print Failure Detection:**
- `GET /vision/status` — scan results, log (last 20), and config
- `GET /vision/snapshot/:printer` — latest captured JPEG as base64
- `POST /vision/scan` — trigger immediate scan (manual)
- `POST /vision/config` — update enabled, intervalMins, confidenceThreshold, model, perPrinter
- `GET /vision/check` — verify ffmpeg + Ollama are installed
- Config persisted to `~/bambu-hub/vision-config.json`
- RTSP URLs from `rtspUrl` in `printers.json` or env vars `CAMERA_A1_RTSP` / `CAMERA_P1_ROOM_RTSP` / `CAMERA_P1_CLOSET_RTSP`
- Pi dependencies: `ffmpeg` + Ollama with `llava:latest` (or `llava-phi3`)
- API server generic proxy: `GET/POST /api/pihub/proxy?hub=<url>&path=<path>`

## Utility Scripts (`scripts`)

A workspace package containing various TypeScript utility scripts, runnable via `pnpm --filter @workspace/scripts run <script>`. These scripts can import any other workspace package.

# External Dependencies

*   **Supabase:** Used for user authentication and data synchronization in both `studio-manager` and `desktop-companion`.
*   **PostgreSQL:** The primary database, accessed via Drizzle ORM.
*   **Shopify API:** Integrated into the `api-server` for order and product synchronization, and webhook processing.
*   **Bambu Cloud API:** Accessed via the `api-server` for real-time printer status in the `desktop-companion`.
*   **Anthropic Claude-Haiku-4-5:** Used by the `api-server` for AI-powered event searching.
*   **JSZip (CDN):** Used in `studio-manager` for 3MF parsing.
*   **Vite:** Build tool for both frontend applications.
*   **esbuild:** Bundler for the API server.
*   **@tanstack/react-query:** Data fetching and caching library in `desktop-companion`.
*   **framer-motion:** Animation library in `desktop-companion`.
*   **lucide-react:** Icon library in `desktop-companion`.
*   **react-dropzone:** File upload component in `desktop-companion`.