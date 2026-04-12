# LayerDeck Forge — New Feature Brief

## What This Is

Build **LayerDeck Forge** — a full filament painting studio built into LayerDeck. It replaces the current Chroma Canvas Stack Planner page entirely. Instead of just suggesting colors and making the user go do everything manually in Chroma Canvas, Forge does the whole job inside LayerDeck:

1. User uploads an image
2. AI analyzes it and picks filament colors from their actual spool inventory
3. A live 2D + 3D preview renders instantly showing what the print will look like
4. User can tweak colors, layer order, and settings with live preview updates
5. Export a real STL file ready for Bambu Studio — no Chroma Canvas needed at all
6. Export syncs to the Desktop Companion app so it's available to download and open on PC

The Desktop Companion app also gets a standalone Forge tab so the user can run the full workflow from their PC as well.

This is a significant build. Take it section by section and don't skip anything.

---

## Navigation

**Mobile app (LayerDeck):**
- Replace the existing "Chroma Canvas Planner" nav entry with **"Forge"**
- Route: `/forge`
- Icon: 🔥 or a flame/forge icon if the design system has one

**Desktop Companion app:**
- Add a **"Forge"** tab to the companion app's navigation
- It runs the same full workflow as the mobile version

---

## Tech Stack for the 3D Preview & Export

Use **Three.js** (already available via CDN at `https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js`) for the 3D preview and STL export.

For STL export, use Three.js's built-in `STLExporter`:
```javascript
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
// or via CDN: THREE.STLExporter
```

