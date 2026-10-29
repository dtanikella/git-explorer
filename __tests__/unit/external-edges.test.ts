import { compactExternalEdges } from '@/app/services/analysis/shared/external-edges';
import { EdgeKind, type AnalysisEdge, type AnalysisResult } from '@/lib/analysis/types';

const edge = (fromSymbol: string, toSymbol: string, isExternal: boolean): AnalysisEdge => ({
  kind: EdgeKind.CALLS, fromFile: 'a.ts', fromName: '', fromSymbol, toText: '', toFile: isExternal ? null : 'a.ts', toName: '',
  toSymbol, isExternal, isAmbiguous: false, edgePosition: { line: 0, col: 0 }, isOptionalChain: false, isAsync: false,
});

describe('compactExternalEdges', () => {
  it('keeps internal edges and counts external ones per source symbol', () => {
    const internal = edge('a', 'b', false);
    const result: AnalysisResult = {
      nodes: [],
      edges: [edge('a', 'npm x', true), internal, edge('a', 'npm y', true), edge('b', 'npm x', true)],
      metadata: { repoPath: '/r', language: 'typescript', nodeCount: 0, edgeCount: 4, analysisDurationMs: 0, missingNodeTypes: [], missingEdgeKinds: [] },
    };

    const compact = compactExternalEdges(result);

    expect(compact.edges).toEqual([internal]);
    expect(compact.metadata.edgeCount).toBe(1);
    expect(compact.metadata.externalEdgeCounts).toEqual({ a: 2, b: 1 });
    expect(result.edges).toHaveLength(4);
  });
});
