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

  // T040: Extract stable event handlers to prevent CircleNode re-renders
  // These useCallback hooks ensure the same function references are passed down
  const handleMouseEnter = useCallback((node: any, e: React.MouseEvent<SVGCircleElement>) => {
    showTooltip?.({
      tooltipData: node.data,
      tooltipLeft: e.clientX,
      tooltipTop: e.clientY,
    });
  }, [showTooltip]);

  const handleMouseLeave = useCallback(() => {
    hideTooltip?.();
  }, [hideTooltip]);

  const handleClick = useCallback((node: any) => {
    onClick?.(node);
  }, [onClick]);

  return (
    <Pack root={root} size={[width, height]} padding={2}>
      {(packData) => (
        <g>
          {packData.descendants().map((node, index) => (
            <CircleNode
              key={node.data.path}
              node={node}
              fill={colorMap.get(node.data.path) || '#ccc'}
              onMouseEnter={(e) => handleMouseEnter(node, e)}
              onMouseLeave={handleMouseLeave}
              onClick={() => handleClick(node)}
            />
          ))}
        </g>
      )}
    </Pack>
  );
};