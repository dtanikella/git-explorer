/**
 * Tree-building utilities for the shared selection sidebar.
 *
 * @remarks
 * Converts flat node lists into hierarchical tree
 * structures for rendering as nested checkable items.
 *
 * @see `SelectionTree` component for the consumer.
 */

import type { AnalysisNode } from '@/lib/analysis/types';

// --- Types ---

export interface TreeNode {
  id: string;
  name: string;
  children?: TreeNode[];
  members?: AnalysisNode[];
  /** For file nodes: the file path. */
  filePath?: string;
  /** For directory and file nodes: the repo-relative path, used to key per-row expansions. */
  path?: string;
}

// --- File Tree ---

/**
 * Builds a file-system directory tree from a list of analysis nodes.
 *
 * @param nodes - The analysis nodes to organize.
 * @returns A root {@link TreeNode} with a directory hierarchy.
 */
export function buildFileTree(nodes: AnalysisNode[]): TreeNode {
  return {
    id: '__root__',
    name: 'Files',
    children: buildFileNodes(nodes, '', false),
  };
}

/**
 * Organizes analysis nodes into directory and file {@link TreeNode}s.
 *
 * @remarks
 * Ids are path-qualified so the same directory name in different branches
 * stays distinct; `idPrefix` scopes them when several trees share one
 * expansion set.
 *
 * @param nodes - The analysis nodes to organize.
 * @param idPrefix - Prefix for every generated id.
 * @param compact - Collapse chains of single-child directories into `a/b/c`.
 */
export function buildFileNodes(nodes: AnalysisNode[], idPrefix: string, compact: boolean): TreeNode[] {
  interface DirNode {
    dirs: Map<string, DirNode>;
    files: Map<string, AnalysisNode[]>;
  }

  const root: DirNode = { dirs: new Map(), files: new Map() };

  for (const node of nodes) {
    const parts = node.filePath.split('/').filter(Boolean);
    const fileName = parts.pop() ?? node.filePath;
    let dir = root;
    for (const part of parts) {
      if (!dir.dirs.has(part)) dir.dirs.set(part, { dirs: new Map(), files: new Map() });
      dir = dir.dirs.get(part)!;
    }
    if (!dir.files.has(fileName)) dir.files.set(fileName, []);
    dir.files.get(fileName)!.push(node);
  }

  function dirToTree(dir: DirNode, parentPath: string): TreeNode[] {
    const result: TreeNode[] = [];
    for (const [dirName, child] of [...dir.dirs.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      let name = dirName;
      let path = parentPath ? `${parentPath}/${dirName}` : dirName;
      let current = child;
      while (compact && current.files.size === 0 && current.dirs.size === 1) {
        const [[nextName, next]] = [...current.dirs.entries()];
        name += `/${nextName}`;
        path += `/${nextName}`;
        current = next;
      }
      result.push({
        id: `${idPrefix}dir:${path}`,
        name,
        path,
        children: dirToTree(current, path),
      });
    }
    for (const [fileName, fileNodes] of [...dir.files.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const filePath = parentPath ? `${parentPath}/${fileName}` : fileName;
      result.push({
        id: `${idPrefix}file:${filePath}`,
        name: fileName,
        path: filePath,
        filePath: fileNodes[0].filePath,
        members: fileNodes,
      });
    }
    return result;
  }

  return dirToTree(root, '');
}
