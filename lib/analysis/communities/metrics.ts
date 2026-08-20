import type { CommunityGraph } from './graph';
import { edgeWeight } from './graph';
import type { CommunityMap } from './detect';

/**
 * Pair separator used for the cross-community weight map keys. Mirrors
 * `lib/areas/cross-area-edges.ts`'s `areaPairKey` ('|') convention.
 */
export const COMMUNITY_PAIR_SEPARATOR = '|';

/** Canonical community-pair key: the two community ids in sorted order. */
export function communityPairKey(a: string, b: string): string {
  return a < b ? `${a}${COMMUNITY_PAIR_SEPARATOR}${b}` : `${b}${COMMUNITY_PAIR_SEPARATOR}${a}`;
}

/** Weighted degree of a node: the sum of its incident undirected edge weights. */
function weightedDegree(graph: CommunityGraph, node: string): number {
  let degree = 0;
  for (const neighbor of graph.neighbors(node)) {
    degree += edgeWeight(graph, node, neighbor);
  }
  return degree;
}

/** Map every node to its weighted degree. */
function weightedDegrees(graph: CommunityGraph): Map<string, number> {
  const degrees = new Map<string, number>();
  for (const node of graph.nodes() as Iterable<string>) {
    degrees.set(node, weightedDegree(graph, node));
  }
  return degrees;
}

/**
 * Per-node embeddedness (report §1.4): `internalDegree(i) / totalDegree(i)`,
 * where `internalDegree` counts only edges to neighbors in the same community.
 *
 * Convention for degree-0 nodes: embeddedness is **0** (not NaN/±Infinity).
 * A node with no edges has no internal structure to pull toward its community,
 * so it contributes no cluster-pull weight — 0 is the least-surprising, safe
 * value and avoids a divide-by-zero. (Judgment call, documented here.)
 */
export function computeEmbeddedness(
  graph: CommunityGraph,
  communityOf: CommunityMap,
): Map<string, number> {
  const degrees = weightedDegrees(graph);
  const embeddedness = new Map<string, number>();

  for (const [node, totalDegree] of degrees) {
    if (totalDegree <= 0) {
      embeddedness.set(node, 0);
      continue;
    }

    const community = communityOf.get(node);
    let internalDegree = 0;
    for (const neighbor of graph.neighbors(node)) {
      if (communityOf.get(neighbor) === community) {
        internalDegree += edgeWeight(graph, node, neighbor);
      }
    }
    embeddedness.set(node, internalDegree / totalDegree);
  }

  return embeddedness;
}

export interface CrossCommunityWeightOptions {
  /** Null-model resolution parameter γ (default 1.0). */
  gamma?: number;
}

/**
 * Null-model-normalized cross-community coupling weight (report §1.5):
 *
 *   weight(c1,c2) = Σ [ A_ij − γ·k_i·k_j/(2m) ]  over edges (i∈c1, j∈c2)
 *
 * where A_ij is the undirected edge weight, k_i is node i's weighted degree,
 * and m is the graph's total (half-)edge weight, i.e. 2m = total edge weight.
 * Positive ⇒ the two communities are coupled more than their sizes predict.
 * Returns a map keyed by canonical sorted community-pair, so the result is
 * symmetric: weight(c1,c2) === weight(c2,c1).
 */
export function computeCrossCommunityWeight(
  graph: CommunityGraph,
  communityOf: CommunityMap,
  options?: CrossCommunityWeightOptions,
): Map<string, number> {
  const gamma = options?.gamma ?? 1.0;
  const degrees = weightedDegrees(graph);

  // 2m where m = total (half-)edge weight of the undirected graph: each edge is
  // counted once in the sum, and 2m is twice that total (report §1.5 / modularity
  // null model).
  let totalEdgeWeight = 0;
  for (const edge of graph.edges() as Iterable<string>) {
    totalEdgeWeight += graph.getEdgeAttribute(edge, 'weight') ?? 1;
  }
  const twoM = 2 * Math.max(totalEdgeWeight, 1);

  const weights = new Map<string, number>();
  for (const edge of graph.edges() as Iterable<string>) {
    const source = graph.source(edge);
    const target = graph.target(edge);
    const ci = communityOf.get(source);
    const cj = communityOf.get(target);
    if (ci == null || cj == null || ci === cj) continue;

    const aij = graph.getEdgeAttribute(edge, 'weight') ?? 1;
    const contribution = aij - (gamma * (degrees.get(source) ?? 0) * (degrees.get(target) ?? 0)) / twoM;

    const key = communityPairKey(ci, cj);
    weights.set(key, (weights.get(key) ?? 0) + contribution);
  }

  return weights;
}

/**
 * The cross-community coupling weight for one specific unordered pair of
 * communities, via the full map's canonical key (symmetric by construction).
 */
export function crossCommunityWeight(
  graph: CommunityGraph,
  communityOf: CommunityMap,
  a: string,
  b: string,
  options?: CrossCommunityWeightOptions,
): number {
  return computeCrossCommunityWeight(graph, communityOf, options).get(communityPairKey(a, b)) ?? 0;
}