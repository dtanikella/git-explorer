import { TreeNode } from '../git/types';
import { frequencyToColor } from './color-scale';
import { SimulationNodeDatum } from 'd3-force';
import { getFileTypeColor } from './file-type-colors';

// Simple square root scale implementation
function scaleSqrt() {
  let domain: [number, number] = [0, 1];
  let range: [number, number] = [0, 1];

  const scale = (value: number) => {
    const sqrtValue = Math.sqrt(value);
    const sqrtMin = Math.sqrt(domain[0]);
    const sqrtMax = Math.sqrt(domain[1]);
    if (sqrtMax === sqrtMin) {
      // All values same, return midpoint
      return (range[0] + range[1]) / 2;
    }
    const normalized = (sqrtValue - sqrtMin) / (sqrtMax - sqrtMin);
    return normalized * (range[1] - range[0]) + range[0];
  };

  scale.domain = (d: [number, number]) => {
    domain = d;
    return scale;
  };

  scale.range = (r: [number, number]) => {
    range = r;
    return scale;
  };

  return scale;
}

/**
 * Represents a file node in the force-directed graph.
 * Extends d3-force's SimulationNodeDatum with application-specific properties.
 */
export interface GraphNode extends SimulationNodeDatum {
  /** Unique identifier (file path) */
  id: string;

  /** Full file path from repository root */
  filePath: string;

  /** Display name (last segment of path) */
  fileName: string;

  /** Number of commits in selected time range */
  commitCount: number;

  /** Calculated bubble radius in pixels [8, 40] */
  radius: number;

  /** Hex color based on file type */
  color: string;
}

export function applyColors(tree: TreeNode): TreeNode {
  function traverse(node: TreeNode): void {
    if (node.isFile && node.fileData) {
      node.color = frequencyToColor(node.fileData.frequencyScore);
    }

    if (node.children) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  const result = { ...tree }; // Shallow copy
  traverse(result);
  return result;
}

/**
 * Transforms hierarchical TreeNode structure to flat array of file nodes
 * for force-directed graph visualization.
 *
 * - Extracts only leaf nodes (files with fileData)
 * - Calculates bubble radius using square root scale
 * - Applies file type coloring
 * - Returns empty array if no files found
 *
 * @param tree - Root TreeNode from git-analysis API
 * @returns Array of GraphNode objects ready for d3.forceSimulation
 *
 * @example
 * const tree = await fetchGitAnalysis(repoPath, timeRange);
 * const nodes = transformTreeToGraph(tree);
 * const simulation = d3.forceSimulation(nodes);
 */
export function transformTreeToGraph(tree: TreeNode): GraphNode[] {
  // 1. Traverse tree to find all leaf nodes (files)
  const files: TreeNode[] = [];
  function extractLeafNodes(node: TreeNode): void {
    if (node.isFile && node.fileData) {
      files.push(node);
    }
    if (node.children) {
      for (const child of node.children) {
        extractLeafNodes(child);
      }
    }
  }
  extractLeafNodes(tree);

  if (files.length === 0) {
    return [];
  }

  // 2. Determine min/max commit counts for scaling
  const commitCounts = files.map(f => f.fileData!.totalCommitCount);
  const minCommits = Math.min(...commitCounts);
  const maxCommits = Math.max(...commitCounts);

  // 3. Create square root scale for bubble radius
  const radiusScale = scaleSqrt()
    .domain([minCommits, maxCommits])
    .range([8, 40]);

  // 4. Map to GraphNode objects
  return files.map(file => ({
    id: file.path,
    filePath: file.path,
    fileName: file.name,
    commitCount: file.fileData!.totalCommitCount,
    radius: radiusScale(file.fileData!.totalCommitCount),
    color: getFileTypeColor(file.path)
  }));
}