The geometry approach (from Kromacut's open source implementation, MIT license):
- Each color slot = one flat rectangular slab at a specific height/thickness
- Slabs are stacked on top of each other (z-axis), darkest at bottom
- Each slab is a `BoxGeometry` with its color slot's hex applied as material color
- The image texture is mapped onto the top face of the topmost slab
- Export all slabs as a single merged STL

This is the same approach HueForge and Chroma Canvas use — the "painting" effect comes from stacking translucent filament layers at print time, not from the geometry itself.

---

## Page Layout — Forge (`/forge`)

The page has three states: **Setup**, **Preview**, and **Export**.

---

### State 1 — Setup

**Section A: Image Upload**

Large upload zone. Drag & drop or tap to browse. Accepts JPG, PNG, WEBP.
Show thumbnail preview once loaded with filename and a "Change" button.

**Section B: Spool Picker**

On page load, fetch spools from Supabase `spools` table where `remaining > 50`, ordered by `remaining DESC`.

**Exact field names from the spools table — use these precisely:**
| Field | Description |
|---|---|
| `id` | Unique ID |
| `name` | Spool display name / color name |
| `color` | Hex color string (e.g. `#ff5500`) |
| `material` | Material type (e.g. "Matte PLA") |
| `brand` | Brand name (e.g. "Bambu Lab") |
| `amsSlot` | AMS slot number |
| `remaining` | Remaining grams |
| `total` | Total grams (full spool capacity) |

When passing spools to the AI, format each as:
```
{ id, name, color, material, brand, remaining }
```

A spool is "low" if `remaining < 100`.

Show a spool count indicator: `🧵 X spools available`

Below it, show a horizontal scrollable row of spool swatches — colored circles using the `color` field, with `name` shown on tap. This lets the user visually see what they're working with before analyzing.

**Section C: Settings**

Four controls in a 2x2 grid:

| Control | Options | Default |
|---|---|---|
| Color Slots | 3 / 4 / 5 / 6 | 4 |
| Layer Height | 0.08mm / 0.10mm / 0.12mm / 0.16mm | 0.10mm |
| Print Size | 80mm / 100mm / 120mm / 150mm / 200mm | 120mm |
| Print Style | Auto-detect / Portrait / Landscape / Logo | Auto-detect |

Each control has a `?` tooltip with a plain English explanation (static, same as v2):
- Color Slots: "How many filament swaps. 4 is the sweet spot."
- Layer Height: "Thinner = smoother blending. 0.10mm is best for most images."
- Print Size: "The physical size of the final print in mm."
- Print Style: "Helps the AI understand your image content."

**Section D: Analyze Button**

```
[ 🔥 Analyze with Forge ]
```

Disabled until image is loaded. On tap, calls `POST /api/forge/analyze` and transitions to Preview state.

---

### State 2 — Preview

This is the main state. Show everything below simultaneously.

**A. AI Summary Bar**

Horizontal pill row: Subject · Style · Slots · Layer Height · Print Size · Est. Layers

**B. Palette Strip**

Horizontal color bar, one segment per slot, slot number below each. Slots are clickable — tapping a slot opens a color picker that lets the user swap it for any other spool from inventory (or a custom hex if no match). Live preview updates on change.

**C. 3D Preview Panel**

This is the hero element. A Three.js canvas showing the stacked slab model:

- **2D tab**: Flat top-down view showing the image mapped onto the print surface with the selected palette applied. This is a Canvas 2D render — take the uploaded image, reduce it to the selected palette colors using nearest-color matching per pixel, and display the result. This is what the print will actually look like from above.

  **Nearest-color matching implementation — do this correctly, it's critical to preview quality:**

  Use **perceptual color distance in LAB color space**, not RGB. RGB distance produces ugly, inaccurate results. LAB distance matches how human eyes perceive color similarity, which is what matters for filament printing.

  Algorithm:
  ```javascript
  // Step 1: Convert every palette hex to LAB once upfront
  function hexToLab(hex) {
    // hex → sRGB (0–1)
    const r = parseInt(hex.slice(1,3),16)/255;
    const g = parseInt(hex.slice(3,5),16)/255;
    const b = parseInt(hex.slice(5,7),16)/255;
    // sRGB → linear RGB
    const toLinear = c => c > 0.04045 ? Math.pow((c+0.055)/1.055, 2.4) : c/12.92;
    const lr = toLinear(r), lg = toLinear(g), lb = toLinear(b);
    // linear RGB → XYZ (D65)
    const x = lr*0.4124564 + lg*0.3575761 + lb*0.1804375;
    const y = lr*0.2126729 + lg*0.7151522 + lb*0.0721750;
    const z = lr*0.0193339 + lg*0.1191920 + lb*0.9503041;
    // XYZ → LAB
    const f = t => t > 0.008856 ? Math.cbrt(t) : (7.787*t + 16/116);
    const fx = f(x/0.95047), fy = f(y/1.0), fz = f(z/1.08883);
    return [116*fy - 16, 500*(fx-fy), 200*(fy-fz)];
  }

  // Step 2: For each pixel, find the palette color with smallest LAB distance
  function nearestPaletteColor(pixelR, pixelG, pixelB, paletteLabs, paletteHexes) {
    const pixLab = hexToLab(rgbToHex(pixelR, pixelG, pixelB));
    let minDist = Infinity, bestIdx = 0;
    for (let i = 0; i < paletteLabs.length; i++) {
      const dL = pixLab[0]-paletteLabs[i][0];
      const da = pixLab[1]-paletteLabs[i][1];
      const db = pixLab[2]-paletteLabs[i][2];
      const dist = Math.sqrt(dL*dL + da*da + db*db);
      if (dist < minDist) { minDist = dist; bestIdx = i; }
    }
    return paletteHexes[bestIdx];
  }

  // Step 3: Draw onto an offscreen canvas, then display
  // Process in a Web Worker or in chunks of rows to avoid blocking the UI thread
  // Scale the image down to max 400px on the longest side before processing
  // (full-res processing on mobile will freeze the UI)
  ```

  Additional quality steps:
  - **Downscale before processing**: resize the image to max 400×400px before running per-pixel matching. The preview doesn't need full resolution and processing 8MP images pixel-by-pixel will freeze the browser.
  - **Apply a subtle blur** (1–2px Gaussian) to the source image before matching to reduce noise/grain showing up as speckles in the preview
  - **Process in chunks**: use `requestAnimationFrame` or a Web Worker to process rows in batches so the UI stays responsive. Show a progress indicator ("Rendering preview…") while processing.
  - When the user swaps a slot color, re-run the matching and re-render the preview. Cache the source pixel data so re-renders are fast.

- **3D tab**: Three.js scene showing the stacked slabs from an isometric angle. Each slab is a different color. Rotate with touch/drag. Shows the physical layer structure.

Controls below the preview:
- Tab toggle: `[ 2D Preview ]  [ 3D View ]`
- Size display: `120 × 120 × 3.2mm`
- Rotate hint (3D only): `Drag to rotate`

**D. Slot Cards**

Same as v2 but now interactive:

Each card shows:
- Colored circle (using `slot.hex`) + slot number + role (Base / Mid / Top)
- Color name (`slot.colorName`) + spool brand (`slot.bambuFilamentName`)
- Hex with copy button
- Remaining weight — look up from `availableSpools` by matching `slot.hex` to `spool.color`, show `spool.remaining`g remaining
- Plain English role note (`slot.roleNote`)
- Low warning if matched spool `remaining < 100`: `⚠️ Low — Xg remaining`
- Swap button: opens a modal showing all spools from `availableSpools` sorted by LAB color distance to the current slot hex, user picks one, preview updates live

**E. Layer Instructions Panel**

A plain English print checklist generated by the AI. Shows exactly:
```
LAYER INSTRUCTIONS
──────────────────────────────────
AMS Slot 1  ●  Bambu Matte Black    Layers 1–8     Load first
AMS Slot 2  ●  Bambu Matte Brown    Layers 9–16
AMS Slot 3  ●  Bambu Matte Tan      Layers 17–22
AMS Slot 4  ●  Ivory White          Layers 23–28   Load last
──────────────────────────────────
Total: 28 layers · 0.10mm · ~2.8mm tall
```

The colored circle matches the spool hex. Layer ranges come from the AI response.

**F. Quality Score + Tips**

Same as v2: 1–10 score with label, detail text, and numbered Chroma Canvas tips (now labelled "Forge Tips").

**G. Export Button**

```
[ ⬇ Export STL — Open in Bambu Studio ]
```

Prominent button at the bottom. See Export section below.

---

### State 3 — Export Flow

When user taps Export:

1. Generate the STL from the Three.js scene using `STLExporter`
2. Upload the STL binary to Supabase Storage bucket `forge-exports`
3. Create a record in a new Supabase table `forge_exports`:
   ```
   id, user_id, image_name, created_at, stl_url, slot_count, layer_height, print_size, palette (json), layer_instructions (text), status ('ready')
   ```
4. Show a success panel:

```
┌─────────────────────────────────────────────┐
│  ✅ Export Ready                             │
│                                             │
│  [palette color strip]                      │
│  [image name].stl · 120×120mm · 4 colors   │
│                                             │
│  📥 Synced to Desktop Companion             │
│  Open the Forge tab on your PC to download  │
│  and open directly in Bambu Studio.         │
│                                             │
│  [ Download STL on this device ]            │
│  [ Export Another Image ]                   │
└─────────────────────────────────────────────┘
```

The "Download STL on this device" button downloads the file directly to the mobile device.

---

## Backend — New Endpoints

Add all of these to the existing LayerDeck Express server. Do not create a new server.

### `POST /api/forge/analyze`

Receives: `{ imageBase64, imageType, slots, layerHeight, printSize, printStyle, availableSpools }`

Same Claude Vision API call as the existing Chroma Canvas endpoint but with an updated prompt. Use the same `ANTHROPIC_API_KEY` secret.

**Spool field mapping — the spools table uses these exact field names:**
```javascript
// availableSpools[] items have these fields from the spools table:
// id, name, color (hex), material, brand, remaining, total, amsSlot

const hasSpools = availableSpools && availableSpools.length > 0;

const spoolsContext = hasSpools
  ? `The user owns these filament spools (only suggest from this list):
${availableSpools.map(s => `- ${s.brand} ${s.name} | Hex: ${s.color} | ${s.remaining}g remaining`).join('\n')}`
  : `No inventory provided — suggest ideal Bambu Lab ${ftLabel} filaments.`;

// A spool is "low" if remaining < 100
// When returning isLow in slots, check: availableSpools.find(s => s.color === slot.hex)?.remaining < 100
```

Updated prompt additions (add to the existing prompt):
- Ask Claude to also return `layerInstructions` — an array of objects with `{ amsSlot, spoolName, hex, layerStart, layerEnd, instruction }`
- Ask Claude to return `estimatedLayers` as a number
- Ask Claude to return `forgeTips` array (same as chromaCanvasTips but rebranded)

Full updated JSON response shape:
```json
{
  "imageSummary": "...",
  "detectedStyle": "portrait|landscape|logo|abstract",
  "layerHeight": "0.10",
  "estimatedLayers": 28,
  "recommendedPrintSize": "120x120mm",
  "plateThickness": "1.2mm",
  "settingsExplainer": { "layerHeight": "...", "totalLayers": "...", "plateThickness": "...", "printSize": "..." },
  "qualityScore": { "score": 8, "label": "Strong contrast", "detail": "..." },
  "slots": [
    {
      "slot": 1,
      "role": "Base / Darkest",
      "colorName": "Rich Black",
      "hex": "#1a1a1a",
      "bambuFilamentName": "Bambu Lab Matte Black",
      "searchTerm": "Bambu Lab Matte Black",
      "roleNote": "...",
      "layerStart": 1,
      "layerEnd": 8,
      "isLow": false,
      "swapSuggestion": null
    }
  ],
  "layerInstructions": [
    { "amsSlot": 1, "spoolName": "Bambu Lab Matte Black", "hex": "#1a1a1a", "layerStart": 1, "layerEnd": 8, "instruction": "Load first — base layer" }
  ],
  "forgeTips": ["tip 1", "tip 2", "tip 3"],
  "beginnerWarnings": ["warning if any"]
}
```

### `POST /api/forge/export`

Receives: `{ stlBase64, filename, palette, layerInstructions, layerHeight, printSize, slotCount }`

1. Decode base64 STL
2. Upload to Supabase Storage `forge-exports` bucket as `{timestamp}-{filename}.stl`
3. Insert record into `forge_exports` table
4. Return `{ exportId, stlUrl, downloadUrl }`

### `GET /api/forge/exports`

Returns all records from `forge_exports` table for the current user, ordered by `created_at DESC`. Used by the Desktop Companion to list available exports.

### `GET /api/forge/exports/:id/download`

Returns a signed download URL for the STL file from Supabase Storage. Used by the Desktop Companion download button.

---

## Supabase Changes

### New table: `forge_exports`

```sql
create table forge_exports (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default now(),
  image_name text,
  stl_url text,
  download_url text,
  slot_count integer,
  layer_height text,
  print_size text,
  palette jsonb,
  layer_instructions jsonb,
  status text default 'ready'
);
```

### New Storage bucket: `forge-exports`

Public read, authenticated write. Files stored as `{timestamp}-{original-filename}.stl`.

---

## Desktop Companion — Technical Context

The Desktop Companion is an existing **React + Vite** app served from the Pi hub server at `/companion`. It already has:
- Supabase client configured with the existing project credentials
- Access to all existing Supabase tables and storage buckets
- The `layerstack-media` Supabase Storage bucket already exists and is public

For the `forge-exports` storage bucket: create it in Supabase as a **public** bucket named `forge-exports`. Same settings as `layerstack-media`.

The companion is served via `app.use('/companion', express.static(...))` on the Pi's Express server. All API calls from the companion go to the same Pi Express server using relative paths.

For the "Open in Bambu Studio" feature in the companion: use `window.open(downloadUrl)` to trigger the file download. Since the companion runs in a browser (served from the Pi), a direct download link is the correct approach — not Electron's `shell.openPath()`. The user's OS will handle opening the `.stl` with Bambu Studio if it's set as the default app for that file type.

---

## Desktop Companion — Forge Tab

Add a **Forge** tab to the Desktop Companion app navigation.

The Forge tab in the companion has two sub-sections:

### Sub-section 1: Export Queue

Shows all records from `GET /api/forge/exports`, most recent first.

Each export card shows:
- Palette color strip (from `palette` JSON)
- Image name + print size + slot count + date
- Status badge: `Ready to Download`
- **`[ Open in Bambu Studio ]`** button — use `window.open(downloadUrl)` to trigger the STL file download. The user's OS will handle opening it with Bambu Studio if set as the default app for `.stl` files.
- **`[ Save STL ]`** button — same `window.open(downloadUrl)`, browser's native download dialog handles the save location

### Sub-section 2: Forge Studio (full workflow on PC)

The exact same Forge workflow as the mobile app — image upload, AI analysis, live preview, export — but laid out for a wider desktop screen:

- Left panel: upload + settings + spool picker
- Center panel: 2D/3D preview (larger canvas, mouse rotate for 3D)
- Right panel: slot cards + layer instructions + export button

The desktop version uses the same backend endpoints as the mobile version. No separate API needed.

When the user exports from the Desktop Companion, the STL downloads directly to their machine and opens a "Open in Bambu Studio" button.

---

## Notification — Export Sync

When a new export is created (from either mobile or desktop), the Desktop Companion should show a notification badge on the Forge tab indicating a new export is ready. This can be implemented by polling `GET /api/forge/exports` every 30 seconds and comparing the count to the last known count.

---

## What NOT to Change

- Do not modify any existing LayerDeck pages or features
- Do not change the spools table schema — read only
- Do not create a new backend server — all endpoints go on the existing Express server
- The existing Chroma Canvas Planner page/route can be deleted and replaced by Forge
- Do not add any other new navigation items beyond Forge

---

## Summary of Deliverables

1. `/forge` page in LayerDeck mobile app (replaces Chroma Canvas Planner)
2. Four new backend API endpoints on the existing Express server
3. New `forge_exports` Supabase table — the `forge-exports` storage bucket is **already created** in Supabase, do not recreate it
4. Forge tab in Desktop Companion with Export Queue + full Forge Studio
5. Export sync notification badge in companion

**Build in this order and stop after each for testing:**
1. Backend endpoints (`/api/forge/analyze`, `/api/forge/export`, `/api/forge/exports`, `/api/forge/exports/:id/download`)
2. Mobile `/forge` page — Setup and Preview states only
3. Mobile `/forge` page — Export state
4. Companion Export Queue tab
5. Companion Forge Studio tab

Do not build everything at once. Complete and confirm each step before moving to the next.
