import type { Print } from '../types';

export interface FailRateRow {
  name: string;
  category: string;
  total: number;
  done: number;
  failed: number;
  failPcts: number[];
  failRate: number; // 0-100
  avgCancelPct: number | null;
}

export type FailRateSort = 'failRate' | 'count' | 'name';

const HIGH_FAIL_THRESHOLD = 25;
const LOW_FAIL_THRESHOLD = 10;

export function failRateColor(rate: number): string {
  if (rate > HIGH_FAIL_THRESHOLD) return '#ef4444';
  if (rate > LOW_FAIL_THRESHOLD) return '#f59e0b';
  return '#22c55e';
}

export function isHighFailRate(rate: number): boolean {
  return rate > HIGH_FAIL_THRESHOLD;
}

export function buildFailRateRows(prints: Print[]): FailRateRow[] {
  const byName = new Map<string, FailRateRow>();

  for (const p of prints) {
    if (!p.status) continue; // no status recorded yet — nothing to aggregate
    const key = p.name || 'Untitled';
    let row = byName.get(key);
    if (!row) {
      row = { name: key, category: p.category || '', total: 0, done: 0, failed: 0, failPcts: [], failRate: 0, avgCancelPct: null };
      byName.set(key, row);
    }
    const qty = p.qty || 1;
    row.total += qty;
    if (p.status === 'done') row.done += qty;
    if (p.status === 'failed') {
      row.failed += qty;
      if (p.failPct != null) row.failPcts.push(p.failPct);
    }
  }

  return Array.from(byName.values()).map((row) => ({
    ...row,
    failRate: row.total ? Math.round((row.failed / row.total) * 1000) / 10 : 0,
    avgCancelPct: row.failPcts.length
      ? Math.round((row.failPcts.reduce((a, b) => a + b, 0) / row.failPcts.length) * 10) / 10
      : null,
  }));
}

export function sortFailRateRows(rows: FailRateRow[], sort: FailRateSort): FailRateRow[] {
  const copy = [...rows];
  if (sort === 'failRate') return copy.sort((a, b) => b.failRate - a.failRate);
  if (sort === 'count') return copy.sort((a, b) => b.total - a.total);
  return copy.sort((a, b) => a.name.localeCompare(b.name));
}
