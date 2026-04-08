import { Router } from "express";
import nodemailer from "nodemailer";
import path from "path";

// Inline logo attachment — travels inside the email, no external URL needed
const LOGO_PATH = path.join(process.cwd(), "artifacts", "studio-manager", "public", "ha3d-logo.png");
const LOGO_CID = "ha3d-logo@hypedanubis3d";

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

// ── Catalog order confirmation (convention catalog → ship later) ──
router.post("/catalog-order", async (req, res) => {
  try {
    const { to, customerName, items, total, method, conventionName, shippingAddress, notes } = req.body as {
      to: string;
      customerName?: string;
      items: Array<{ name: string; qty: number; price: number }>;
      total: string;
      method?: string;
      conventionName?: string;
      shippingAddress?: { address?: string; city?: string; state?: string; zip?: string; country?: string };
      notes?: string;
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

    const itemRows = items.map((i) =>
      `<tr>
        <td style="padding:8px 10px;border-bottom:1px solid #2a2a40;color:#e2e8f0;font-size:13px">${i.name}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #2a2a40;color:#94a3b8;text-align:center">${i.qty}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #2a2a40;color:#4ade80;text-align:right;font-family:monospace">$${(parseFloat(String(i.price)) * parseInt(String(i.qty))).toFixed(2)}</td>
      </tr>`
    ).join("");

    const addrLines = shippingAddress ? [
      shippingAddress.address,
      [shippingAddress.city, shippingAddress.state].filter(Boolean).join(", "),
      [shippingAddress.zip, shippingAddress.country].filter(Boolean).join(" "),
    ].filter(Boolean) : [];

    const addrHtml = addrLines.length > 0
      ? `<div style="background:#1a1a2e;border:1px solid #2a2a40;border-radius:8px;padding:14px 16px;margin-bottom:20px">
          <div style="font-size:10px;color:#64748b;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px">📦 Shipping To</div>
          ${addrLines.map(l => `<div style="color:#e2e8f0;font-size:13px;line-height:1.6">${l}</div>`).join("")}
        </div>`
      : "";

    const notesHtml = notes
      ? `<div style="background:#1a1a2e;border-left:3px solid #c9a227;border-radius:0 6px 6px 0;padding:10px 14px;margin-bottom:16px;font-size:12px;color:#94a3b8;font-style:italic">📝 Notes: ${notes}</div>`
      : "";

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Order Confirmed</title></head>
<body style="margin:0;padding:0;background:#0d0d1a;font-family:Arial,sans-serif">
  <div style="max-width:540px;margin:0 auto;padding:28px 16px">
    <div style="text-align:center;margin-bottom:28px">
      <img src="cid:${LOGO_CID}" alt="HypedAnubis3D" width="160" style="max-width:160px;height:auto;display:block;margin:0 auto 8px"/>
      <div style="font-size:9px;color:#555;letter-spacing:2px;margin-top:2px">ORDER CONFIRMED</div>
    </div>
    <div style="background:#141420;border:1px solid #2a2a40;border-radius:12px;padding:28px">
      <div style="text-align:center;margin-bottom:20px">
        <div style="font-size:28px;font-weight:900;color:#c9a227;letter-spacing:1px;text-transform:uppercase;font-family:Georgia,serif">Order Received!</div>
        <div style="font-size:12px;color:#64748b;margin-top:4px;letter-spacing:1px">We're printing your dreams ✨</div>
      </div>
      <p style="margin:0 0 8px;color:#cbd5e1;font-size:14px">${greeting}</p>
      <p style="margin:0 0 20px;color:#94a3b8;font-size:13px;line-height:1.6">
        Thank you for your order${conventionName ? ` at <strong style="color:#c084fc">${conventionName}</strong>` : ""}!
        Your items will be <strong style="color:#e2e8f0">custom 3D printed and shipped within 1–2 weeks</strong>.
        We'll send you a tracking number as soon as it's on its way. 🚀
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
        <thead>
          <tr style="background:#1e1e30">
            <th style="padding:8px 10px;color:#64748b;font-size:10px;font-weight:600;text-align:left;letter-spacing:1px">ITEM</th>
            <th style="padding:8px 10px;color:#64748b;font-size:10px;font-weight:600;text-align:center;letter-spacing:1px">QTY</th>
            <th style="padding:8px 10px;color:#64748b;font-size:10px;font-weight:600;text-align:right;letter-spacing:1px">PRICE</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a2e;border-radius:6px;margin-bottom:20px">
        <tr>
          <td style="padding:14px 12px;color:#94a3b8;font-size:13px">Total &middot; ${methodLabel}</td>
          <td style="padding:14px 12px;text-align:right;font-family:'Courier New',monospace;font-size:16px;font-weight:700;color:#4ade80">$${total}</td>
        </tr>
      </table>
      ${addrHtml}
      ${notesHtml}
      <div style="background:#1a1a2e;border:1px solid #c9a22744;border-radius:8px;padding:14px 16px;margin-bottom:20px;text-align:center">
        <div style="font-size:11px;color:#c9a227;font-weight:700;letter-spacing:1px;margin-bottom:4px">⏱ ESTIMATED SHIPPING</div>
        <div style="font-size:20px;font-weight:700;color:#e2e8f0">1 – 2 Weeks</div>
        <div style="font-size:11px;color:#64748b;margin-top:4px">We'll email you a tracking number when it ships</div>
      </div>
      <p style="margin:0;color:#475569;font-size:11px;text-align:center">
        Questions? Reply to this email or DM us on Instagram.<br>
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
      subject: `Your HypedAnubis3D order is confirmed! ✅ Ships in 1-2 weeks`,
      html,
      text: `${greeting}\n\nThank you for your order${conventionName ? ` at ${conventionName}` : ""}!\n\nYour items will be custom 3D printed and shipped within 1-2 weeks.\n\nItems:\n${items.map((i) => `${i.name} ×${i.qty} — $${(parseFloat(String(i.price)) * parseInt(String(i.qty))).toFixed(2)}`).join("\n")}\n\nTotal: $${total} (${methodLabel})\n\n${addrLines.length > 0 ? `Shipping to:\n${addrLines.join("\n")}\n\n` : ""}We'll send you a tracking number as soon as it ships!\n\nThanks for supporting HypedAnubis3D!`,
      attachments: [{ filename: "ha3d-logo.png", path: LOGO_PATH, cid: LOGO_CID }],
    });

    res.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[email] catalog-order error", msg);
    res.status(500).json({ success: false, error: msg });
  }
});

