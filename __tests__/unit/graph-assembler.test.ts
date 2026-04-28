import { assembleResult } from '@/app/services/analysis/ts/graph-assembler';
import { SyntaxType, EdgeKind, MISSING_NODE_TYPES, MISSING_EDGE_KINDS, type AnalysisNode, type AnalysisEdge } from '@/lib/analysis/types';

describe('assembleResult', () => {
  it('computes metadata from nodes and edges', () => {
    const nodes: AnalysisNode[] = [
      {
        syntaxType: SyntaxType.FUNCTION,
        name: 'add',
        filePath: 'src/utils.ts',
        startLine: 0,
        startCol: 0,
        isAsync: false,
        isExported: true,
        params: [],
        returnTypeText: 'number',
        scipSymbol: 'sym:add',
        isDefinition: true,
        inTestFile: false,
        referencedAt: [],
        outboundRefs: [],
      },
    ];

    const edges: AnalysisEdge[] = [
      {
        kind: EdgeKind.CALLS,
        fromFile: 'src/index.ts',
        fromName: 'main',
        fromSymbol: 'sym:main',
        toText: 'add',
        toFile: 'src/utils.ts',
        toName: 'add',
        toSymbol: 'sym:add',
        isExternal: false,
        edgePosition: { line: 2, col: 2 },
        isOptionalChain: false,
        isAsync: false,
      },
    ];

    const result = assembleResult({
      nodes,
      edges,
      repoPath: '/my/repo',
      language: 'typescript',
      startTime: Date.now() - 100,
    });

    expect(result.nodes).toBe(nodes);
    expect(result.edges).toBe(edges);
    expect(result.metadata.repoPath).toBe('/my/repo');
    expect(result.metadata.language).toBe('typescript');
    expect(result.metadata.nodeCount).toBe(1);
    expect(result.metadata.edgeCount).toBe(1);
    expect(result.metadata.analysisDurationMs).toBeGreaterThanOrEqual(0);
    expect(result.metadata.missingNodeTypes).toEqual(MISSING_NODE_TYPES);
    expect(result.metadata.missingEdgeKinds).toEqual(MISSING_EDGE_KINDS);
  });
});
