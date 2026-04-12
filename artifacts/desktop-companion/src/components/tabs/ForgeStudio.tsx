import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDropzone } from 'react-dropzone';
import JSZip from 'jszip';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  Upload, Loader2, Download, X, Shuffle, AlertTriangle,
  Cpu, Layers,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Spool {
  id: string; name: string; color: string; material: string;
  brand: string; amsSlot: number; remaining: number; total: number;
}

interface Slot {
  slot: number; role: string; colorName: string; hex: string;
  bambuFilamentName: string; layerStart: number; layerEnd: number;
  isLow: boolean; roleNote: string; swapSuggestion: string | null;
}

interface LayerInstruction {
  amsSlot: number; spoolName: string; hex: string;
  layerStart: number; layerEnd: number; instruction: string;
}

interface ForgeStack {
  imageSummary: string; detectedStyle: string; layerHeight: string;
  estimatedLayers: number; recommendedPrintSize: string; plateThickness: string;
  qualityScore: { score: number; label: string; detail: string };
  slots: Slot[]; layerInstructions: LayerInstruction[];
  forgeTips: string[]; beginnerWarnings: string[];
}

// ── Color Math ────────────────────────────────────────────────────────────────

function hexToLab(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const lin = (c: number) => c > 0.04045 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92;
  const lr = lin(r), lg = lin(g), lb = lin(b);
  const x = lr * 0.4124564 + lg * 0.3575761 + lb * 0.1804375;
  const y = lr * 0.2126729 + lg * 0.7151522 + lb * 0.0721750;
  const z = lr * 0.0193339 + lg * 0.1191920 + lb * 0.9503041;
  const f = (t: number) => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  const fx = f(x / 0.95047), fy = f(y), fz = f(z / 1.08883);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function labDist(a: [number, number, number], b: [number, number, number]) {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

function nearestHex(r: number, g: number, b: number, labs: [number, number, number][], hexes: string[]) {
  const lin = (c: number) => c > 0.04045 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92;
  const lr = lin(r / 255), lg = lin(g / 255), lb = lin(b / 255);
  const px = lr * 0.4124564 + lg * 0.3575761 + lb * 0.1804375;
  const py = lr * 0.2126729 + lg * 0.7151522 + lb * 0.0721750;
  const pz = lr * 0.0193339 + lg * 0.1191920 + lb * 0.9503041;
  const f = (t: number) => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  const pLab: [number, number, number] = [
    116 * f(py) - 16, 500 * (f(px / 0.95047) - f(py)), 200 * (f(py) - f(pz / 1.08883)),
  ];
  let minDist = Infinity, best = 0;
  for (let i = 0; i < labs.length; i++) {
    const d = labDist(pLab, labs[i]);
    if (d < minDist) { minDist = d; best = i; }
  }
  return hexes[best];
}

// ── 3MF builder ───────────────────────────────────────────────────────────────

function escXml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Color utilities and greedy meshing adapted from Kromacut by vycdev (MIT license)
// https://github.com/vycdev/Kromacut

function pixelToLab(r: number, g: number, b: number): [number, number, number] {
  const lin = (v: number) => v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92;
  const rl = lin(r / 255), gl = lin(g / 255), bl = lin(b / 255);
  const X = (rl * 0.4124 + gl * 0.3576 + bl * 0.1805) / 0.95047;
  const Y =  rl * 0.2126 + gl * 0.7152 + bl * 0.0722;
  const Z = (rl * 0.0193 + gl * 0.1192 + bl * 0.9505) / 1.08883;
  const f = (v: number) => v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116;
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}

function hexToLab(hex: string): [number, number, number] {
  return pixelToLab(parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16));
}

function sampleImagePixels(base64: string, type: string, res: number): Promise<Uint8ClampedArray> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = res; canvas.height = res;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, res, res);
      resolve(ctx.getImageData(0, 0, res, res).data);
    };
    img.src = `data:${type};base64,${base64}`;
  });
}

