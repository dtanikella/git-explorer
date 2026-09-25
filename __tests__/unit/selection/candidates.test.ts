import { computeExpansionCandidates, computeActiveNodeIds } from '@/lib/selection/candidates';
import { SyntaxType, EdgeKind } from '@/lib/analysis/types';
import type { AnalysisNode, AnalysisEdge } from '@/lib/analysis/types';
import type { Area } from '@/lib/areas/types';

function makeNode(sym: string, name: string, filePath: string): AnalysisNode {
  return {
    syntaxType: SyntaxType.FUNCTION,
    name,
    filePath,
    startLine: 1,
    startCol: 0,
    isAsync: false,
    isExported: true,
    params: [],
    returnTypeText: null,
    scipSymbol: sym,
    isDefinition: true,
    inTestFile: false,
    referencedAt: [],
    outboundRefs: [],
  };
}

function makeEdge(
  kind: EdgeKind,
  from: string,
  to: string,
  fromFile = 'a.ts',
  toFile = 'b.ts',
): AnalysisEdge {
  return {
    kind,
    fromFile,
    fromName: from.split('/').pop()!,
    fromSymbol: from,
    toText: to.split('/').pop()!,
    toFile,
    toName: to.split('/').pop()!,
    toSymbol: to,
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

const nodes: AnalysisNode[] = [
  makeNode('sym:a', 'funcA', 'src/a.ts'),
  makeNode('sym:b', 'funcB', 'src/a.ts'),
  makeNode('sym:c', 'funcC', 'src/b.ts'),
  makeNode('sym:d', 'funcD', 'src/c.ts'),
  makeNode('sym:e', 'funcE', 'src/d.ts'),
];

const edges: AnalysisEdge[] = [
  makeEdge(EdgeKind.CALLS, 'sym:a', 'sym:c'),
  makeEdge(EdgeKind.CALLS, 'sym:c', 'sym:d'),
  makeEdge(EdgeKind.USES_TYPE, 'sym:b', 'sym:e'),
];

const visibleNodeIds = new Set(['sym:a', 'sym:b', 'sym:c', 'sym:d', 'sym:e']);

const areas: Area[] = [
  makeArea('area-1', 'Area 1', ['sym:a', 'sym:b']),
  makeArea('area-2', 'Area 2', ['sym:c']),
  makeArea('area-parent', 'Parent', [], null, ['area-1']),
];

describe('computeExpansionCandidates', () => {
  it('returns empty map when nothing is selected', () => {
    const result = computeExpansionCandidates(new Set(), new Set(), nodes, edges, visibleNodeIds, areas);
    expect(result.size).toBe(0);
  });

  it('computes same-file candidates for a selected node', () => {
    const result = computeExpansionCandidates(
      new Set(['sym:a']),
      new Set(),
      nodes,
      edges,
      visibleNodeIds,
      areas,
    );
    const sameFile = result.get('same-file')!;
    expect(sameFile).toBeDefined();
    expect(sameFile.candidates.map((c: { nodeId: string }) => c.nodeId)).toEqual(['sym:b']);
    // Should propagate enabled and disabledIds from prevExpansions
    expect(typeof sameFile.enabled).toBe('boolean');
    expect(sameFile.disabledIds instanceof Set).toBe(true);
  });

  it('does not include area-members expansion', () => {
    const result = computeExpansionCandidates(
      new Set(['sym:a']),
      new Set(['area-1']),
      nodes,
      edges,
      visibleNodeIds,
      areas,
    );
    expect(result.has('area-members')).toBe(false);
  });

  it('computes caller candidates', () => {
    const result = computeExpansionCandidates(new Set(['sym:c']), new Set(), nodes, edges, visibleNodeIds, areas);
    const callers = result.get('callers')!;
    expect(callers.candidates.map((c: { nodeId: string }) => c.nodeId)).toEqual(['sym:a']);
  });

  it('computes callee candidates', () => {
    const result = computeExpansionCandidates(new Set(['sym:c']), new Set(), nodes, edges, visibleNodeIds, areas);
    const callees = result.get('callees')!;
    expect(callees.candidates.map((c: { nodeId: string }) => c.nodeId)).toEqual(['sym:d']);
  });

  it('treats INSTANTIATES, USES_TYPE, EXTENDS, IMPLEMENTS as caller/callee edges', () => {
    for (const kind of [EdgeKind.INSTANTIATES, EdgeKind.USES_TYPE, EdgeKind.EXTENDS, EdgeKind.IMPLEMENTS]) {
      const e = makeEdge(kind, 'sym:a', 'sym:c');
      const result = computeExpansionCandidates(new Set(['sym:c']), new Set(), nodes, [e], visibleNodeIds, areas);
      expect(result.get('callers')!.candidates.map((c: { nodeId: string }) => c.nodeId)).toEqual(['sym:a']);
    }
  });

  it('does not treat IMPORTS as caller/callee', () => {
    const e = makeEdge(EdgeKind.IMPORTS, 'sym:a', 'sym:c');
    const result = computeExpansionCandidates(new Set(['sym:c']), new Set(), nodes, [e], visibleNodeIds, areas);
    expect(result.get('callers')!.candidates).toHaveLength(0);
  });

  it('does not include already-selected nodes as expansion candidates', () => {
    const result = computeExpansionCandidates(
      new Set(['sym:a', 'sym:b']),
      new Set(),
      nodes,
      edges,
      visibleNodeIds,
      areas,
    );
    const sameFile = result.get('same-file')!;
    expect(sameFile.candidates).toHaveLength(0);
  });

  it('preserves previous enabled and disabledIds state', () => {
    const prevExpansions = new Map<string, { type: string; enabled: boolean; candidates: { nodeId: string; sourceNodeIds: string[] }[]; disabledIds: Set<string> }>();
    prevExpansions.set('same-file', {
      type: 'same-file',
      enabled: true,
      candidates: [],
      disabledIds: new Set(['sym:b']),
    });

    const result = computeExpansionCandidates(
      new Set(['sym:a']),
      new Set(),
      nodes,
      edges,
      visibleNodeIds,
      areas,
      prevExpansions,
    );
    const sameFile = result.get('same-file')!;
    expect(sameFile.enabled).toBe(true);
    expect(sameFile.disabledIds.has('sym:b')).toBe(true);
  });
});

describe('computeActiveNodeIds', () => {
  it('returns selected node ids when no expansions are enabled', () => {
    const expansions = new Map();
    expansions.set('same-file', {
      type: 'same-file',
      enabled: false,
      candidates: [{ nodeId: 'sym:b', sourceNodeIds: ['sym:a'] }],
      disabledIds: new Set(),
    });

    const active = computeActiveNodeIds(new Set(['sym:a']), expansions);
    expect(active.has('sym:a')).toBe(true);
    expect(active.has('sym:b')).toBe(false);
  });

  it('adds enabled expansion candidates', () => {
    const expansions = new Map();
    expansions.set('same-file', {
      type: 'same-file',
      enabled: true,
      candidates: [{ nodeId: 'sym:b', sourceNodeIds: ['sym:a'] }],
      disabledIds: new Set(),
    });

    const active = computeActiveNodeIds(new Set(['sym:a']), expansions);
    expect(active.has('sym:a')).toBe(true);
    expect(active.has('sym:b')).toBe(true);
  });

  it('excludes disabled expansion candidates', () => {
    const expansions = new Map();
    expansions.set('same-file', {
      type: 'same-file',
      enabled: true,
      candidates: [{ nodeId: 'sym:b', sourceNodeIds: ['sym:a'] }],
      disabledIds: new Set(['sym:b']),
    });

    const active = computeActiveNodeIds(new Set(['sym:a']), expansions);
    expect(active.has('sym:b')).toBe(false);
  });

  it('only includes same-file, callers, and callees (not area-members)', () => {
    const expansions = new Map();
    expansions.set('same-file', {
      type: 'same-file',
      enabled: true,
      candidates: [{ nodeId: 'sym:b', sourceNodeIds: ['sym:a'] }],
      disabledIds: new Set(),
    });
    expansions.set('callers', {
      type: 'callers',
      enabled: true,
      candidates: [{ nodeId: 'sym:c', sourceNodeIds: ['sym:a'] }],
      disabledIds: new Set(),
    });

    const active = computeActiveNodeIds(new Set(['sym:a']), expansions);
    expect(active.has('sym:a')).toBe(true);
    expect(active.has('sym:b')).toBe(true);
    expect(active.has('sym:c')).toBe(true);
  });
});