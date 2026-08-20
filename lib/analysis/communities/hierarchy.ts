import { detectCommunities, type CommunityMap } from './detect';
import type { CommunityGraph } from './graph';

/** community → members of that community (node ids). */
export type CommunityMembers = Map<string, string[]>;

/**
 * One level of the resolution-sweep dendrogram: a partition detected at a given
 * resolution, plus (for all but the coarsest level) the parent links matching
 * each community at this level to the community at the next-coarser level whose
 * node set contains it.
 */
export interface HierarchyLevel {
  resolution: number;
  partition: CommunityMap;
  /** communityId (this level) → communityId (coarser level), or null if it has no parent. */
  parentOf: Map<string, string | null>;
}

/**
 * Group a node→community map into community → member node ids.
 */
export function membersByCommunity(partition: CommunityMap): CommunityMembers {
  const members: CommunityMembers = new Map();
  for (const [node, communityId] of partition) {
    const list = members.get(communityId);
    if (list) {
      list.push(node);
    } else {
      members.set(communityId, [node]);
    }
  }
  return members;
}

function isSuperset(outer: Set<string>, inner: Set<string>): boolean {
  for (const node of inner) {
    if (!outer.has(node)) return false;
  }
  return true;
}

function intersectionSize(a: Set<string>, b: Set<string>): number {
  let count = 0;
  for (const node of a) {
    if (b.has(node)) count++;
  }
  return count;
}

/**
 * Match every community at the finer (higher-resolution) level's partition to a
 * community at the coarser (lower-resolution) level whose node set is a full
 * superset of the finer community's nodes (preferred). If no coarser community
 * is a full superset — which can happen after the connected-components split
 * breaks one raw community into several — fall back to the coarser community
 * with the largest node-set overlap. Returns a `communityId → parentId` map,
 * with entries that failed to match (and thus have no parent) set to null.
 *
 * Exported as a pure function so the matching logic is directly unit-testable
 * with injected partitions, independent of Louvain's (possibly nondeterministic)
 * output on a small fixture.
 */
export function matchParents(
  finerPartition: CommunityMap,
  coarserMembers: CommunityMembers,
): Map<string, string | null> {
  const coarserSets = new Map<string, Set<string>>();
  for (const [communityId, nodes] of coarserMembers) {
    coarserSets.set(communityId, new Set(nodes));
  }

  const finerMembers = membersByCommunity(finerPartition);
  const parentOf = new Map<string, string | null>();

  for (const [finerId, members] of finerMembers) {
    const finerSet = new Set(members);

    let parentId: string | null = null;
    for (const [coarserId, coarserSet] of coarserSets) {
      if (isSuperset(coarserSet, finerSet)) {
        parentId = coarserId;
        break;
      }
    }

    if (parentId === null) {
      let bestOverlap = 0;
      for (const [coarserId, coarserSet] of coarserSets) {
        const overlap = intersectionSize(coarserSet, finerSet);
        if (overlap > bestOverlap) {
          bestOverlap = overlap;
          parentId = coarserId;
        }
      }
      if (bestOverlap === 0) parentId = null;
    }

    parentOf.set(finerId, parentId);
  }

  return parentOf;
}

/**
 * Sweep `graph` across ascending `resolutions`, producing one `HierarchyLevel`
 * per resolution with its community partition and parent links to the next
 * coarser level. The coarsest (first) level's `parentOf` entries are all null.
 */
export function buildHierarchy(
  graph: CommunityGraph,
  resolutions: number[],
): HierarchyLevel[] {
  const sorted = [...resolutions].sort((a, b) => a - b);

  const levels: HierarchyLevel[] = sorted.map((resolution) => ({
    resolution,
    partition: detectCommunities(graph, resolution),
    parentOf: new Map<string, string | null>(),
  }));

  // Coarsest level has no parents.
  for (const communityId of membersByCommunity(levels[0].partition).keys()) {
    levels[0].parentOf.set(communityId, null);
  }

  // Finer levels each link to the next-coarser level's containing community.
  for (let i = 1; i < levels.length; i++) {
    const coarserMembers = membersByCommunity(levels[i - 1].partition);
    levels[i].parentOf = matchParents(levels[i].partition, coarserMembers);
  }

  return levels;
}