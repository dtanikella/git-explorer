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
  /** For directory and file nodes: the repo-relative path, used to key per-row expansions. */
  path?: string;
}

/** Id of the synthetic root-level section holding nodes that belong to no area. */
export const UNASSIGNED_ID = '__unassigned__';

// --- Area Tree ---

/**
 * Builds a hierarchical tree from a flat area list.
 *
 * @remarks
 * Nodes directly under a leaf area are organized by file structure (see
 * {@link buildFileNodes}). Nodes in `nodeSymbols` that no area contains are
 * gathered in a trailing {@link UNASSIGNED_ID} section, organized the same way.
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

    // A leaf area's nodes are organized by file structure instead of a flat list
    if (children.length === 0) {
      const fileChildren = buildFileNodes(members, `${area.id}:`, true);
      return {
        id: area.id,
        name: area.name,
        areaId: area.id,
        children: fileChildren.length > 0 ? fileChildren : undefined,
      };
    }

    return {
      id: area.id,
      name: area.name,
      areaId: area.id,
      members: members.length > 0 ? members : undefined,
      children,
    };
  }

  const topLevel = areas
    .filter((a) => a.parent === null)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(buildNode);

  const assigned = new Set<string>();
  for (const area of areas) {
    for (const sym of area.contains) assigned.add(sym);
  }
  const unassigned = [...nodeSymbols.values()].filter((n) => !assigned.has(n.scipSymbol));
  if (unassigned.length > 0) {
    topLevel.push({
      id: UNASSIGNED_ID,
      name: 'Unassigned',
      children: buildFileNodes(unassigned, `${UNASSIGNED_ID}:`, true),
    });
  }

  const root: TreeNode = {
    id: '__root__',
    name: 'Areas',
    children: topLevel,
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
