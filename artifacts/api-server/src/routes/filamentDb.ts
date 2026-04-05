import { Router } from "express";

const router = Router();

// Maps filamentcolors.xyz manufacturer IDs → our brand names
const MFR_MAP: Record<number, string> = {
  170: "Bambu Lab",
  188: "ELEGOO",
  12:  "Polymaker",
  68:  "SUNLU",
  216: "3DHoJor",
};

// Maps filamentcolors.xyz filament type names → our mat names
const TYPE_MAP: Record<string, string> = {
  "PLA Matte":          "PLA Matte",
  "PLA Basic":          "PLA Basic",
  "PLA":                "PLA Basic",
  "Silk PLA":           "PLA Silk",
  "PLA Silk+":          "PLA Silk",
  "PLA Silk Dual Color":"PLA Silk Multi Color",
  "Silk Dual Color":    "PLA Silk Multi Color",
  "PLA Silk Gradient":  "PLA Silk Multi Color",
  "Silk Gradient":      "PLA Silk Multi Color",
  "PLA Silk Multi Color":"PLA Silk Multi Color",
  "PLA Galaxy":         "PLA Galaxy",
  "PLA Sparkle":        "PLA Sparkle",
  "PLA Gradient":       "PLA Gradient",
  "PLA Lite":           "PLA Lite",
  "PLA Glow":           "PLA Glow",
  "PLA Metal":          "PLA Metal",
  "PLA Marble":         "PLA Marble",
  "PLA+":               "PLA+",
  "PLA Pro":            "PLA+",
  "PLA Tough":          "PLA Tough",
  "PLA Tough+":         "PLA Tough",
  "PLA High Speed":     "PLA High Speed",
  "High Speed PLA":     "PLA High Speed",
  "PLA Meta":           "PLA Silk",
  "Carbon Fiber PLA":   "PLA-CF",
  "PETG-HF":            "PETG HF",
  "PETG":               "PETG Basic",
  "PETG Carbon Fiber":  "PETG-CF",
  "PET-CF":             "PETG-CF",
  "PETG-CF":            "PETG-CF",
  "ABS":                "ABS",
  "ASA":                "ASA",
  "ASA Glow":           "ASA Glow",
  "TPU / TPE":          "TPU 95A",
  "TPU":                "TPU 95A",
  "TPU 90A":            "TPU 90A",
  "TPU 68D":            "TPU 68D",
  "PAHT-CF":            "PA6-CF",
  "PA6-CF":             "PA6-CF",
  "PC":                 "PC",
  "PVB":                "PVB",
  "PolyLite PLA":       "PLA Basic",
  "PolyTerra PLA":      "PLA Matte",
  "PolyMax PLA":        "PLA+",
  "PolyFlex TPU95":     "TPU 95A",
  "PolyFlex TPU90":     "TPU 95A",
  "PolyFlex TPU95-HF":  "TPU 95A",
  "PolyLite PETG":      "PETG Basic",
  "PolyLite ABS":       "ABS",
  "PolyLite ASA":       "ASA",
  "PolySmooth PVB":     "PVB",
  "Polysmooth PVB":     "PVB",
  "Panchroma Matte":    "PLA Matte",
  "Panchroma Luminous": "PLA Glow",
  "Panchroma Starlight":"PLA Silk",
  "Panchroma Metallic": "PLA Metal",
  "Panchroma Galaxy":   "PLA Galaxy",
  "Panchroma Celestial":"PLA Silk",
  "Panchroma Marble":   "PLA Marble",
  "Panchroma":          "PLA Basic",
  "PolyLite Pro":       "PLA Basic",
  "PolyMax PC":         "PC",
  "PolySupport":        "Support W",
  "Silk PLA+":          "PLA Silk",
  "Elite PLA":          "PLA Basic",
  "APLA":               "PLA+",
  "Glow PLA":           "PLA Glow",
};

interface Swatch {
  color_name: string;
  hex_color: string;
  manufacturer: { id: number; name: string };
  filament_type: { name: string };
}

interface PagedResult {
  results: Swatch[];
  next: string | null;
}

async function fetchAll(mfrId: number): Promise<Swatch[]> {
  const all: Swatch[] = [];
  let page = 1;
  while (true) {
    const url = `https://filamentcolors.xyz/api/swatch/?manufacturer__id=${mfrId}&page_size=100&page=${page}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) break;
    const data: PagedResult = await res.json();
    all.push(...(data.results || []));
    if (!data.next) break;
    page++;
    if (page > 20) break;
  }
  return all;
}

// GET /api/filament-db/sync
// Returns grouped color data for all mapped brands from filamentcolors.xyz
router.get("/sync", async (_req, res) => {
  try {
    const mfrIds = Object.keys(MFR_MAP).map(Number);

    const results = await Promise.all(
      mfrIds.map(async (id) => {
        const swatches = await fetchAll(id);
        const brand = MFR_MAP[id];

        // Group by mat
        const byMat: Record<string, { name: string; hex: string }[]> = {};
        for (const s of swatches) {
          const typeName = s.filament_type?.name || "";
          const mat = TYPE_MAP[typeName];
          if (!mat) continue;
          const hex = "#" + s.hex_color.replace(/^#/, "");
          if (!byMat[mat]) byMat[mat] = [];
          // Avoid duplicates (same hex or same name)
          const exists = byMat[mat].some(
            (c) => c.hex.toLowerCase() === hex.toLowerCase() || c.name.toLowerCase() === s.color_name.toLowerCase()
          );
          if (!exists) byMat[mat].push({ name: s.color_name, hex });
        }

        return { brand, types: byMat, total: swatches.length };
      })
    );

    res.json({ ok: true, data: results, fetchedAt: new Date().toISOString() });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
