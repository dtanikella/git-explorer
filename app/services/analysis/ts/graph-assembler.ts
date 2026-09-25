import {
  MISSING_NODE_TYPES,
  MISSING_EDGE_KINDS,
  type AnalysisNode,
  type AnalysisEdge,
  type AnalysisResult,
} from '@/lib/analysis/types';

export interface AssemblyInput {
  nodes: AnalysisNode[];
  edges: AnalysisEdge[];
  repoPath: string;
  language: string;
  startTime: number;
}

/**
 * Assembles the final {@link AnalysisResult} from extracted nodes,
 * edges, and parsed file metadata.
 *
 * @remarks
 * Combines the node and edge arrays, computes metadata counts (total
 * symbols, files, edge kinds), and returns a complete analysis result
 * ready for consumption by the visualization layer.
 *
 * @param input - The extraction output including nodes, edges, and language info.
 * @returns A complete {@link AnalysisResult} with metadata.
 * @see commit d83512a
 */
export function assembleResult(input: AssemblyInput): AnalysisResult {
  return {
    nodes: input.nodes,
    edges: input.edges,
    metadata: {
      repoPath: input.repoPath,
      language: input.language,
      nodeCount: input.nodes.length,
      edgeCount: input.edges.length,
      analysisDurationMs: Date.now() - input.startTime,
      missingNodeTypes: [...MISSING_NODE_TYPES],
      missingEdgeKinds: [...MISSING_EDGE_KINDS],
    },
  };
}
