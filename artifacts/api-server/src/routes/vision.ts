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
              text: `You are monitoring a 3D printer named "${printerName}" for print failures. Analyze this camera image.
Look for: spaghetti (tangled filament strands), layer shift, warping or bed adhesion failure, nozzle clog, stringing, blobs, or any other print defects.
If the printer appears to be off, empty, dark, or not actively printing, note that.
Reply ONLY with valid JSON and nothing else:
{"status":"ok","confidence":0.9,"issues":[],"description":"one sentence summary"}
status must be: ok, warning, or failure. confidence is 0.0 to 1.0.`,
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