// Maximal-rectangle greedy meshing — merges adjacent active pixels into minimal rectangles
// Adapted from Kromacut (MIT license) https://github.com/vycdev/Kromacut
function greedyMerge(active: Uint8Array, W: number, H: number): Array<{ x: number; y: number; w: number; h: number }> {
  const visited = new Uint8Array(W * H);
  const rects: Array<{ x: number; y: number; w: number; h: number }> = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x;
      if (!active[idx] || visited[idx]) continue;
      let w = 1;
      while (x + w < W && active[y * W + (x + w)] && !visited[y * W + (x + w)]) w++;
      let h = 1, canExpand = true;
      while (y + h < H && canExpand) {
        for (let dx = 0; dx < w; dx++) {
          if (!active[(y + h) * W + (x + dx)] || visited[(y + h) * W + (x + dx)]) {
            canExpand = false; break;
          }
        }
        if (canExpand) h++;
      }
      for (let dy = 0; dy < h; dy++)
        for (let dx = 0; dx < w; dx++)
          visited[(y + dy) * W + (x + dx)] = 1;
      rects.push({ x, y, w, h });
    }
  }
  return rects;
}

const TFACE = [
  [0,2,1],[0,3,2], [5,7,4],[5,6,7],
  [4,3,0],[4,7,3], [1,2,6],[1,6,5],
  [0,1,5],[0,5,4], [3,7,6],[3,6,2],
] as const;

