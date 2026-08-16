import type { Print, PrintFilament, QueueItem, Spool, UsageHistEntry } from '../types';
import { normalizeSpoolsForSave } from './spools';
import { uid } from './userData';

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

// Same deltaBySpool math as applyFilamentDelta, but returns usageHist log
// entries instead of mutating spools — mirrors the positive-amount logging
// at the print create/edit sites (index.html:7453/7463/10367/10378).
// Only positive deltas (net additional grams used) are logged, matching
// the web app's `if(delta>0)` guard.
export function buildUsageHistForDelta(
  printName: string,
  spools: Spool[],
  oldFilaments: PrintFilament[],
  oldQty: number,
  newFilaments: PrintFilament[],
  newQty: number
): UsageHistEntry[] {
  const deltaBySpool = new Map<string, number>();
  for (const f of oldFilaments) {
    if (!f.spoolId) continue;
    deltaBySpool.set(f.spoolId, (deltaBySpool.get(f.spoolId) || 0) - f.grams * oldQty);
  }
  for (const f of newFilaments) {
    if (!f.spoolId) continue;
    deltaBySpool.set(f.spoolId, (deltaBySpool.get(f.spoolId) || 0) + f.grams * newQty);
  }

  const entries: UsageHistEntry[] = [];
  for (const [spoolId, delta] of deltaBySpool) {
    if (delta <= 0) continue;
    const spool = spools.find((s) => s.id === spoolId);
    entries.push({
      id: uid(),
      spoolId,
      spoolName: spool?.name ?? 'Unknown',
      material: spool?.material ?? '',
      amount: Math.round(delta * 10) / 10,
      job: printName,
      notes: '',
      timestamp: Date.now(),
    });
  }
  return entries;
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

// Matches studio-manager's confirmFinish() queue-advance logic exactly
// (index.html:7574-7583): printId/linkedPrintId first, falling back to a
// name+stage match for records that never got an explicit link.
export function matchLinkedQueueItem(queueItems: QueueItem[], print: Print): QueueItem | undefined {
  return queueItems.find(
    (q) =>
      q.printId === print.id ||
      q.linkedPrintId === print.id ||
      q.id === print.fromQueueItemId ||
      (q.name === print.name && (q.stage === 'inprogress' || q.stage === 'queued'))
  );
}

export interface FinishOutcome {
  print: Print;
  spools?: Spool[]; // present only when the 'failed' path issued a refund
  queueItems?: QueueItem[]; // present only when a linked queue item was found
  usageHistEntries: UsageHistEntry[];
}

// Mirrors confirmFinish() (index.html:7542-7588) for both outcomes:
// - 'done': just stamps status/finishedAt, no spool math.
// - 'failed': prorates each filament's expected grams by failPct, refunds
//   the difference back to the spool (capped at the spool's total capacity
//   so a refund can never overfill it), and logs a negative usageHist
//   entry per spool. Both outcomes advance the linked queue item to
//   stage:'done' with an `outcome` field recording which one happened.
export function computeFinish(
  print: Print,
  outcome: 'done' | 'failed',
  opts: { failPct?: number; failNote?: string; spools: Spool[]; queueItems: QueueItem[] }
): FinishOutcome {
  const finishedAt = Date.now();
  const usageHistEntries: UsageHistEntry[] = [];
  let updatedPrint: Print;
  let updatedSpools: Spool[] | undefined;

  if (outcome === 'failed') {
    const pv = Math.min(100, Math.max(0, opts.failPct ?? 0));
    const ratio = pv / 100;
    let spools = opts.spools;

    const updatedFilaments = (print.filaments || []).map((f) => {
      const expected = f.grams * (print.qty || 1);
      const actual = Math.round(expected * ratio * 10) / 10;
      const refund = Math.round((expected - actual) * 10) / 10;

      if (refund > 0 && f.spoolId) {
        const spool = spools.find((s) => s.id === f.spoolId);
        spools = spools.map((s) =>
          s.id === f.spoolId ? { ...s, remaining: Math.min(s.total, s.remaining + refund) } : s
        );
        usageHistEntries.push({
          id: uid(),
          spoolId: f.spoolId,
          spoolName: spool?.name ?? 'Unknown',
          material: spool?.material ?? '',
          amount: -refund,
          job: `[REFUND] ${print.name}`,
          notes: `Failed at ${pv.toFixed(0)}%`,
          timestamp: finishedAt,
        });
      }
      return { ...f, actualGrams: actual };
    });

    updatedSpools = normalizeSpoolsForSave(spools).spools;
    updatedPrint = {
      ...print,
      status: 'failed',
      failPct: pv,
      failNote: opts.failNote || '',
      filaments: updatedFilaments,
      finishedAt,
    };
  } else {
    updatedPrint = { ...print, status: 'done', finishedAt };
  }

  const linkedQueueItem = matchLinkedQueueItem(opts.queueItems, print);
  const updatedQueueItems = linkedQueueItem
    ? opts.queueItems.map((q) =>
        q.id === linkedQueueItem.id ? { ...q, stage: 'done' as const, finishedAt, outcome } : q
      )
    : undefined;

  return { print: updatedPrint, spools: updatedSpools, queueItems: updatedQueueItems, usageHistEntries };
}
