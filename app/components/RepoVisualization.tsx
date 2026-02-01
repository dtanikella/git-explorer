import React from 'react';
import { useTooltip, TooltipWithBounds } from '@visx/tooltip';
import { Zoom } from '@visx/zoom';
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

  const width = 800;
  const height = 600;

  return (
    <div style={{ width: '100%', height: '70vh', border: '1px solid #ccc' }}>
      <Zoom
        width={width}
        height={height}
        scaleXMin={0.1}
        scaleXMax={10}
        initialTransformMatrix={{ scaleX: 1, scaleY: 1, translateX: 0, translateY: 0, skewX: 0, skewY: 0 }}
      >
        {(zoom) => (
          <svg width={width} height={height}>
            <g transform={zoom.toString()} style={{ transition: 'transform 0.1s ease-out' }}>
              <CirclePackingChart
                data={data}
                width={width}
                height={height}
                sizingStrategy={sizingStrategy}
                coloringStrategy={coloringStrategy}
                showTooltip={showTooltip}
                hideTooltip={hideTooltip}
              />
            </g>
            <rect
              data-testid="zoom-rect"
              fill="transparent"
              width={width}
              height={height}
              onWheel={zoom.handleWheel}
              onMouseDown={zoom.dragStart}
              onMouseMove={zoom.dragMove}
              onMouseUp={zoom.dragEnd}
              onDoubleClick={() => zoom.reset()}
            />
          </svg>
        )}
      </Zoom>
      {tooltipOpen && tooltipData && (
        <TooltipWithBounds left={tooltipLeft} top={tooltipTop}>
          <Tooltip node={tooltipData} rootPath={data.path} />
        </TooltipWithBounds>
      )}
    </div>
  );
};