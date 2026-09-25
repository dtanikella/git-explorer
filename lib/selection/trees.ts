/**
 * Tree-building utilities for the shared selection sidebar.
 *
 * @remarks
 * Converts flat area lists and node lists into hierarchical tree
 * structures for rendering as nested checkable items.
 *
 * @see `SelectionTree` component for the consumer.
 */

import type { AnalysisNode } from '@/lib/analysis/types';
import type { Area } from '@/lib/areas/types';

// --- Types ---

export interface TreeNode {
  id: string;
  name: string;
  children?: TreeNode[];
  members?: AnalysisNode[];
  /** For area nodes: the area id for lookups. */
  areaId?: string;
  /** For file nodes: the file path. */
  filePath?: string;
}

// --- Area Tree ---

/**
 * Builds a hierarchical tree from a flat area list.
 *
 * @param areas - All area definitions.
 * @param nodeSymbols - A map from scipSymbol to AnalysisNode for member resolution.
 * @returns A root {@link TreeNode} whose children are top-level areas.
 */
export function buildAreaTree(
  areas: Area[],
  nodeSymbols: Map<string, AnalysisNode>,
): TreeNode {
  const areaById = new Map(areas.map((a) => [a.id, a]));

  function buildNode(area: Area): TreeNode {
    const members: AnalysisNode[] = [];
    for (const sym of area.contains) {
      const node = nodeSymbols.get(sym);
      if (node) members.push(node);
    }

    const children: TreeNode[] = [];
    for (const childId of area.children) {
      const child = areaById.get(childId);
      if (child) children.push(buildNode(child));
    }

    return {
      id: area.id,
      name: area.name,
      areaId: area.id,
      members: members.length > 0 ? members : undefined,
      children: children.length > 0 ? children : undefined,
    };
  }

  const topLevel = areas
    .filter((a) => a.parent === null)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(buildNode);

  const root: TreeNode = {
    id: '__root__',
    name: 'Areas',
    children: topLevel.length > 0 ? topLevel : [],
  };

  return root;
}

// --- File Tree ---

/**
 * Builds a file-system directory tree from a list of analysis nodes.
 *
 * @param nodes - The analysis nodes to organize.
 * @returns A root {@link TreeNode} with a directory hierarchy.
 */
export function buildFileTree(nodes: AnalysisNode[]): TreeNode {
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

  function dirToTree(dir: DirNode): TreeNode[] {
    const result: TreeNode[] = [];
    for (const [name, child] of [...dir.dirs.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      result.push({
        id: `dir:${name}`,
        name,
        children: dirToTree(child),
      });
    }
    for (const [fileName, fileNodes] of [...dir.files.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      result.push({
        id: `file:${fileName}`,
        name: fileName,
        filePath: fileNodes[0].filePath,
        members: fileNodes,
      });
    }
    return result;
  }

  return {
    id: '__root__',
    name: 'Files',
    children: dirToTree(root),
  };
}