import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import { Pool } from "pg";

const router = Router();
const FORGE_BUCKET = "forge-exports";

// ── Supabase (storage only) ────────────────────────────────────────────────────
function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

// ── Local Postgres (forge_exports table) ──────────────────────────────────────
const db = new Pool({ connectionString: process.env.DATABASE_URL });

async function ensureForgeTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS forge_exports (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      created_at TIMESTAMPTZ DEFAULT now(),
      image_name TEXT,
      stl_url TEXT,
      download_url TEXT,
      slot_count INTEGER,
      layer_height TEXT,
      print_size TEXT,
      palette JSONB,
      layer_instructions JSONB,
      status TEXT DEFAULT 'ready'
    )
  `);
}

// Run on first load — idempotent
ensureForgeTable().catch(() => {});

// ── POST /api/forge/analyze ────────────────────────────────────────────────────
router.post("/analyze", async (req, res) => {
  const token = process.env.ANTHROPIC_API_KEY;
  if (!token) return res.status(500).json({ error: "ANTHROPIC_API_KEY not set" });

  const {
    imageBase64,
    imageType,
    slots,
    layerHeight,
    printSize,
    printStyle,
    availableSpools,
  } = req.body as {
    imageBase64: string;
    imageType: string;
    slots: string;
    layerHeight: string;
    printSize: string;
    printStyle: string;
    availableSpools?: Array<{
      id: string;
      name: string;
      color: string;
      material: string;
      brand: string;
      remaining: number;
    }>;
  };

  if (!imageBase64) return res.status(400).json({ error: "imageBase64 required" });

  const slotCount = parseInt(slots) || 4;
  const lh = layerHeight || "0.10";
  const ps = printSize || "120mm";
  const style = printStyle === "auto" ? "auto-detect from the image" : printStyle;
  const hasSpools = availableSpools && availableSpools.length > 0;

  const spoolsContext = hasSpools
    ? `The user owns these filament spools. You MUST only choose from this exact list — match hex values exactly as given:
${availableSpools!
  .map(
    (s) =>
      `- ${s.brand} ${s.name} | Hex: ${s.color} | ${s.remaining}g remaining${s.remaining < 100 ? " (LOW)" : ""}`
  )
  .join("\n")}`
    : `No spool inventory provided — suggest ideal Bambu Lab Matte PLA filaments with appropriate hex colors.`;

  const prompt = `You are an expert at filament painting — a technique where flat 3D-printed slabs are stacked to create multi-color images, similar to HueForge and Bambu's Chroma Canvas.

Analyze this image and return a ${slotCount}-slot filament palette for a ${ps} print at ${lh}mm layer height.
Print style: ${style}

${spoolsContext}

CRITICAL RULES:
- Slot 1 = DARKEST color (bottom/base, printed first). Must be the darkest.
- Slot ${slotCount} = LIGHTEST color (top, printed last). Must be the lightest.
- Sequence MUST go strictly dark → light. This is required for filament painting to work.
${hasSpools ? "- Hex values MUST exactly match one of the user's spools listed above. Do NOT invent new hex colors." : "- Use realistic printable filament hex colors."}
- Distribute layers evenly across slots.
- estimatedLayers: calculate as Math.round(${ps.replace("mm", "")} / ${lh} * 0.025).
- isLow = true if that spool has < 100g remaining.
- layerStart / layerEnd: distribute estimatedLayers evenly across all ${slotCount} slots.

