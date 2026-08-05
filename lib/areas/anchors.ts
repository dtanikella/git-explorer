import type { SimulationNodeDatum } from 'd3';
import type { Area } from './types';

export interface AreaAnchorNode extends SimulationNodeDatum {
  kind: 'anchor';
  id: string;
  areaId: string;
}

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
