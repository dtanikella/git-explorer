import { buildAreaTree, buildFileTree, type TreeNode } from '@/lib/selection/trees';
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
    expect(tree.children![0].members).toHaveLength(2);
    expect(tree.children![0].members![0].scipSymbol).toBe('sym:a');
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