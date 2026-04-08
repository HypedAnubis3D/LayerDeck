import { Router } from "express";
import nodemailer from "nodemailer";

const router = Router();

function getTransporter() {
  const user = process.env.GMAIL_EMAIL;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) throw new Error("GMAIL_EMAIL or GMAIL_APP_PASSWORD not configured");
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
}

router.post("/receipt", async (req, res) => {
  try {
    const { to, customerName, items, total, method, conventionName, date } = req.body as {
      to: string;
      customerName?: string;
      items: Array<{ name: string; qty: number; price: number }>;
      total: string;
      method?: string;
      conventionName?: string;
      date?: string;
    };

    if (!to || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ success: false, error: "Missing required fields" });
      return;
    }

    const senderEmail = process.env.GMAIL_EMAIL;
    if (!senderEmail) {
      res.status(500).json({ success: false, error: "Email sender not configured — set GMAIL_EMAIL in environment" });
      return;
    }

    const greeting = customerName ? `Hi ${customerName},` : "Hi there,";
    const methodLabel = (method || "card").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const itemRows = items
      .map(
        (i) =>
          `<tr>
            <td style="padding:6px 8px;border-bottom:1px solid #2a2a40;color:#e2e8f0;font-size:13px">${i.name}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #2a2a40;color:#94a3b8;text-align:center">${i.qty}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #2a2a40;color:#4ade80;text-align:right;font-family:monospace">$${(parseFloat(String(i.price)) * parseInt(String(i.qty))).toFixed(2)}</td>
          </tr>`
      )
      .join("");

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Your Receipt</title></head>
<body style="margin:0;padding:0;background:#0d0d1a;font-family:Arial,sans-serif">
  <div style="max-width:520px;margin:0 auto;padding:24px 16px">
    <!-- Header -->
    <div style="text-align:center;margin-bottom:24px">
      <div style="font-family:Courier New,monospace;font-size:11px;font-weight:700;color:#c9a227;letter-spacing:3px;text-transform:uppercase">HypedAnubis3D</div>
      <div style="font-size:9px;color:#555;letter-spacing:2px;margin-top:2px">PURCHASE RECEIPT</div>
    </div>
    <!-- Body card -->
    <div style="background:#141420;border:1px solid #2a2a40;border-radius:12px;padding:24px">
      <p style="margin:0 0 16px;color:#cbd5e1;font-size:14px">${greeting}</p>
      <p style="margin:0 0 20px;color:#94a3b8;font-size:13px">
        Thank you for your purchase${conventionName ? ` at <strong style="color:#c084fc">${conventionName}</strong>` : ""}${date ? ` on ${date}` : ""}!
        Here's your receipt:
      </p>
      <!-- Items table -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
        <thead>
          <tr style="background:#1e1e30">
            <th style="padding:6px 8px;color:#64748b;font-size:10px;font-weight:600;text-align:left;letter-spacing:1px">ITEM</th>
            <th style="padding:6px 8px;color:#64748b;font-size:10px;font-weight:600;text-align:center;letter-spacing:1px">QTY</th>
            <th style="padding:6px 8px;color:#64748b;font-size:10px;font-weight:600;text-align:right;letter-spacing:1px">TOTAL</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
      <!-- Total (table layout for email client compatibility) -->
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a2e;border-radius:6px;margin-bottom:16px">
        <tr>
          <td style="padding:14px 12px;color:#94a3b8;font-size:13px;font-family:Arial,sans-serif">Total &middot; ${methodLabel}</td>
          <td style="padding:14px 12px;color:#4ade80;font-size:18px;font-weight:700;text-align:right;font-family:Courier New,monospace;white-space:nowrap">$${total}</td>
        </tr>
      </table>
      <p style="margin:0;color:#475569;font-size:11px;text-align:center">
        Questions? Reply to this email or find us on Instagram.<br>
        <a href="https://www.instagram.com/hypedanubis3d" style="color:#c9a227;text-decoration:none;font-weight:700">@hypedanubis3d</a><br><br>
        <span style="color:#c9a227">Thanks for supporting HypedAnubis3D! 🎉</span>
      </p>
    </div>
    <!-- Footer -->
    <div style="text-align:center;margin-top:16px">
      <p style="color:#334155;font-size:9px;margin:0">HypedAnubis3D · Powered by LayerDeck</p>
    </div>
  </div>
</body>
</html>`;

    const transporter = getTransporter();
    await transporter.sendMail({
      from: `"HypedAnubis3D" <${senderEmail}>`,
      to,
      subject: `Your receipt from HypedAnubis3D${conventionName ? ` — ${conventionName}` : ""}`,
      html,
      text: `Thank you for your purchase!\n\nItems:\n${items.map((i) => `${i.name} ×${i.qty} — $${(parseFloat(String(i.price)) * parseInt(String(i.qty))).toFixed(2)}`).join("\n")}\n\nTotal: $${total} (${methodLabel})\n\nThanks for supporting HypedAnubis3D!`,
    });

    res.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[email] receipt error", msg);
    res.status(500).json({ success: false, error: msg });
  }
});

// ── Shipping confirmation with tracking number ──
router.post("/shipping", async (req, res) => {
  try {
    const { to, customerName, items, total, trackingNumber, conventionName } = req.body as {
      to: string;
      customerName?: string;
      items: Array<{ name: string; qty: number; price: number }>;
      total: string;
      trackingNumber: string;
      conventionName?: string;
    };

    if (!to || !trackingNumber) {
      res.status(400).json({ success: false, error: "Missing required fields" });
      return;
    }

    const senderEmail = process.env.GMAIL_EMAIL;
    if (!senderEmail) {
      res.status(500).json({ success: false, error: "Email sender not configured" });
      return;
    }

    const greeting = customerName ? `Hi ${customerName},` : "Hi there,";
    const itemRows = (items || [])
      .map(
        (i) =>
          `<tr>
            <td style="padding:6px 8px;border-bottom:1px solid #2a2a40;color:#e2e8f0;font-size:13px">${i.name}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #2a2a40;color:#94a3b8;text-align:center">${i.qty}</td>
          </tr>`
      )
      .join("");

    // Build a generic tracking URL (works for USPS, UPS, FedEx, etc.)
    const trackingUrl = `https://www.google.com/search?q=${encodeURIComponent(trackingNumber + " tracking")}`;

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Your Order Has Shipped</title></head>
<body style="margin:0;padding:0;background:#0d0d1a;font-family:Arial,sans-serif">
  <div style="max-width:520px;margin:0 auto;padding:24px 16px">
    <div style="text-align:center;margin-bottom:24px">
      <div style="font-family:Courier New,monospace;font-size:11px;font-weight:700;color:#c9a227;letter-spacing:3px;text-transform:uppercase">HypedAnubis3D</div>
      <div style="font-size:9px;color:#555;letter-spacing:2px;margin-top:2px">YOUR ORDER HAS SHIPPED</div>
    </div>
    <div style="background:#141420;border:1px solid #2a2a40;border-radius:12px;padding:24px">
      <p style="margin:0 0 16px;color:#cbd5e1;font-size:14px">${greeting}</p>
      <p style="margin:0 0 20px;color:#94a3b8;font-size:13px">
        Great news! Your order${conventionName ? ` from <strong style="color:#c084fc">${conventionName}</strong>` : ""} has shipped and is on its way to you.
      </p>
      <!-- Tracking box -->
      <div style="background:#1a1a2e;border:2px solid #4ade80;border-radius:8px;padding:16px 20px;margin-bottom:20px;text-align:center">
        <div style="font-size:10px;color:#64748b;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px">Tracking Number</div>
        <div style="font-family:Courier New,monospace;font-size:20px;font-weight:700;color:#4ade80;letter-spacing:2px;margin-bottom:10px">${trackingNumber}</div>
        <a href="${trackingUrl}" style="display:inline-block;background:#4ade80;color:#0d0d1a;font-weight:700;font-size:12px;padding:8px 20px;border-radius:6px;text-decoration:none;letter-spacing:1px">Track My Package →</a>
      </div>
      ${itemRows ? `<table style="width:100%;border-collapse:collapse;margin-bottom:16px">
        <thead>
          <tr style="background:#1e1e30">
            <th style="padding:6px 8px;color:#64748b;font-size:10px;font-weight:600;text-align:left;letter-spacing:1px">ITEM</th>
            <th style="padding:6px 8px;color:#64748b;font-size:10px;font-weight:600;text-align:center;letter-spacing:1px">QTY</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>` : ""}
      <p style="margin:0;color:#475569;font-size:11px;text-align:center">
        Questions about your shipment? Reply to this email or DM us on Instagram.<br>
        <a href="https://www.instagram.com/hypedanubis3d" style="color:#c9a227;text-decoration:none;font-weight:700">@hypedanubis3d</a><br><br>
        <span style="color:#c9a227">Thanks for supporting HypedAnubis3D! 🎉</span>
      </p>
    </div>
    <div style="text-align:center;margin-top:16px">
      <p style="color:#334155;font-size:9px;margin:0">HypedAnubis3D · Powered by LayerDeck</p>
    </div>
  </div>
</body>
</html>`;

    const transporter = getTransporter();
    await transporter.sendMail({
      from: `"HypedAnubis3D" <${senderEmail}>`,
      to,
      subject: `Your HypedAnubis3D order has shipped! 📦 Tracking: ${trackingNumber}`,
      html,
      text: `${greeting}\n\nYour order has shipped!\n\nTracking Number: ${trackingNumber}\nTrack it here: ${trackingUrl}\n\nThank you for supporting HypedAnubis3D!`,
    });

    res.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[email] shipping error", msg);
    res.status(500).json({ success: false, error: msg });
  }
});

export default router;
