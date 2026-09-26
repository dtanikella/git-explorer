import { buildAreaTree, buildFileTree, UNASSIGNED_ID, type TreeNode } from '@/lib/selection/trees';
import type { AnalysisNode } from '@/lib/analysis/types';
import { SyntaxType } from '@/lib/analysis/types';
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

describe('buildAreaTree', () => {
  it('builds a hierarchical tree from flat area list', () => {
    const areas = [
      makeArea('parent', 'Parent', [], null, ['child-a', 'child-b']),
      makeArea('child-a', 'Child A', ['sym:a'], 'parent', []),
      makeArea('child-b', 'Child B', ['sym:b'], 'parent', []),
    ];
    const nodeSymbols = new Map<string, AnalysisNode>([
      ['sym:a', makeNode('sym:a', 'funcA', 'src/a.ts')],
      ['sym:b', makeNode('sym:b', 'funcB', 'src/b.ts')],
    ]);

    const tree = buildAreaTree(areas, nodeSymbols);
    expect(tree.id).toBe('__root__');
    expect(tree.children).toHaveLength(1);
    expect(tree.children![0].id).toBe('parent');
    expect(tree.children![0].children).toHaveLength(2);
    expect(tree.children![0].children![0].id).toBe('child-a');
    expect(tree.children![0].children![1].id).toBe('child-b');
  });

  it('returns top-level areas when no parent exists', () => {
    const areas = [
      makeArea('area-a', 'Area A', ['sym:a']),
      makeArea('area-b', 'Area B', ['sym:b']),
    ];
    const nodeSymbols = new Map<string, AnalysisNode>([
      ['sym:a', makeNode('sym:a', 'funcA', 'src/a.ts')],
      ['sym:b', makeNode('sym:b', 'funcB', 'src/b.ts')],
    ]);

    const tree = buildAreaTree(areas, nodeSymbols);
    expect(tree.children).toHaveLength(2);
  });

  it('attaches member nodes to each area node', () => {
    const areas = [makeArea('area-a', 'Area A', ['sym:a', 'sym:b'])];
    const nodeSymbols = new Map<string, AnalysisNode>([
      ['sym:a', makeNode('sym:a', 'funcA', 'src/a.ts')],
      ['sym:b', makeNode('sym:b', 'funcB', 'src/b.ts')],
    ]);

    const tree = buildAreaTree(areas, nodeSymbols);
    // Leaf area members are organized by file: src/a.ts, src/b.ts
    const src = tree.children![0].children![0];
    expect(src.name).toBe('src');
    expect(src.children!.map((c) => c.name)).toEqual(['a.ts', 'b.ts']);
    expect(src.children![0].members![0].scipSymbol).toBe('sym:a');
  });

  it('collapses single-child directory chains under a leaf area', () => {
    const areas = [makeArea('area-a', 'Area A', ['sym:a', 'sym:b'])];
    const nodeSymbols = new Map<string, AnalysisNode>([
      ['sym:a', makeNode('sym:a', 'funcA', 'src/lib/deep/a.ts')],
      ['sym:b', makeNode('sym:b', 'funcB', 'src/lib/deep/b.ts')],
    ]);

    const tree = buildAreaTree(areas, nodeSymbols);
    const dir = tree.children![0].children![0];
    expect(dir.name).toBe('src/lib/deep');
    expect(dir.children).toHaveLength(2);
  });

  it('keeps direct members flat on areas that have child areas', () => {
    const areas = [
      makeArea('parent', 'Parent', ['sym:p'], null, ['child']),
      makeArea('child', 'Child', ['sym:c'], 'parent', []),
    ];
    const nodeSymbols = new Map<string, AnalysisNode>([
      ['sym:p', makeNode('sym:p', 'funcP', 'src/p.ts')],
      ['sym:c', makeNode('sym:c', 'funcC', 'src/c.ts')],
    ]);

    const parent = buildAreaTree(areas, nodeSymbols).children![0];
    expect(parent.members).toHaveLength(1);
    expect(parent.children![0].id).toBe('child');
  });

  it('adds an Unassigned section for nodes that belong to no area', () => {
    const areas = [makeArea('area-a', 'Area A', ['sym:a'])];
    const nodeSymbols = new Map<string, AnalysisNode>([
      ['sym:a', makeNode('sym:a', 'funcA', 'src/a.ts')],
      ['sym:x', makeNode('sym:x', 'funcX', 'lib/x.ts')],
    ]);

    const tree = buildAreaTree(areas, nodeSymbols);
    expect(tree.children).toHaveLength(2);
    const unassigned = tree.children![1];
    expect(unassigned.id).toBe(UNASSIGNED_ID);
    expect(unassigned.children![0].name).toBe('lib');
    expect(unassigned.children![0].children![0].members![0].scipSymbol).toBe('sym:x');
  });

  it('omits the Unassigned section when every node is in an area', () => {
    const areas = [makeArea('area-a', 'Area A', ['sym:a'])];
    const nodeSymbols = new Map<string, AnalysisNode>([
      ['sym:a', makeNode('sym:a', 'funcA', 'src/a.ts')],
    ]);

    const tree = buildAreaTree(areas, nodeSymbols);
    expect(tree.children!.some((c) => c.id === UNASSIGNED_ID)).toBe(false);
  });
});

describe('buildFileTree', () => {
  it('builds a directory-tree structure from nodes', () => {
    const nodes = [
      makeNode('sym:a', 'funcA', 'src/utils/a.ts'),
      makeNode('sym:b', 'funcB', 'src/utils/b.ts'),
      makeNode('sym:c', 'funcC', 'src/services/c.ts'),
    ];

    const tree = buildFileTree(nodes);
    expect(tree.children).toHaveLength(1); // "src"
    expect(tree.children![0].children).toHaveLength(2); // "utils", "services"

    const utils = tree.children![0].children!.find((c) => c.name === 'utils')!;
    expect(utils.children).toHaveLength(2); // a.ts, b.ts

    const aFile = utils.children!.find((c) => c.name === 'a.ts')!;
    expect(aFile.members).toHaveLength(1);
    expect(aFile.members![0].scipSymbol).toBe('sym:a');
  });

  it('returns empty root for empty nodes', () => {
    const tree = buildFileTree([]);
    expect(tree.id).toBe('__root__');
    expect(tree.children).toHaveLength(0);
  });
});
