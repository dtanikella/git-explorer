import type { Area } from './types';

export function buildNodeToAreas(areas: Area[]): Map<string, Area[]> {
  const map = new Map<string, Area[]>();
  for (const area of areas) {
    for (const symbol of area.contains) {
      const existing = map.get(symbol);
      if (existing) {
        existing.push(area);
      } else {
        map.set(symbol, [area]);
      }
    }
  }
  return map;
}

export function buildAreaToNodes(areas: Area[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const area of areas) {
    map.set(area.id, new Set(area.contains));
  }
  return map;
}
