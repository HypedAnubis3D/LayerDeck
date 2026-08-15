import type { Spool } from '../types';

export type SpoolStatus = 'critical' | 'low' | 'ok' | 'full';

export const SPOOL_THRESH_CRIT = 10;
export const SPOOL_THRESH_LOW = 30;
export const SPOOL_THRESH_OK = 80;

export interface SpoolGroup {
  key: string;
  name: string;
  material: string;
  color: string;
  spools: Spool[];
  totalRemaining: number;
  totalCapacity: number;
  pct: number;
  status: SpoolStatus;
}

// Matches studio-manager's getGroupKey(): grouped by name + material, not
// individual spool and not raw hex color (name is the display label, e.g. "Black").
export function getGroupKey(s: Spool): string {
  return `${s.name || ''}|${s.material || ''}`.toLowerCase();
}

export function groupPct(totalRemaining: number, totalCapacity: number): number {
  return totalCapacity ? Math.round((totalRemaining / totalCapacity) * 100) : 0;
}

export function statusForPct(pct: number): SpoolStatus {
  if (pct < SPOOL_THRESH_CRIT) return 'critical';
  if (pct < SPOOL_THRESH_LOW) return 'low';
  if (pct < SPOOL_THRESH_OK) return 'ok';
  return 'full';
}

export function groupSpools(spools: Spool[]): SpoolGroup[] {
  const map = new Map<string, Spool[]>();
  for (const s of spools) {
    const key = getGroupKey(s);
    const list = map.get(key);
    if (list) list.push(s);
    else map.set(key, [s]);
  }

  const groups: SpoolGroup[] = [];
  for (const [key, list] of map) {
    const totalRemaining = list.reduce((a, s) => a + (s.remaining || 0), 0);
    const totalCapacity = list.reduce((a, s) => a + (s.total || 0), 0);
    const pct = groupPct(totalRemaining, totalCapacity);
    groups.push({
      key,
      name: list[0].name,
      material: list[0].material,
      color: list[0].color,
      spools: list,
      totalRemaining,
      totalCapacity,
      pct,
      status: statusForPct(pct),
    });
  }
  return groups;
}

export function pctForSpool(s: Spool): number {
  return s.total ? Math.round((s.remaining / s.total) * 100) : 0;
}

/**
 * Rounds remaining/total to 2 decimals (guards against float drift from
 * repeated subtraction, e.g. 51.08000000000019) and drops any spool whose
 * remaining rounds to <= 0.05g (treated as depleted). Call this on every
 * write-back of the spools collection — mirrors studio-manager's saveSpools().
 */
export function normalizeSpoolsForSave(spools: Spool[]): {
  spools: Spool[];
  depleted: Spool[];
} {
  const rounded = spools.map((s) => ({
    ...s,
    remaining: Math.round((s.remaining ?? 0) * 100) / 100,
    total: Math.round((s.total ?? 0) * 100) / 100,
  }));

  const depleted = rounded.filter((s) => (s.remaining || 0) <= 0.05);
  const kept = rounded.filter((s) => (s.remaining || 0) > 0.05);

  return { spools: kept, depleted };
}
