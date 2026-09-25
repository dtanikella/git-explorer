import type { Area } from './types';

export interface AreaInfluence {
  dimmed: boolean;
}

/**
 * Determines whether a node should be visually dimmed based on area visibility.
 *
 * @remarks
 * A node is dimmed when it belongs to no area (and visible areas exist) or
 * when none of its containing areas are currently visible. Returns null for
 * nodes that belong to at least one visible area (no dimming).
 *
 * @param nodeId - The node identifier to check.
 * @param visibleAreas - The currently visible areas.
 * @param nodeToAreas - Maps node ID to its containing areas (built by
 *   {@link buildNodeToAreas}).
 * @returns An {@link AreaInfluence} with `dimmed: true`, or null when the
 *   node should not be dimmed.
 * @see commit 36dc2f3
 */
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