Return ONLY valid JSON, no markdown:
{
  "imageSummary": "brief 1-sentence subject description",
  "detectedStyle": "portrait|landscape|logo|abstract",
  "layerHeight": "${lh}",
  "estimatedLayers": 28,
  "recommendedPrintSize": "${ps}",
  "plateThickness": "Xmm",
  "settingsExplainer": {
    "layerHeight": "Why ${lh}mm is good for this image",
    "totalLayers": "What the layer count means",
    "plateThickness": "What plate thickness means",
    "printSize": "Why ${ps} is recommended"
  },
  "qualityScore": {
    "score": 8,
    "label": "Strong contrast",
    "detail": "One sentence explaining why this image works well for filament painting."
  },
  "slots": [
    {
      "slot": 1,
      "role": "Base / Darkest",
      "colorName": "Rich Black",
      "hex": "#1a1a1a",
      "bambuFilamentName": "Bambu Lab Matte Black",
      "searchTerm": "Bambu Lab Matte Black",
      "roleNote": "What this layer represents visually in the final print",
      "layerStart": 1,
      "layerEnd": 8,
      "isLow": false,
      "swapSuggestion": null
    }
  ],
  "layerInstructions": [
    {
      "amsSlot": 1,
      "spoolName": "Bambu Lab Matte Black",
      "hex": "#1a1a1a",
      "layerStart": 1,
      "layerEnd": 8,
      "instruction": "Load first — base layer"
    }
  ],
  "forgeTips": [
    "Specific actionable tip for this image",
    "Tip about gradient/contrast settings",
    "Tip about layer count or filament choice"
  ],
  "beginnerWarnings": []
}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": token,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 1500,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: imageType || "image/jpeg",
                  data: imageBase64,
                },
              },
              { type: "text", text: prompt },
            ],
          },
        ],
      }),
    });

    const data = (await response.json()) as {
      error?: { message: string };
      content?: Array<{ type: string; text?: string }>;
    };

    if (data.error) return res.status(500).json({ error: data.error.message });
    if (!data.content) return res.status(500).json({ error: "No content in API response" });

    const raw = data.content.map((b) => b.text || "").join("");
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const stack = JSON.parse(cleaned);
    return res.json({ stack });
  } catch (err) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

// ── POST /api/forge/export ─────────────────────────────────────────────────────
router.post("/export", async (req, res) => {
  const { stlBase64, filename, palette, layerInstructions, layerHeight, printSize, slotCount } =
    req.body as {
      stlBase64: string;
      filename: string;
      palette: unknown;
      layerInstructions: unknown;
      layerHeight: string;
      printSize: string;
      slotCount: number;
    };

  if (!stlBase64 || !filename) {
    return res.status(400).json({ error: "stlBase64 and filename required" });
  }

  const stlBuffer = Buffer.from(stlBase64, "base64");
  const storageKey = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}.stl`;
  let stlUrl = "";

  // Try Supabase Storage first
  const sb = getSupabase();
  if (sb) {
    try {
      const { error: uploadError } = await sb.storage
        .from(FORGE_BUCKET)
        .upload(storageKey, stlBuffer, { contentType: "model/stl", upsert: false });

      if (!uploadError) {
        const { data: urlData } = sb.storage.from(FORGE_BUCKET).getPublicUrl(storageKey);
        stlUrl = urlData?.publicUrl ?? "";
      }
    } catch {
      // Storage unavailable — continue with empty url
    }
  }

  try {
    const result = await db.query(
      `INSERT INTO forge_exports (image_name, stl_url, download_url, slot_count, layer_height, print_size, palette, layer_instructions, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ready')
       RETURNING id`,
      [
        filename,
        stlUrl,
        stlUrl,
        slotCount,
        layerHeight,
        printSize,
        JSON.stringify(palette),
        JSON.stringify(layerInstructions),
      ]
    );

    const exportId = result.rows[0].id;

    // If no Supabase URL, generate a local download endpoint URL
    const downloadUrl = stlUrl || `/api/forge/exports/${exportId}/download`;

    await db.query(`UPDATE forge_exports SET download_url=$1 WHERE id=$2`, [downloadUrl, exportId]);

    return res.json({ exportId, stlUrl, downloadUrl });
  } catch (err) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Export failed",
    });
  }
});

// ── GET /api/forge/exports ─────────────────────────────────────────────────────
router.get("/exports", async (_req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM forge_exports ORDER BY created_at DESC LIMIT 50"
    );
    return res.json({ exports: result.rows });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Query failed" });
  }
});

// ── GET /api/forge/exports/:id/download ───────────────────────────────────────
router.get("/exports/:id/download", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT stl_url, download_url, image_name FROM forge_exports WHERE id = $1",
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Export not found" });
    const row = result.rows[0];
    return res.json({
      downloadUrl: row.download_url || row.stl_url,
      filename: row.image_name,
    });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Query failed" });
  }
});

export default router;
