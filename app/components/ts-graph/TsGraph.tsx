'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import {
  TsGraphData,
  TsNode,
  TsEdge,
} from '@/lib/ts/types';
import {
  evaluateNodeForces,
  evaluateNodeStyle,
  evaluateEdgeForces,
  evaluateEdgeStyle,
} from '@/lib/ts/force-rules';
import { defaultNodeRules, defaultEdgeRules } from '@/lib/ts/default-rules';

interface TsGraphProps {
  repoPath: string;
  hideTestFiles: boolean;
  onSearchNode?: (handler: (query: string) => boolean) => void;
}

type SymbolNode = FunctionNode | ClassNode | InterfaceNode;

function isSymbolNode(n: TsNode): n is SymbolNode {
  return n.kind === 'FUNCTION' || n.kind === 'CLASS' || n.kind === 'INTERFACE';
}

const NODE_COLORS: Record<string, string> = {
  FUNCTION: '#3b82f6',
  CLASS: '#8b5cf6',
  INTERFACE: '#10b981',
};

const NODE_SIZES: Record<string, number> = {
  FUNCTION: 6,
  CLASS: 10,
  INTERFACE: 8,
};

const EDGE_COLORS: Record<string, string> = {
  call: '#fcd34d',
  uses: '#f9a8d4',
};

const EDGE_SIZES: Record<string, number> = {
  call: 1.5,
  uses: 1,
};

