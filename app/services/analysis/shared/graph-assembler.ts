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
 * Assembles extracted nodes and edges into a final {@link AnalysisResult}
 * with computed metadata.
 *
 * @remarks
 * Shared between the TypeScript and Ruby analysis pipelines. Computes
 * duration from `startTime`, counts nodes and edges, and copies over
 * the missing-type sets from the analysis types module.
 *
 * @param input - The nodes, edges, repo path, language, and start timestamp.
 * @returns A complete {@link AnalysisResult} with all metadata.
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