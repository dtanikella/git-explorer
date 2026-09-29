/**
 * Selection statistics — computes edge-leaving histograms for areas.
 *
 * @remarks
 * For each area that contains a selected node, counts every edge that
 * originates from a member node (including descendant members, selected or
 * not) and terminates at a node outside the area, so the figure describes the
 * area rather than the selection. Results are sorted by leaving count
 * descending, then by name.
 */

import type { AnalysisEdge } from '@/lib/analysis/types';
import type { Area } from '@/lib/areas/types';
import { getDescendantIds } from '@/lib/areas/containment';

export interface AreaEdgeStat {
  areaId: string;
  areaName: string;
  /** Edges from any member of the area to a node outside it. */
  leavingCount: number;
  /** Members of the area (including descendants) that are currently selected. */
  selectedCount: number;
}

/**
 * Maps each area id to the ids of all its member nodes, including the
 * members of its descendant areas.
 *
 * @param areas - All area definitions.
 * @returns A map from area id to its rolled-up member node ids.
 */
export function getAreaMemberIds(areas: Area[]): Map<string, Set<string>> {
  const areasById = new Map(areas.map((a) => [a.id, a]));
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
  return areaMemberIds;
}

/**
 * Computes edge-leaving statistics for each area that contains at
 * least one selected node.
 *
 * @param selectedNodeIds - The set of currently selected node symbols.
 * @param edges - All analysis edges.
 * @param areas - All area definitions.
 * @returns Array of {@link AreaEdgeStat} sorted by leavingCount descending, then name.
 */
export function computeAreaEdgeStats(
  selectedNodeIds: Set<string>,
  edges: AnalysisEdge[],
  areas: Area[],
): AreaEdgeStat[] {
  if (selectedNodeIds.size === 0) return [];

  const areasById = new Map(areas.map((a) => [a.id, a]));
  const areaMemberIds = getAreaMemberIds(areas);

  const stats = new Map<string, AreaEdgeStat>();
  for (const [areaId, members] of areaMemberIds) {
    let selectedCount = 0;
    for (const id of selectedNodeIds) {
      if (members.has(id)) selectedCount++;
    }
    if (selectedCount === 0) continue;
    stats.set(areaId, {
      areaId,
      areaName: areasById.get(areaId)?.name ?? areaId,
      leavingCount: 0,
      selectedCount,
    });
  }

  if (stats.size === 0) return [];

  for (const edge of edges) {
    for (const [areaId, stat] of stats) {
      const members = areaMemberIds.get(areaId)!;
      // Edge leaves this area if it starts inside and the target is NOT a member
      if (members.has(edge.fromSymbol) && !members.has(edge.toSymbol)) {
        stat.leavingCount++;
      }
    }
  }

  return [...stats.values()].sort(
    (a, b) => b.leavingCount - a.leavingCount || a.areaName.localeCompare(b.areaName),
  );
}
