import { Router } from "express";

const router = Router();

interface SlotRequest {
  imageBase64: string;
  imageType: string;
  slots: string;
  layerHeight: string;
  filamentType: string;
  printStyle: string;
}

// POST /api/chroma-canvas/analyze
router.post("/analyze", async (req, res) => {
  const token = process.env.ANTHROPIC_API_KEY;
  if (!token) return res.status(500).json({ error: "ANTHROPIC_API_KEY not set" });

  const { imageBase64, imageType, slots, layerHeight, filamentType, printStyle } = req.body as SlotRequest;

  if (!imageBase64) return res.status(400).json({ error: "imageBase64 required" });

  const ftLabel: Record<string, string> = {
    matte: "Matte PLA",
    basic: "Basic PLA",
    silk: "Silk PLA",
    any: "PLA",
  };
  const ft = ftLabel[filamentType] || "Matte PLA";
  const slotCount = parseInt(slots) || 4;
  const lh = layerHeight || "0.10";

  const prompt = `You are an expert at Bambu Lab's Chroma Canvas filament painting tool.

Analyze this image and return a ${slotCount}-slot color palette optimized for Chroma Canvas at ${lh}mm layer height using ${ft}.
Print style: ${printStyle === "auto" ? "auto-detect from image" : printStyle}

IMPORTANT RULES:
- Slot 1 = DARKEST color (background/shadow, printed first at bottom)
- Slot ${slotCount} = LIGHTEST color (highlight/foreground, printed last at top)
- Sequence must go dark to light for Chroma Canvas depth mapping to work correctly
- Recommend real Bambu Lab ${ft} filament names (e.g. "Bambu Lab Matte Black", "Bambu Lab Matte Ivory White")
- Hex codes should represent printable filament colors, not raw image pixels

Return ONLY valid JSON, no markdown:
{
  "imageSummary": "brief subject description",
  "detectedStyle": "portrait|landscape|logo|abstract",
  "layerHeight": "${lh}",
  "recommendedTotalLayers": 25,
  "recommendedPrintSize": "120x120mm",
  "plateThickness": "1.2mm",
  "slots": [
    {
      "slot": 1,
      "role": "Background / Darkest",
      "colorName": "Rich Black",
      "hex": "#1a1a1a",
      "bambuFilamentName": "Bambu Lab Matte Black",
      "searchTerm": "Bambu Lab Matte Black",
      "roleNote": "what this layer represents visually in the print"
    }
  ],
  "amsLoadOrder": "short tip on AMS slot assignment",
  "printNotes": "2-3 specific Chroma Canvas tips for this image: gradient slider advice, contrast adjustments, layer count recommendation"
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
        max_tokens: 1200,
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
    return res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
});

export default router;
