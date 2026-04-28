'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import type { AnalysisResult } from '@/lib/analysis/types';

interface RepoGraphProps {
  repoPath: string;
  hideTestFiles: boolean;
  onSearchNode?: (handler: (query: string) => boolean) => void;
}

interface SimpleNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
}

interface SimpleEdge extends d3.SimulationLinkDatum<SimpleNode> {
  source: string;
  target: string;
}

const NODE_RADIUS = 6;
const NODE_COLOR = '#999999';
const EDGE_COLOR = '#999999';
const EDGE_WIDTH = 1;
const EDGE_OPACITY = 0.6;
const HIGHLIGHT_COLOR = '#facc15';

export default function RepoGraph({ repoPath, hideTestFiles, onSearchNode }: RepoGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const tooltipRef = useRef<d3.Selection<HTMLDivElement, unknown, HTMLElement, any> | null>(null);
  const simulationRef = useRef<d3.Simulation<SimpleNode, SimpleEdge> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<HTMLCanvasElement, unknown> | null>(null);
  const zoomTransformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
  const simNodesRef = useRef<SimpleNode[]>([]);
  const hoveredNodeRef = useRef<SimpleNode | null>(null);
  const highlightedNodeIdRef = useRef<string | null>(null);
  const drawFrameRef = useRef<(() => void) | null>(null);

  const [analysisData, setAnalysisData] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(!!repoPath);
  const [error, setError] = useState<string | null>(null);
  const [ctxError, setCtxError] = useState(false);

  // Tooltip lifecycle — mount/unmount only
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
  }, []);

  // Fetch data from /api/repo-analysis
  useEffect(() => {
    if (!repoPath) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch('/api/repo-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoPath, hideTestFiles }),
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        return res.json();
      })
      .then((result) => {
        if (result.success) {
          setAnalysisData(result.data);
        } else {
          setError(result.error || 'Analysis failed');
        }
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setError(err.message || 'Network error');
        setLoading(false);
      });

    return () => controller.abort();
  }, [repoPath, hideTestFiles]);

  // Adapter: AnalysisResult → SimpleNode[] + SimpleEdge[]
  const simNodes: SimpleNode[] = useMemo(() => {
    if (!analysisData) return [];
    return analysisData.nodes.map((n) => ({
      id: n.scipSymbol,
      name: n.name,
    }));
  }, [analysisData]);

  const simEdges: SimpleEdge[] = useMemo(() => {
    if (!analysisData) return [];
    const nodeIds = new Set(simNodes.map((n) => n.id));
    return analysisData.edges
      .filter((e) => nodeIds.has(e.fromSymbol) && nodeIds.has(e.toSymbol))
      .map((e) => ({
        source: e.fromSymbol,
        target: e.toSymbol,
      }));
  }, [analysisData, simNodes]);

  useEffect(() => { simNodesRef.current = simNodes; }, [simNodes]);

  // Mouse handlers
  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const t = zoomTransformRef.current;

    const mx = (event.clientX - rect.left - t.x) / t.k;
    const my = (event.clientY - rect.top - t.y) / t.k;

    const nodes = simNodesRef.current;
    let found: SimpleNode | null = null;
    for (const n of nodes) {
      if (n.x == null || n.y == null) continue;
      const dx = mx - n.x;
      const dy = my - n.y;
      if (Math.sqrt(dx * dx + dy * dy) <= NODE_RADIUS) {
        found = n;
        break;
      }
    }

    if (found !== hoveredNodeRef.current) {
      hoveredNodeRef.current = found;
      if (found && tooltipRef.current) {
        tooltipRef.current
          .style('visibility', 'visible')
          .text(found.name);
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

  // Force simulation + canvas rendering
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
        const src = e.source as unknown as SimpleNode;
        const tgt = e.target as unknown as SimpleNode;
        if (src.x == null || src.y == null || tgt.x == null || tgt.y == null) continue;
        c.beginPath();
        c.moveTo(src.x, src.y);
        c.lineTo(tgt.x, tgt.y);
        c.strokeStyle = EDGE_COLOR;
        c.lineWidth = EDGE_WIDTH;
        c.globalAlpha = EDGE_OPACITY;
        c.stroke();
        c.globalAlpha = 1.0;
      }

      // Draw nodes
      for (const n of simNodes) {
        if (n.x == null || n.y == null) continue;
        c.beginPath();
        c.arc(n.x, n.y, NODE_RADIUS, 0, 2 * Math.PI);
        c.fillStyle = NODE_COLOR;
        c.fill();
        c.strokeStyle = '#fff';
        c.lineWidth = 1;
        c.stroke();
        if (highlightedNodeIdRef.current === n.id) {
          c.beginPath();
          c.arc(n.x, n.y, NODE_RADIUS + 2, 0, 2 * Math.PI);
          c.strokeStyle = HIGHLIGHT_COLOR;
          c.lineWidth = 4;
          c.stroke();
        }
      }

      c.restore();
    }

    drawFrameRef.current = drawFrame;

    const simulation = d3
      .forceSimulation<SimpleNode>(simNodes)
      .force(
        'link',
        d3
          .forceLink<SimpleNode, SimpleEdge>(simEdges)
          .id((d) => d.id)
          .distance(80)
          .strength(0.5)
      )
      .force('charge', d3.forceManyBody<SimpleNode>().strength(-150))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide<SimpleNode>().radius(NODE_RADIUS + 3));

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

  // Search handler
  const handleSearchNode = useCallback((query: string): boolean => {
    const lowerQ = query.toLowerCase();
    const match =
      simNodesRef.current.find((n) => n.name.toLowerCase() === lowerQ) ??
      simNodesRef.current.find((n) => n.name.toLowerCase().includes(lowerQ));

    if (!match || match.x == null || match.y == null) return false;
    if (!canvasRef.current || !zoomRef.current) return false;

    const canvas = canvasRef.current;
    const w = canvas.offsetWidth || 800;
    const h = canvas.offsetHeight || 600;
    const scale = 2;
    const transform = d3.zoomIdentity
      .translate(w / 2 - match.x * scale, h / 2 - match.y * scale)
      .scale(scale);

    d3.select(canvas as any)
      .transition()
      .duration(500)
      .call((zoomRef.current as any).transform, transform);

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
        Analyzing repository...
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

  if (!analysisData) return null;

  return (
    <div style={{ width: '100%', height: '100%', background: '#fff', borderRadius: 8, border: '1px solid #ccc', position: 'relative' }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
        aria-label="Repository structure graph"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />
    </div>
  );
}