async function build3MF(
  slots: Slot[], printMM: number, lh: number,
  imageBase64?: string, imageType?: string
): Promise<Blob> {
  const half = printMM / 2;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
  <Default Extension="config" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
</Types>`;

  const rels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel" Target="/3D/3dmodel.model" Id="rel0"/>
  <Relationship Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel" Target="/Metadata/model_settings.config" Id="rel1"/>
</Relationships>`;

  // ── Z ranges per slot ─────────────────────────────────────────────────────
  const slabThicks = slots.map(s => Math.max(1, (s.layerEnd || 1) - (s.layerStart || 0)) * lh);
  const zBots: number[] = [], zTops: number[] = [];
  let zA = 0;
  slabThicks.forEach(t => { zBots.push(zA); zA += t; zTops.push(zA); });

  // ── Per-pixel slot assignment via LAB color distance ──────────────────────
  const slotLabs = slots.map(s => hexToLab(s.hex || '#888888'));
  const imgRes = Math.min(Math.round(printMM), 150);
  const stepMM = printMM / imgRes;
  let topSlotIdx: Int32Array | null = null;

  if (imageBase64) {
    const pixelData = await sampleImagePixels(imageBase64, imageType || 'image/jpeg', imgRes);
    topSlotIdx = new Int32Array(imgRes * imgRes);
    for (let py = 0; py < imgRes; py++) {
      for (let px = 0; px < imgRes; px++) {
        const di = (py * imgRes + px) * 4;
        const lab = pixelToLab(pixelData[di], pixelData[di + 1], pixelData[di + 2]);
        let best = 0, bestDist = Infinity;
        slotLabs.forEach((sl, si) => {
          const d = (lab[0]-sl[0])**2 + (lab[1]-sl[1])**2 + (lab[2]-sl[2])**2;
          if (d < bestDist) { bestDist = d; best = si; }
        });
        topSlotIdx[py * imgRes + px] = best;
      }
    }
  }

  // ── basematerials for 3MF color reference ────────────────────────────────
  const baseMats = slots.map((s, i) =>
    `      <base name="${escXml(s.colorName || 'Slot' + (i + 1))}" displaycolor="${s.hex || '#888888'}"/>`
  ).join('\n');

  // ── Greedy heightmap mesh per slot ────────────────────────────────────────
  // Slot K is active for a pixel when topSlotIdx[pixel] >= K, meaning
  // filament K appears somewhere in the vertical stack at that pixel.
  let objectsXml = '', buildItems = '';
  slots.forEach((slot, i) => {
    const zBot = zBots[i], zTop = zTops[i];
    const objId = i + 10;

    const active = new Uint8Array(imgRes * imgRes);
    if (topSlotIdx) {
      for (let p = 0; p < active.length; p++) active[p] = topSlotIdx[p] >= i ? 1 : 0;
    } else {
      active.fill(1);
    }

    const rects = greedyMerge(active, imgRes, imgRes);

    const verts: number[] = [], tris: number[] = [];
    for (const { x, y, w, h } of rects) {
      const ox = x * stepMM - half, oy = y * stepMM - half;
      const ox2 = ox + w * stepMM, oy2 = oy + h * stepMM;
      const vBase = verts.length / 3;
      verts.push(
        ox,  oy,  zBot,  ox2, oy,  zBot,  ox2, oy2, zBot,  ox,  oy2, zBot,
        ox,  oy,  zTop,  ox2, oy,  zTop,  ox2, oy2, zTop,  ox,  oy2, zTop
      );
      TFACE.forEach(t => tris.push(vBase + t[0], vBase + t[1], vBase + t[2]));
    }

    const vLines: string[] = [], tLines: string[] = [];
    for (let vi = 0; vi < verts.length; vi += 3)
      vLines.push(`<vertex x="${verts[vi].toFixed(3)}" y="${verts[vi+1].toFixed(3)}" z="${verts[vi+2].toFixed(3)}"/>`);
    for (let ti = 0; ti < tris.length; ti += 3)
      tLines.push(`<triangle v1="${tris[ti]}" v2="${tris[ti+1]}" v3="${tris[ti+2]}"/>`);

    objectsXml +=
      `    <object id="${objId}" type="model" pid="1" pindex="${i}" name="${escXml(slot.colorName || 'Slot' + (i + 1))}">\n` +
      `      <mesh>\n        <vertices>${vLines.join('')}</vertices>\n        <triangles>${tLines.join('')}</triangles>\n      </mesh>\n    </object>\n`;
    buildItems += `    <item objectid="${objId}"/>\n`;
  });

  const model = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US"
  xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources>
    <basematerials id="1">
${baseMats}
    </basematerials>
${objectsXml}  </resources>
  <build>
${buildItems}  </build>
</model>`;

  // ── model_settings.config — Bambu Studio extruder assignment ─────────────
  // Format adapted from Kromacut (MIT) https://github.com/vycdev/Kromacut
  let cfgObjects = '';
  slots.forEach((slot, i) => {
    cfgObjects += ` <object id="${i + 10}">\n  <metadata key="name" value="${escXml(slot.colorName || 'Slot' + (i + 1))}"/>\n  <metadata key="extruder" value="${i + 1}"/>\n </object>\n`;
  });
  let cfgInstances = '';
  slots.forEach((_s, i) => {
    cfgInstances += `  <model_instance>\n   <metadata key="object_id" value="${i + 10}"/>\n   <metadata key="instance_id" value="0"/>\n  </model_instance>\n`;
  });
  const modelConfig = `<?xml version="1.0" encoding="UTF-8"?>
<config>
${cfgObjects} <plate>
  <metadata key="plater_id" value="1"/>
  <metadata key="locked" value="false"/>
${cfgInstances} </plate>
</config>`;

  const zip = new JSZip();
  zip.file('[Content_Types].xml', contentTypes);
  zip.folder('_rels')!.file('.rels', rels);
  zip.folder('3D')!.file('3dmodel.model', model);
  zip.folder('Metadata')!.file('model_settings.config', modelConfig);
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

// ── SlotCard ──────────────────────────────────────────────────────────────────

function SlotCard({ slot, spools, onSwap }: { slot: Slot; spools: Spool[]; onSwap: () => void }) {
  const matched = spools.find(s => s.color.toLowerCase() === slot.hex.toLowerCase());
  return (
    <div className="rounded-xl border border-white/5 bg-card/30 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 rounded-full shrink-0 border border-white/10" style={{ background: slot.hex }} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground truncate">Slot {slot.slot} · {slot.colorName}</p>
          <p className="text-[10px] text-muted-foreground/60 truncate">{slot.bambuFilamentName}</p>
        </div>
        <button onClick={onSwap} title="Swap filament"
          className="shrink-0 text-muted-foreground/40 hover:text-primary transition-colors p-1 rounded">
          <Shuffle className="h-3.5 w-3.5" />
        </button>
      </div>
      {slot.roleNote && (
        <p className="text-[10px] text-muted-foreground/60 leading-relaxed">{slot.roleNote}</p>
      )}
      <div className="flex items-center gap-2 text-[10px]">
        <code className="bg-white/5 rounded px-1.5 py-0.5 font-mono">{slot.hex}</code>
        <span className="text-muted-foreground/40">L{slot.layerStart}–{slot.layerEnd}</span>
        {matched && (
          <span className={`flex items-center gap-0.5 ${matched.remaining < 100 ? 'text-yellow-400' : 'text-muted-foreground/40'}`}>
            {matched.remaining < 100 && <AlertTriangle className="h-2.5 w-2.5" />}
            {matched.remaining}g
          </span>
        )}
      </div>
    </div>
  );
}

// ── ForgeStudio ───────────────────────────────────────────────────────────────

export function ForgeStudio() {
  const { toast } = useToast();

  type Stage = 'setup' | 'loading' | 'preview';
  const [stage, setStage] = useState<Stage>('setup');
  const [imgData, setImgData] = useState<{ base64: string; type: string; name: string } | null>(null);
  const [settings, setSettings] = useState({ slots: '4', layerHeight: '0.10', printSize: '120mm', printStyle: 'auto' });
  const [stack, setStack] = useState<ForgeStack | null>(null);
  const [liveSlots, setLiveSlots] = useState<Slot[]>([]);
  const [previewTab, setPreviewTab] = useState<'2d' | '3d'>('2d');
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [swapIdx, setSwapIdx] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportedBlob, setExportedBlob] = useState<{ blob: Blob; filename: string } | null>(null);

  const canvas2dRef = useRef<HTMLCanvasElement>(null);
  const container3dRef = useRef<HTMLDivElement>(null);
  const renderToken = useRef(0);
  const threeCleanup = useRef<(() => void) | null>(null);

  // ── Spools ──────────────────────────────────────────────────────────────────
  const { data: spools = [] } = useQuery<Spool[]>({
    queryKey: ['forge-spools'],
    queryFn: async () => {
      const { data } = await supabase
        .from('ha3d_spools').select('*').gt('remaining', 50).order('remaining', { ascending: false });
      return (data ?? []) as Spool[];
    },
    staleTime: 60_000,
  });

  // ── Image upload ─────────────────────────────────────────────────────────────
  const onDrop = useCallback((accepted: File[]) => {
    const file = accepted[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      const result = e.target?.result as string;
      setImgData({ base64: result.split(',')[1], type: file.type || 'image/jpeg', name: file.name });
      setAnalyzeError(null);
    };
    reader.readAsDataURL(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'image/jpeg': [], 'image/png': [], 'image/webp': [] }, maxFiles: 1,
  });

  // ── Analyze ──────────────────────────────────────────────────────────────────
  async function handleAnalyze() {
    if (!imgData) return;
    setStage('loading');
    setAnalyzeError(null);
    setExportedBlob(null);
    try {
      const resp = await fetch('/api/forge/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: imgData.base64, imageType: imgData.type,
          slots: settings.slots, layerHeight: settings.layerHeight,
          printSize: settings.printSize, printStyle: settings.printStyle,
          availableSpools: spools.map(s => ({ id: s.id, name: s.name, color: s.color, material: s.material, brand: s.brand, remaining: s.remaining })),
        }),
      });
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      const st: ForgeStack = data.stack;
      setStack(st);
      setLiveSlots(st.slots ?? []);
      setStage('preview');
      setPreviewTab('2d');
    } catch (e) {
      setAnalyzeError(e instanceof Error ? e.message : 'Unknown error');
      setStage('setup');
    }
  }

  function resetForge() {
    renderToken.current++;
    if (threeCleanup.current) { threeCleanup.current(); threeCleanup.current = null; }
    setStage('setup');
    setStack(null);
    setLiveSlots([]);
    setExportedBlob(null);
    setSwapIdx(null);
  }

  // ── 2D Canvas preview ────────────────────────────────────────────────────────
  useEffect(() => {
    if (stage !== 'preview' || previewTab !== '2d' || !imgData || !liveSlots.length) return;
    const canvas = canvas2dRef.current;
    if (!canvas) return;
    renderToken.current++;
    const myToken = renderToken.current;
    const LABS = liveSlots.map(s => hexToLab(s.hex));
    const HEXES = liveSlots.map(s => s.hex);
    const img = new Image();
    img.onload = () => {
      if (myToken !== renderToken.current) return;
      const MAX = 500;
      const scale = Math.min(MAX / img.width, MAX / img.height, 1);
      const sw = Math.floor(img.width * scale), sh = Math.floor(img.height * scale);
      const off = document.createElement('canvas');
      off.width = sw; off.height = sh;
      const octx = off.getContext('2d')!;
      octx.filter = 'blur(1.5px)'; octx.drawImage(img, 0, 0, sw, sh); octx.filter = 'none';
      const src = octx.getImageData(0, 0, sw, sh).data;
      const out = new ImageData(sw, sh);
      canvas.width = sw; canvas.height = sh;
      const ctx = canvas.getContext('2d')!;
      let row = 0;
      function chunk() {
        if (myToken !== renderToken.current) return;
        const end = Math.min(row + 30, sh);
        for (let y = row; y < end; y++) {
          for (let x = 0; x < sw; x++) {
            const idx = (y * sw + x) * 4;
            const h = nearestHex(src[idx], src[idx+1], src[idx+2], LABS, HEXES);
            out.data[idx]   = parseInt(h.slice(1,3), 16);
            out.data[idx+1] = parseInt(h.slice(3,5), 16);
            out.data[idx+2] = parseInt(h.slice(5,7), 16);
            out.data[idx+3] = 255;
          }
        }
        row = end;
        ctx.putImageData(out, 0, 0);
        if (row < sh) requestAnimationFrame(chunk);
      }
      requestAnimationFrame(chunk);
    };
    img.src = `data:${imgData.type};base64,${imgData.base64}`;
  }, [stage, previewTab, liveSlots, imgData]);

  // ── 3D Three.js preview ──────────────────────────────────────────────────────
  useEffect(() => {
    if (stage !== 'preview' || previewTab !== '3d' || !liveSlots.length || !stack) return;
    const container = container3dRef.current;
    if (!container) return;
    if (threeCleanup.current) { threeCleanup.current(); threeCleanup.current = null; }

    const w = container.clientWidth || 480;
    const h = container.clientHeight || 480;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(w, h);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 2000);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dl = new THREE.DirectionalLight(0xffffff, 0.8);
    dl.position.set(1, 2, 3); scene.add(dl);

    const printMM = parseFloat((stack.recommendedPrintSize || '120mm').replace(/[^0-9.]/g, '')) || 120;
    const lh = parseFloat(stack.layerHeight || '0.10') || 0.10;
    // Slabs: X=printMM wide, Y=printMM tall, Z=slabThickness — stacked along Z
    let zCursor = 0;
    liveSlots.forEach(slot => {
      const layerCount = Math.max(1, (slot.layerEnd || 1) - (slot.layerStart || 0));
      const slabZ = layerCount * lh;
      const geo = new THREE.BoxGeometry(printMM, printMM, slabZ);
      const mat = new THREE.MeshLambertMaterial({ color: new THREE.Color(slot.hex || '#888') });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(0, 0, zCursor + slabZ / 2);
      scene.add(mesh);
      zCursor += slabZ;
    });

    // Camera at ~45° above-and-to-the-side looking at the centre of the stack
    const totalZ = zCursor;
    const camDist = Math.max(printMM * 1.5, 80);
    const midZ = totalZ / 2;
    camera.position.set(camDist, camDist, midZ + camDist);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.1;
    controls.target.set(0, 0, midZ); controls.update();

    let animId: number;
    function animate() { animId = requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); }
    animate();

    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix();
    });
    ro.observe(container);

    threeCleanup.current = () => {
      cancelAnimationFrame(animId); ro.disconnect(); renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
    return () => { if (threeCleanup.current) { threeCleanup.current(); threeCleanup.current = null; } };
  }, [stage, previewTab, liveSlots, stack]);

  // ── Swap ─────────────────────────────────────────────────────────────────────
  const swapSlot = swapIdx !== null ? liveSlots[swapIdx] : null;
  const sortedSpools = swapSlot
    ? [...spools].sort((a, b) => labDist(hexToLab(a.color), hexToLab(swapSlot.hex)) - labDist(hexToLab(b.color), hexToLab(swapSlot.hex)))
    : spools;

  function applySwap(spool: Spool) {
    if (swapIdx === null) return;
    setLiveSlots(prev => prev.map((s, i) =>
      i === swapIdx ? { ...s, hex: spool.color, colorName: spool.name, bambuFilamentName: `${spool.brand} ${spool.name}` } : s
    ));
    setSwapIdx(null);
    renderToken.current++;
  }

  // ── Export ────────────────────────────────────────────────────────────────────
  async function handleExport() {
    if (!stack || !liveSlots.length) return;
    setExporting(true);
    try {
      const printMM = parseFloat((stack.recommendedPrintSize || '120mm').replace(/[^0-9.]/g, '')) || 120;
      const lh = parseFloat(stack.layerHeight || '0.10') || 0.10;
      const blob = await build3MF(liveSlots, printMM, lh, imgData?.base64, imgData?.type);
      const safeName = (stack.imageSummary || 'forge').replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 40);
      const filename = `LayerDeck_Forge_${safeName}_${liveSlots.length}color.3mf`;
      setExportedBlob({ blob, filename });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 15000);

      // Background server upload
      (async () => {
        try {
          const reader = new FileReader();
          const b64: string = await new Promise((res, rej) => {
            reader.onload = e => res((e.target!.result as string).split(',')[1]);
            reader.onerror = rej; reader.readAsDataURL(blob);
          });
          await fetch('/api/forge/export', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileBase64: b64, filename: stack.imageSummary || 'forge_model',
              palette: liveSlots.map(s => ({ hex: s.hex, colorName: s.colorName, slot: s.slot })),
              layerInstructions: stack.layerInstructions ?? [],
              layerHeight: stack.layerHeight, printSize: stack.recommendedPrintSize, slotCount: liveSlots.length,
            }),
          });
        } catch { /* silent — local file already saved */ }
      })();

      toast({ title: '3MF Downloaded', description: 'Import into Bambu Studio and assign each object to an AMS slot.' });
    } catch (e) {
      toast({ title: 'Export Failed', description: e instanceof Error ? e.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  const SETTINGS_CONFIG = [
    { key: 'slots',       label: 'Color Slots',  tip: 'How many filament swaps. 4 is the sweet spot.',              opts: [['3','3'],['4','4'],['5','5'],['6','6']] },
    { key: 'layerHeight', label: 'Layer Height',  tip: 'Thinner = smoother blending. 0.10mm is best for most images.', opts: [['0.08','0.08mm'],['0.10','0.10mm'],['0.12','0.12mm'],['0.16','0.16mm']] },
    { key: 'printSize',   label: 'Print Size',    tip: 'The physical size of the final print in mm.',                opts: [['80mm','80mm'],['100mm','100mm'],['120mm','120mm'],['150mm','150mm'],['200mm','200mm']] },
    { key: 'printStyle',  label: 'Print Style',   tip: 'Helps the AI understand your image content.',               opts: [['auto','Auto-detect'],['portrait','Portrait'],['landscape','Landscape'],['logo','Logo']] },
  ] as const;

  return (
    <div className="relative">

      {/* ── SETUP ─────────────────────────────────────────────────────────── */}
      {stage === 'setup' && (
        <div className="max-w-2xl mx-auto space-y-4 py-4">

          {/* Upload zone */}
          <div {...getRootProps()} className={`rounded-2xl border-2 border-dashed p-10 text-center cursor-pointer transition-all
            ${isDragActive ? 'border-orange-400 bg-orange-400/5' : 'border-white/10 hover:border-white/20 hover:bg-white/5'}
            ${imgData ? 'border-orange-400/40' : ''}`}>
            <input {...getInputProps()} />
            {imgData ? (
              <div className="flex flex-col items-center gap-3">
                <img src={`data:${imgData.type};base64,${imgData.base64}`}
                  className="max-h-44 max-w-full rounded-xl object-contain" alt="Preview" />
                <p className="text-sm font-medium text-orange-400">{imgData.name}</p>
                <p className="text-xs text-muted-foreground/50">Drop another image to replace</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-muted-foreground/50">
                <Upload className="h-10 w-10" />
                <div>
                  <p className="text-sm font-medium text-foreground/70">Drop an image here or click to browse</p>
                  <p className="text-xs mt-1">JPG · PNG · WEBP</p>
                </div>
              </div>
            )}
          </div>

          {/* Settings */}
          <div className="rounded-xl border border-white/5 bg-card/30 p-4">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Settings</p>
            <div className="grid grid-cols-2 gap-3">
              {SETTINGS_CONFIG.map(({ key, label, tip, opts }) => (
                <div key={key}>
                  <label className="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wider mb-1 flex items-center gap-1">
                    {label}
                    <span className="cursor-help opacity-40 hover:opacity-80" title={tip}>?</span>
                  </label>
                  <select
                    value={settings[key]}
                    onChange={e => setSettings(s => ({ ...s, [key]: e.target.value }))}
                    className="w-full bg-background border border-white/10 rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-orange-400/50">
                    {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Spools */}
          {spools.length > 0 && (
            <div className="rounded-xl border border-white/5 bg-card/30 p-4">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                🧵 {spools.length} spools available
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                {spools.map(s => (
                  <div key={s.id} title={`${s.brand} ${s.name} · ${s.remaining}g`}
                    className="shrink-0 h-7 w-7 rounded-full border border-white/10 cursor-default hover:scale-110 transition-transform"
                    style={{ background: s.color }} />
                ))}
              </div>
            </div>
          )}

          {analyzeError && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 flex items-start gap-2 text-xs text-red-400">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /><span>{analyzeError}</span>
            </div>
          )}

          <Button size="lg" disabled={!imgData} onClick={handleAnalyze}
            className="w-full gap-2 bg-orange-500 hover:bg-orange-600 text-white font-bold tracking-wide">
            <Cpu className="h-4 w-4" /> Analyze with Forge
          </Button>
        </div>
      )}

      {/* ── LOADING ────────────────────────────────────────────────────────── */}
      {stage === 'loading' && (
        <div className="flex flex-col items-center justify-center py-28 gap-5">
          <div className="h-16 w-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
            <Loader2 className="h-8 w-8 text-orange-400 animate-spin" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold">Analyzing with AI…</p>
            <p className="text-xs text-muted-foreground/50 mt-1">Matching filament colors from your spool inventory</p>
          </div>
        </div>
      )}

      {/* ── PREVIEW ────────────────────────────────────────────────────────── */}
      {stage === 'preview' && stack && (
        <div className="space-y-4">

          {/* Summary pills + reset */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {[stack.imageSummary, stack.detectedStyle, `${liveSlots.length} slots`, `${stack.layerHeight}mm`, stack.recommendedPrintSize, `${stack.estimatedLayers} layers`].map((v, i) => (
                <span key={i} className="text-[10px] bg-white/5 border border-white/5 px-2 py-0.5 rounded-full text-muted-foreground/70">{v}</span>
              ))}
            </div>
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs shrink-0 text-muted-foreground" onClick={resetForge}>
              <X className="h-3.5 w-3.5" /> New Image
            </Button>
          </div>

          {/* 3-column layout */}
          <div className="grid gap-5" style={{ gridTemplateColumns: '260px 1fr 280px', minHeight: '560px' }}>

            {/* LEFT */}
            <div className="space-y-3 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 20rem)' }}>
              {/* Palette bar */}
              <div className="flex rounded-xl overflow-hidden h-8 cursor-pointer">
                {liveSlots.map((s, i) => (
                  <div key={s.slot} className="flex-1 hover:opacity-80 transition-opacity"
                    style={{ background: s.hex }} title={`Slot ${s.slot}: ${s.colorName}`}
                    onClick={() => setSwapIdx(i)} />
                ))}
              </div>

              {/* Quality */}
              <div className="rounded-xl border border-white/5 bg-card/30 p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Quality</span>
                  <span className="text-lg font-bold text-orange-400">{stack.qualityScore.score}/10</span>
                </div>
                <p className="text-xs font-medium">{stack.qualityScore.label}</p>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5 leading-relaxed">{stack.qualityScore.detail}</p>
              </div>

              {/* Tips */}
              {stack.forgeTips?.length > 0 && (
                <div className="rounded-xl border border-white/5 bg-card/30 p-3 space-y-1.5">
                  <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Forge Tips</p>
                  {stack.forgeTips.map((tip, i) => (
                    <p key={i} className="text-[10px] text-muted-foreground/60 leading-relaxed">
                      <span className="text-orange-400 mr-1">{i + 1}.</span>{tip}
                    </p>
                  ))}
                </div>
              )}

              {/* Source thumbnail */}
              {imgData && (
                <img src={`data:${imgData.type};base64,${imgData.base64}`}
                  className="w-full rounded-xl object-cover border border-white/5 max-h-48" alt="Source" />
              )}
            </div>

            {/* CENTER */}
            <div className="space-y-3">
              {/* Tab switcher */}
              <div className="flex gap-1 bg-white/5 rounded-lg p-1 w-fit">
                {(['2d', '3d'] as const).map(t => (
                  <button key={t} onClick={() => setPreviewTab(t)}
                    className={`px-5 py-1.5 rounded-md text-xs font-semibold transition-all
                      ${previewTab === t ? 'bg-orange-500 text-white' : 'text-muted-foreground hover:text-foreground'}`}>
                    {t === '2d' ? '2D Preview' : '3D View'}
                  </button>
                ))}
              </div>

              {/* Preview canvas */}
              <div className="rounded-2xl border border-white/5 bg-black/20 overflow-hidden flex items-center justify-center"
                style={{ aspectRatio: '1/1' }}>
                {previewTab === '2d'
                  ? <canvas ref={canvas2dRef} className="max-w-full max-h-full object-contain" style={{ imageRendering: 'pixelated' }} />
                  : <div ref={container3dRef} className="w-full h-full" />
                }
              </div>

              {previewTab === '3d' && (
                <p className="text-[10px] text-muted-foreground/40 text-center">Drag to rotate · Scroll to zoom</p>
              )}

              <p className="text-xs text-center text-muted-foreground/50">
                {stack.recommendedPrintSize.replace('mm', '')} × {stack.recommendedPrintSize.replace('mm', '')} × {stack.plateThickness}
              </p>
            </div>

            {/* RIGHT */}
            <div className="space-y-3 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 20rem)' }}>
              {liveSlots.map((slot, i) => (
                <SlotCard key={slot.slot} slot={slot} spools={spools} onSwap={() => setSwapIdx(i)} />
              ))}

              {/* Layer instructions */}
              <div className="rounded-xl border border-white/5 bg-card/30 p-3">
                <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Layers className="h-3 w-3" /> Layer Instructions
                </p>
                <div className="space-y-2">
                  {stack.layerInstructions?.map((li, i) => (
                    <div key={i} className="flex items-center gap-2 text-[10px]">
                      <div className="h-3.5 w-3.5 rounded-full shrink-0 border border-white/10" style={{ background: li.hex }} />
                      <span className="font-medium">AMS {li.amsSlot}</span>
                      <span className="text-muted-foreground/60 truncate flex-1">{li.spoolName}</span>
                      <span className="text-muted-foreground/40 shrink-0">L{li.layerStart}–{li.layerEnd}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground/40 mt-2 pt-2 border-t border-white/5">
                  {stack.estimatedLayers} layers · {stack.layerHeight}mm · ~{stack.plateThickness}
                </p>
              </div>

              {/* Export */}
              <Button size="lg" className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                onClick={handleExport} disabled={exporting}>
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {exporting ? 'Generating…' : 'Export 3MF'}
              </Button>

              {exportedBlob && (
                <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs border-white/10" onClick={() => {
                  const url = URL.createObjectURL(exportedBlob.blob);
                  const a = document.createElement('a');
                  a.href = url; a.download = exportedBlob.filename;
                  document.body.appendChild(a); a.click(); document.body.removeChild(a);
                  setTimeout(() => URL.revokeObjectURL(url), 5000);
                }}>
                  <Download className="h-3.5 w-3.5" /> Download Again
                </Button>
              )}

              <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground/50" onClick={resetForge}>
                ↩ Analyze Another Image
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── SWAP MODAL ───────────────────────────────────────────────────────── */}
      {swapIdx !== null && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-6"
          onClick={() => setSwapIdx(null)}>
          <div className="bg-background rounded-2xl border border-white/10 w-full max-w-sm max-h-[75vh] flex flex-col shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 shrink-0">
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 rounded-full border border-white/10" style={{ background: swapSlot?.hex }} />
                <p className="text-sm font-semibold">Swap Slot {swapSlot?.slot} — {swapSlot?.colorName}</p>
              </div>
              <button onClick={() => setSwapIdx(null)} className="text-muted-foreground/40 hover:text-foreground transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-2 space-y-0.5">
              {sortedSpools.map(spool => {
                const dist = swapSlot ? Math.round(labDist(hexToLab(spool.color), hexToLab(swapSlot.hex))) : 0;
                return (
                  <button key={spool.id} onClick={() => applySwap(spool)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 text-left transition-colors">
                    <div className="h-8 w-8 rounded-full shrink-0 border border-white/10" style={{ background: spool.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{spool.brand} {spool.name}</p>
                      <p className="text-[10px] text-muted-foreground/60">{spool.material} · {spool.remaining}g</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground/30 shrink-0 font-mono">Δ{dist}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
