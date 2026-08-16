import type { PrintGroup } from '../types';

export function findGroupForPrint(groups: PrintGroup[], printId: string): PrintGroup | undefined {
  return groups.find((g) => g.printIds.includes(printId));
}

// A print belongs to at most one group at a time — assigning to a new group
// removes it from whichever group currently holds it first. Pass groupId=null
// to just remove the print from any group ("none").
export function assignPrintToGroup(
  groups: PrintGroup[],
  printId: string,
  groupId: string | null
): PrintGroup[] {
  const cleared = groups.map((g) => ({ ...g, printIds: g.printIds.filter((id) => id !== printId) }));
  if (!groupId) return cleared;
  return cleared.map((g) => (g.id === groupId ? { ...g, printIds: [...g.printIds, printId] } : g));
}
