/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import {
  TsGraphData,
  TsNode,
  TsEdge,
  NodeForceRule,
  EdgeForceRule,
} from '@/lib/ts/types';
import {
  evaluateNodeForces,
  evaluateNodeStyle,
  evaluateEdgeForces,
  evaluateEdgeStyle,
} from '@/lib/ts/force-rules';
import { defaultNodeRules, defaultEdgeRules } from '@/lib/ts/default-rules';
import ForcePanel from './ForcePanel';

interface TsGraphProps {
  repoPath: string;
}

interface SimNode extends d3.SimulationNodeDatum {
  id: string;
  data: TsNode;
  computedRadius: number;
}

interface SimEdge extends d3.SimulationLinkDatum<SimNode> {
  id: string;
  data: TsEdge;
}

// TODO: temporarily excluding IMPORT nodes — restore by adding 'IMPORT' back
const SYMBOL_KINDS = new Set(['FUNCTION', 'CLASS', 'INTERFACE']);

export default function TsGraph({ repoPath }: TsGraphProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const tooltipRef = useRef<d3.Selection<HTMLDivElement, unknown, HTMLElement, any> | null>(null);
  const linkSelectionRef = useRef<d3.Selection<SVGLineElement, SimEdge, SVGGElement, unknown> | null>(null);
  const nodeSelectionRef = useRef<d3.Selection<SVGCircleElement, SimNode, SVGGElement, unknown> | null>(null);
  const simulationRef = useRef<d3.Simulation<SimNode, SimEdge> | null>(null);

  const [graphData, setGraphData] = useState<TsGraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hideTestFiles, setHideTestFiles] = useState(true);
  const [nodeRules, setNodeRules] = useState<NodeForceRule[]>(defaultNodeRules);
  const [edgeRules, setEdgeRules] = useState<EdgeForceRule[]>(defaultEdgeRules);

  // Refs to snapshot current rules for use inside Effect 1 without stale closure warnings
  const nodeRulesRef = useRef(nodeRules);
  const edgeRulesRef = useRef(edgeRules);
  useEffect(() => { nodeRulesRef.current = nodeRules; }, [nodeRules]);
  useEffect(() => { edgeRulesRef.current = edgeRules; }, [edgeRules]);

  // Tooltip lifecycle effect — mount/unmount only
  useEffect(() => {
    const tip = d3
      .select('body')
      .append('div')
      .style('position', 'absolute')
      .style('visibility', 'hidden')
      .style('pointer-events', 'none')
      .style('background', '#1f2937')
      .style('color', '#f9fafb')
      .style('padding', '6px 10px')
      .style('border-radius', '4px')
      .style('font-size', '12px')
      .style('z-index', '1000');
    tooltipRef.current = tip;
    return () => {
      tip.remove();
      tooltipRef.current = null;
    };
  }, []); // mount/unmount only

  useEffect(() => {
    if (!repoPath) return;
    setLoading(true);
    setError(null);

    fetch('/api/ts-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoPath, hideTestFiles }),
    })
      .then((res) => res.json())
      .then((result) => {
        if (result.success) {
          setGraphData(result.data);
        } else {
          setError(result.error || 'Analysis failed');
        }
      })
      .catch((err) => {
        setError(err.message || 'Network error');
      })
      .finally(() => setLoading(false));
  }, [repoPath, hideTestFiles]);

  const simEdges: SimEdge[] = useMemo(() => {
    if (!graphData) return [];
    // Build a set of symbol (non-file/folder) node IDs
    const symbolIds = new Set(
      graphData.nodes.filter((n) => SYMBOL_KINDS.has(n.kind)).map((n) => n.id)
    );
    // Keep only edges where both endpoints are symbol nodes
    return graphData.edges
      .filter((e) => symbolIds.has(e.source) && symbolIds.has(e.target))
      .map((e) => ({ id: e.id, source: e.source, target: e.target, data: { ...e } }));
  }, [graphData]);

  const simNodes: SimNode[] = useMemo(() => {
    if (!graphData) return [];

    // Only include symbol nodes that have at least one remaining edge
    const connectedIds = new Set<string>();
    for (const e of simEdges) {
      const src = typeof e.source === 'string' ? e.source : (e.source as SimNode).id;
      const tgt = typeof e.target === 'string' ? e.target : (e.target as SimNode).id;
      connectedIds.add(src);
      connectedIds.add(tgt);
    }

    const nodes = graphData.nodes
      .filter((n) => SYMBOL_KINDS.has(n.kind) && connectedIds.has(n.id))
      .map((n) => ({ id: n.id, data: { ...n }, computedRadius: 0 }));

    // Count edges per node for degree-based sizing
    const degree = new Map<string, number>();
    for (const e of simEdges) {
      const src = typeof e.source === 'string' ? e.source : (e.source as SimNode).id;
      const tgt = typeof e.target === 'string' ? e.target : (e.target as SimNode).id;
      degree.set(src, (degree.get(src) ?? 0) + 1);
      degree.set(tgt, (degree.get(tgt) ?? 0) + 1);
    }

    // Find min/max degree among symbol nodes
    let minDeg = Infinity;
    let maxDeg = 0;
    for (const n of nodes) {
      const d = degree.get(n.id) ?? 0;
      if (d < minDeg) minDeg = d;
      if (d > maxDeg) maxDeg = d;
    }
    if (minDeg === Infinity) minDeg = 0;

    const scale = d3.scaleLinear()
      .domain([minDeg, Math.max(maxDeg, minDeg + 1)])
      .range([5, 100])
      .clamp(true);

    const fnScale = d3.scaleLinear()
      .domain([minDeg, Math.max(maxDeg, minDeg + 1)])
      .range([10, 40])
      .clamp(true);

    for (const n of nodes) {
      const deg = degree.get(n.id) ?? 0;
      n.computedRadius = n.data.kind === 'FUNCTION' ? fnScale(deg) : scale(deg);
    }

    return nodes;
  }, [graphData, simEdges]);

  // Import nodes use a fixed visual radius; others use their computed radius
  function visualRadius(d: SimNode): number {
    if (d.data.kind === 'IMPORT') return 10;
    if (d.data.kind === 'FUNCTION') return d.computedRadius;
    return d.computedRadius;
  }

  // Effect 1: simulation setup — runs only when simNodes or simEdges change
  useEffect(() => {
    if (!svgRef.current || simNodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = svgRef.current.parentElement?.clientWidth || 800;
    const height = 600;

    const zoneMap: Record<string, { x: number; y: number }> = {
      top: { x: width / 2, y: height * 0.2 },
      bottom: { x: width / 2, y: height * 0.8 },
      left: { x: width * 0.2, y: height / 2 },
      right: { x: width * 0.8, y: height / 2 },
      center: { x: width / 2, y: height / 2 },
    };

    const currentNodeRules = nodeRulesRef.current;
    const currentEdgeRules = edgeRulesRef.current;

    const simulation = d3
      .forceSimulation<SimNode>(simNodes)
      .force(
        'link',
        d3
          .forceLink<SimNode, SimEdge>(simEdges)
          .id((d) => d.id)
          .distance((d) => evaluateEdgeForces(d.data, currentEdgeRules).linkDistance)
          .strength((d) => evaluateEdgeForces(d.data, currentEdgeRules).linkStrength)
      )
      .force(
        'charge',
        d3.forceManyBody<SimNode>().strength((d) =>
          evaluateNodeForces(d.data, currentNodeRules).charge
        )
      )
      .force(
        'collide',
        d3.forceCollide<SimNode>().radius((d) => d.computedRadius + 3)
      )
      .force(
        'x',
        d3.forceX<SimNode>()
          .x((d) => {
            const forces = evaluateNodeForces(d.data, currentNodeRules);
            if (forces.fx !== null) return forces.fx;
            if (forces.zone && zoneMap[forces.zone]) return zoneMap[forces.zone].x;
            return width / 2;
          })
          .strength((d) => {
            const forces = evaluateNodeForces(d.data, currentNodeRules);
            return forces.zone || forces.fx !== null ? 0.3 : forces.centerStrength;
          })
      )
      .force(
        'y',
        d3.forceY<SimNode>()
          .y((d) => {
            const forces = evaluateNodeForces(d.data, currentNodeRules);
            if (forces.fy !== null) return forces.fy;
            if (forces.zone && zoneMap[forces.zone]) return zoneMap[forces.zone].y;
            return height / 2;
          })
          .strength((d) => {
            const forces = evaluateNodeForces(d.data, currentNodeRules);
            return forces.zone || forces.fy !== null ? 0.3 : forces.centerStrength;
          })
      );

    const g = svg.append('g');

    const link = g
      .append('g')
      .selectAll('line')
      .data(simEdges)
      .join('line')
      .attr('stroke', (d) => evaluateEdgeStyle(d.data, currentEdgeRules).color)
      .attr('stroke-width', (d) => evaluateEdgeStyle(d.data, currentEdgeRules).width)
      .attr('stroke-opacity', 0.6) as d3.Selection<SVGLineElement, SimEdge, SVGGElement, unknown>;

    const node = g
      .append('g')
      .selectAll('circle')
      .data(simNodes)
      .join('circle')
      .attr('r', (d) => visualRadius(d))
      .attr('fill', (d) => evaluateNodeStyle(d.data, currentNodeRules).color)
      .attr('stroke', '#fff')
      .attr('stroke-width', 1)
      .call(drag(simulation) as any) as d3.Selection<SVGCircleElement, SimNode, SVGGElement, unknown>;

    // Store selections and simulation in refs for Effect 2
    linkSelectionRef.current = link;
    nodeSelectionRef.current = node;
    simulationRef.current = simulation;

    node
      .on('mouseenter', (event, d) => {
        if (!tooltipRef.current) return;
        const label = 'name' in d.data ? (d.data as { name: string }).name : d.id;
        tooltipRef.current
          .style('visibility', 'visible')
          .html(`<strong>${d.data.kind}</strong>: ${label}`);
      })
      .on('mousemove', (event) => {
        if (!tooltipRef.current) return;
        tooltipRef.current
          .style('top', event.pageY - 10 + 'px')
          .style('left', event.pageX + 10 + 'px');
      })
      .on('mouseleave', () => {
        if (!tooltipRef.current) return;
        tooltipRef.current.style('visibility', 'hidden');
      });

    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node.attr('cx', (d) => d.x!).attr('cy', (d) => d.y!);
    });

    svg.call(
      d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 8])
        .on('zoom', (event) => {
          g.attr('transform', event.transform);
        })
    );

    function drag(simulation: d3.Simulation<SimNode, SimEdge>) {
      function dragstarted(event: any, d: SimNode) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      }
      function dragged(event: any, d: SimNode) {
        d.fx = event.x;
        d.fy = event.y;
      }
      function dragended(event: any, d: SimNode) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      }
      return d3
        .drag<SVGCircleElement, SimNode>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended);
    }

    return () => {
      simulation.stop();
    };
  }, [simNodes, simEdges]);

  // Effect 2: visual attribute update — runs when rules change, no simulation rebuild
  useEffect(() => {
    if (!linkSelectionRef.current || !nodeSelectionRef.current) return;

    linkSelectionRef.current
      .attr('stroke', (d) => evaluateEdgeStyle(d.data, edgeRules).color)
      .attr('stroke-width', (d) => evaluateEdgeStyle(d.data, edgeRules).width);

    nodeSelectionRef.current
      .attr('r', (d) => visualRadius(d))
      .attr('fill', (d) => evaluateNodeStyle(d.data, nodeRules).color);

    // Reheat simulation slightly for force changes
    if (simulationRef.current) {
      simulationRef.current.alpha(0.3).restart();
    }
  }, [nodeRules, edgeRules]);

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>
        Analyzing TypeScript structure...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#ef4444' }}>
        {error}
      </div>
    );
  }

  if (!graphData) return null;

  if (graphData.nodes.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>
        No non-test files found. Uncheck &ldquo;Hide test files&rdquo; in the panel to include test files in the graph.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', width: '100%', height: 600, background: '#fff', borderRadius: 8, border: '1px solid #ccc' }}>
      <div style={{ flex: 1, position: 'relative' }}>
        <svg
          ref={svgRef}
          width="100%"
          height={600}
          style={{ display: 'block' }}
          aria-label="TypeScript repository structure graph"
        />
      </div>
      <ForcePanel
        nodeRules={nodeRules}
        edgeRules={edgeRules}
        onNodeRulesChange={setNodeRules}
        onEdgeRulesChange={setEdgeRules}
        hideTestFiles={hideTestFiles}
        onHideTestFilesChange={setHideTestFiles}
      />
    </div>
  );
}
