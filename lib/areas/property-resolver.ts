import type { Area } from './types';

export interface AreaInfluence {
  dimmed: boolean;
}

export function resolveAreaInfluence(
  nodeId: string,
  visibleAreas: Area[],
  nodeToAreas: Map<string, Area[]>,
): AreaInfluence | null {
  if (visibleAreas.length === 0) return null;

  const nodeAreas = nodeToAreas.get(nodeId);
  if (!nodeAreas || nodeAreas.length === 0) {
    return { dimmed: true };
  }

  const visibleAreaIds = new Set(visibleAreas.map((a) => a.id));
  const belongsToVisible = nodeAreas.some((a) => visibleAreaIds.has(a.id));

  return belongsToVisible ? null : { dimmed: true };
}
