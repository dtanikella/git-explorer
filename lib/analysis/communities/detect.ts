import louvain from 'graphology-communities-louvain';
import { connectedComponents } from 'graphology-components';
import Graph from 'graphology';
import type { CommunityGraph } from './graph';
import { EDGE_WEIGHT_ATTRIBUTE } from './graph';

/** Community id — an arbitrary string, assigned by the detection pipeline. */
export type CommunityId = string;

/** node → community id map. */
export type CommunityMap = Map<string, CommunityId>;

/**
 * Build the induced subgraph of `graph` restricted to `nodeSet`. Used so the
 * connected-components split (`connectCommunityComponents`) can be expressed as
 * `graphology-components`'s `connectedComponents` over a true induced subgraph,
 * per report §1.1.
 */
export function buildInducedSubgraph(
  graph: CommunityGraph,
  nodeSet: Set<string>,
): CommunityGraph {
  const sub = new Graph();
  for (const node of nodeSet) sub.addNode(node);

  const seen = new Set<string>();
  for (const node of nodeSet) {
    for (const neighbor of graph.neighbors(node)) {
      if (!nodeSet.has(neighbor)) continue;
      const key = node < neighbor ? `${node}|${neighbor}` : `${neighbor}|${node}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const weight = graph.getEdgeAttribute(node, neighbor, EDGE_WEIGHT_ATTRIBUTE, 1);
      sub.addEdge(node, neighbor, { [EDGE_WEIGHT_ATTRIBUTE]: weight });
    }
  }

  return sub;
}

/**
 * Guarantee every returned community is internally connected (report §1.1).
 *
 * Louvain can return a "community" whose members are not all mutually
 * reachable through edges within that community (an artifact of its local
 * merge order). For each community in `communityOf`, this recomputes its
 * connected components and relabels any additional disconnected piece as
 * `${communityId}::${n}`, so those pieces become their own communities.
 *
 * Exposed as a pure function so the split itself is directly unit-testable
 * with an artificially disconnected partition, independently of whether a
 * small Louvain fixture would reproduce the artifact deterministically.
 */
export function connectCommunityComponents(
  graph: CommunityGraph,
  communityOf: CommunityMap,
): CommunityMap {
  const membersByCommunity = new Map<CommunityId, string[]>();
  for (const [node, communityId] of communityOf) {
    const members = membersByCommunity.get(communityId);
    if (members) {
      members.push(node);
    } else {
      membersByCommunity.set(communityId, [node]);
    }
  }

  const result: CommunityMap = new Map();
  for (const [communityId, members] of membersByCommunity) {
    const nodeSet = new Set(members);
    const components = connectedComponents(buildInducedSubgraph(graph, nodeSet));

    if (components.length <= 1) {
      for (const member of members) result.set(member, communityId);
      continue;
    }

    components.forEach((component, index) => {
      const splitId = `${communityId}::${index}`;
      for (const member of component) result.set(member, splitId);
    });
  }

  return result;
}

/**
 * Run Louvain community detection over `graph` at `resolution`, then apply the
 * connectivity split. Returns a `node → communityId` map.
 */
export function detectCommunities(
  graph: CommunityGraph,
  resolution: number,
): CommunityMap {
  const raw = louvain(graph, { resolution });
  const communityOf: CommunityMap = new Map();
  for (const [node, cluster] of Object.entries(raw)) {
    communityOf.set(node, String(cluster));
  }
  return connectCommunityComponents(graph, communityOf);
}