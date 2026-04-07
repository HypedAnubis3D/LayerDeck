import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";

const router = Router();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

router.post("/search", async (req, res) => {
  const { city, type } = req.body ?? {};
  if (!city) {
    res.status(400).json({ error: "city is required" });
    return;
  }

  const eventType = type || "3D printing collectibles maker";
  const today = new Date().toISOString().split("T")[0];

  const prompt = `You are a helpful assistant for a small business owner who sells 3D printed collectibles at vendor events.

Today is ${today}. Find upcoming conventions, craft fairs, maker markets, anime/pop-culture cons, and artisan markets near "${city}" (this may be a city name, city+state, or US zip code — use it to determine the region) where a vendor selling 3D printed collectibles could book a booth.

Focus on event type: ${eventType}

Return ONLY a valid JSON array (no markdown, no explanation) of up to 8 events. Each event object must have these fields:
- name: string (event name)
- date: string (date or date range, e.g. "June 14-16, 2026" or "TBD")
- venue: string (venue name and city)
- type: string (one of: "Convention", "Craft Fair", "Maker Market", "Pop-up Market", "Anime/Comic Con", "Gaming Con", "Artisan Market")
- attendance: string (estimated attendance, e.g. "~2,000" or "Unknown")
- boothCost: string (typical vendor booth cost, e.g. "$150–$250/day" or "Unknown")
- website: string (official website URL or empty string if unknown)
- vendorDeadline: string (vendor/exhibitor application deadline, e.g. "March 15, 2026" — use "Unknown" if not known)
- notes: string (any useful notes: indoor/outdoor, recurring, special requirements, etc.)

If you don't know of specific confirmed events, include well-known recurring events in that region that typically occur annually. Be honest — use "TBD" for dates you're not certain about and note if the event is recurring/annual.

Only return the raw JSON array, starting with [ and ending with ].`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text.trim() : "[]";

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
