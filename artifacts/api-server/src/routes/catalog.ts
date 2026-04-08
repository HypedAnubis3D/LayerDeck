import { Router } from "express";
import https from "https";

const router = Router();

const N3D_BASE = "www.n3dmelbourne.com";
const CPL_BASE = "www.cpl3d.com";

function httpsGet(hostname: string, path: string, headers: Record<string, string>): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname, path, method: "GET", headers: { "User-Agent": "LayerDeck/1.0", ...headers } },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try { resolve(JSON.parse(data)); }
          catch (e) { reject(new Error("Invalid JSON from upstream: " + data.slice(0, 200))); }
        });
      }
    );
    req.setTimeout(15000, () => { req.destroy(); reject(new Error("Upstream timeout")); });
    req.on("error", reject);
    req.end();
  });
}

// ── N3D Melbourne ─────────────────────────────────────────────────────────────
// GET /api/catalog/n3d?page=1&limit=50&category=&search=
router.get("/n3d", async (req, res) => {
  const key = process.env.N3D_API_KEY || "";
  if (!key) { res.status(500).json({ error: "N3D API key not configured" }); return; }

  const params = new URLSearchParams();
  if (req.query.page)     params.set("page",     String(req.query.page));
  if (req.query.limit)    params.set("limit",    String(req.query.limit || 50));
  if (req.query.category) params.set("category", String(req.query.category));
  if (req.query.search)   params.set("search",   String(req.query.search));
  params.set("locale", "AU");

  try {
    const data = await httpsGet(N3D_BASE, `/api/v1/designs?${params}`, {
      Authorization: `Bearer ${key}`,
    });
    res.json(data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("N3D proxy error:", msg);
    res.status(502).json({ error: "N3D API error: " + msg });
  }
});

// ── CPL3D ─────────────────────────────────────────────────────────────────────
// GET /api/catalog/cpl?page=1&limit=50&type=&search=&sort=name&sortDir=asc
router.get("/cpl", async (req, res) => {
  const key = process.env.CPL3D_API_KEY || "";
  if (!key) { res.status(500).json({ error: "CPL3D API key not configured" }); return; }

  const params = new URLSearchParams();
  if (req.query.page)    params.set("page",    String(req.query.page));
  if (req.query.limit)   params.set("limit",   String(req.query.limit || 50));
  if (req.query.type)    params.set("type",    String(req.query.type));
  if (req.query.search)  params.set("search",  String(req.query.search));
  if (req.query.sort)    params.set("sort",    String(req.query.sort));
  if (req.query.sortDir) params.set("sortDir", String(req.query.sortDir));

  try {
    const data = await httpsGet(CPL_BASE, `/api/v1/models?${params}`, {
      Authorization: `Bearer ${key}`,
    });
    res.json(data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("CPL3D proxy error:", msg);
    res.status(502).json({ error: "CPL3D API error: " + msg });
  }
});

export default router;
