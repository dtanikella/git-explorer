import type { AnalysisResult, AnalysisNode } from '@/lib/analysis/types';
import type {
  LabelledDeclaration,
  GitAnalysisNode,
  GitAnalysisResult,
  DiffCounts,
} from './types';
import { DiffStatus } from './types';

/**
 * Join labelled declarations onto graph nodes.
 *
 * Join key: `${filePath}:${startLine}:${startCol}` on the node,
 * `${unit.path}:${unit.namePos.row}:${unit.namePos.column}` on the label.
 *
 * 1. Labels on new units (added, modified, unchanged): look up the key in head;
 *    a hit sets that node's diffStatus, a miss goes to unmatched.
 * 2. Labels on old units with status 'deleted' and absorbedBy null: look up the key in base;
 *    a hit becomes a ghost, a miss goes to unmatched.
 *    Deleted absorbed units, and old units of modified or unchanged pairs, are skipped.
 * 3. Head nodes with no label get 'unchanged'. Ghosts have no edges; head edges are passed through.
 */
export function joinDiffToAnalysis(
  labels: LabelledDeclaration[],
  head: AnalysisResult,
  base: AnalysisResult,
  shas: { base: string; head: string },
): { result: GitAnalysisResult; unmatched: LabelledDeclaration[] } {
  // Build lookup maps: key -> AnalysisNode
  const headLookup = new Map<string, AnalysisNode>();
  for (const node of head.nodes) {
    headLookup.set(makeNodeKey(node), node);
  }

  const baseLookup = new Map<string, AnalysisNode>();
  for (const node of base.nodes) {
    baseLookup.set(makeNodeKey(node), node);
  }

  // Track which head nodes have a label
  const labelledHeadKeys = new Set<string>();
  const unmatched: LabelledDeclaration[] = [];
  const resultNodes: GitAnalysisNode[] = [];

  // Step 1: Labels on new units (added, modified, unchanged)
  for (const label of labels) {
    if (label.unit.side !== 'new') continue;

    const key = makeUnitKey(label.unit);
    const headNode = headLookup.get(key);
    if (headNode) {
      labelledHeadKeys.add(key);
      resultNodes.push({
        ...headNode,
        diffStatus: label.status,
      });
    } else {
      unmatched.push(label);
    }
  }

  // Step 2: Labels on old units with status 'deleted' and not absorbed
  for (const label of labels) {
    if (label.unit.side !== 'old') continue;
    if (label.status !== 'deleted') continue;
    if (label.unit.absorbedBy !== null) continue; // skip absorbed

    const key = makeUnitKey(label.unit);
    const baseNode = baseLookup.get(key);
    if (baseNode) {
      // Ghost node: a deleted declaration from the base analysis
      resultNodes.push({
        ...baseNode,
        diffStatus: 'deleted',
        ghost: true,
        referencedAt: [],
        outboundRefs: [],
      });
    } else {
      unmatched.push(label);
    }
  }

  // Step 3: Head nodes with no label get 'unchanged'
  for (const node of head.nodes) {
    const key = makeNodeKey(node);
    if (!labelledHeadKeys.has(key)) {
      // Check if this node was already added as a labelled node
      const alreadyAdded = resultNodes.find(
        (rn) => makeNodeKey(rn as AnalysisNode) === key,
      );
      if (!alreadyAdded) {
        resultNodes.push({
          ...node,
          diffStatus: 'unchanged' as DiffStatus,
        });
      }
    }
  }

  return {
    result: {
      nodes: resultNodes,
      edges: head.edges,
      metadata: head.metadata,
      base: shas.base,
      head: shas.head,
    },
    unmatched,
  };
}

/**
 * Count result nodes by diffStatus. Ghosts count as deleted.
 */
export function countDiff(result: GitAnalysisResult): DiffCounts {
  let added = 0;
  let modified = 0;
  let deleted = 0;

  for (const node of result.nodes) {
    switch (node.diffStatus) {
      case 'added':
        added++;
        break;
      case 'modified':
        modified++;
        break;
      case 'deleted':
        deleted++;
        break;
      // unchanged is not counted
    }
  }

  return { added, modified, deleted };
}

function makeNodeKey(node: { filePath: string; startLine: number; startCol: number }): string {
  return `${node.filePath}:${node.startLine}:${node.startCol}`;
}

function makeUnitKey(unit: { path: string; namePos: { row: number; column: number } }): string {
  return `${unit.path}:${unit.namePos.row}:${unit.namePos.column}`;
}