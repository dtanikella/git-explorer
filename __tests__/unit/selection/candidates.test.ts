import {
  computeExpansionGroups,
  computeActiveNodeIds,
  collectRelationIds,
  nodeSourceKey,
  areaSourceKey,
  pathSourceKey,
} from '@/lib/selection/candidates';
import type { ExpansionInput, ExpansionType, SourceKey } from '@/lib/selection/candidates';
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

function run(over: Partial<ExpansionInput> = {}) {
  return computeExpansionGroups({
    selectedNodeIds: new Set(),
    selectedAreaIds: new Set(),
    nodes,
    edges,
    visibleNodeIds,
    areas,
    wholeEnabled: new Set<ExpansionType>(),
    rowExpansions: new Map<SourceKey, Set<ExpansionType>>(),
    disabledIds: new Map(),
    focusKey: null,
    ...over,
  });
}

const ids = (relations: { nodeIds: string[] }[]) => relations.flatMap((r) => r.nodeIds).sort();

describe('computeExpansionGroups', () => {
  it('returns an empty map when nothing is selected, expanded or focused', () => {
    expect(run().size).toBe(0);
  });

  it('computes same-file, callers and callees for a selected node', () => {
    const result = run({ selectedNodeIds: new Set(['sym:c']) });
    expect(ids(result.get('same-file')!.available)).toEqual([]); // only sym:c is in src/b.ts
    expect(ids(result.get('callers')!.available)).toEqual(['sym:a']);
    expect(ids(result.get('callees')!.available)).toEqual(['sym:d']);
    expect([...result.keys()]).toEqual(['same-file', 'callers', 'callees']);
  });

  it('finds other nodes in the same file', () => {
    const result = run({ selectedNodeIds: new Set(['sym:a']) });
    expect(ids(result.get('same-file')!.available)).toEqual(['sym:b']);
  });

  it('treats INSTANTIATES, USES_TYPE, EXTENDS, IMPLEMENTS as caller/callee edges', () => {
    for (const kind of [EdgeKind.INSTANTIATES, EdgeKind.USES_TYPE, EdgeKind.EXTENDS, EdgeKind.IMPLEMENTS]) {
      const result = run({ selectedNodeIds: new Set(['sym:c']), edges: [makeEdge(kind, 'sym:a', 'sym:c')] });
      expect(ids(result.get('callers')!.available)).toEqual(['sym:a']);
    }
  });

  it('does not treat IMPORTS as caller/callee', () => {
    const result = run({
      selectedNodeIds: new Set(['sym:c']),
      edges: [makeEdge(EdgeKind.IMPORTS, 'sym:a', 'sym:c')],
    });
    expect(result.get('callers')!.available).toHaveLength(0);
  });

  it('never offers nodes already in the selection', () => {
    const result = run({ selectedNodeIds: new Set(['sym:a', 'sym:b']) });
    expect(result.get('same-file')!.available).toHaveLength(0);
  });

  it('only adds nodes when the whole-selection toggle is on', () => {
    const selected = new Set(['sym:a']);
    const off = run({ selectedNodeIds: selected });
    expect(off.get('same-file')!.active).toHaveLength(0);
    const on = run({ selectedNodeIds: selected, wholeEnabled: new Set<ExpansionType>(['same-file']) });
    expect(ids(on.get('same-file')!.active)).toEqual(['sym:b']);
  });

  it('treats a checked area as one source, with callers from outside it', () => {
    const result = run({
      selectedNodeIds: new Set(['sym:a', 'sym:b']),
      selectedAreaIds: new Set(['area-1']),
      edges: [makeEdge(EdgeKind.CALLS, 'sym:a', 'sym:b'), makeEdge(EdgeKind.CALLS, 'sym:c', 'sym:a')],
    });
    const callers = result.get('callers')!.available;
    expect(callers).toHaveLength(1);
    expect(callers[0].source.key).toBe(areaSourceKey('area-1'));
    expect(callers[0].nodeIds).toEqual(['sym:c']);
  });

  describe('per-row expansions', () => {
    const rows = (key: SourceKey, ...types: ExpansionType[]) => new Map([[key, new Set(types)]]);

    it('expands an unselected node and adds only that row\'s nodes', () => {
      const result = run({ rowExpansions: rows(nodeSourceKey('sym:c'), 'callers') });
      expect(ids(result.get('callers')!.active)).toEqual(['sym:a']);
      expect(result.get('callees')!.active).toHaveLength(0);
    });

    it('expands an area, counting sub-areas as part of it', () => {
      const parentAreas = [
        makeArea('parent', 'Parent', [], null, ['kid']),
        makeArea('kid', 'Kid', ['sym:c'], 'parent'),
      ];
      const result = run({ areas: parentAreas, rowExpansions: rows(areaSourceKey('parent'), 'callees') });
      expect(ids(result.get('callees')!.active)).toEqual(['sym:d']);
    });

    it('expands a folder: every node in it, callers of it, callees by it', () => {
      const same = run({ rowExpansions: rows(pathSourceKey('src'), 'same-file') });
      expect(ids(same.get('same-file')!.active)).toEqual(['sym:a', 'sym:b', 'sym:c', 'sym:d', 'sym:e']);

      const callees = run({ rowExpansions: rows(pathSourceKey('src/b.ts'), 'callees') });
      expect(ids(callees.get('callees')!.active)).toEqual(['sym:d']);
    });

    it('matches folders by path segment, not prefix', () => {
      const result = run({
        nodes: [...nodes, makeNode('sym:f', 'funcF', 'src-extra/f.ts')],
        visibleNodeIds: new Set([...visibleNodeIds, 'sym:f']),
        rowExpansions: rows(pathSourceKey('src'), 'same-file'),
      });
      expect(ids(result.get('same-file')!.active)).not.toContain('sym:f');
    });

    it('never duplicates a node a whole-selection toggle already adds for the same row', () => {
      const result = run({
        selectedNodeIds: new Set(['sym:c']),
        wholeEnabled: new Set<ExpansionType>(['callers']),
        rowExpansions: rows(nodeSourceKey('sym:c'), 'callers'),
      });
      expect(ids(result.get('callers')!.active)).toEqual(['sym:a']);
    });

    it('adds per-row nodes on top of the whole-selection toggle', () => {
      const result = run({
        selectedNodeIds: new Set(['sym:c']),
        wholeEnabled: new Set<ExpansionType>(['callers']),
        rowExpansions: rows(nodeSourceKey('sym:b'), 'callers'),
        edges: [...edges, makeEdge(EdgeKind.CALLS, 'sym:e', 'sym:b')],
      });
      expect(ids(result.get('callers')!.active)).toEqual(['sym:a', 'sym:e']);
    });

    it('reports the focused row\'s relation even when its toggle is off', () => {
      const result = run({ focusKey: nodeSourceKey('sym:c') });
      expect(ids([result.get('callers')!.focused!])).toEqual(['sym:a']);
      expect(result.get('callers')!.active).toHaveLength(0);
    });

    it('keeps excluded ids shared across whole-selection and per-row views', () => {
      const result = run({
        selectedNodeIds: new Set(['sym:c']),
        wholeEnabled: new Set<ExpansionType>(['callers']),
        rowExpansions: rows(nodeSourceKey('sym:d'), 'callers'),
        disabledIds: new Map([['callers' as ExpansionType, new Set(['sym:a'])]]),
      });
      const group = result.get('callers')!;
      expect(collectRelationIds(group.active, group.disabledIds)).not.toContain('sym:a');
    });

    it('ignores unknown sources', () => {
      const result = run({ rowExpansions: rows(areaSourceKey('missing'), 'callers') });
      expect(result.get('callers')!.active).toHaveLength(0);
    });
  });
});

describe('computeActiveNodeIds', () => {
  it('returns the selected ids when nothing is expanded', () => {
    const groups = run({ selectedNodeIds: new Set(['sym:a']) });
    expect([...computeActiveNodeIds(new Set(['sym:a']), groups)]).toEqual(['sym:a']);
  });

  it('adds whole-selection and per-row expansions, minus excluded nodes', () => {
    const selected = new Set(['sym:a']);
    const groups = run({
      selectedNodeIds: selected,
      wholeEnabled: new Set<ExpansionType>(['same-file']),
      rowExpansions: new Map([[nodeSourceKey('sym:c'), new Set<ExpansionType>(['callers', 'callees'])]]),
      disabledIds: new Map([['callees' as ExpansionType, new Set(['sym:d'])]]),
    });
    expect([...computeActiveNodeIds(selected, groups)].sort()).toEqual(['sym:a', 'sym:b']);
    // sym:c callers -> sym:a (already selected); callees sym:d is excluded
  });
});
