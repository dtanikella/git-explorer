import { UndirectedGraph } from 'graphology';
import type { AnalysisNode, AnalysisEdge } from '@/lib/analysis/types';

/**
 * Attribute key holding the undirected edge weight in the community graph.
 */
export const EDGE_WEIGHT_ATTRIBUTE = 'weight';

/**
 * Community graph type — an undirected graphology graph, one node per
 * `scipSymbol`, edge weight = symmetrized call weight.
 */
export type CommunityGraph = UndirectedGraph;

// Separator used only inside the local accumulator map (never a graph key).
// Null characters cannot appear in SCIP symbol strings.
const PAIR_SEPARATOR = '\u0000';

function pairKey(a: string, b: string): string {
  return a < b ? `${a}${PAIR_SEPARATOR}${b}` : `${b}${PAIR_SEPARATOR}${a}`;
}

/**
 * Build an undirected `graphology` graph from a code-analysis node/edge list.
 *
 * - One node per `scipSymbol` (isolated, degree-0 nodes are kept).
 * - Edges are symmetrized per report §1.1: the undirected edge (a—b) carries
 *   weight = calls(a→b) + calls(b→a), where each directed `AnalysisEdge`
 *   between the pair contributes +1 regardless of edge kind.
 * - If multiple edges exist between the same pair (e.g. both a CALLS and an
 *   IMPORTS edge), their weights accumulate into one edge rather than forming
 *   parallel edges (graphology graphs are simple by default).
 */
export function buildCommunityGraph(
  nodes: AnalysisNode[],
  edges: AnalysisEdge[],
): CommunityGraph {
  const graph = new UndirectedGraph();

  // Every analysis node becomes a graph node, even if it has no edges
  // (degree 0). Dropping isolated nodes here would silently lose them from
  // `detectCommunities` later.
  for (const node of nodes) {
    if (!graph.hasNode(node.scipSymbol)) {
      graph.addNode(node.scipSymbol);
    }
  }

  // Accumulate the symmetrized weight per unordered node pair.
  const weightByPair = new Map<string, number>();
  for (const edge of edges) {
    if (edge.fromSymbol === edge.toSymbol) continue; // self-loop: ignored for clustering
    const key = pairKey(edge.fromSymbol, edge.toSymbol);
    weightByPair.set(key, (weightByPair.get(key) ?? 0) + 1);
  }

  // Materialize one weighted undirected edge per pair.
  for (const [key, weight] of weightByPair) {
    const [a, b] = key.split(PAIR_SEPARATOR);
    if (!graph.hasNode(a)) graph.addNode(a);
    if (!graph.hasNode(b)) graph.addNode(b);
    graph.addEdge(a, b, { [EDGE_WEIGHT_ATTRIBUTE]: weight });
  }

  return graph;
}

/**
 * The undirected edge weight between two nodes in a community graph, defaulting
 * to 0 for non-adjacent pairs (rather than to graphology's default of 1).
 */
export function edgeWeight(
  graph: CommunityGraph,
  a: string,
  b: string,
): number {
  if (!graph.hasEdge(a, b)) return 0;
  return graph.getEdgeAttribute(a, b, EDGE_WEIGHT_ATTRIBUTE) ?? 1;
}