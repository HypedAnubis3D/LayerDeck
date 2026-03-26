import JSZip from 'jszip';

export interface Parsed3MF {
  id: string;
  filename: string;
  file: File;
  modelName: string;
  objectsCount: number;
  objects: string[];
  printTimeEstimate?: string;
  hrs?: number | null;
  filamentColors: string[];
  filamentTypes: string[];
  filamentGramsPerColor: number[];
  layerHeight?: number | null;
  nozzleDiam?: string;
  printer?: string;
  status: 'pending' | 'parsing' | 'ready' | 'error' | 'added';
  errorMessage?: string;
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
        result.filamentTypes = Array.isArray(cfg.filament_type)
          ? cfg.filament_type
          : [cfg.filament_type || ''];
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
      if (titleM) result.modelName = titleM[1];

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

    // ── Metadata/slice_info.config (XML) — print time + grams ──
    if (sliceRaw) {
      try {
        const siDoc = new DOMParser().parseFromString(sliceRaw, 'application/xml');
        const predEl = siDoc.querySelector('metadata[key="prediction"]');
        if (predEl) {
          const sec = parseInt(predEl.getAttribute('value') || '0');
          if (sec > 0) hrs = sec / 3600;
        }
        const filEls = [...siDoc.querySelectorAll('filament')];
        if (filEls.length) {
          filamentGramsPerColor = filEls
            .map((f) => parseFloat(f.getAttribute('used_g') || f.getAttribute('weight') || '0'))
            .filter((v) => v > 0)
            .map((v) => parseFloat(v.toFixed(2)));
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
