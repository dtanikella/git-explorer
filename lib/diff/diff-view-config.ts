import type { GitAnalysisNode } from '@/lib/diff/types';
import type { Area } from '@/lib/areas/types';
import type { RepoGraphConfig, NodeStyler } from '@/lib/analysis/graph-config';
import { DEFAULT_REPO_GRAPH_CONFIG, mergeConfigs } from '@/lib/analysis/graph-config';

/**
 * Desaturate a hex color toward its own luminance gray by the given factor (0–1).
 * At saturation 1 the color is unchanged; at 0 it becomes the gray of equal luminance.
 */
export function saturate(hex: string, saturation: number): string {
  if (saturation >= 1) return hex;

  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  const gray = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);

  const nr = Math.round(gray + (r - gray) * saturation);
  const ng = Math.round(gray + (g - gray) * saturation);
  const nb = Math.round(gray + (b - gray) * saturation);

  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
}

const DIFF_STATUS_COLORS: Record<string, string> = {
  added: '#22a559',
  modified: '#3b82f6',
  deleted: '#e5484d',
};

/**
 * Build an area color map: scipSymbol → area color.
 */
function buildAreaColorMap(nodes: GitAnalysisNode[], areas: Area[]): Map<string, string> {
  const areaColorMap = new Map<string, string>();
  for (const area of areas) {
    if (area.color) {
      for (const symbol of area.contains) {
        areaColorMap.set(symbol, area.color);
      }
    }
  }
  return areaColorMap;
}

/**
 * Create a diff view config that wraps the node styler.
 * Follows the closure pattern of createDataFlowViewConfig.
 */
export function createDiffViewConfig(
  nodes: GitAnalysisNode[],
  areas: Area[],
): RepoGraphConfig {
  const areaColorMap = buildAreaColorMap(nodes, areas);

  const nodeStyler: NodeStyler = (node, _degree) => {
    // Default style for non-GitAnalysisNode or when diffStatus is missing
    const diffNode = node as unknown as Partial<GitAnalysisNode>;
    const status = diffNode.diffStatus;

    if (!status) {
      return { color: '#6b7280', radius: 6, opacity: 1, label: false };
    }

    const inArea = areaColorMap.get(node.scipSymbol);

    switch (status) {
      case 'added':
        return {
          color: inArea || DIFF_STATUS_COLORS.added,
          radius: 8,
          opacity: 1,
          saturation: 1,
          ghostRing: false,
          label: false,
        };
      case 'modified':
        return {
          color: inArea || DIFF_STATUS_COLORS.modified,
          radius: 8,
          opacity: 1,
          saturation: 1,
          ghostRing: false,
          label: false,
        };
      case 'deleted':
        return {
          color: inArea || DIFF_STATUS_COLORS.deleted,
          radius: 8,
          opacity: 1,
          saturation: 1,
          // Ghost ring on loose (not in area) deleted nodes
          ghostRing: !inArea && !!(diffNode as Record<string, unknown>).ghost,
          label: false,
        };
      case 'unchanged':
      default:
        return {
          color: inArea ? inArea : '#6b7280',
          radius: 6,
          opacity: 0.75,
          saturation: 0.5,
          ghostRing: false,
          label: false,
        };
    }
  };

  return mergeConfigs(DEFAULT_REPO_GRAPH_CONFIG, {
    filters: {
      node: () => true,
      edge: () => true,
    },
    style: {
      node: nodeStyler,
    },
  });
}