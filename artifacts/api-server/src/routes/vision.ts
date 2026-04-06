import { Router } from "express";
import OpenAI from "openai";

const router = Router();

function getClient() {
  return new OpenAI({
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "placeholder",
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
    const openai = getClient();
    const response = await openai.chat.completions.create({
      model: "gpt-5-nano",
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:${imgType};base64,${base64}`,
                detail: "low",
              },
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

    const raw = (response.choices[0]?.message?.content || "").trim();
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
    console.error("[Vision] OpenAI error:", e?.message);
    return res.status(500).json({
      status: "error",
      confidence: 0,
      issues: [],
      description: `AI error: ${e?.message || "unknown"}`,
    });
  }
});

export default router;
