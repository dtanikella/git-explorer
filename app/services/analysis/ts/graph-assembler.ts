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
