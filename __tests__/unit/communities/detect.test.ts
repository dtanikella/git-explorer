import {
  detectCommunities,
  connectCommunityComponents,
  buildInducedSubgraph,
  type CommunityMap,
} from '@/lib/analysis/communities/detect';
import {
  buildCommunityGraph,
  type CommunityGraph,
} from '@/lib/analysis/communities/graph';
import type { AnalysisNode, AnalysisEdge } from '@/lib/analysis/types';
import { SyntaxType, EdgeKind } from '@/lib/analysis/types';

function makeNode(id: string): AnalysisNode {
  return {
    syntaxType: SyntaxType.FUNCTION,
    name: id,
    filePath: `/src/${id}.ts`,
    startLine: 1,
    startCol: 0,
    isAsync: false,
    isExported: true,
    params: [],
    returnTypeText: null,
    scipSymbol: id,
    isDefinition: true,
    inTestFile: false,
    referencedAt: [],
    outboundRefs: [],
  };
}

function makeEdge(from: string, to: string): AnalysisEdge {
  return {
    kind: EdgeKind.CALLS,
    fromFile: `/src/${from}.ts`,
    fromName: from,
    fromSymbol: from,
    toText: to,
    toFile: `/src/${to}.ts`,
    toName: to,
    toSymbol: to,
    isExternal: false,
    edgePosition: { line: 1, col: 0 },
    isOptionalChain: false,
    isAsync: false,
  };
}

function nodes(ids: string[]): AnalysisNode[] {
  return ids.map(makeNode);
}

function edges(pairs: Array<[string, string]>): AnalysisEdge[] {
  return pairs.map(([from, to]) => makeEdge(from, to));
}

/** Nodes whose induced subgraph has >1 connected component (a disconnected community). */
function inducedComponentCount(graph: CommunityGraph, members: string[]): number {
  const sub = buildInducedSubgraph(graph, new Set(members));
  // Count connected components via BFS over the induced subgraph's adjacency.
  let sets = 0;
  const remaining = new Set(Array.from(sub.nodes() as Iterable<string>));
  while (remaining.size > 0) {
    sets++;
    const start = [...remaining][0];
    const stack = [start];
    remaining.delete(start);
    while (stack.length > 0) {
      const cur = stack.pop() as string;
      for (const nb of sub.neighbors(cur)) {
        if (remaining.has(nb)) {
          remaining.delete(nb);
          stack.push(nb);
        }
      }
    }
  }
  return sets;
}

describe('detectCommunities', () => {
  it('finds exactly 2 communities for two disjoint, fully-connected triangles', () => {
    const graph = buildCommunityGraph(
      nodes(['a', 'b', 'c', 'd', 'e', 'f']),
      edges([
        ['a', 'b'], ['a', 'c'], ['b', 'c'],
        ['d', 'e'], ['d', 'f'], ['e', 'f'],
      ]),
    );

    const communityOf = detectCommunities(graph, 1.0);
    const groups = groupByCommunity(communityOf);

    expect(groups.length).toBe(2);
    const sortedGroups = groups.map((g) => [...g].sort()).sort();
    expect(sortedGroups).toEqual([
      ['a', 'b', 'c'].sort(),
      ['d', 'e', 'f'].sort(),
    ]);
  });

  it('every returned community is internally connected (connectivity split)', () => {
    // Two disconnected groups {a,b} and {c,d}; hand-feed a partition that merges
    // them into one "community" label to force the artifact Louvain can produce.
    const graph = buildCommunityGraph(
      nodes(['a', 'b', 'c', 'd']),
      edges([['a', 'b'], ['c', 'd']]),
    );
    const merged: CommunityMap = new Map([
      ['a', 'X'],
      ['b', 'X'],
      ['c', 'X'],
      ['d', 'X'],
    ]);

    const result = connectCommunityComponents(graph, merged);
    const groups = groupByCommunity(result);

    // Must split into 2 connected pieces, neither internally disconnected.
    expect(groups.length).toBeGreaterThanOrEqual(2);
    for (const group of groups) {
      expect(inducedComponentCount(graph, group)).toBe(1);
    }
    // No node is lost across the split.
    expect(result.size).toBe(4);
  });

  test('a higher resolution yields at least as many communities on a 2-level hierarchy', () => {
    // Two tightly-connected quads joined by a single loose cross edge.
    const graph = buildCommunityGraph(
      nodes(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']),
      edges([
        ['a', 'b'], ['a', 'c'], ['a', 'd'], ['b', 'c'], ['b', 'd'], ['c', 'd'],
        ['e', 'f'], ['e', 'g'], ['e', 'h'], ['f', 'g'], ['f', 'h'], ['g', 'h'],
        ['d', 'e'], // single loose connector between the two quads
      ]),
    );

    const lowRes = detectCommunities(graph, 0.5);
    const highRes = detectCommunities(graph, 1.5);

    const lowCount = groupByCommunity(lowRes).length;
    const highCount = groupByCommunity(highRes).length;
    expect(highCount).toBeGreaterThanOrEqual(lowCount);
  });
});

function groupByCommunity(communityOf: CommunityMap): string[][] {
  const map = new Map<string, string[]>();
  for (const [node, community] of communityOf) {
    const members = map.get(community);
    if (members) {
      members.push(node);
    } else {
      map.set(community, [node]);
    }
  }
  return [...map.values()];
}