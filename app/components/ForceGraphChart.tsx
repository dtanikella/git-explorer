'use client';

import React, { useEffect, useRef, useMemo, useState } from 'react';
import { TreeNode } from '@/lib/git/types';
import { GraphNode, transformTreeToGraph } from '@/lib/treemap/data-transformer';
import { scaleSqrt } from 'd3-scale';
import { forceSimulation, forceCenter, forceCollide, forceManyBody } from 'd3-force';

interface ForceGraphChartProps {
  /**
   * Hierarchical tree data from git-analysis API
   */
  data: TreeNode;

  /**
   * Chart width in pixels
   */
  width: number;

  /**
   * Chart height in pixels
   */
  height: number;

  /**
   * Optional callback when a file node is clicked
   */
  onNodeClick?: (node: GraphNode) => void;
}

export default function ForceGraphChart({
  data,
  width,
  height,
  onNodeClick,
}: ForceGraphChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<any>(null);

  // Transform tree data to graph nodes
  const graphNodes = useMemo(() => {
    return transformTreeToGraph(data);
  }, [data]);

  // Initialize nodes state with graph nodes
  const [nodes, setNodes] = useState<GraphNode[]>(graphNodes);

  // Update nodes when graphNodes changes
  useEffect(() => {
    setNodes(graphNodes);
  }, [graphNodes]);

  // Create radius scale
  const radiusScale = useMemo(() => {
    if (!nodes.length) return () => 5;
    const maxCommits = Math.max(...nodes.map(node => node.commitCount));
    return scaleSqrt()
      .domain([0, maxCommits])
      .range([5, 50])
      .clamp(true);
  }, [nodes]);

  // Initialize force simulation
  useEffect(() => {
    // Skip simulation in test environment
    if (process.env.NODE_ENV === 'test' || !nodes.length || !svgRef.current) return;

    // Create simulation
    const simulation = forceSimulation(nodes)
      .force('center', forceCenter(width / 2, height / 2))
      .force('charge', forceManyBody().strength(-100))
      .force('collide', forceCollide().radius((d: any) => radiusScale(d.commitCount) + 2))
      .alpha(1); // Start with high alpha

    simulationRef.current = simulation;

    // Run simulation to completion
    let tickCount = 0;
    const maxTicks = 300;

    const tick = () => {
      simulation.tick();
      tickCount++;

      if (simulation.alpha() > 0.001 && tickCount < maxTicks) {
        // Continue ticking
        requestAnimationFrame(tick);
      } else {
        // Simulation complete, update state once
        setNodes([...nodes]);
        simulation.stop();
      }
    };

    // Start the simulation
    requestAnimationFrame(tick);

    return () => {
      simulation.stop();
    };
  }, [nodes, width, height, radiusScale]);

  if (!graphNodes.length) {
    return (
      <div className="flex items-center justify-center p-8 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="text-center">
          <div className="text-gray-500 mb-4">
            <svg
              className="w-12 h-12 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">No Data to Display</h3>
          <p className="text-gray-600">
            No files found in the selected repository and time range.
          </p>
        </div>
      </div>
    );
  }

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      className="border border-gray-200 rounded-lg"
      role="img"
      aria-label="Activity graph visualization"
    >
      <g>
        {nodes.map((node) => {
          const radius = radiusScale(node.commitCount);
          return (
            <g key={node.id}>
              <circle
                cx={node.x || width / 2}
                cy={node.y || height / 2}
                r={radius}
                fill={node.color}
                stroke="#fff"
                strokeWidth={2}
                className="cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => onNodeClick?.(node)}
              />
              {radius > 15 && (
                <text
                  x={node.x || width / 2}
                  y={node.y || height / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="text-xs font-medium fill-white pointer-events-none"
                  style={{ fontSize: Math.min(radius / 3, 12) }}
                >
                  {node.fileName}
                </text>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}