import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";

const router = Router();

function getClient() {
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
}

router.post("/analyze", async (req, res) => {
  const { base64, printerName, mediaType } = req.body;

  if (!base64 || !printerName) {
    return res.status(400).json({ error: "base64 and printerName required" });
  }

  const imgType = (mediaType || "image/jpeg") as
    | "image/jpeg"
    | "image/png"
    | "image/gif"
    | "image/webp";

  try {
    const anthropic = getClient();
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: imgType, data: base64 },
            },
            {
              type: "text",
              text: `You are monitoring a Bambu Lab FDM 3D printer named "${printerName}" via camera during an active print.

REAL FAILURE (status:"failure", confidence 0.9+):
- Filament actively tangling AROUND the toolhead/nozzle in a chaotic mass NOT attached to the print
- Print completely detached from the bed and being dragged around by the moving toolhead
- Large molten blob accumulated on the nozzle itself

WARNING (status:"warning"):
- Print visibly lifting or curling at edges (warping)
- Clear layer shift — print looks stepped/misaligned
- Partial detachment at one corner while rest is still printing

NORMAL — always status:"ok":
- Completed or in-progress parts sitting FLAT on the build plate (very common, not a failure)
- Multiple finished-looking parts on the bed (batch printing is normal)
- Camera showing bed from above with parts that look done or nearly done
- Empty or dark bed (printer idle or between jobs)
- Filament strands that are clearly PART OF the print structure

KEY RULE: If you cannot clearly see filament tangled around the toolhead or a print being dragged, use status:"ok". Prefer ok over failure when uncertain.

Reply ONLY with valid JSON, no markdown:
{"status":"ok","confidence":0.85,"issues":[],"description":"one sentence describing what you see"}
status: ok|warning|failure   confidence: 0.0-1.0`,
            },
          ],
        },
      ],
    });

    const raw = (
      message.content[0].type === "text" ? message.content[0].text : ""
    ).trim();

    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");

    if (start === -1 || end === -1) {
      return res.json({
        status: "ok",
        confidence: 0,
        issues: [],
        description: "AI response could not be parsed",
      });
    }

    const parsed = JSON.parse(raw.slice(start, end + 1));
    return res.json(parsed);
  } catch (e: any) {
    console.error("[Vision] Anthropic error:", e?.message);
    return res.status(500).json({
      status: "error",
      confidence: 0,
      issues: [],
      description: `AI error: ${e?.message || "unknown"}`,
    });
  }
});

export default router;
