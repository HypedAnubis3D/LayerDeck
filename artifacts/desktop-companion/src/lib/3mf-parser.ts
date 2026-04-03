import JSZip from 'jszip';

export interface PlateFilamentData {
  plateId: number | null;
  filGrams: Record<number, number>;
}

export interface Parsed3MF {
  id: string;
  filename: string;
  file?: File | null;
  modelName: string;
  metaTitle?: string;
  objectsCount: number;
  objects: string[];
  printTimeEstimate?: string;
  hrs?: number | null;
  filamentColors: string[];
  filamentTypes: string[];
  filamentGramsPerColor: number[];
  plateFilamentGrams?: PlateFilamentData[];
  purgeGrams?: number;
  supportGrams?: number;
  layerHeight?: number | null;
  nozzleDiam?: string;
  printer?: string;
  status: 'pending' | 'parsing' | 'ready' | 'error' | 'added';
  errorMessage?: string;
}

// Extract a clean, specific filament type from a Bambu preset ID string.
// "Bambu PLA Basic @BBL X1C" → "PLA Basic"
// "Generic PLA" → "PLA"
// Falls back to the raw filament_type value if nothing useful can be parsed.
function _extractFilamentType(settingsId: string, fallback: string): string {
  if (!settingsId) return fallback || '';
  const noSuffix = settingsId.split('@')[0].trim();
  const cleaned = noSuffix
    .replace(/^(Bambu|Generic|Polymaker|PolyLite|eSun|Elegoo|Hatchbox|Overture|Prusament|Extrudr|Fiberlogy)\s+/i, '')
    .trim();
  return cleaned || fallback || '';
}

