import type { SyntaxType } from '@/lib/analysis/types';
import type { AnalysisNode, AnalysisResult } from '@/lib/analysis/types';

// ============================================================================
// Basic statuses
// ============================================================================

export type DiffStatus = 'added' | 'deleted' | 'modified' | 'unchanged';

// ============================================================================
// Position (tree-sitter coordinates: UTF-16 code units)
// ============================================================================

/** A tree-sitter point: 0-indexed row, column in UTF-16 code units. */
export type Pos = { row: number; column: number };

// ============================================================================
// Diff units (from step 5)
// ============================================================================

/** One declaration on one side of a diff, at the same granularity as a graph node. */
export interface DiffUnit {
  side: 'old' | 'new';
  path: string;                // repo-relative
  index: number;               // position of this unit in its side's list, in source order
  kind: SyntaxType;            // classified exactly as node-extractor does
  name: string;
  qualifiedName: string;       // names of enclosing non-absorbed units and this one, joined with '.'
  namePos: Pos;                // start of the name identifier; equals AnalysisNode startLine/startCol
  start: Pos;                  // declaration range start; widened to the export_statement when the parent is one
  end: Pos;                    // declaration range end
  parentIndex: number | null;  // enclosing non-absorbed unit
  absorbedBy: number | null;   // enclosing function-like unit whose body contains this one, or null
}

// ============================================================================
// Mapped spans (from step 5)
// ============================================================================

/** A difftastic change resolved to a position on one side. */
export interface MappedSpan {
  side: 'old' | 'new';
  row: number;
  startCol: number;            // UTF-16, converted from difftastic's byte column
  endCol: number;              // UTF-16
  unitIndex: number | null;    // innermost non-absorbed unit containing the start, or null when unmapped
}

// ============================================================================
// Labelled declarations (from steps 6 & 7)
// ============================================================================

/** A unit with its final label; the output of steps 6 and 7 and the input to step 9. */
export interface LabelledDeclaration {
  unit: DiffUnit;
  status: DiffStatus;
}

// ============================================================================
// Diff result types (from step 9)
// ============================================================================

export interface GitAnalysisNode extends AnalysisNode {
  diffStatus: DiffStatus;
  ghost?: boolean;             // true for deleted nodes taken from the base analysis
}

export interface GitAnalysisResult extends Omit<AnalysisResult, 'nodes'> {
  nodes: GitAnalysisNode[];    // head nodes plus ghosts; edges and metadata are the head analysis's
  base: string;                // commit sha
  head: string;                // commit sha
}

export interface DiffCounts {
  added: number;
  modified: number;
  deleted: number;
}

// ============================================================================
// API types (from step 10)
// ============================================================================

/** GET /api/git-refs?repoPath=<abs path>[&sha=<pasted sha>] */
export type GitRefsResponse =
  | {
    success: true;
    data: {
      branches: string[];
      tags: string[];
      defaultBranch: string | null;
      currentBranch: string | null;
      sha?: { input: string; valid: boolean; resolved: string | null };
    };
  }
  | { success: false; error: string };

/** POST /api/diff body */
export interface DiffRequest {
  repoPath: string;
  base: string;
  compare: string;
  hideTestFiles?: boolean;
}

export type DiffErrorCode =
  | 'BAD_REQUEST'
  | 'BAD_REF'
  | 'DIFFT_MISSING'
  | 'DIFFT_TOO_OLD'
  | 'ANALYSIS_FAILED';

export type DiffResponse =
  | {
    success: true;
    state: 'ok' | 'no-changes';
    data: GitAnalysisResult;
    counts: DiffCounts;
    changedFiles: number;
    unmatched: LabelledDeclaration[];
  }
  | { success: false; state: 'error'; code: DiffErrorCode; error: string };