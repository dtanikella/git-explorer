'use client';

import React, { useEffect, useRef, useMemo, useState } from 'react';
import { TreeNode } from '@/lib/git/types';
import { GraphNode, transformTreeToGraph } from '@/lib/treemap/data-transformer';
import { scaleSqrt } from 'd3-scale';
import { forceSimulation, forceCenter, forceCollide, forceManyBody } from 'd3-force';
import { zoom, zoomIdentity } from 'd3-zoom';
import { select } from 'd3-selection';

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

/**
 * Truncate filename with ellipsis if too long for display
 */
function truncateFilename(filename: string, maxLength: number = 12): string {
  if (filename.length <= maxLength) return filename;
  return filename.substring(0, maxLength - 3) + '...';
}

export default function ForceGraphChart({
  data,
  width,
  height,
  onNodeClick,
}: ForceGraphChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<any>(null);
  const zoomRef = useRef<any>(null);

  // Transform tree data to graph nodes
  const graphNodes = useMemo(() => {
    return transformTreeToGraph(data);
  }, [data]);

  // Initialize nodes state with graph nodes
  const [nodes, setNodes] = useState<GraphNode[]>(graphNodes);
  const [zoomTransform, setZoomTransform] = useState<any>(zoomIdentity);

  // Update nodes when graphNodes changes
  useEffect(() => {
    setNodes(graphNodes);
  }, [graphNodes]);

  // Create radius scale
  const radiusScale = useMemo(() => {
    if (!nodes.length) return () => 5;
    const commitCounts = nodes.map(node => node.commitCount);
    const minCommits = Math.min(...commitCounts);
    const maxCommits = Math.max(...commitCounts);
    
    // Edge case: all files have same commit count
    if (minCommits === maxCommits) {
      return () => 25; // Fixed radius for uniform data
    }
    
    return scaleSqrt()
      .domain([minCommits, maxCommits])
      .range([8, 40])
      .clamp(true);
  }, [nodes]);

  // Initialize force simulation
  useEffect(() => {
    // Skip simulation in test environment
    if (process.env.NODE_ENV === 'test' || !nodes.length || !svgRef.current) return;

    // Adjust forces based on number of nodes
    const numNodes = nodes.length;
    let chargeStrength = -100;
    let maxTicks = 200; // Reduced from 300 for faster stabilization
    
    // Edge case: very few nodes
    if (numNodes <= 2) {
      chargeStrength = -50; // Weaker repulsion for stability
      maxTicks = 100; // Faster convergence
    } else if (numNodes > 50) {
      chargeStrength = -150; // Stronger repulsion for many nodes
      maxTicks = 300; // Allow more time for complex layouts
    }

    // Create simulation
    const simulation = forceSimulation(nodes)
      .force('center', forceCenter(width / 2, height / 2))
      .force('charge', forceManyBody().strength(chargeStrength))
      .force('collide', forceCollide().radius((d: any) => radiusScale(d.commitCount) + 2))
      .alpha(1) // Start with high alpha
      .alphaDecay(0.02) // Faster decay for quicker stabilization
      .velocityDecay(0.4); // Add some damping

    simulationRef.current = simulation;

    // Run simulation to completion
    let tickCount = 0;

    const tick = () => {
      simulation.tick();
      tickCount++;

      if (simulation.alpha() > 0.01 && tickCount < maxTicks) {
        // Continue ticking (relaxed alpha threshold for faster completion)
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

  // Initialize zoom behavior
  useEffect(() => {
    if (process.env.NODE_ENV === 'test' || !svgRef.current) return;

    const svg = svgRef.current;
    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 5.0])
      .on('zoom', (event) => {
        setZoomTransform(event.transform);
      });

    zoomRef.current = zoomBehavior;
    select(svg).call(zoomBehavior);

    return () => {
      zoomBehavior.on('zoom', null);
    };
  }, [width, height]);

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
      <g transform={zoomTransform.toString()}>
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
                  {truncateFilename(node.fileName)}
                </text>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}