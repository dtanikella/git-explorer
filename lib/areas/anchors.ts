import type { SimulationNodeDatum } from 'd3';
import type { Area } from './types';

export interface AreaAnchorNode extends SimulationNodeDatum {
  kind: 'anchor';
  id: string;
  areaId: string;
}

/**
 * Builds or reuses area anchor nodes for the D3 simulation.
 *
 * @remarks
 * Each area gets one anchor node (marked as `kind: 'anchor'`). Reuses
 * existing positions from `previous` so that anchors maintain continuity
 * across simulation re-initializations (e.g., when areas change).
 *
 * @param areas - All areas to create anchors for.
 * @param previous - Map of previous anchors by area ID; positions are reused
 *   when an area already had an anchor.
 * @returns An array of {@link AreaAnchorNode}s, one per area.
 * @see commit 6430295
 */
export function buildAreaAnchors(
  areas: Area[],
  previous: Map<string, AreaAnchorNode>,
): AreaAnchorNode[] {
  return areas.map((area) => {
    const existing = previous.get(area.id);
    if (existing) return existing;
    return { kind: 'anchor', id: `area-anchor:${area.id}`, areaId: area.id };
  });
}
