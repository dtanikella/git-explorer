import React from 'react';
import { useTooltip, TooltipWithBounds } from '@visx/tooltip';
import { Zoom } from '@visx/zoom';
import { FileTree, SizingStrategy, ColoringStrategy } from '../../lib/types';
import { CirclePackingChart } from './CirclePackingChart';
import { Tooltip } from './Tooltip';
import throttle from 'lodash.throttle';

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

  const [isDragging, setIsDragging] = React.useState(false);

  const throttledDragMoveRef = React.useRef(
    throttle((handler: any, event: React.MouseEvent) => {
      handler(event);
    }, 16, { leading: true, trailing: true })
  );

  React.useEffect(() => {
    const throttledDragMove = throttledDragMoveRef.current;
    return () => {
      throttledDragMove.cancel();
    };
  }, []);

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
          <svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${width} ${height}`}
            style={{ display: 'block' }}
            onWheel={zoom.handleWheel}
          >
            <g transform={zoom.toString()} style={{ 
              transition: isDragging ? 'none' : 'transform 0.3s ease-out',
              willChange: 'transform'
            }}>
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
              style={{ pointerEvents: isDragging ? 'auto' : 'none' }}
              onMouseDown={(e) => {
                setIsDragging(true);
                zoom.dragStart(e);
              }}
              onMouseMove={(e) => throttledDragMoveRef.current(zoom.dragMove, e)}
              onMouseUp={(e) => {
                setIsDragging(false);
                zoom.dragEnd(e);
              }}
              onMouseLeave={(e) => {
                // Handle case where mouse leaves SVG during drag
                if (isDragging) {
                  setIsDragging(false);
                  zoom.dragEnd(e);
                }
              }}
              onDoubleClick={() => zoom.reset()}
            />
          </svg>
        )}
      </Zoom>
      <TooltipWithBounds 
        left={tooltipLeft ?? 0} 
        top={tooltipTop ?? 0}
        style={{
          visibility: tooltipOpen && tooltipData ? 'visible' : 'hidden',
          pointerEvents: 'none', // Prevent tooltip from blocking mouse events
          transition: 'opacity 0.1s ease-out',
          opacity: tooltipOpen && tooltipData ? 1 : 0,
        }}
      >
        {tooltipData && <Tooltip node={tooltipData} rootPath={data.path} />}
      </TooltipWithBounds>
    </div>
  );
};