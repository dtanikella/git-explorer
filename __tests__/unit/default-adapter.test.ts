import { buildHierarchy } from '@/lib/default/adapter';
import { SyntaxType } from '@/lib/analysis/types';
import type { AnalysisNode, AnalysisResult } from '@/lib/analysis/types';
import type { GitAnalysisNode } from '@/lib/diff/types';
import type { HierarchyNode } from '@/lib/default/types';

const node = (over: Partial<AnalysisNode>): AnalysisNode => ({
  syntaxType: SyntaxType.FUNCTION,
  name: 'f',
  filePath: 'a.ts',
  startLine: 0,
  startCol: 0,
  isAsync: false,
  isExported: true,
  params: [],
  returnTypeText: null,
  scipSymbol: 'pkg a.ts/f().',
  isDefinition: true,
  inTestFile: false,
  referencedAt: [],
  outboundRefs: [],
  ...over,
});

const result = (nodes: AnalysisNode[]): AnalysisResult => ({
  nodes,
  edges: [],
  metadata: { repoPath: '/r', language: 'typescript', nodeCount: nodes.length, edgeCount: 0, analysisDurationMs: 0, missingNodeTypes: [], missingEdgeKinds: [] },
});

const flatten = (n: HierarchyNode): HierarchyNode[] => [n, ...n.children.flatMap(flatten)];

describe('buildHierarchy', () => {
  it('builds root > folder > file > symbol with depths', () => {
    const root = buildHierarchy(result([node({ filePath: 'lib/x/a.ts', name: 'f', scipSymbol: 's1' })]), 'repo');
    expect(root).toMatchObject({ tier: 'root', name: 'repo', depth: 0 });
    const lib = root.children[0];
    const x = lib.children[0];
    const file = x.children[0];
    const sym = file.children[0];
    expect([lib, x, file, sym].map((n) => [n.tier, n.name, n.depth])).toEqual([
      ['folder', 'lib', 1],
      ['folder', 'x', 2],
      ['file', 'a.ts', 3],
      ['symbol', 'f', 4],
    ]);
    expect(sym.symbol?.syntaxType).toBe(SyntaxType.FUNCTION);
  });

  it('puts a root-level file directly under the root', () => {
    const root = buildHierarchy(result([node({ filePath: 'next.config.ts', scipSymbol: 's1' })]));
    expect(root.children[0]).toMatchObject({ tier: 'file', depth: 1 });
  });

  it('drops local symbols and member, decorator kinds', () => {
    const nodes = [
      node({ scipSymbol: 'keep' }),
      node({ scipSymbol: 'a.ts#local 2' }),
      ...[SyntaxType.METHOD, SyntaxType.GETTER, SyntaxType.SETTER, SyntaxType.CONSTRUCTOR, SyntaxType.DECORATOR].map((syntaxType, i) =>
        node({ syntaxType, scipSymbol: `m${i}` }),
      ),
    ];
    const symbols = flatten(buildHierarchy(result(nodes))).filter((n) => n.tier === 'symbol');
    expect(symbols.map((s) => s.id)).toEqual(['keep']);
  });

  it('shows a symbol once when its scipSymbol repeats', () => {
    const symbols = flatten(buildHierarchy(result([node({ scipSymbol: 'dup' }), node({ scipSymbol: 'dup', filePath: 'b.ts' })]))).filter((n) => n.tier === 'symbol');
    expect(symbols).toHaveLength(1);
    expect(symbols[0].path).toBe('a.ts');
  });

  it('gives a file with only filtered symbols no node', () => {
    const root = buildHierarchy(result([node({ filePath: 'only-members.ts', syntaxType: SyntaxType.METHOD, scipSymbol: 'm' }), node({ filePath: 'ok.ts', scipSymbol: 'k' })]));
    expect(root.children.map((c) => c.name)).toEqual(['ok.ts']);
  });

  it('puts subfolders before files in every folder, keeping first-seen order within each', () => {
    const root = buildHierarchy(result([
      node({ filePath: 'lib/z.ts', scipSymbol: '1' }),
      node({ filePath: 'lib/b/x.ts', scipSymbol: '2' }),
      node({ filePath: 'lib/a.ts', scipSymbol: '3' }),
      node({ filePath: 'lib/c/y.ts', scipSymbol: '4' }),
      node({ filePath: 'top.ts', scipSymbol: '5' }),
      node({ filePath: 'app/m.ts', scipSymbol: '6' }),
    ]));
    expect(root.children.map((c) => c.name)).toEqual(['lib', 'app', 'top.ts']);
    expect(root.children[0].children.map((c) => c.name)).toEqual(['b', 'c', 'z.ts', 'a.ts']);
  });

  it('returns a lone root for an empty result', () => {
    expect(buildHierarchy(result([]))).toMatchObject({ tier: 'root', children: [] });
  });

  it('carries diffStatus and ghost from a diff result onto symbols, ghosts included', () => {
    const diffNode = (over: Partial<GitAnalysisNode>) => ({ ...node({}), diffStatus: 'unchanged', ...over }) as GitAnalysisNode;
    const root = buildHierarchy(result([
      diffNode({ scipSymbol: 'a', name: 'a', diffStatus: 'added' }),
      diffNode({ scipSymbol: 'g', name: 'g', diffStatus: 'deleted', ghost: true }),
      diffNode({ scipSymbol: 'u', name: 'u' }),
    ]));
    const by = Object.fromEntries(flatten(root).filter((n) => n.tier === 'symbol').map((n) => [n.name, n]));
    expect([by.a.diffStatus, by.a.ghost]).toEqual(['added', undefined]);
    expect([by.g.diffStatus, by.g.ghost]).toEqual(['deleted', true]);
    expect(by.u.diffStatus).toBe('unchanged');
  });

  it('leaves diff fields off the symbols of a plain analysis result', () => {
    const root = buildHierarchy(result([node({ scipSymbol: 's1' })]));
    const sym = flatten(root).find((n) => n.tier === 'symbol')!;
    expect('diffStatus' in sym).toBe(false);
    expect('ghost' in sym).toBe(false);
  });
});
