import type { AnalysisResult } from '@/lib/analysis/types';
import type {
  GitAnalysisResult,
  LabelledDeclaration,
  DiffCounts,
  DiffResponse,
} from './types';
import { listChangedTsFiles, type ChangedFile } from './git-diff';
import { buildFileTrees, type ParsedFilePair } from './file-trees';
import { labelModifiedFile, labelAddedFile, labelDeletedFile } from './match';
import { joinDiffToAnalysis, countDiff } from './join';
import { analyzeCommit } from './snapshot';
import { DifftUnavailableError } from './difftastic';

export interface DiffPipelineInput {
  repoPath: string;
  base: string;
  compare: string;
  hideTestFiles?: boolean;
}

/**
 * Run the full diff pipeline: steps 3 through 9.
 *
 * Orchestrates: listing changed TS files with difftastic (step 3), building
 * tree-sitter parse trees (step 4), extracting diff units and mapping spans
 * (step 5), labelling declarations as added/deleted/modified/unchanged
 * (steps 6-7), snapshotting both commits into git worktrees for SCIP
 * analysis (step 8), then joining labels onto graph nodes (step 9).
 *
 * @param input - Pipeline inputs: repoPath, base and compare commit refs,
 *   and whether to exclude test files.
 * @returns A DiffResponse: either success with the enriched graph result,
 *   counts, and unmatched labels, or an error with the appropriate status
 *   code (BAD_REQUEST, BAD_REF, DIFFT_MISSING, DIFFT_TOO_OLD, or
 *   ANALYSIS_FAILED).
 */
export async function runDiffPipeline(
  input: DiffPipelineInput,
): Promise<DiffResponse> {
  const { repoPath, base, compare, hideTestFiles = true } = input;

  if (!repoPath) {
    return {
      success: false,
      state: 'error',
      code: 'BAD_REQUEST',
      error: 'repoPath is required',
    };
  }

  // Step 3: List changed TS files with difftastic
  let changedFiles: ChangedFile[];
  try {
    changedFiles = await listChangedTsFiles(repoPath, base, compare, { hideTestFiles });
  } catch (err: any) {
    if (err instanceof DifftUnavailableError) {
      return {
        success: false,
        state: 'error',
        code: err.code,
        error: err.message,
      };
    }

    // Check for bad ref (git rev-parse failure)
    if (
      err.message?.includes('fatal:') ||
      err.stderr?.includes('fatal:')
    ) {
      return {
        success: false,
        state: 'error',
        code: 'BAD_REF',
        error: `Invalid ref: ${err.stderr || err.message}`,
      };
    }

    return {
      success: false,
      state: 'error',
      code: 'ANALYSIS_FAILED',
      error: err.message || 'Unknown error listing changed files',
    };
  }

  // If no TypeScript files changed, analyze compare only and return no-changes
  if (changedFiles.length === 0) {
    try {
      const headAnalysis = await analyzeCommit(repoPath, compare, { hideTestFiles });
      // All nodes are unchanged
      const allUnchanged = headAnalysis.nodes.map(n => ({
        ...n,
        diffStatus: 'unchanged' as const,
      }));

      const result: GitAnalysisResult = {
        nodes: allUnchanged,
        edges: headAnalysis.edges,
        metadata: { ...headAnalysis.metadata, repoPath },
        base,
        head: compare,
      };

      return {
        success: true,
        state: 'no-changes',
        data: result,
        counts: { added: 0, modified: 0, deleted: 0 },
        changedFiles: 0,
        unmatched: [],
      };
    } catch (err: any) {
      return {
        success: false,
        state: 'error',
        code: 'ANALYSIS_FAILED',
        error: err.message || 'Analysis failed',
      };
    }
  }

  // Step 4: Build file trees
  const filePairs: ParsedFilePair[] = changedFiles.map(buildFileTrees);

  // Step 5-7: Analyze both sides
  let headAnalysis: AnalysisResult;
  let baseAnalysis: AnalysisResult;

  try {
    [headAnalysis, baseAnalysis] = await Promise.all([
      analyzeCommit(repoPath, compare, { hideTestFiles }),
      analyzeCommit(repoPath, base, { hideTestFiles }),
    ]);
  } catch (err: any) {
    return {
      success: false,
      state: 'error',
      code: 'ANALYSIS_FAILED',
      error: err.message || 'Analysis failed',
    };
  }

  // Label each file
  const allLabels: LabelledDeclaration[] = [];

  for (const pair of filePairs) {
    switch (pair.status) {
      case 'added':
        allLabels.push(...labelAddedFile(pair));
        break;
      case 'deleted':
        allLabels.push(...labelDeletedFile(pair));
        break;
      case 'modified': {
        const { labels } = labelModifiedFile(pair);
        allLabels.push(...labels);
        break;
      }
    }
  }

  // Step 9: Join labels to graph nodes
  const { result, unmatched } = joinDiffToAnalysis(
    allLabels,
    headAnalysis,
    baseAnalysis,
    { base, head: compare },
  );

  const counts = countDiff(result);

  return {
    success: true,
    state: 'ok',
    data: result,
    counts,
    changedFiles: changedFiles.length,
    unmatched,
  };
}