export default function TsGraph({ repoPath, hideTestFiles, onSearchNode }: TsGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const tooltipRef = useRef<d3.Selection<HTMLDivElement, unknown, HTMLElement, any> | null>(null);
  const simulationRef = useRef<d3.Simulation<SimNode, SimEdge> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<HTMLCanvasElement, unknown> | null>(null);
  const zoomTransformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
  const simNodesRef = useRef<SimNode[]>([]);
  const hoveredNodeRef = useRef<SimNode | null>(null);
  const highlightedNodeIdRef = useRef<string | null>(null);
  const drawFrameRef = useRef<(() => void) | null>(null);

  const [graphData, setGraphData] = useState<TsGraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ctxError, setCtxError] = useState(false);
  // Rules UI was removed with ForcePanel. Using defaults until toolbar controls are added.
  const nodeRules = defaultNodeRules;
  const edgeRules = defaultEdgeRules;

  // Refs to snapshot current rules for use inside Effect 1 without stale closure warnings
  const nodeRulesRef = useRef(nodeRules);
  const edgeRulesRef = useRef(edgeRules);

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
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch('/api/ts-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoPath, hideTestFiles: true }),
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((result) => {
        if (result.success) {
          setGraphData(result.data);
        } else {
          setError(result.error || 'Analysis failed');
        }
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setError(err.message || 'Network error');
      })
      .finally(() => setLoading(false));
  }, [repoPath, hideTestFiles]);

  const simEdges: SimEdge[] = useMemo(() => {
    if (!graphData) return [];
    const symbolIds = new Set(
      graphData.nodes.filter((n) => SYMBOL_KINDS.has(n.kind)).map((n) => n.id)
    );
    // Include FILE nodes that are an endpoint of a call edge where the other endpoint is a symbol
    const fileIds = new Set(
      graphData.nodes.filter((n) => n.kind === 'FILE').map((n) => n.id)
    );
    const eligibleIds = new Set(symbolIds);
    for (const e of graphData.edges) {
      if (e.type !== 'call') continue;
      if (fileIds.has(e.source) && symbolIds.has(e.target)) eligibleIds.add(e.source);
      if (fileIds.has(e.target) && symbolIds.has(e.source)) eligibleIds.add(e.target);
    }
    return graphData.edges
      .filter((e) => eligibleIds.has(e.source) && eligibleIds.has(e.target))
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
      .filter((n) => (SYMBOL_KINDS.has(n.kind) || n.kind === 'FILE') && connectedIds.has(n.id))
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

  // Keep simNodesRef in sync for search callback
  useEffect(() => { simNodesRef.current = simNodes; }, [simNodes]);

  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const t = zoomTransformRef.current;

    const mx = (event.clientX - rect.left - t.x) / t.k;
    const my = (event.clientY - rect.top - t.y) / t.k;

    const nodes = simNodesRef.current;
    let found: SimNode | null = null;
    for (const n of nodes) {
      if (n.x == null || n.y == null) continue;
      const dx = mx - n.x;
      const dy = my - n.y;
      if (Math.sqrt(dx * dx + dy * dy) <= visualRadius(n)) {
        found = n;
        break;
      }
    }

    if (found !== hoveredNodeRef.current) {
      hoveredNodeRef.current = found;
      if (found && tooltipRef.current) {
        const label = 'name' in found.data ? (found.data as { name: string }).name : found.id;
        tooltipRef.current
          .style('visibility', 'visible')
          .html(`<strong>${found.data.kind}</strong>: ${label}`);
      } else if (tooltipRef.current) {
        tooltipRef.current.style('visibility', 'hidden');
      }
    }

    if (found && tooltipRef.current) {
      tooltipRef.current
        .style('top', event.pageY - 10 + 'px')
        .style('left', event.pageX + 10 + 'px');
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    hoveredNodeRef.current = null;
    if (tooltipRef.current) {
      tooltipRef.current.style('visibility', 'hidden');
    }
  }, []);

  // Import nodes use a fixed visual radius; FILE nodes use a fixed smaller radius
  function visualRadius(d: SimNode): number {
    if (d.data.kind === 'IMPORT') return 10;
    if (d.data.kind === 'FILE') return 8;
    if (d.data.kind === 'FUNCTION') return d.computedRadius;
    return d.computedRadius;
  }

  // Effect 1: simulation setup — runs only when simNodes or simEdges change
  useEffect(() => {
    if (!canvasRef.current || simNodes.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setCtxError(true);
      return;
    }
    ctxRef.current = ctx;

    canvas.width = canvas.offsetWidth || 800;
    canvas.height = canvas.offsetHeight || 600;
    const width = canvas.width;
    const height = canvas.height;

    const currentNodeRules = nodeRulesRef.current;
    const currentEdgeRules = edgeRulesRef.current;

    function drawFrame() {
      const c = ctxRef.current;
      const cv = canvasRef.current;
      if (!c || !cv) return;
      const t = zoomTransformRef.current;

      c.clearRect(0, 0, cv.width, cv.height);
      c.save();
      c.setTransform(t.k, 0, 0, t.k, t.x, t.y);

      // Draw edges
      for (const e of simEdges) {
        const src = e.source as SimNode;
        const tgt = e.target as SimNode;
        if (src.x == null || src.y == null || tgt.x == null || tgt.y == null) continue;
        const style = evaluateEdgeStyle(e.data, currentEdgeRules);
        c.beginPath();
        c.moveTo(src.x, src.y);
        c.lineTo(tgt.x, tgt.y);
        c.strokeStyle = style.color;
        c.lineWidth = style.width;
        c.globalAlpha = 0.6;
        c.stroke();
        c.globalAlpha = 1.0;
      }

      // Draw nodes
      for (const n of simNodes) {
        if (n.x == null || n.y == null) continue;
        const style = evaluateNodeStyle(n.data, currentNodeRules);
        const r = visualRadius(n);
        c.beginPath();
        c.arc(n.x, n.y, r, 0, 2 * Math.PI);
        c.fillStyle = style.color;
        c.fill();
        c.strokeStyle = '#fff';
        c.lineWidth = 1;
        c.stroke();
        if (highlightedNodeIdRef.current === n.id) {
          c.beginPath();
          c.arc(n.x, n.y, r + 2, 0, 2 * Math.PI);
          c.strokeStyle = '#facc15';
          c.lineWidth = 4;
          c.stroke();
        }
      }

      c.restore();
    }

    drawFrameRef.current = drawFrame;

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
        d3
          .forceX<SimNode>()
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
        d3
          .forceY<SimNode>()
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

    simulationRef.current = simulation;
    simulation.on('tick', drawFrame);

    const zoomBehavior = d3
      .zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.1, 8])
      .on('zoom', (event) => {
        zoomTransformRef.current = event.transform;
        drawFrame();
      });
    zoomRef.current = zoomBehavior;
    d3.select(canvas as any).call(zoomBehavior as any);

    const resizeObserver = new ResizeObserver(() => {
      if (!canvasRef.current) return;
      canvasRef.current.width = canvasRef.current.offsetWidth || 800;
      canvasRef.current.height = canvasRef.current.offsetHeight || 600;
      drawFrame();
    });
    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }

    return () => {
      simulation.stop();
      zoomRef.current = null;
      drawFrameRef.current = null;
      resizeObserver.disconnect();
    };
  }, [simNodes, simEdges]);

  // Search handler: find node by name (case-insensitive), zoom to it, and highlight it
  const handleSearchNode = useCallback((query: string): boolean => {
    const lowerQ = query.toLowerCase();
    const match =
      simNodesRef.current.find((n) => {
        const name = 'name' in n.data ? (n.data as { name: string }).name : '';
        return name.toLowerCase() === lowerQ;
      }) ??
      simNodesRef.current.find((n) => {
        const name = 'name' in n.data ? (n.data as { name: string }).name : '';
        return name.toLowerCase().includes(lowerQ);
      });

    if (!match || match.x == null || match.y == null) return false;
    if (!canvasRef.current || !zoomRef.current) return false;

    const canvas = canvasRef.current;
    const width = canvas.offsetWidth || 800;
    const height = canvas.offsetHeight || 600;
    const scale = 2;
    const transform = d3.zoomIdentity
      .translate(width / 2 - match.x * scale, height / 2 - match.y * scale)
      .scale(scale);

    d3.select(canvas as any)
      .transition()
      .duration(500)
      .call((zoomRef.current as any).transform, transform);

    // Highlight node — drawFrame checks highlightedNodeIdRef on every tick/zoom event
    highlightedNodeIdRef.current = match.id;
    drawFrameRef.current?.();

    setTimeout(() => {
      highlightedNodeIdRef.current = null;
      drawFrameRef.current?.();
    }, 1500);

    return true;
  }, []);

  useEffect(() => {
    if (onSearchNode) {
      onSearchNode(handleSearchNode);
    }
  }, [onSearchNode, handleSearchNode]);

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

  if (ctxError) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#ef4444' }}>
        Canvas not supported in this browser.
      </div>
    );
  }

  if (!graphData) return null;

  if (!graphData.nodes.some(isSymbolNode)) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>
        No non-test files found. Uncheck &ldquo;Hide test files&rdquo; in the toolbar to include test files in the graph.
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', background: '#fff', borderRadius: 8, border: '1px solid #ccc', position: 'relative' }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
        aria-label="TypeScript repository structure graph"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />
    </div>
  );
}
