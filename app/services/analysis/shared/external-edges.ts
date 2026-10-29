import type { AnalysisEdge, AnalysisResult } from '@/lib/analysis/types';

/**
 * Drops external edges from a result, keeping only how many each source symbol had.
 *
 * @remarks
 * Most references point into libraries, so external edges are the bulk of the payload, yet no view draws them:
 * the default view only reports how many a symbol has ("external / unresolved"). The counts go into
 * `metadata.externalEdgeCounts`, keyed by `fromSymbol`, and `metadata.edgeCount` is updated to match `edges`.
 *
 * @param result - A full analysis result.
 * @returns A new result with internal edges only.
 */
export function compactExternalEdges(result: AnalysisResult): AnalysisResult {
  const edges: AnalysisEdge[] = [];
  const externalEdgeCounts: Record<string, number> = {};
  for (const edge of result.edges) {
    if (edge.isExternal) {
      externalEdgeCounts[edge.fromSymbol] = (externalEdgeCounts[edge.fromSymbol] ?? 0) + 1;
    } else {
      edges.push(edge);
    }
  }
  return {
    ...result,
    edges,
    metadata: { ...result.metadata, edgeCount: edges.length, externalEdgeCounts },
  };
}
