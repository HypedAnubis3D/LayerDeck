import { Router } from "express";
import { sendDailyDiscordReport } from "../lib/notificationScheduler";

const router = Router();

const CHANNEL_ENV_MAP: Record<string, string> = {
  "print-alerts":            "DISCORD_WEBHOOK_PRINT_ALERTS",
  "printer-status":          "DISCORD_WEBHOOK_PRINT_ALERTS",
  "pi-health":               "DISCORD_WEBHOOK_PI_HEALTH",
  "orders":                  "DISCORD_WEBHOOK_ORDERS",
  "stock-alerts":            "DISCORD_WEBHOOK_STOCK_ALERTS",
  "daily-report":            "DISCORD_WEBHOOK_DAILY_REPORT",
  "convention-sales":        "DISCORD_WEBHOOK_CONVENTION_SALES",
  "convention-prep":         "DISCORD_WEBHOOK_CONVENTION_PREP",
  "bambu-restock":           "DISCORD_WEBHOOK_BAMBU_RESTOCK",
  "print-failure-detected":  "DISCORD_WEBHOOK_PRINT_WATCH",
};

function resolveWebhookUrl(channel?: string, webhookUrl?: string): string | null {
  if (channel && CHANNEL_ENV_MAP[channel]) {
    const url = process.env[CHANNEL_ENV_MAP[channel]];
    if (url) return url;
  }
  return webhookUrl || null;
}

router.post("/notify", async (req, res) => {
  const { channel, webhookUrl, message, imageUrl } = req.body;
  if (!message) return res.status(400).json({ error: "message required" });

  const url = resolveWebhookUrl(channel, webhookUrl);
  if (!url) {
    return res.status(400).json({
      error: channel
        ? `No webhook configured for channel '${channel}' (set ${CHANNEL_ENV_MAP[channel] ?? "a matching env var"})`
        : "webhookUrl or channel required",
    });
  }

  try {
    const body: Record<string, unknown> = { content: message };
    if (imageUrl) {
      body.embeds = [{ image: { url: imageUrl } }];
    }

    const r = await fetch(url, {
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
