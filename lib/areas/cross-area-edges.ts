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
