import type { Area } from './types';

/**
 * Builds a map from node symbol to the areas that contain it.
 *
 * @remarks
 * Each area's `contains` array is flattened into the map; a node belonging
 * to multiple areas will have an entry with all containing areas. Used by
 * area force functions and the UI to determine area membership.
 *
 * @param areas - All areas; each area's `contains` field lists member symbols.
 * @returns A map from node symbol to array of areas.
 * @see commit cc7fc9d
 */
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

/**
 * Builds a map from area ID to the set of node symbols it contains.
 *
 * @remarks
 * The inverse of {@link buildNodeToAreas}. Used to quickly query which
 * symbols belong to a given area without scanning all areas.
 *
 * @param areas - All areas whose containment sets to index.
 * @returns A map from area ID to a `Set` of contained symbols.
 * @see commit cc7fc9d
 */
export function buildAreaToNodes(areas: Area[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const area of areas) {
    map.set(area.id, new Set(area.contains));
  }
  return map;
}
