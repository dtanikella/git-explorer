import React, { useMemo, useCallback } from 'react';
import { Pack, hierarchy } from '@visx/hierarchy';
import { FileTree, SizingStrategy, ColoringStrategy } from '../../lib/types';
import { CircleNode } from './CircleNode';

interface CirclePackingChartProps {
  data: FileTree;
  width: number;
  height: number;
  sizingStrategy: SizingStrategy;
  coloringStrategy: ColoringStrategy;
  showTooltip?: (args: { tooltipData: any; tooltipLeft: number; tooltipTop: number }) => void;
  hideTooltip?: () => void;
  onClick?: (node: any) => void;
}

export const CirclePackingChart: React.FC<CirclePackingChartProps> = ({
  data,
  width,
  height,
  sizingStrategy,
  coloringStrategy,
  showTooltip,
  hideTooltip,
  onClick,
}) => {
  // T038: Memoize hierarchy computation to avoid recalculating on every render
  // This is O(n log n) operation, cached until data or sizingStrategy changes
  const root = useMemo(() =>
    hierarchy(data)
      .sum(sizingStrategy)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0)),
    [data, sizingStrategy]
  );

  // T039: Pre-compute color map for all nodes to avoid calling coloringStrategy
  // on every render. This builds a Map<path, color> once per data/coloringStrategy change
  const colorMap = useMemo(() => {
    const map = new Map<string, string>();
    const traverse = (node: FileTree) => {
      map.set(node.path, coloringStrategy(node));
      if (node.children) {
        node.children.forEach(traverse);
      }
    };
    traverse(data);
    return map;
  }, [data, coloringStrategy]);

  // Create node map for event delegation lookup
  const nodeMap = useMemo(() => {
    const map = new Map();
    const traverse = (node: any) => {
      map.set(node.data.path, node);
      if (node.children) {
        node.children.forEach((child: any) => traverse(child));
      }
    };
    traverse(root);
    return map;
  }, [root]);

  // Event delegation handlers
  const lastHoveredPath = React.useRef<string | null>(null);

  const handleGroupMouseMove = useCallback((e: React.MouseEvent<SVGGElement>) => {
    const target = e.target as SVGElement;
    if (target.tagName === 'circle') {
      const nodePath = target.getAttribute('data-node-path');
      if (nodePath && nodePath !== lastHoveredPath.current) {
        const node = nodeMap.get(nodePath);
        if (node) {
          lastHoveredPath.current = nodePath;
          showTooltip?.({
            tooltipData: node.data,
            tooltipLeft: e.clientX,
            tooltipTop: e.clientY,
          });
        }
      }
    }
  }, [nodeMap, showTooltip]);

  const handleGroupMouseLeave = useCallback(() => {
    lastHoveredPath.current = null;
    hideTooltip?.();
  }, [hideTooltip]);

  const handleGroupClick = useCallback((e: React.MouseEvent<SVGGElement>) => {
    const target = e.target as SVGElement;
    if (target.tagName === 'circle') {
      const nodePath = target.getAttribute('data-node-path');
      if (nodePath) {
        const node = nodeMap.get(nodePath);
        if (node) {
          onClick?.(node);
        }
      }
    }
  }, [nodeMap, onClick]);

  return (
    <Pack root={root} size={[width, height]} padding={2}>
      {(packData) => (
        <g 
          onMouseMove={handleGroupMouseMove}
          onMouseLeave={handleGroupMouseLeave}
          onClick={handleGroupClick}
        >
          {packData.descendants().map((node, index) => (
            <CircleNode
              key={node.data.path}
              node={node}
              fill={colorMap.get(node.data.path) || '#ccc'}
            />
          ))}
        </g>
      )}
    </Pack>
  );
};