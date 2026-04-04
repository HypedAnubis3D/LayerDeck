import { Router } from "express";
import { sendDailyDiscordReport } from "../lib/notificationScheduler";

const router = Router();

router.post("/notify", async (req, res) => {
  const { webhookUrl, message, imageUrl } = req.body;
  if (!webhookUrl) return res.status(400).json({ error: "webhookUrl required" });
  if (!message) return res.status(400).json({ error: "message required" });

  try {
    const body: Record<string, unknown> = { content: message };
    if (imageUrl) {
      body.embeds = [{ image: { url: imageUrl } }];
    }

    const r = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!r.ok) {
      const text = await r.text().catch(() => "");
      return res
        .status(r.status)
        .json({ error: `Discord returned ${r.status}`, detail: text });
    }

    res.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    res.status(500).json({ error: msg });
  }
});

// Manual trigger for the daily report (from Discord settings page)
router.post("/daily-report/send", async (_req, res) => {
  try {
    await sendDailyDiscordReport();
    res.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    res.status(500).json({ error: msg });
  }
});

export default router;
