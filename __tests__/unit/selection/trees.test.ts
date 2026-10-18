import { buildFileNodes, buildFileTree, type TreeNode } from '@/lib/selection/trees';
import type { AnalysisNode } from '@/lib/analysis/types';
import { SyntaxType } from '@/lib/analysis/types';

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

describe('buildFileNodes', () => {
  it('collapses single-child directory chains when compact', () => {
    const nodes = [
      makeNode('sym:a', 'funcA', 'src/lib/deep/a.ts'),
      makeNode('sym:b', 'funcB', 'src/lib/deep/b.ts'),
    ];
    const [dir] = buildFileNodes(nodes, '', true);
    expect(dir.name).toBe('src/lib/deep');
    expect(dir.children).toHaveLength(2);
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
