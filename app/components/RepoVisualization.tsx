import React from 'react';
import { FileTree, SizingStrategy, ColoringStrategy } from '../../lib/types';
import { CirclePackingChart } from './CirclePackingChart';

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
  return (
    <div style={{ width: '100%', height: '70vh', border: '1px solid #ccc' }}>
      <CirclePackingChart
        data={data}
        width={800} // Will be overridden by responsive
        height={600}
        sizingStrategy={sizingStrategy}
        coloringStrategy={coloringStrategy}
      />
    </div>
  );
};