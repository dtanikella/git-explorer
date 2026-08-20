import {
  buildCommunityGraph,
  edgeWeight,
  EDGE_WEIGHT_ATTRIBUTE,
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

function makeEdge(from: string, to: string, kind: EdgeKind = EdgeKind.CALLS): AnalysisEdge {
  return {
    kind,
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

/** Count how many analysis edges sit between the given pair (both directions). */
function summedWeight(edges: AnalysisEdge[], a: string, b: string): number {
  return edges.filter(
    (e) => (e.fromSymbol === a && e.toSymbol === b) || (e.fromSymbol === b && e.toSymbol === a),
  ).length;
}

describe('buildCommunityGraph', () => {
  it('symmetrizes call weights (a→b×2 + b→a×1 ⇒ undirected weight 3)', () => {
    const nodes = [makeNode('a'), makeNode('b')];
    const edges = [
      makeEdge('a', 'b'),
      makeEdge('a', 'b'),   // second a→b edge → "a→b weight 2"
      makeEdge('b', 'a'),   // b→a weight 1
    ];
    const graph = buildCommunityGraph(nodes, edges);
    expect(graph.order).toBe(2);
    expect(graph.size).toBe(1); // one undirected edge, not parallel
    expect(summedWeight(edges, 'a', 'b')).toBe(3);
    expect(graph.getEdgeAttribute('a', 'b', EDGE_WEIGHT_ATTRIBUTE)).toBe(3);
  });

  it('keeps isolated (degree-0) nodes in the graph', () => {
    const nodes = [makeNode('a'), makeNode('b'), makeNode('iso')];
    const edges = [makeEdge('a', 'b')];
    const graph = buildCommunityGraph(nodes, edges);
    expect(graph.hasNode('a')).toBe(true);
    expect(graph.hasNode('b')).toBe(true);
    expect(graph.hasNode('iso')).toBe(true);
    expect(graph.neighbors('iso')).toHaveLength(0);
  });

  it('accumulates multiple edge kinds between a pair into one weighted edge', () => {
    const nodes = [makeNode('a'), makeNode('b')];
    const edges = [
      makeEdge('a', 'b', EdgeKind.CALLS),
      makeEdge('a', 'b', EdgeKind.IMPORTS),
    ];
    const graph = buildCommunityGraph(nodes, edges);
    expect(graph.order).toBe(2);
    expect(graph.size).toBe(1); // two parallel directed edges → one undirected edge
    expect(graph.getEdgeAttribute('a', 'b', EDGE_WEIGHT_ATTRIBUTE)).toBe(2);
  });

  it('ignores self-loops when building clustering edges', () => {
    const nodes = [makeNode('a')];
    const edges = [makeEdge('a', 'a')];
    const graph = buildCommunityGraph(nodes, edges);
    expect(graph.hasNode('a')).toBe(true);
    expect(graph.size).toBe(0);
  });

  it('builds a usable graphology graph (nodes, neighbors, hasEdge)', () => {
    const nodes = [makeNode('a'), makeNode('b')];
    const edges = [makeEdge('a', 'b')];
    const graph: CommunityGraph = buildCommunityGraph(nodes, edges);
    expect(graph.hasEdge('a', 'b')).toBe(true);
    expect(graph.neighbors('a')).toContain('b');
    expect(graph.neighbors('b')).toContain('a');
    expect(graph.nodes()).toEqual(expect.arrayContaining(['a', 'b']));
  });

  it('edgeWeight returns 0 for non-adjacent pairs', () => {
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c')];
    const graph = buildCommunityGraph(nodes, [makeEdge('a', 'b')]);
    expect(edgeWeight(graph, 'a', 'c')).toBe(0);
  });

  it('edgeWeight returns the accumulated undirected weight for adjacent pairs', () => {
    const nodes = [makeNode('a'), makeNode('b')];
    const graph = buildCommunityGraph(nodes, [makeEdge('a', 'b')]);
    expect(edgeWeight(graph, 'a', 'b')).toBe(1);
  });
});