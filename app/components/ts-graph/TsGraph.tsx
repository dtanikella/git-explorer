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
}

interface SimEdge extends d3.SimulationLinkDatum<SimNode> {
  id: string;
  data: TsEdge;
}

export default function TsGraph({ repoPath }: TsGraphProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [graphData, setGraphData] = useState<TsGraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nodeRules, setNodeRules] = useState<NodeForceRule[]>(defaultNodeRules);
  const [edgeRules, setEdgeRules] = useState<EdgeForceRule[]>(defaultEdgeRules);

  useEffect(() => {
    if (!repoPath) return;
    setLoading(true);
    setError(null);

    fetch('/api/ts-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoPath }),
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
  }, [repoPath]);

  const simNodes: SimNode[] = useMemo(
    () => graphData?.nodes.map((n) => ({ id: n.id, data: { ...n } })) ?? [],
    [graphData]
  );
  const simEdges: SimEdge[] = useMemo(
    () =>
      graphData?.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        data: { ...e },
      })) ?? [],
    [graphData]
  );

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

    const simulation = d3
      .forceSimulation<SimNode>(simNodes)
      .force(
        'link',
        d3
          .forceLink<SimNode, SimEdge>(simEdges)
          .id((d) => d.id)
          .distance((d) => evaluateEdgeForces(d.data, edgeRules).linkDistance)
          .strength((d) => evaluateEdgeForces(d.data, edgeRules).linkStrength)
      )
      .force(
        'charge',
        d3.forceManyBody<SimNode>().strength((d) =>
          evaluateNodeForces(d.data, nodeRules).charge
        )
      )
      .force(
        'collide',
        d3.forceCollide<SimNode>().radius((d) =>
          evaluateNodeForces(d.data, nodeRules).collideRadius
        )
      )
      .force(
        'x',
        d3.forceX<SimNode>()
          .x((d) => {
            const forces = evaluateNodeForces(d.data, nodeRules);
            if (forces.fx !== null) return forces.fx;
            if (forces.zone && zoneMap[forces.zone]) return zoneMap[forces.zone].x;
            return width / 2;
          })
          .strength((d) => {
            const forces = evaluateNodeForces(d.data, nodeRules);
            return forces.zone || forces.fx !== null ? 0.3 : forces.centerStrength;
          })
      )
      .force(
        'y',
        d3.forceY<SimNode>()
          .y((d) => {
            const forces = evaluateNodeForces(d.data, nodeRules);
            if (forces.fy !== null) return forces.fy;
            if (forces.zone && zoneMap[forces.zone]) return zoneMap[forces.zone].y;
            return height / 2;
          })
          .strength((d) => {
            const forces = evaluateNodeForces(d.data, nodeRules);
            return forces.zone || forces.fy !== null ? 0.3 : forces.centerStrength;
          })
      );

    const g = svg.append('g');

    const link = g
      .append('g')
      .selectAll('line')
      .data(simEdges)
      .join('line')
      .attr('stroke', (d) => evaluateEdgeStyle(d.data, edgeRules).color)
      .attr('stroke-width', (d) => evaluateEdgeStyle(d.data, edgeRules).width)
      .attr('stroke-opacity', 0.6);

    let tooltip = d3.select('body').select<HTMLDivElement>('div.ts-graph-tooltip');
    if (tooltip.empty()) {
      tooltip = d3
        .select('body')
        .append('div')
        .attr('class', 'ts-graph-tooltip')
        .style('position', 'absolute')
        .style('visibility', 'hidden')
        .style('pointer-events', 'none')
        .style('background', '#1f2937')
        .style('color', '#f9fafb')
        .style('padding', '6px 10px')
        .style('border-radius', '4px')
        .style('font-size', '12px')
        .style('z-index', '1000');
    }

    const node = g
      .append('g')
      .selectAll('circle')
      .data(simNodes)
      .join('circle')
      .attr('r', (d) => evaluateNodeStyle(d.data, nodeRules).radius)
      .attr('fill', (d) => evaluateNodeStyle(d.data, nodeRules).color)
      .attr('stroke', '#fff')
      .attr('stroke-width', 1)
      .call(drag(simulation));

    node
      .on('mouseenter', (event, d) => {
        const label = 'name' in d.data ? (d.data as any).name : d.id;
        tooltip
          .style('visibility', 'visible')
          .html(`<strong>${d.data.kind}</strong>: ${label}`);
      })
      .on('mousemove', (event) => {
        tooltip
          .style('top', event.pageY - 10 + 'px')
          .style('left', event.pageX + 10 + 'px');
      })
      .on('mouseleave', () => {
        tooltip.style('visibility', 'hidden');
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
      tooltip.remove();
    };
  }, [simNodes, simEdges, nodeRules, edgeRules]);

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

  return (
    <div style={{ display: 'flex', width: '100%', minHeight: 600, background: '#fff', borderRadius: 8, border: '1px solid #ccc' }}>
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
      />
    </div>
  );
}
