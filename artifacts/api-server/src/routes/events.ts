import { Router } from "express";
import https from "https";

const router = Router();

// Call Anthropic directly via raw HTTPS to avoid Replit network proxy interception
function anthropicMessages(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.ANTHROPIC_API_KEY || "";
    const body = JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });
    const options = {
      hostname: "api.anthropic.com",
      path: "/v1/messages",
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
        "content-length": Buffer.byteLength(body),
      },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(parsed.error.message || JSON.stringify(parsed.error)));
          const text = parsed.content?.[0]?.text ?? "";
          resolve(text);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

router.post("/search", async (req, res) => {
  const { city, type, radius } = req.body ?? {};
  if (!city) {
    res.status(400).json({ error: "city is required" });
    return;
  }

  const eventType = type || "3D printing collectibles maker";
  const searchRadius = typeof radius === "number" && radius > 0 ? radius : 50;
  const today = new Date().toISOString().split("T")[0];

  const prompt = `You are a helpful assistant for a small business owner who sells 3D printed collectibles at vendor events.

Today is ${today}. Find upcoming conventions, craft fairs, maker markets, anime/pop-culture cons, and artisan markets within approximately ${searchRadius} miles of "${city}" (this may be a city name, city+state, or US zip code — use it to determine the region) where a vendor selling 3D printed collectibles could book a booth. Only include events within roughly ${searchRadius} miles — do not include events that are clearly much farther away.

Focus on event type: ${eventType}

CRITICAL RULES — follow these exactly:
1. FUTURE DATES ONLY: Only include events that have not yet occurred as of ${today}. Do not include events whose dates have already passed. If an annual event's next occurrence date is unknown, use "TBD (annual)" but only include it if it plausibly occurs after ${today}.
2. ACCURATE WEBSITES: Only include a website URL if you are confident it is the real, active official website. If you are not sure the URL is correct and working, leave website as an empty string "". Never guess or fabricate a URL — a missing website is far better than a broken link.
3. DATE ACCURACY: If you are not certain of exact dates, say "TBD" or give a rough timeframe (e.g. "Fall 2026 (TBD)"). Do not invent specific dates you are not confident about.
4. QUANTITY: Return up to 16 events — aim for the full 16 by including well-known recurring regional events even if you only know the approximate season. Spread across different event types when possible.

Return ONLY a valid JSON array (no markdown, no explanation) of up to 16 events. Each event object must have these fields:
- name: string (event name)
- date: string (future date or date range, e.g. "June 14-16, 2026", "Fall 2026 (TBD)", or "TBD (annual)")
- venue: string (venue name and city)
- type: string (one of: "Convention", "Craft Fair", "Maker Market", "Pop-up Market", "Anime/Comic Con", "Gaming Con", "Artisan Market")
- attendance: string (estimated attendance, e.g. "~2,000" or "Unknown")
- boothCost: string (typical vendor booth cost, e.g. "$150–$250/day" or "Unknown")
- website: string (confirmed official website URL, or empty string "" if uncertain)
- vendorDeadline: string (vendor/exhibitor application deadline, e.g. "March 15, 2026" — use "Unknown" if not known)
- notes: string (any useful notes: indoor/outdoor, recurring, special requirements, etc.)

Only return the raw JSON array, starting with [ and ending with ].`;

  try {
    const raw = await anthropicMessages(prompt);
    let events: unknown[];
    try {
      const jsonStart = raw.indexOf("[");
      const jsonEnd = raw.lastIndexOf("]");
      const jsonStr = jsonStart !== -1 && jsonEnd !== -1 ? raw.slice(jsonStart, jsonEnd + 1) : raw;
      events = JSON.parse(jsonStr);
    } catch {
      events = [];
    }
    res.json({ events, city });
  } catch (err) {
    console.error("Event search error:", err);
    res.status(500).json({ error: "Failed to search events" });
  }
});

export default router;
