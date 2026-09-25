/**
 * Selection statistics — computes edge-leaving histograms for areas.
 *
 * @remarks
 * For each area in scope, counts edges that originate from a member
 * node (including descendant members) and terminate at a node outside
 * the area. Results are sorted by leaving count descending.
 */

import type { AnalysisEdge } from '@/lib/analysis/types';
import type { Area } from '@/lib/areas/types';
import { getDescendantIds } from '@/lib/areas/containment';

export interface AreaEdgeStat {
  areaId: string;
  areaName: string;
  leavingCount: number;
}

/**
 * Computes edge-leaving statistics for each area that contains at
 * least one selected node.
 *
 * @param selectedNodeIds - The set of currently selected node symbols.
 * @param edges - All analysis edges.
 * @param areas - All area definitions.
 * @returns Array of {@link AreaEdgeStat} sorted by leavingCount descending.
 */
export function computeAreaEdgeStats(
  selectedNodeIds: Set<string>,
  edges: AnalysisEdge[],
  areas: Area[],
): AreaEdgeStat[] {
  if (selectedNodeIds.size === 0) return [];

  const areasById = new Map(areas.map((a) => [a.id, a]));

  // Build a map from area id to all member node ids (including descendants)
  const areaMemberIds = new Map<string, Set<string>>();
  for (const area of areas) {
    const ids = new Set(area.contains);
    for (const descId of getDescendantIds(areas, area.id)) {
      const desc = areasById.get(descId);
      if (desc) {
        for (const nid of desc.contains) ids.add(nid);
      }
    }
    areaMemberIds.set(area.id, ids);
  }

  // Determine which areas contain at least one selected node
  const relevantAreaIds = new Set<string>();
  for (const area of areas) {
    const members = areaMemberIds.get(area.id);
    if (!members) continue;
    for (const id of selectedNodeIds) {
      if (members.has(id)) {
        relevantAreaIds.add(area.id);
        break;
      }
    }
  }

  if (relevantAreaIds.size === 0) return [];

  const stats = new Map<string, number>();
  for (const areaId of relevantAreaIds) {
    stats.set(areaId, 0);
  }

  for (const edge of edges) {
    const fromNodeId = edge.fromSymbol;
    const toNodeId = edge.toSymbol;
    if (!selectedNodeIds.has(fromNodeId)) continue;

    for (const areaId of relevantAreaIds) {
      const members = areaMemberIds.get(areaId);
      if (!members || !members.has(fromNodeId)) continue;
      // Edge leaves this area if the target is NOT a member
      if (!members.has(toNodeId)) {
        stats.set(areaId, (stats.get(areaId) ?? 0) + 1);
      }
    }
  }

  return [...stats.entries()]
    .map(([areaId, leavingCount]) => ({
      areaId,
      areaName: areasById.get(areaId)?.name ?? areaId,
      leavingCount,
    }))
    .sort((a, b) => b.leavingCount - a.leavingCount);
}