'use client';

import React from 'react';
import { Treemap, treemapSquarify } from '@visx/hierarchy';
import { hierarchy } from 'd3-hierarchy';
import { TreeNode } from '@/lib/git/types';

interface TreemapChartProps {
  data: TreeNode;
  width: number;
  height: number;
  onNodeClick?: (node: TreeNode) => void;
}

export function TreemapChart({ data, width, height, onNodeClick }: TreemapChartProps) {
  if (!data.children || data.children.length === 0) {
    return (
      <div
        style={{ width, height }}
        className="flex items-center justify-center bg-gray-100 border-2 border-dashed border-gray-300 rounded"
      >
        <p className="text-gray-500 text-lg">No data to display</p>
      </div>
    );
  }

  const root = hierarchy(data).sum((d) => d.value);

  return (
    <svg
      width={width}
      height={height}
      role="img"
      aria-label="Git repository commit activity treemap visualization"
    >
      <Treemap
        root={root}
        size={[width, height]}
        tile={treemapSquarify}
      >
        {(treemap) => (
          <g>
            {treemap
              .descendants()
              .filter((node) => node.depth > 0) // Skip root
              .map((node, i) => {
                const nodeData = node.data as TreeNode;
                return (
                  <g key={`node-${i}`}>
                    <rect
                      x={node.x0}
                      y={node.y0}
                      width={node.x1 - node.x0}
                      height={node.y1 - node.y0}
                      fill={nodeData.color || '#ccc'}
                      stroke="#fff"
                      strokeWidth={1}
                      role="img"
                      aria-label={`${nodeData.name}: ${nodeData.value} commits`}
                      onClick={() => onNodeClick?.(nodeData)}
                      style={{ cursor: onNodeClick ? 'pointer' : 'default' }}
                    />
                    {(node.x1 - node.x0 > 30 && node.y1 - node.y0 > 30) && (
                      <text
                        x={node.x0 + (node.x1 - node.x0) / 2}
                        y={node.y0 + (node.y1 - node.y0) / 2}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize="12px"
                        fill="#000"
                        pointerEvents="none"
                      >
                        {nodeData.name}
                      </text>
                    )}
                  </g>
                );
              })}
          </g>
        )}
      </Treemap>
    </svg>
  );
}