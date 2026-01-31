import React from 'react';
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
  const root = hierarchy(data)
    .sum(sizingStrategy)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  return (
    <Pack root={root} size={[width, height]} padding={2}>
      {(packData) => (
        <svg width={width} height={height}>
          {packData.descendants().map((node, index) => (
            <CircleNode
              key={node.data.path}
              node={node}
              fill={coloringStrategy(node.data)}
              onMouseEnter={(e) => showTooltip?.({
                tooltipData: node.data,
                tooltipLeft: e.clientX,
                tooltipTop: e.clientY,
              })}
              onMouseLeave={() => hideTooltip?.()}
              onClick={() => onClick?.(node)}
            />
          ))}
        </svg>
      )}
    </Pack>
  );
};