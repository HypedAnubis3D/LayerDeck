import type { Print, PrintFilament, Spool } from '../types';
import { normalizeSpoolsForSave } from './spools';

// Mirrors studio-manager's savePrint()/editPrint() delta reconciliation
// (index.html ~10344-10380): only the DIFFERENCE between old and new
// grams-used is applied to each spool, so editing a print's filament list
// doesn't double-deduct. A brand-new print (oldFilaments=[], oldQty=0)
// naturally reduces to "deduct grams*qty" per spool.
export function applyFilamentDelta(
  spools: Spool[],
  oldFilaments: PrintFilament[],
  oldQty: number,
  newFilaments: PrintFilament[],
  newQty: number
): { spools: Spool[]; depleted: Spool[] } {
  const deltaBySpool = new Map<string, number>();

  for (const f of oldFilaments) {
    if (!f.spoolId) continue;
    deltaBySpool.set(f.spoolId, (deltaBySpool.get(f.spoolId) || 0) - f.grams * oldQty);
  }
  for (const f of newFilaments) {
    if (!f.spoolId) continue;
    deltaBySpool.set(f.spoolId, (deltaBySpool.get(f.spoolId) || 0) + f.grams * newQty);
  }

  let updated = spools;
  for (const [spoolId, delta] of deltaBySpool) {
    if (Math.abs(delta) < 0.01) continue;
    updated = updated.map((s) => (s.id === spoolId ? { ...s, remaining: s.remaining - delta } : s));
  }

  return normalizeSpoolsForSave(updated);
}

// Estimated filament (material) cost only — not electricity or a suggested
// sell price. Spool.cost is the price of the whole spool, so cost-per-gram
// is cost/total. Intentionally conservative: no wattage/electricity source
// is wired up yet, so we only show what we can actually compute correctly.
export function estimateFilamentCost(filaments: PrintFilament[], qty: number, spools: Spool[]): number {
  let total = 0;
  for (const f of filaments) {
    const spool = spools.find((s) => s.id === f.spoolId);
    if (!spool || !spool.total) continue;
    const costPerGram = spool.cost / spool.total;
    total += costPerGram * f.grams * qty;
  }
  return Math.round(total * 100) / 100;
}

export function printStatusLabel(p: Print): string {
  return p.status || 'done';
}
