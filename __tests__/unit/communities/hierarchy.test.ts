import {
  buildHierarchy,
  matchParents,
  membersByCommunity,
  type HierarchyLevel,
} from '@/lib/analysis/communities/hierarchy';
import type { CommunityMap } from '@/lib/analysis/communities/detect';
import { buildCommunityGraph } from '@/lib/analysis/communities/graph';
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

describe('matchParents', () => {
  it('maps both high-res communities to the single low-res community that contains them', () => {
    const finer: CommunityMap = new Map([
      ['a', 'A'], ['b', 'A'],
      ['c', 'B'], ['d', 'B'],
    ]);
    const coarser = new Map([['one', ['a', 'b', 'c', 'd']]]);

    const parentOf = matchParents(finer, coarser);
    expect(parentOf.get('A')).toBe('one');
    expect(parentOf.get('B')).toBe('one');
  });

  it('maps identical partitions to themselves (degenerate case, no undefined parents)', () => {
    const partition: CommunityMap = new Map([
      ['a', 'A'], ['b', 'A'],
      ['c', 'B'], ['d', 'B'],
    ]);
    const coarser = new Map([
      ['A', ['a', 'b']],
      ['B', ['c', 'd']],
    ]);

    const parentOf = matchParents(partition, coarser);
    expect(parentOf.get('A')).toBe('A');
    expect(parentOf.get('B')).toBe('B');
  });

  it('falls back to majority overlap when no coarser community is a full superset (post-split)', () => {
    // {a,b} and {c} live in coarser community X; {c} was split off from a raw
    // community Y into its own piece, but Y is no longer a superset of it.
    const partition: CommunityMap = new Map([
      ['a', 'A'], ['b', 'A'],
      ['c', 'C'],
    ]);
    const coarser = new Map([
      ['X', ['a', 'b', 'd']],
      ['Z', ['c', 'd']],
    ]);

    const parentOf = matchParents(partition, coarser);
    // A has full superset, C has majority overlap with Z.
    expect(parentOf.get('A')).toBe('X');
    expect(parentOf.get('C')).toBe('Z');
  });

  it('sets null when no coarser community overlaps at all', () => {
    const partition: CommunityMap = new Map([['a', 'A']]);
    const coarser = new Map([['X', ['z']]]);
    const parentOf = matchParents(partition, coarser);
    expect(parentOf.get('A')).toBeNull();
  });
});

describe('buildHierarchy', () => {
  it('builds one level per ascending resolution with null parents on the coarsest level', () => {
    const graph = buildCommunityGraph(
      ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(makeNode),
      [
        ['a', 'b'], ['a', 'c'], ['a', 'd'], ['b', 'c'], ['b', 'd'], ['c', 'd'],
        ['e', 'f'], ['e', 'g'], ['e', 'h'], ['f', 'g'], ['f', 'h'], ['g', 'h'],
        ['d', 'e'],
      ].map((pair) => makeEdge(pair[0], pair[1])),
    );

    const resolutions = [0.5, 1.0, 1.5];
    const levels: HierarchyLevel[] = buildHierarchy(graph, resolutions);
    expect(levels).toHaveLength(3);
    expect(levels.map((l) => l.resolution)).toEqual([0.5, 1.0, 1.5]);

    // Coarsest level has all-null parents.
    const coarsestCommunities = new Set(membersByCommunity(levels[0].partition).keys());
    for (const communityId of coarsestCommunities) {
      expect(levels[0].parentOf.get(communityId)).toBeNull();
    }

    // Every non-coarsest level community has a parent in the next-coarser level.
    for (let i = 1; i < levels.length; i++) {
      const finerMembers = membersByCommunity(levels[i].partition);
      for (const communityId of finerMembers.keys()) {
        expect(levels[i].parentOf.get(communityId)).not.toBeNull();
      }
    }
  });

  it('handles the degenerate case of identical partitions across resolutions', () => {
    const graph = buildCommunityGraph(
      ['a', 'b'].map(makeNode),
      [makeEdge('a', 'b')],
    );
    const levels = buildHierarchy(graph, [1.0, 1.0]);
    expect(levels).toHaveLength(2);
    const finerCommunities = new Set(membersByCommunity(levels[1].partition).keys());
    for (const communityId of finerCommunities) {
      expect(levels[1].parentOf.get(communityId)).not.toBe(undefined);
    }
  });
});