// ── Shipping confirmation with tracking number ──
router.post("/shipping", async (req, res) => {
  try {
    const { to, customerName, items, trackingNumber, shippingAddress, orderId } = req.body as {
      to: string;
      customerName?: string;
      items?: Array<{ name: string; qty: number; price: number }>;
      trackingNumber: string;
      shippingAddress?: string;
      orderId?: string;
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

    // Detect carrier and build direct tracking URL
    const tn = trackingNumber.replace(/\s/g, "").toUpperCase();
    let carrier = "Carrier";
    let trackingUrl = `https://www.google.com/search?q=${encodeURIComponent(trackingNumber + " tracking")}`;
    if (/^1Z[A-Z0-9]{16}$/.test(tn)) {
      carrier = "UPS";
      trackingUrl = `https://www.ups.com/track?tracknum=${tn}`;
    } else if (/^(94|93|92|94|95)[0-9]{18,20}$/.test(tn) || /^[0-9]{20,22}$/.test(tn)) {
      carrier = "USPS";
      trackingUrl = `https://tools.usps.com/go/TrackConfirmAction?tLabels=${tn}`;
    } else if (/^[0-9]{12}$/.test(tn) || /^[0-9]{15}$/.test(tn) || /^[0-9]{20}$/.test(tn)) {
      carrier = "FedEx";
      trackingUrl = `https://www.fedex.com/fedextrack/?trknbr=${tn}`;
    } else if (/^JD[0-9]{18}$/.test(tn) || /^JVGL[0-9]+$/.test(tn)) {
      carrier = "DHL";
      trackingUrl = `https://www.dhl.com/en/express/tracking.html?AWB=${tn}`;
    }

    const firstName = (customerName || "").split(" ")[0] || "there";
    const itemSummary = (items || []).map(i => `${i.name}${i.qty > 1 ? ` ×${i.qty}` : ""}`).join(", ");

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Your Order Is On Its Way!</title></head>
<body style="margin:0;padding:0;background:#050510;font-family:Arial,sans-serif">
  <!-- Hero gradient banner -->
  <div style="background:linear-gradient(135deg,#0d2b1a 0%,#0a1f2e 50%,#1a0d2e 100%);padding:36px 20px 0">
    <div style="max-width:540px;margin:0 auto;text-align:center">
      <img src="cid:${LOGO_CID}" alt="HypedAnubis3D" width="120" style="max-width:120px;height:auto;display:block;margin:0 auto 20px"/>
      <!-- Big rocket animation substitute -->
      <div style="font-size:52px;margin-bottom:8px">🚀</div>
      <div style="font-size:26px;font-weight:900;color:#ffffff;letter-spacing:2px;text-transform:uppercase;line-height:1.2;font-family:Georgia,serif">It's on its way!</div>
      <div style="font-size:13px;color:#4ade80;margin-top:6px;letter-spacing:1px">Your package has left the building 📦</div>
      <!-- Wave divider -->
      <div style="height:32px"></div>
    </div>
  </div>

  <div style="max-width:540px;margin:0 auto;padding:0 16px 28px">

    <!-- Greeting -->
    <div style="background:#0f1f15;border:1px solid #1a3a25;border-radius:0 0 12px 12px;padding:20px 24px 24px;margin-bottom:16px">
      <p style="margin:0 0 10px;color:#e2e8f0;font-size:14px">Hey <strong>${firstName}</strong>! 👋</p>
      <p style="margin:0;color:#94a3b8;font-size:13px;line-height:1.7">
        Great news — your HypedAnubis3D order is officially on its way to you!
        ${itemSummary ? `Your <strong style="color:#e2e8f0">${itemSummary}</strong> is heading your direction.` : ""}
        Use the tracking number below to follow your package every step of the way.
      </p>
    </div>

    <!-- Tracking hero card -->
    <div style="background:linear-gradient(135deg,#0d2b1a,#0a1a2e);border:2px solid #4ade80;border-radius:16px;padding:28px 20px;margin-bottom:16px;text-align:center;box-shadow:0 0 40px rgba(74,222,128,.15)">
      <div style="font-size:10px;color:#4ade80;letter-spacing:3px;text-transform:uppercase;margin-bottom:10px;font-weight:700">${carrier} Tracking Number</div>
      <div style="font-family:'Courier New',Courier,monospace;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:3px;margin-bottom:18px;word-break:break-all">${trackingNumber}</div>
      <a href="${trackingUrl}" style="display:inline-block;background:linear-gradient(90deg,#22c55e,#4ade80);color:#030d09;font-weight:900;font-size:13px;padding:12px 32px;border-radius:50px;text-decoration:none;letter-spacing:1.5px;text-transform:uppercase">Track My Package →</a>
      <div style="margin-top:14px;font-size:10px;color:#475569">Click the button or copy the tracking number above into your carrier's website</div>
    </div>

    ${shippingAddress ? `<!-- Delivery address -->
    <div style="background:#0d1117;border:1px solid #1e293b;border-radius:10px;padding:14px 18px;margin-bottom:16px;display:flex;align-items:flex-start;gap:12px">
      <div style="font-size:20px;flex-shrink:0">📍</div>
      <div>
        <div style="font-size:9px;color:#475569;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px">Delivering To</div>
        <div style="color:#cbd5e1;font-size:12px;line-height:1.7">${shippingAddress.replace(/,\s*/g, "<br>")}</div>
      </div>
    </div>` : ""}

    <!-- Footer CTA -->
    <div style="background:#0d1117;border:1px solid #1e293b;border-radius:10px;padding:20px;text-align:center">
      <div style="font-size:13px;color:#94a3b8;margin-bottom:12px">Share the love! Tag us when your order arrives 📸</div>
      <a href="https://www.instagram.com/hypedanubis3d" style="display:inline-block;background:#c9a227;color:#000;font-weight:700;font-size:11px;padding:8px 20px;border-radius:6px;text-decoration:none;letter-spacing:1px">@hypedanubis3d</a>
      <p style="margin:16px 0 0;color:#334155;font-size:10px">Questions? Just reply to this email — we've got you. 🤙</p>
    </div>

    <div style="text-align:center;margin-top:20px">
      <p style="color:#1e293b;font-size:9px;margin:0">HypedAnubis3D · Powered by LayerDeck${orderId ? ` · Order ${orderId}` : ""}</p>
    </div>
  </div>
</body>
</html>`;

    const transporter = getTransporter();
    await transporter.sendMail({
      from: `"HypedAnubis3D" <${senderEmail}>`,
      to,
      subject: `🚀 Your order is on its way! Tracking: ${trackingNumber}`,
      html,
      text: `Hey ${firstName}!\n\nGreat news — your HypedAnubis3D order has shipped!\n\n${carrier} Tracking: ${trackingNumber}\nTrack it here: ${trackingUrl}\n\n${shippingAddress ? `Delivering to: ${shippingAddress}\n\n` : ""}Tag us on Instagram when it arrives: @hypedanubis3d\n\nQuestions? Just reply to this email.\n\nHypedAnubis3D`,
      attachments: [{ filename: "ha3d-logo.png", path: LOGO_PATH, cid: LOGO_CID }],
    });

    res.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[email] shipping error", msg);
    res.status(500).json({ success: false, error: msg });
  }
});

export default router;
