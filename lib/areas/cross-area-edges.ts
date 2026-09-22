import type { Area } from './types';

export function areaPairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function buildCrossAreaEdgeWeights(
  edges: Array<[string, string]>,
  nodeToAreas: Map<string, Area[]>,
): Map<string, number> {
  const weights = new Map<string, number>();

  for (const [source, target] of edges) {
    const sourceAreas = nodeToAreas.get(source) ?? [];
    const targetAreas = nodeToAreas.get(target) ?? [];

    for (const sourceArea of sourceAreas) {
      for (const targetArea of targetAreas) {
        if (sourceArea.id === targetArea.id) continue;
        const key = areaPairKey(sourceArea.id, targetArea.id);
        weights.set(key, (weights.get(key) ?? 0) + 1);
      }
    }
  }

  return weights;
}

/**
 * Per-node view of cross-area interaction: for each node, the areas it has an
 * edge into/from that it is *not* itself a member of, weighted by edge count.
 * Feeds `createCrossAreaPullForce` — unlike `buildCrossAreaEdgeWeights` (which
 * aggregates to one weight per area pair), this keeps the result attributable
 * to the specific node doing the interacting.
 */
export function buildNodeCrossAreaTargets(
  edges: Array<[string, string]>,
  nodeToAreas: Map<string, Area[]>,
): Map<string, Map<string, number>> {
  const result = new Map<string, Map<string, number>>();

  const addWeights = (nodeId: string, ownAreaIds: Set<string>, otherAreas: Area[]) => {
    for (const area of otherAreas) {
      if (ownAreaIds.has(area.id)) continue;
      let byArea = result.get(nodeId);
      if (!byArea) {
        byArea = new Map();
        result.set(nodeId, byArea);
      }
      byArea.set(area.id, (byArea.get(area.id) ?? 0) + 1);
    }
  };

  for (const [source, target] of edges) {
    const sourceAreas = nodeToAreas.get(source) ?? [];
    const targetAreas = nodeToAreas.get(target) ?? [];
    const sourceAreaIds = new Set(sourceAreas.map((a) => a.id));
    const targetAreaIds = new Set(targetAreas.map((a) => a.id));

    addWeights(source, sourceAreaIds, targetAreas);
    addWeights(target, targetAreaIds, sourceAreas);
  }

  return result;
}
