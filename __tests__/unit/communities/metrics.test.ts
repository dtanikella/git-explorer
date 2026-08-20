import {
  computeEmbeddedness,
  computeCrossCommunityWeight,
  crossCommunityWeight,
  communityPairKey,
} from '@/lib/analysis/communities/metrics';
import { buildCommunityGraph } from '@/lib/analysis/communities/graph';
import type { CommunityMap } from '@/lib/analysis/communities/detect';
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

function makeEdge(from: string, to: string, times = 1): AnalysisEdge[] {
  return Array.from({ length: times }, () => ({
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
  }));
}

describe('computeEmbeddedness', () => {
  it('returns 1 for a node whose edges are all within its community', () => {
    // a-b (1), a-c (1), a-d (1), a-e (1) — all internal to community "A".
    const graph = buildCommunityGraph(
      ['a', 'b', 'c', 'd', 'e'].map(makeNode),
      [
        ...makeEdge('a', 'b'),
        ...makeEdge('a', 'c'),
        ...makeEdge('a', 'd'),
        ...makeEdge('a', 'e'),
      ],
    );
    const communityOf: CommunityMap = new Map([
      ['a', 'A'], ['b', 'A'], ['c', 'A'], ['d', 'A'], ['e', 'A'],
    ]);
    expect(computeEmbeddedness(graph, communityOf).get('a')).toBe(1);
  });

  it('returns 0.25 for a node with 1 internal and 3 cross-community edges', () => {
    const graph = buildCommunityGraph(
      ['a', 'b', 'c', 'd', 'e'].map(makeNode),
      [
        ...makeEdge('a', 'b'),   // internal (A→A)
        ...makeEdge('a', 'c'),   // cross
        ...makeEdge('a', 'd'),   // cross
        ...makeEdge('a', 'e'),   // cross
      ],
    );
    const communityOf: CommunityMap = new Map([
      ['a', 'A'], ['b', 'A'],
      ['c', 'B'], ['d', 'B'], ['e', 'B'],
    ]);
    expect(computeEmbeddedness(graph, communityOf).get('a')).toBeCloseTo(0.25, 6);
  });

  it('returns 0 for an isolated (degree-0) node instead of NaN', () => {
    const graph = buildCommunityGraph(
      ['a', 'isolated', 'b'].map(makeNode),
      [...makeEdge('a', 'b')],
    );
    const communityOf: CommunityMap = new Map([
      ['a', 'A'], ['b', 'A'], ['isolated', 'A'],
    ]);
    const embeddedness = computeEmbeddedness(graph, communityOf);
    expect(embeddedness.get('isolated')).toBe(0);
    expect(Number.isNaN(embeddedness.get('isolated'))).toBe(false);
  });
});

describe('computeCrossCommunityWeight', () => {
  it('is positive when a community pair has more cross-edges than the null model predicts', () => {
    // Hand-computable: C1 = {a}, C2 = {b,c,d}; cross edges a-b, a-c, a-d.
    // m = 3 ⇒ 2m = 6; degrees k_a=3, k_b=k_c=k_d=1. Contribution per cross
    // edge (γ=1) = 1 − (3·1)/6 = +0.5, so total = 3 × 0.5 = +1.5 > 0.
    const graph = buildCommunityGraph(
      ['a', 'b', 'c', 'd'].map(makeNode),
      [
        ...makeEdge('a', 'b'),
        ...makeEdge('a', 'c'),
        ...makeEdge('a', 'd'),
      ],
    );
    const communityOf: CommunityMap = new Map([
      ['a', 'C1'],
      ['b', 'C2'], ['c', 'C2'], ['d', 'C2'],
    ]);
    const weights = computeCrossCommunityWeight(graph, communityOf);
    expect(weights.get('C1|C2')).toBeCloseTo(1.5, 6);
  });

  it('is <= 0 when there are fewer cross-edges than the null model predicts', () => {
    // C1 = {a,b} with a 10-weight intra edge, C2 = {c,d} with a 10-weight intra
    // edge, plus a single cross edge a-c (weight 1). m = 21 ⇒ 2m = 42.
    // k_a=11, k_c=11. Cross contribution = 1 − (11·11)/42 ≈ −1.88 < 0.
    const graph = buildCommunityGraph(
      ['a', 'b', 'c', 'd'].map(makeNode),
      [
        ...makeEdge('a', 'b', 10),
        ...makeEdge('c', 'd', 10),
        ...makeEdge('a', 'c'),
      ],
    );
    const communityOf: CommunityMap = new Map([
      ['a', 'C1'], ['b', 'C1'],
      ['c', 'C2'], ['d', 'C2'],
    ]);
    const weights = computeCrossCommunityWeight(graph, communityOf);
    expect(weights.get('C1|C2')).toBeDefined();
    expect((weights.get('C1|C2') ?? 0)).toBeLessThan(0);
  });

  it('is symmetric — weight(c1,c2) === weight(c2,c1)', () => {
    const graph = buildCommunityGraph(
      ['a', 'b', 'c', 'd'].map(makeNode),
      [
        ...makeEdge('a', 'c'),
        ...makeEdge('b', 'd'),
      ],
    );
    const communityOf: CommunityMap = new Map([
      ['a', 'C1'], ['b', 'C1'],
      ['c', 'C2'], ['d', 'C2'],
    ]);
    expect(crossCommunityWeight(graph, communityOf, 'C1', 'C2')).toBe(
      crossCommunityWeight(graph, communityOf, 'C2', 'C1'),
    );
    // And the canonical map key is produced by communityPairKey regardless of order.
    const weights = computeCrossCommunityWeight(graph, communityOf);
    expect(weights.has('C1|C2')).toBe(true);
  });
});

describe('communityPairKey', () => {
  it('canonicalizes to sorted order', () => {
    expect(communityPairKey('beta', 'alpha')).toBe('alpha|beta');
    expect(communityPairKey('alpha', 'beta')).toBe('alpha|beta');
  });
});