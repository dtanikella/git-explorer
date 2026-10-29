import type { DiffCounts } from '@/lib/diff/types';
import type { HierarchyNode } from './types';

/** Changed symbols of one file, by status, plus their total. */
export interface FileRollup extends DiffCounts {
  changed: number;
}

/** What diff mode needs to know about the changes in a hierarchy, found in one pass. */
export interface DiffRollups {
  /** per file id; only files with at least one changed symbol */
  byFile: Map<string, FileRollup>;
  /** ids of every file and folder with a changed symbol beneath it */
  changedIds: Set<string>;
  /** changed symbols in the whole hierarchy */
  changed: number;
}

/**
 * Counts the added, modified and deleted symbols of each file in one walk of the hierarchy.
 *
 * @remarks
 * A symbol with no `diffStatus` or an `unchanged` one counts for nothing. Ghosts count as deleted, because the
 * adapter gives them that status. Pure: the result is the same for the same hierarchy, so it can be memoised on it.
 *
 * @param root - A hierarchy built from a diff result.
 */
export function rollupDiff(root: HierarchyNode): DiffRollups {
  const byFile = new Map<string, FileRollup>();
  const changedIds = new Set<string>();
  const walk = (node: HierarchyNode): number => {
    if (node.tier === 'symbol') return node.diffStatus && node.diffStatus !== 'unchanged' ? 1 : 0;
    let below = 0;
    for (const child of node.children) below += walk(child);
    if (node.tier === 'file' && below > 0) {
      const counts: FileRollup = { added: 0, modified: 0, deleted: 0, changed: below };
      for (const child of node.children) {
        const s = child.diffStatus;
        if (s === 'added' || s === 'modified' || s === 'deleted') counts[s]++;
      }
      byFile.set(node.id, counts);
    }
    if (below > 0) changedIds.add(node.id);
    return below;
  };
  const changed = walk(root);
  return { byFile, changedIds, changed };
}
