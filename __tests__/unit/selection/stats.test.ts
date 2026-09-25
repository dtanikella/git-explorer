import { computeAreaEdgeStats } from '@/lib/selection/stats';
import { EdgeKind } from '@/lib/analysis/types';
import type { AnalysisEdge } from '@/lib/analysis/types';
import type { Area } from '@/lib/areas/types';

function makeEdge(
  kind: EdgeKind,
  fromSymbol: string,
  toSymbol: string,
  fromFile = 'a.ts',
  toFile = 'b.ts',
): AnalysisEdge {
  return {
    kind,
    fromFile,
    fromName: fromSymbol.split('/').pop()!,
    fromSymbol,
    toText: toSymbol.split('/').pop()!,
    toFile,
    toName: toSymbol.split('/').pop()!,
    toSymbol,
    isExternal: false,
    isAmbiguous: false,
    edgePosition: { line: 1, col: 0 },
    isOptionalChain: false,
    isAsync: false,
  };
}

function makeArea(id: string, name: string, contains: string[], parent: string | null = null, children: string[] = []): Area {
  return {
    id,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    name,
    type: 'business_domain',
    contains,
    parent,
    children,
    clusterStrength: 0,
  };
}

describe('computeAreaEdgeStats', () => {
  it('returns empty array for empty selected node ids', () => {
    const result = computeAreaEdgeStats(new Set(), [], []);
    expect(result).toHaveLength(0);
  });

  it('returns areas sorted by edges-leaving count descending', () => {
    const areas = [
      makeArea('area-a', 'Area A', ['sym:a', 'sym:b']),
      makeArea('area-b', 'Area B', ['sym:c']),
    ];

    // Area A: sym:a -> sym:c is an outgoing edge (c is outside area A)
    //          sym:b -> sym:d is an outgoing edge (d is outside area A)
    // Area B: sym:c -> sym:d is an outgoing edge (d is outside area B)
    const edges = [
      makeEdge(EdgeKind.CALLS, 'sym:a', 'sym:c'), // A->out
      makeEdge(EdgeKind.CALLS, 'sym:b', 'sym:d'), // A->out
      makeEdge(EdgeKind.CALLS, 'sym:c', 'sym:d'), // B->out
    ];

    const selectedNodeIds = new Set(['sym:a', 'sym:b', 'sym:c']);
    const result = computeAreaEdgeStats(selectedNodeIds, edges, areas);

    expect(result).toHaveLength(2);
    expect(result[0].areaId).toBe('area-a');
    expect(result[0].leavingCount).toBe(2);
    expect(result[1].areaId).toBe('area-b');
    expect(result[1].leavingCount).toBe(1);
  });

  it('returns area with zero leaving count when no edges leave', () => {
    const areas = [makeArea('area-a', 'Area A', ['sym:a'])];
    const edges: AnalysisEdge[] = [];
    const selectedNodeIds = new Set(['sym:a']);

    const result = computeAreaEdgeStats(selectedNodeIds, edges, areas);
    expect(result).toHaveLength(1);
    expect(result[0].leavingCount).toBe(0);
  });

  it('does not count edges within the same area as leaving', () => {
    const areas = [makeArea('area-a', 'Area A', ['sym:a', 'sym:b'])];
    const edges = [
      makeEdge(EdgeKind.CALLS, 'sym:a', 'sym:b'), // Both in Area A
    ];
    const selectedNodeIds = new Set(['sym:a', 'sym:b']);

    const result = computeAreaEdgeStats(selectedNodeIds, edges, areas);
    expect(result).toHaveLength(1);
    expect(result[0].leavingCount).toBe(0);
  });

  it('includes descendant node ids when computing area membership', () => {
    const areas = [
      makeArea('parent', 'Parent', [], null, ['child']),
      makeArea('child', 'Child', ['sym:a'], 'parent', []),
    ];
    const edges = [
      makeEdge(EdgeKind.CALLS, 'sym:a', 'sym:b'), // sym:a is under child under parent
    ];
    const selectedNodeIds = new Set(['sym:a']);

    const result = computeAreaEdgeStats(selectedNodeIds, edges, areas);
    expect(result).toHaveLength(2);
    const parentEntry = result.find((r) => r.areaId === 'parent')!;
    expect(parentEntry.leavingCount).toBe(1);
  });
});