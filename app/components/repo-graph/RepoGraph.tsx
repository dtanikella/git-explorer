'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import type { AnalysisResult, AnalysisNode, AnalysisEdge } from '@/lib/analysis/types';
import type { RepoGraphConfig } from '@/lib/analysis/graph-config';
import { DEFAULT_REPO_GRAPH_CONFIG } from '@/lib/analysis/graph-config';
import { useSelection } from '@/app/contexts/SelectionContext';

type ConfigOrFactory = RepoGraphConfig | ((edges: AnalysisEdge[]) => RepoGraphConfig);

interface RepoGraphProps {
  repoPath: string;
  hideTestFiles: boolean;
  config?: ConfigOrFactory;
  onSearchNode?: (handler: (query: string) => boolean) => void;
  analysisData: AnalysisResult | null;
  loading: boolean;
  error: string | null;
  highlightedNodeId?: string | null;
}

interface SimpleNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  data: AnalysisNode;
  degree: number;
}

interface SimpleEdge extends d3.SimulationLinkDatum<SimpleNode> {
  source: string;
  target: string;
  data: AnalysisEdge;
}

export default function RepoGraph({ repoPath, hideTestFiles, config, onSearchNode, analysisData, loading, error, highlightedNodeId }: RepoGraphProps) {
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
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const configRef = useRef<RepoGraphConfig>(DEFAULT_REPO_GRAPH_CONFIG);

  const [ctxError, setCtxError] = useState(false);
  const { activeNodeIds, hasSelection, toggleNode } = useSelection();
  const selectedNodeIds = useSelection().state.selectedNodeIds;
  const activeNodeIdsRef = useRef(activeNodeIds);
  const selectedNodeIdsRef = useRef(selectedNodeIds);
  const hasSelectionRef = useRef(hasSelection);

  useEffect(() => {
    activeNodeIdsRef.current = activeNodeIds;
    selectedNodeIdsRef.current = selectedNodeIds;
    hasSelectionRef.current = hasSelection;
    drawFrameRef.current?.();
  }, [activeNodeIds, selectedNodeIds, hasSelection]);

  const resolvedConfig = useMemo(() => {
    if (!analysisData) {
      return config && typeof config !== 'function'
        ? config
        : DEFAULT_REPO_GRAPH_CONFIG;
    }

    return typeof config === 'function'
      ? config(analysisData.edges)
      : (config ?? DEFAULT_REPO_GRAPH_CONFIG);
  }, [analysisData, config]);

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

  useEffect(() => {
    configRef.current = resolvedConfig;
  }, [resolvedConfig]);

  // Adapter: AnalysisResult → SimpleNode[] + SimpleEdge[]
  const simEdges: SimpleEdge[] = useMemo(() => {
    if (!analysisData) return [];
    const cfg = resolvedConfig;
    const candidateIds = new Set(
      analysisData.nodes.filter(cfg.filters.node).map((n) => n.scipSymbol)
    );
    return analysisData.edges
      .filter((e) =>
        cfg.filters.edge(e) &&
        candidateIds.has(e.fromSymbol) && candidateIds.has(e.toSymbol)
      )
      .map((e) => ({
        source: e.fromSymbol,
        target: e.toSymbol,
        data: e,
      }));
  }, [analysisData, resolvedConfig]);

  const simNodes: SimpleNode[] = useMemo(() => {
    if (!analysisData) return [];
    const cfg = resolvedConfig;
    const connectedIds = new Set<string>();
    for (const e of simEdges) {
      connectedIds.add(e.source as string);
      connectedIds.add(e.target as string);
    }
    return analysisData.nodes
      .filter((n) => cfg.filters.node(n) && connectedIds.has(n.scipSymbol))
      .map((n) => ({
        id: n.scipSymbol,
        name: n.name,
        data: n,
        degree: 0,
      }));
  }, [analysisData, simEdges, resolvedConfig]);

  useEffect(() => { simNodesRef.current = simNodes; }, [simNodes]);

  useEffect(() => {
    const degreeCounts = new Map<string, number>();
    for (const e of simEdges) {
      degreeCounts.set(e.source as string, (degreeCounts.get(e.source as string) ?? 0) + 1);
      degreeCounts.set(e.target as string, (degreeCounts.get(e.target as string) ?? 0) + 1);
    }
    simNodes.forEach((n) => {
      (n as { degree: number }).degree = degreeCounts.get(n.id) ?? 0;
    });
  }, [simNodes, simEdges]);

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
      const cfg = configRef.current;
      const nStyle = cfg.style.node(n.data, n.degree);
      if (Math.sqrt(dx * dx + dy * dy) <= nStyle.radius) {
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

  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    mouseDownPosRef.current = { x: event.clientX, y: event.clientY };
  }, []);

  const handleMouseUp = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const downPos = mouseDownPosRef.current;
    mouseDownPosRef.current = null;
    if (!downPos) return;

    const dx = event.clientX - downPos.x;
    const dy = event.clientY - downPos.y;
    if (Math.sqrt(dx * dx + dy * dy) > 3) return;

    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const t = zoomTransformRef.current;
    const mx = (event.clientX - rect.left - t.x) / t.k;
    const my = (event.clientY - rect.top - t.y) / t.k;

    const nodes = simNodesRef.current;
    const cfg = configRef.current;
    for (const n of nodes) {
      if (n.x == null || n.y == null) continue;
      const ndx = mx - n.x;
      const ndy = my - n.y;
      const nStyle = cfg.style.node(n.data, n.degree);
      if (Math.sqrt(ndx * ndx + ndy * ndy) <= nStyle.radius) {
        toggleNode(n.id);
        return;
      }
    }
  }, [toggleNode]);

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
      const cfg = configRef.current;

      c.clearRect(0, 0, cv.width, cv.height);
      c.save();
      c.setTransform(t.k, 0, 0, t.k, t.x, t.y);

      // Draw edges
      for (const e of simEdges) {
        const src = e.source as unknown as SimpleNode;
        const tgt = e.target as unknown as SimpleNode;
        if (src.x == null || src.y == null || tgt.x == null || tgt.y == null) continue;
        const eStyle = cfg.style.edge(e.data);
        c.beginPath();
        c.moveTo(src.x, src.y);
        c.lineTo(tgt.x, tgt.y);
        if (eStyle.gradientSourceColor && eStyle.gradientTargetColor) {
          const grad = c.createLinearGradient(src.x, src.y, tgt.x, tgt.y);
          grad.addColorStop(0, eStyle.gradientSourceColor);
          grad.addColorStop(1, eStyle.gradientTargetColor);
          c.strokeStyle = grad;
        } else {
          c.strokeStyle = eStyle.color;
        }
        c.lineWidth = eStyle.width;

        if (hasSelectionRef.current) {
          const srcActive = activeNodeIdsRef.current.has(src.id);
          const tgtActive = activeNodeIdsRef.current.has(tgt.id);
          c.globalAlpha = (srcActive || tgtActive) ? eStyle.opacity : 0.15;
        } else {
          c.globalAlpha = eStyle.opacity;
        }

        c.stroke();
        c.globalAlpha = 1.0;
      }

      // Draw nodes
      for (const n of simNodes) {
        if (n.x == null || n.y == null) continue;
        const nStyle = cfg.style.node(n.data, n.degree);
        const isActive = hasSelectionRef.current ? activeNodeIdsRef.current.has(n.id) : true;
        const nodeAlpha = hasSelectionRef.current ? (isActive ? nStyle.opacity : 0.3) : nStyle.opacity;

        c.beginPath();
        c.arc(n.x, n.y, nStyle.radius, 0, 2 * Math.PI);
        c.fillStyle = nStyle.color;
        c.globalAlpha = nodeAlpha;
        c.fill();
        c.globalAlpha = 1.0;
        c.strokeStyle = '#fff';
        c.lineWidth = 1;
        c.stroke();
        if (nStyle.label) {
          c.globalAlpha = nodeAlpha;
          c.fillStyle = '#374151';
          c.font = '10px sans-serif';
          c.textAlign = 'center';
          c.fillText(n.name, n.x, n.y + nStyle.radius + 10);
          c.globalAlpha = 1.0;
        }

        if (selectedNodeIdsRef.current.has(n.id)) {
          c.beginPath();
          c.arc(n.x, n.y, nStyle.radius + 2, 0, 2 * Math.PI);
          c.strokeStyle = '#3b82f6';
          c.lineWidth = 2;
          c.setLineDash([4, 3]);
          c.stroke();
          c.setLineDash([]);
        }
      }

      c.restore();
    }

    drawFrameRef.current = drawFrame;

    const cfg = configRef.current;

    const simulation = d3
      .forceSimulation<SimpleNode>(simNodes)
      .force(
        'link',
        d3
          .forceLink<SimpleNode, SimpleEdge>(simEdges)
          .id((d) => d.id)
          .distance((d: any) => cfg.forces.edge(d.data).distance)
          .strength((d: any) => cfg.forces.edge(d.data).strength)
      )
      .force('charge', d3.forceManyBody<SimpleNode>()
        .strength((d: any) => cfg.forces.node(d.data).charge))
      .force('center', d3.forceCenter(width / 2, height / 2)
        .strength(cfg.simulation.centerStrength))
      .force('collide', d3.forceCollide<SimpleNode>()
        .radius((d: any) => {
          const nStyle = cfg.style.node(d.data, d.degree);
          return nStyle.radius + cfg.simulation.collisionPadding;
        }));

    simulation.alphaDecay(cfg.simulation.alphaDecay);
    simulation.velocityDecay(cfg.simulation.velocityDecay);

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

  const handleSearchNode = useCallback((query: string): boolean => {
    const lowerQ = query.toLowerCase();
    const match =
      simNodesRef.current.find((n) => n.name.toLowerCase() === lowerQ) ??
      simNodesRef.current.find((n) => n.name.toLowerCase().includes(lowerQ));

    if (!match || match.x == null || match.y == null) return false;

    if (!selectedNodeIdsRef.current.has(match.id)) {
      toggleNode(match.id);
    }

    return true;
  }, [toggleNode]);

  useEffect(() => {
    if (onSearchNode) {
      onSearchNode(handleSearchNode);
    }
  }, [onSearchNode, handleSearchNode]);

  // Zoom-to-fit when active set changes
  useEffect(() => {
    if (activeNodeIds.size === 0) return;
    let cancelled = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 40; // 40 × 50ms = 2s

    function tryZoomToFit() {
      if (cancelled) return;
      attempts++;

      if (!canvasRef.current || !zoomRef.current) {
        if (attempts < MAX_ATTEMPTS) setTimeout(tryZoomToFit, 50);
        return;
      }

      // Check that nodes have been positioned
      const activeNodes = simNodesRef.current.filter(
        (n) => activeNodeIds.has(n.id) && n.x != null && n.y != null
      );
      if (activeNodes.length === 0) {
        if (attempts < MAX_ATTEMPTS) setTimeout(tryZoomToFit, 50);
        return;
      }

      const canvas = canvasRef.current;
      const w = canvas.offsetWidth || 800;
      const h = canvas.offsetHeight || 600;
      const t = zoomTransformRef.current;

      // Compute bounding box of active nodes in simulation coords
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const n of activeNodes) {
        const cfg = configRef.current;
        const r = cfg.style.node(n.data, n.degree).radius;
        minX = Math.min(minX, n.x! - r);
        minY = Math.min(minY, n.y! - r);
        maxX = Math.max(maxX, n.x! + r);
        maxY = Math.max(maxY, n.y! + r);
      }

      // Check if all active nodes are already visible in viewport
      const viewMinX = (0 - t.x) / t.k;
      const viewMinY = (0 - t.y) / t.k;
      const viewMaxX = (w - t.x) / t.k;
      const viewMaxY = (h - t.y) / t.k;

      if (minX >= viewMinX && maxX <= viewMaxX && minY >= viewMinY && maxY <= viewMaxY) {
        return; // already visible
      }

      // Compute zoom transform to fit bounding box with padding
      const padding = 40;
      const bboxW = maxX - minX;
      const bboxH = maxY - minY;
      const scale = Math.min(
        (w - 2 * padding) / Math.max(bboxW, 1),
        (h - 2 * padding) / Math.max(bboxH, 1),
        4, // max zoom
      );
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const transform = d3.zoomIdentity
        .translate(w / 2 - cx * scale, h / 2 - cy * scale)
        .scale(scale);

      d3.select(canvas as any)
        .transition()
        .duration(250)
        .call((zoomRef.current as any).transform, transform);
    }

    tryZoomToFit();
    return () => { cancelled = true; };
  }, [activeNodeIds]);

  // External highlight (from Stats tab cross-navigation)
  // RepoGraph may remount when switching tabs, so the simulation may not
  // have positioned nodes yet. Wait for the simulation to exist, then
  // fast-forward it to completion before zooming to the target node.
  useEffect(() => {
    if (!highlightedNodeId) return;
    let cancelled = false;
    let highlightTimer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;
    const MAX_ATTEMPTS = 40; // 40 × 50ms = 2s

    function tryHighlight() {
      if (cancelled) return;
      attempts++;

      if (!simulationRef.current || !canvasRef.current || !zoomRef.current) {
        if (attempts < MAX_ATTEMPTS) {
          setTimeout(tryHighlight, 50);
        }
        return;
      }

      // Fast-forward the simulation to its settled state
      const sim = simulationRef.current;
      sim.stop();
      while (sim.alpha() > sim.alphaMin()) {
        sim.tick();
      }
      drawFrameRef.current?.();

      const match = simNodesRef.current.find((n) => n.id === highlightedNodeId);
      if (!match || match.x == null || match.y == null) return;

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

      // Set highlight after zoom transition completes
      setTimeout(() => {
        if (cancelled) return;
        highlightedNodeIdRef.current = match.id;
        drawFrameRef.current?.();

        highlightTimer = setTimeout(() => {
          highlightedNodeIdRef.current = null;
          drawFrameRef.current?.();
        }, 5000);
      }, 500);
    }

    tryHighlight();

    return () => {
      cancelled = true;
      if (highlightTimer) clearTimeout(highlightTimer);
    };
  }, [highlightedNodeId]);

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
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
      />
    </div>
  );
}
