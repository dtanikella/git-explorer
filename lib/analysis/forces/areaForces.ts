import type { AreaAnchorNode } from '@/lib/areas/anchors';
import type { Area } from '@/lib/areas/types';
import type { ForceNode } from '@/lib/areas/forces';
import { createAreaAttractForce, createAnchorRepelForce } from '@/lib/areas/forces';

/**
 * v2 anchor-repel strength (report §1.6): scaling repulsion off layout geometry
 * instead of a fixed constant. `anchorRepel ∝ canvasArea / numCommunities`
 * (Eades / Fruchterman–Reingold equilibrium-spacing), so inter-anchor spacing
 * stays self-consistent as the repo — and its community count — grows.
 *
 * `canvasArea` is canvas width × height (in simulation units); 0 communities is
 * a degenerate guard returning 0 (no anchors to repel anyway).
 */
export function computeAnchorRepel(canvasArea: number, numCommunities: number): number {
  if (numCommunities <= 0) return 0;
  return canvasArea / numCommunities;
}

/**
 * v2 anchor-repel force: identical inverse-square loop to the legacy force,
 * with the strength derived from layout geometry instead of a constant.
 */
export function createComputedAnchorRepelForce(
  anchors: AreaAnchorNode[],
  canvasArea: number,
  numCommunities: number,
): (alpha: number) => void {
  const strength = computeAnchorRepel(canvasArea, numCommunities);
  return createAnchorRepelForce(anchors, strength);
}

/**
 * v2 cluster-pull force (report §1.4): the same weighted-centroid pull as the
 * legacy `createClusterPullForce`, but the per-area weight is the node's
 * computed **embeddedness** (`internalDegree/totalDegree` from
 * `metrics.computeEmbeddedness`) instead of the hand-authored
 * `Area.clusterStrength`.
 *
 * A node whose calls are almost entirely within its community gets pulled hard
 * toward its anchors; a bridge node (mostly called from elsewhere) is pulled
 * weakly, letting it drift toward the visual center between the areas it
 * actually connects.
 *
 * Deviation from the report's literal formula (documented): the report §1.4
 * weighted-centroid form divides the embeddedness weight back out, which — with
 * one community per node and thus one embeddedness value per node — cancels the
 * signal entirely for single-area nodes. To deliver the report's stated intent
 * (bridges drift, glued nodes cling) the final pull is scaled by the node's
 * embeddedness instead; the weighted centroid over multiple areas is retained.
 */
export function createEmbeddednessClusterPullForce(
  nodes: ForceNode[],
  nodeToAreas: Map<string, Area[]>,
  anchorsById: Map<string, AreaAnchorNode>,
  embeddedness: Map<string, number>,
  strength: number,
): (alpha: number) => void {
  return (alpha: number) => {
    for (const node of nodes) {
      if (node.x == null || node.y == null) continue;
      const areas = nodeToAreas.get(node.id);
      if (!areas || areas.length === 0) continue;

      const embedding = embeddedness.get(node.id) ?? 0;
      if (embedding <= 0) continue; // bridge/isolated node: no cluster pull

      let totalWeight = 0;
      let targetX = 0;
      let targetY = 0;
      for (const area of areas) {
        const anchor = anchorsById.get(area.id);
        if (!anchor || anchor.x == null || anchor.y == null) continue;
        totalWeight += 1;
        targetX += anchor.x;
        targetY += anchor.y;
      }
      if (totalWeight <= 0) continue;
      targetX /= totalWeight;
      targetY /= totalWeight;

      node.vx = (node.vx ?? 0) + (targetX - node.x) * embedding * strength * alpha;
      node.vy = (node.vy ?? 0) + (targetY - node.y) * embedding * strength * alpha;
    }
  };
}

/**
 * v2 area-attract force: the legacy formula operating on the **null-model
 * normalized** cross-community weights from `metrics.computeCrossCommunityWeight`
 * (report §1.5) instead of the raw cross-area edge counts. The force loop itself
 * is unchanged — the data feeding it is what the math replaced.
 */
export const createNullModelAreaAttractForce = createAreaAttractForce;

/**
 * v2 parent-pull force (report §1.3): child anchors pulled toward their parent
 * anchor, where the parent links come from the resolution-sweep hierarchy
 * (`parentOf: communityId → communityId | null`) rather than the hand-authored
 * `Area.parent` field.
 */
export function createHierarchyParentPullForce(
  anchors: AreaAnchorNode[],
  parentOf: Map<string, string | null>,
  strength: number,
): (alpha: number) => void {
  const anchorsByAreaId = new Map(anchors.map((a) => [a.areaId, a]));

  return (alpha: number) => {
    for (const anchor of anchors) {
      const parentId = parentOf.get(anchor.areaId);
      if (parentId == null) continue;
      const parentAnchor = anchorsByAreaId.get(parentId);
      if (!parentAnchor) continue;
      if (anchor.x == null || anchor.y == null || parentAnchor.x == null || parentAnchor.y == null) continue;

      const dx = parentAnchor.x - anchor.x;
      const dy = parentAnchor.y - anchor.y;
      anchor.vx = (anchor.vx ?? 0) + dx * strength * alpha;
      anchor.vy = (anchor.vy ?? 0) + dy * strength * alpha;
    }
  };
}