export async function parse3MFFile(file: File): Promise<Parsed3MF> {
  const result: Parsed3MF = {
    id: crypto.randomUUID(),
    filename: file.name,
    file,
    modelName: file.name.replace(/\.3mf$/i, ''),
    objectsCount: 0,
    objects: [],
    filamentColors: [],
    filamentTypes: [],
    filamentGramsPerColor: [],
    status: 'parsing',
  };

  try {
    const zip = new JSZip();
    const contents = await zip.loadAsync(file);

    async function readZipFile(path: string): Promise<string | null> {
      const f = contents.file(path);
      if (!f) return null;
      return f.async('text');
    }

    const [settingsRaw, modelRaw, sliceRaw] = await Promise.all([
      readZipFile('Metadata/project_settings.config'),
      readZipFile('3D/3dmodel.model'),
      readZipFile('Metadata/slice_info.config'),
    ]);

    let hrs: number | null = null;
    let filamentGramsPerColor: number[] = [];

    // ── project_settings.config (JSON) ──
    if (settingsRaw) {
      try {
        const cfg = JSON.parse(settingsRaw);
        result.printer = cfg.printer_model || cfg.printer_settings_id || '';
        // Prefer filament_settings_id for specific names ("PLA Basic", "PLA Matte", etc.)
        // e.g. "Bambu PLA Basic @BBL X1C" → "PLA Basic"
        const settingsIds = Array.isArray(cfg.filament_settings_id)
          ? cfg.filament_settings_id
          : [cfg.filament_settings_id || ''];
        const baseTypes = Array.isArray(cfg.filament_type)
          ? cfg.filament_type
          : [cfg.filament_type || ''];
        result.filamentTypes = settingsIds.map((sid: string, i: number) =>
          _extractFilamentType(sid, baseTypes[i] || '')
        );
        result.filamentColors = (
          Array.isArray(cfg.filament_colour)
            ? cfg.filament_colour
            : [cfg.filament_colour || '']
        )
          .map((c: string) => (c ? '#' + c.replace(/[^a-fA-F0-9]/g, '').slice(0, 6) : ''))
          .filter((c: string) => c && c.length >= 4);
        result.layerHeight = parseFloat(cfg.layer_height) || null;
        result.nozzleDiam = Array.isArray(cfg.nozzle_diameter)
          ? cfg.nozzle_diameter[0]
          : cfg.nozzle_diameter || '';
      } catch (e) {
        console.warn('3MF settings parse error:', e);
      }
    }

    // ── 3D/3dmodel.model (XML) — title + object names ──
    if (modelRaw) {
      const titleM =
        modelRaw.match(/name="Title"\s+value="([^"]+)"/) ||
        modelRaw.match(/<metadata name="Title">([^<]+)<\/metadata>/i);
      // Store metadata title separately — Bambu Studio often leaves a stale project title
      // from a previous file, so the filename (user-set) is more reliable as the primary name
      if (titleM) result.metaTitle = titleM[1];

      // Bambu format: key="name" value="something.stl"
      const oNames = [
        ...modelRaw.matchAll(/key="name"\s+value="([^"]+\.stl[^"]*)"/gi),
      ].map((m) => m[1]);
      result.objects = [...new Set(oNames)];
      result.objectsCount = result.objects.length;

      // Fallback: standard <object name="..."> tags
      if (result.objectsCount === 0) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(modelRaw, 'text/xml');
        const objs = xmlDoc.getElementsByTagName('object');
        result.objectsCount = objs.length;
        for (let i = 0; i < objs.length; i++) {
          const n = objs[i].getAttribute('name');
          if (n) result.objects.push(n);
        }
      }
    }

    // ── Metadata/slice_info.config (XML) — print time + per-plate grams + support ──
    if (sliceRaw) {
      try {
        const siDoc = new DOMParser().parseFromString(sliceRaw, 'application/xml');
        const predEl = siDoc.querySelector('metadata[key="prediction"]');
        if (predEl) {
          const sec = parseInt(predEl.getAttribute('value') || '0');
          if (sec > 0) hrs = sec / 3600;
        }
        let supG = 0, purG = 0;
        const sliceColorByIdx: Record<number, string> = {};
        const plateFilamentGrams: PlateFilamentData[] = [];

        function parseFilEls(fels: Element[], gramMap: Record<number, number> | null) {
          fels.forEach((f) => {
            const g = parseFloat(f.getAttribute('used_g') || f.getAttribute('weight') || '0');
            const ft = (f.getAttribute('type') || '').toLowerCase();
            const fid = parseInt(f.getAttribute('id') || '-1');
            const fcol = ('#' + (f.getAttribute('color') || '').replace(/[^a-fA-F0-9]/g, '')).slice(0, 7);
            if (ft.includes('support') || ft.includes('interface')) {
              if (g > 0) supG += g;
            } else if (ft.includes('flush')) {
              if (g > 0) purG += g;
            } else if (fid >= 0) {
              if (fcol && fcol.length === 7 && !sliceColorByIdx[fid]) sliceColorByIdx[fid] = fcol;
              if (gramMap) gramMap[fid] = (gramMap[fid] || 0) + g;
            }
          });
        }

        const plateEls = [...siDoc.querySelectorAll('plate')];
        if (plateEls.length) {
          plateEls.forEach((pl) => {
            const pidMeta = pl.querySelector('metadata[key="plater_id"]');
            const plateId = pidMeta ? parseInt(pidMeta.getAttribute('value') || '-1') : null;
            const filGrams: Record<number, number> = {};
            parseFilEls([...pl.querySelectorAll('filament')], filGrams);
            if (Object.keys(filGrams).length) plateFilamentGrams.push({ plateId, filGrams });
          });
          const combined: Record<number, number> = {};
          plateFilamentGrams.forEach((p) => {
            Object.entries(p.filGrams).forEach(([id, g]) => {
              const i = parseInt(id); combined[i] = (combined[i] || 0) + g;
            });
          });
          const maxIdx = Object.keys(combined).length ? Math.max(...Object.keys(combined).map(Number)) : -1;
          if (maxIdx >= 0) {
            for (let i = 0; i <= maxIdx; i++) filamentGramsPerColor[i] = combined[i] ? parseFloat(combined[i].toFixed(2)) : 0;
          }
        } else {
          const gmap: Record<number, number> = {};
          parseFilEls([...siDoc.querySelectorAll('filament')], gmap);
          const maxI = Object.keys(gmap).length ? Math.max(...Object.keys(gmap).map(Number)) : -1;
          if (maxI >= 0) {
            for (let i = 0; i <= maxI; i++) filamentGramsPerColor[i] = gmap[i] ? parseFloat(gmap[i].toFixed(2)) : 0;
          }
        }

        if (supG > 0) result.supportGrams = parseFloat(supG.toFixed(2));
        if (purG > 0) result.purgeGrams = parseFloat(purG.toFixed(2));
        if (plateFilamentGrams.length) result.plateFilamentGrams = plateFilamentGrams;

        // Override filamentColors with slice_info data (slot-indexed, more accurate)
        if (Object.keys(sliceColorByIdx).length) {
          const maxCI = Math.max(...Object.keys(sliceColorByIdx).map(Number));
          const newCols = Array.from({ length: maxCI + 1 }, (_, i) => sliceColorByIdx[i] || result.filamentColors[i] || '');
          if (newCols.some((c) => c && c.length >= 4)) result.filamentColors = newCols;
        }
        // Ensure filamentTypes is at least as long as filamentColors (pad with base type)
        if (result.filamentColors.length > result.filamentTypes.length) {
          const base = result.filamentTypes[0] || '';
          while (result.filamentTypes.length < result.filamentColors.length)
            result.filamentTypes.push(base);
        }
      } catch (e) {
        console.warn('slice_info parse error:', e);
      }
    }

    // ── Fallback: scan gcode files for print time + grams ──
    if (!hrs || !filamentGramsPerColor.length) {
      const allFiles = Object.keys(contents.files);
      for (const fname of allFiles) {
        if (!fname.endsWith('.gcode') && !fname.endsWith('.gc')) continue;
        try {
          const gc = await contents.file(fname)!.async('text');
          if (!hrs) {
            const m =
              gc.match(/;\s*estimated printing time[^\d]*(\d+)h\s*(\d+)m/i) ||
              gc.match(/;\s*total estimated time.*?(\d+)h\s*(\d+)m/i);
            if (m) hrs = parseFloat(m[1]) + parseFloat(m[2]) / 60;
          }
          if (!filamentGramsPerColor.length) {
            const mB = gc.match(/;\s*filament used \[g\]\s*=\s*([\d.]+(?:\s*[;,]\s*[\d.]+)+)/i);
            if (mB)
              filamentGramsPerColor = mB[1]
                .split(/[;,]/)
                .map((s) => parseFloat(s.trim()))
                .filter((v) => v > 0);
            if (!filamentGramsPerColor.length) {
              const mC = gc.match(/;\s*filament used \[g\]\s*=\s*([\d.]+)/i);
              if (mC) filamentGramsPerColor = [parseFloat(parseFloat(mC[1]).toFixed(2))];
            }
          }
        } catch {
          /* skip bad gcode */
        }
        if (hrs && filamentGramsPerColor.length) break;
      }
    }

    result.hrs = hrs ? parseFloat(hrs.toFixed(2)) : null;
    result.filamentGramsPerColor = filamentGramsPerColor;

    if (hrs) {
      const h = Math.floor(hrs);
      const m = Math.round((hrs - h) * 60);
      result.printTimeEstimate = `${h}h ${m}m`;
    }

    // Fallback model name from filename if still empty
    if (!result.modelName || result.modelName === file.name.replace(/\.3mf$/i, '')) {
      result.modelName = file.name.replace(/\.3mf$/i, '').replace(/_/g, ' ');
    }

    result.status = 'ready';
  } catch (error) {
    console.error('Error parsing 3MF:', error);
    result.status = 'error';
    result.errorMessage = error instanceof Error ? error.message : 'Invalid 3MF file';
  }

  return result;
}
