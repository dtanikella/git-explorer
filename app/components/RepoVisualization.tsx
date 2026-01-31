import React from 'react';
import { useTooltip, TooltipWithBounds } from '@visx/tooltip';
import { FileTree, SizingStrategy, ColoringStrategy } from '../../lib/types';
import { CirclePackingChart } from './CirclePackingChart';
import { Tooltip } from './Tooltip';

interface RepoVisualizationProps {
  data: FileTree;
  sizingStrategy: SizingStrategy;
  coloringStrategy: ColoringStrategy;
}

export const RepoVisualization: React.FC<RepoVisualizationProps> = ({
  data,
  sizingStrategy,
  coloringStrategy,
}) => {
  const {
    tooltipOpen,
    tooltipLeft,
    tooltipTop,
    tooltipData,
    showTooltip,
    hideTooltip,
  } = useTooltip<FileTree>();

  return (
    <div style={{ width: '100%', height: '70vh', border: '1px solid #ccc' }}>
      <CirclePackingChart
        data={data}
        width={800} // Will be overridden by responsive
        height={600}
        sizingStrategy={sizingStrategy}
        coloringStrategy={coloringStrategy}
        showTooltip={showTooltip}
        hideTooltip={hideTooltip}
      />
      {tooltipOpen && tooltipData && (
        <TooltipWithBounds left={tooltipLeft} top={tooltipTop}>
          <Tooltip node={tooltipData} rootPath={data.path} />
        </TooltipWithBounds>
      )}
    </div>
  );
};