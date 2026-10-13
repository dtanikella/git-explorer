'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import type { AnalysisResult, AnalysisNode, AnalysisEdge } from '@/lib/analysis/types';
import type { RepoGraphConfig } from '@/lib/analysis/graph-config';
import { DEFAULT_REPO_GRAPH_CONFIG, buildStructuralBonds } from '@/lib/analysis/graph-config';
import {
  ancestorFolders,
  buildDirectoryHubs,
  fileHubId,
  folderHubId,
  type DirectoryEdgeKind,
  type DirectoryHubKind,
} from '@/lib/analysis/directory-hubs';
import {
  computeFileOverlays,
  drawFileOverlays,
  overlayAt,
  type FileOverlay,
  type OverlayEmphasis,
  type OverlayInput,
} from '@/lib/analysis/file-overlay';
import { useSelection } from '@/app/contexts/SelectionContext';
import { useAreaStore } from '@/app/contexts/AreaContext';
import { drawAreaOverlays, computeAreaHull } from '@/lib/areas/renderer';
import { resolveAreaInfluence } from '@/lib/areas/property-resolver';
import { getDescendantIds } from '@/lib/areas/containment';
import { buildAreaAnchors, type AreaAnchorNode } from '@/lib/areas/anchors';
import { buildCrossAreaEdgeWeights, buildNodeCrossAreaTargets } from '@/lib/areas/cross-area-edges';
import {
  createClusterPullForce,
  createAreaAttractForce,
  createParentPullForce,
  createAnchorRepelForce,
  createAreaPinForce,
  createCrossAreaPullForce,
  createAreaHullCollisionForce,
} from '@/lib/areas/forces';

type ConfigOrFactory = RepoGraphConfig | ((edges: AnalysisEdge[], nodes: AnalysisNode[]) => RepoGraphConfig);

interface RepoGraphProps {
  repoPath: string;
  hideTestFiles: boolean;
  config?: ConfigOrFactory;
  onSearchNode?: (handler: (query: string) => boolean) => void;
  analysisData: AnalysisResult | null;
  loading: boolean;
  error: string | null;
  /** `dark` draws on a dark canvas and calls out diff-changed, selected and locked nodes and their file overlays; default `light` */
  theme?: 'light' | 'dark';
}

/** Dark-theme colors: diff status fills, selection rings and the canvas itself. */
const DARK = {
  canvas: '#0b0f19',
  border: '#1f2937',
  node: '#64748b',
  edge: '#64748b',
  label: '#e5e7eb',
  selected: '#f8fafc',
  locked: '#fbbf24',
  status: { added: '#4ade80', modified: '#60a5fa', deleted: '#f87171' } as Record<string, string>,
} as const;

/** The diff color of a node, or null when it is unchanged or not part of a diff. */
function changeColor(n: AnalysisNode): string | null {
  const status = (n as { diffStatus?: string }).diffStatus;
  return status ? DARK.status[status] ?? null : null;
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
  /** set on synthetic structural-bond links, which are simulated but never drawn */
  bond?: { distance: number; strength: number };
}

/** Synthetic file/folder anchor: simulated, optionally drawn, never selectable, searchable or hoverable. */
interface HubNode extends d3.SimulationNodeDatum {
  id: string;
  kind: 'hub';
  hubKind: DirectoryHubKind;
  path: string;
  /** the nodes the hub holds: a file's own, or everything under a folder */
  members: SimpleNode[];
}

/** Link between a node/hub and its containing hub; `edgeKind` picks the tier's drawing style. */
interface HubLink extends SimpleEdge {
  edgeKind: DirectoryEdgeKind;
}

/**
 * Which file overlays to call out: those holding a locked or selected node.
 *
 * @param hubs - The directory hubs; only file hubs are considered.
 * @param selectedIds - Selected node ids.
 * @param lockedIds - Locked node ids.
 * @returns Emphasis by file hub id. The accent is the diff color most of the file's highlighted nodes share, else the selection color.
 */
function overlayEmphasis(
  hubs: readonly HubNode[],
  selectedIds: ReadonlySet<string>,
  lockedIds: ReadonlySet<string>,
): Map<string, OverlayEmphasis> {
  const out = new Map<string, OverlayEmphasis>();
  for (const hub of hubs) {
    if (hub.hubKind !== 'FILE') continue;
    let locked = false;
    let any = false;
    const tally = new Map<string, number>();
    for (const m of hub.members) {
      const isLocked = lockedIds.has(m.id);
      if (!isLocked && !selectedIds.has(m.id)) continue;
      any = true;
      locked ||= isLocked;
      const color = changeColor(m.data);
      if (color) tally.set(color, (tally.get(color) ?? 0) + 1);
    }
    if (!any) continue;
    let accent: string = DARK.selected;
    let best = 0;
    for (const [color, count] of tally) if (count > best) { best = count; accent = color; }
    out.set(hub.id, { level: locked ? 'locked' : 'selected', accent });
  }
  return out;
}

/**
 * Canvas-based D3 force-directed graph with area overlays and zoom/pan.
 *
 * @remarks
 * Renders the analysis node/edge graph using a canvas element with D3
 * force simulation. Supports zoom, pan, hover tooltips, area hull
 * overlays, and node selection. The diff view mode selects nodes
 * permanently rather than interactively.
 *
 * @param repoPath - Repository path for click-to-explore navigation.
 * @param hideTestFiles - Whether test files are filtered from the view.
 * @param config - Graph configuration (filters, style, forces, simulation).
 * @param onSearchNode - Callback when a node is selected via search.
 * @param analysisData - The full analysis result (nodes and edges).
 * @param loading - Whether analysis is in progress.
 * @param error - Analysis error message, if any.
 * @param theme - `dark` for the diff view's dark canvas and highlighting; default `light`.
 */
export default function RepoGraph({ repoPath, hideTestFiles, config, onSearchNode, analysisData, loading, error, theme = 'light' }: RepoGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const tooltipRef = useRef<d3.Selection<HTMLDivElement, unknown, HTMLElement, any> | null>(null);
  const simulationRef = useRef<d3.Simulation<SimpleNode, SimpleEdge> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<HTMLCanvasElement, unknown> | null>(null);
  const zoomTransformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
  const simNodesRef = useRef<SimpleNode[]>([]);
  const hoveredNodeRef = useRef<SimpleNode | null>(null);
  const hoveredAreaIdRef = useRef<string | null>(null);
  const hoveredOverlayRef = useRef<FileOverlay | null>(null);
  const overlaysRef = useRef<FileOverlay[]>([]);
  const drawFrameRef = useRef<(() => void) | null>(null);
  const refreshOverlaysRef = useRef<(() => void) | null>(null);
  const configRef = useRef<RepoGraphConfig>(DEFAULT_REPO_GRAPH_CONFIG);
  const toggleNodeRef = useRef<(id: string) => void>(() => {});

  const [ctxError, setCtxError] = useState(false);
  const { activeNodeIds, hasSelection, toggleNode } = useSelection();
  const selectionState = useSelection().state;
  const selectedNodeIds = selectionState.selectedNodeIds;
  const lockedNodeIds = selectionState.lockedNodeIds;
  const lockedNodeIdsRef = useRef(lockedNodeIds);
  const themeRef = useRef(theme);
  const activeNodeIdsRef = useRef(activeNodeIds);
  const selectedNodeIdsRef = useRef(selectedNodeIds);
  const hasSelectionRef = useRef(hasSelection);

  const { areas, runtimeState, nodeToAreas, getVisibleAreas } = useAreaStore();
  const areasRef = useRef(areas);
  const runtimeStateRef = useRef(runtimeState);
  const nodeToAreasRef = useRef(nodeToAreas);
  const getVisibleAreasRef = useRef(getVisibleAreas);
  const anchorsRef = useRef<Map<string, AreaAnchorNode>>(new Map());

  useEffect(() => {
    activeNodeIdsRef.current = activeNodeIds;
    selectedNodeIdsRef.current = selectedNodeIds;
    lockedNodeIdsRef.current = lockedNodeIds;
    themeRef.current = theme;
    hasSelectionRef.current = hasSelection;
    toggleNodeRef.current = toggleNode;
    // dark overlays keep files holding a selected or locked node, so the set of overlays follows the selection
    refreshOverlaysRef.current?.();
    drawFrameRef.current?.();
  }, [activeNodeIds, selectedNodeIds, lockedNodeIds, hasSelection, toggleNode, theme]);

  useEffect(() => {
    areasRef.current = areas;
    runtimeStateRef.current = runtimeState;
    nodeToAreasRef.current = nodeToAreas;
    getVisibleAreasRef.current = getVisibleAreas;
    drawFrameRef.current?.();
  }, [areas, runtimeState, nodeToAreas, getVisibleAreas]);

  const resolvedConfig = useMemo(() => {
    if (!analysisData) {
      return config && typeof config !== 'function'
        ? config
        : DEFAULT_REPO_GRAPH_CONFIG;
    }

    return typeof config === 'function'
      ? config(analysisData.edges, analysisData.nodes)
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

    // Area hull hit-testing (deepest-only, never highlight ancestor alongside child)
    const areaHitTest = () => {
      if (!canvasRef.current) return null;
      const cursorAreas: string[] = [];
      const visibleAreas = areasRef.current.filter(
        (a) => runtimeStateRef.current.get(a.id)?.visible !== false,
      );
      const nodePositionMap = new Map<string, { x: number; y: number; radius: number }>();
      for (const n of simNodesRef.current) {
        if (n.x == null || n.y == null) continue;
        const cfg = configRef.current;
        const nStyle = cfg.style.node(n.data, n.degree);
        nodePositionMap.set(n.id, { x: n.x, y: n.y, radius: nStyle.radius });
      }
      const areasById = new Map(visibleAreas.map((a) => [a.id, a]));

      for (const area of visibleAreas) {
        const hull = computeAreaHull(area, nodePositionMap, areasById);
        if (!hull) continue;
        let contains = false;
        if (hull.type === 'circle') {
          const dx = mx - hull.cx;
          const dy = my - hull.cy;
          contains = Math.sqrt(dx * dx + dy * dy) <= hull.r;
        } else {
          contains = d3.polygonContains(hull.points, [mx, my]);
        }
        if (contains) cursorAreas.push(area.id);
      }

      if (cursorAreas.length === 0) return null;

      // Find deepest area — the one with no visible descendant also containing the point
      for (const id of cursorAreas) {
        const descendants = getDescendantIds(visibleAreas, id);
        const hasDescendantAlsoContaining = [...descendants].some((did) =>
          cursorAreas.includes(did) &&
          runtimeStateRef.current.get(did)?.visible !== false,
        );
        if (!hasDescendantAlsoContaining) {
          return id;
        }
      }
      // Fallback: first containing area (shouldn't normally reach here)
      return cursorAreas[0];
    };

    // File overlays (directory views): the overlay under the cursor, when no node is
    const overlay = !found && configRef.current.forces.directory ? overlayAt(overlaysRef.current, mx, my) : null;
    if (overlay?.id !== hoveredOverlayRef.current?.id) {
      hoveredOverlayRef.current = overlay;
      drawFrameRef.current?.();
    }
    if (overlay && tooltipRef.current) {
      tooltipRef.current
        .style('visibility', 'visible')
        .text(`${overlay.path} · ${overlay.memberCount} nodes`)
        .style('top', event.pageY - 10 + 'px')
        .style('left', event.pageX + 10 + 'px');
    } else if (!found && tooltipRef.current) {
      tooltipRef.current.style('visibility', 'hidden');
    }

    const hitAreaId = configRef.current.forces.directory ? null : areaHitTest();
    if (hitAreaId !== hoveredAreaIdRef.current) {
      hoveredAreaIdRef.current = hitAreaId;
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.style.cursor = hitAreaId ? 'pointer' : 'default';
      }
      // Redraw to reflect highlight change
      drawFrameRef.current?.();
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    hoveredNodeRef.current = null;
    hoveredAreaIdRef.current = null;
    hoveredOverlayRef.current = null;
    if (canvasRef.current) {
      canvasRef.current.style.cursor = 'default';
    }
    if (tooltipRef.current) {
      tooltipRef.current.style('visibility', 'hidden');
    }
    drawFrameRef.current?.();
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

    // Canvas shadows are costly: with many changed nodes, glow them only once zoomed in
    const changedTotal = themeRef.current === 'dark' ? simNodes.reduce((k, n) => k + (changeColor(n.data) ? 1 : 0), 0) : 0;

    function drawFrame() {
      const c = ctxRef.current;
      const cv = canvasRef.current;
      if (!c || !cv) return;
      const t = zoomTransformRef.current;
      const cfg = configRef.current;

      c.clearRect(0, 0, cv.width, cv.height);
      c.save();
      c.setTransform(t.k, 0, 0, t.k, t.x, t.y);

      // Draw area overlays (behind edges and nodes)
      const nodePositionMap = new Map<string, { x: number; y: number; radius: number }>();
      for (const n of simNodes) {
        if (n.x == null || n.y == null) continue;
        const nStyle = cfg.style.node(n.data, n.degree);
        nodePositionMap.set(n.id, { x: n.x, y: n.y, radius: nStyle.radius });
      }
      const dirCfg = cfg.forces.directory;
      if (dirCfg) {
        if (dirCfg.overlay) {
          const dark = themeRef.current === 'dark';
          drawFileOverlays(c, overlaysRef.current, dirCfg.overlay, hoveredOverlayRef.current?.id ?? null, {
            theme: themeRef.current,
            emphasis: dark ? overlayEmphasis(hubNodes, selectedNodeIdsRef.current, lockedNodeIdsRef.current) : undefined,
          });
        }
      } else {
        drawAreaOverlays(c, areasRef.current, runtimeStateRef.current, nodePositionMap, hoveredAreaIdRef.current);
      }

      // Draw directory links (only tiers with a style) and hubs that are not fully transparent, behind the nodes
      if (directory) {
        for (const l of hubLinks) {
          const style = directory.tiers[l.edgeKind].style;
          const src = l.source as unknown as HubNode | SimpleNode;
          const tgt = l.target as unknown as HubNode | SimpleNode;
          if (!style || src.x == null || src.y == null || tgt.x == null || tgt.y == null) continue;
          c.beginPath();
          c.moveTo(src.x, src.y);
          c.lineTo(tgt.x, tgt.y);
          c.strokeStyle = style.color;
          c.lineWidth = style.width;
          c.globalAlpha = style.opacity;
          c.stroke();
          c.globalAlpha = 1.0;
        }
        for (const h of hubNodes) {
          const style = directory.hubs[h.hubKind];
          if (style.opacity <= 0 || h.x == null || h.y == null) continue;
          c.beginPath();
          c.arc(h.x, h.y, style.radius, 0, 2 * Math.PI);
          c.fillStyle = style.color;
          c.globalAlpha = style.opacity;
          c.fill();
          c.globalAlpha = 1.0;
        }
      }

      // Draw edges
      const dark = themeRef.current === 'dark';
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
          c.strokeStyle = dark ? DARK.edge : eStyle.color;
        }
        c.lineWidth = eStyle.width;
        const edgeChanged = dark && (changeColor(src.data) != null || changeColor(tgt.data) != null);
        const edgeFade = dark && !edgeChanged ? 0.45 : 1;

        // Compute area filtering state for edges
        const allAreasE = areasRef.current;
        const visibleAreasE = getVisibleAreasRef.current();
        const isAreaFilteringE = allAreasE.length > 0 && visibleAreasE.length < allAreasE.length;

        if (hasSelectionRef.current) {
          const srcActive = activeNodeIdsRef.current.has(src.id);
          const tgtActive = activeNodeIdsRef.current.has(tgt.id);
          c.globalAlpha = (srcActive || tgtActive) ? eStyle.opacity * edgeFade : 0.15;
        } else if (isAreaFilteringE) {
          const srcInArea = resolveAreaInfluence(src.id, visibleAreasE, nodeToAreasRef.current);
          const tgtInArea = resolveAreaInfluence(tgt.id, visibleAreasE, nodeToAreasRef.current);
          const bothDimmed = srcInArea?.dimmed && tgtInArea?.dimmed;
          c.globalAlpha = bothDimmed ? 0.08 : eStyle.opacity * edgeFade;
        } else {
          c.globalAlpha = eStyle.opacity * edgeFade;
        }

        c.stroke();
        c.globalAlpha = 1.0;
      }

      // Draw nodes
      const cfgZoom = t.k;
      for (const n of simNodes) {
        if (n.x == null || n.y == null) continue;
        const nStyle = cfg.style.node(n.data, n.degree);
        const isActive = hasSelectionRef.current ? activeNodeIdsRef.current.has(n.id) : true;
        const nodeAlpha = hasSelectionRef.current ? (isActive ? nStyle.opacity : 0.3) : nStyle.opacity;

        // Only apply area dimming when user has toggled some areas off (active filter)
        const allAreas = areasRef.current;
        const visibleAreas = getVisibleAreasRef.current();
        const isAreaFiltering = allAreas.length > 0 && visibleAreas.length < allAreas.length;
        const areaInfluence = isAreaFiltering
          ? resolveAreaInfluence(n.id, visibleAreas, nodeToAreasRef.current)
          : null;
        // Never dim active/selected nodes via area influence
        const finalAlpha = (areaInfluence?.dimmed && !isActive) ? Math.min(nodeAlpha, 0.15) : nodeAlpha;

        const isSelected = selectedNodeIdsRef.current.has(n.id);
        const isLocked = lockedNodeIdsRef.current.has(n.id);
        const changed = dark ? changeColor(n.data) : null;
        const radius = changed ? nStyle.radius + 1 : nStyle.radius;

        c.beginPath();
        c.arc(n.x, n.y, radius, 0, 2 * Math.PI);
        if (dark) {
          // diff-changed nodes glow in their status color; everything else recedes
          c.fillStyle = changed ?? DARK.node;
          c.globalAlpha = changed ? Math.max(finalAlpha, 0.9) : Math.min(finalAlpha, isSelected || isLocked ? 0.8 : 0.45);
          if (changed && (changedTotal <= 1500 || cfgZoom >= 2)) {
            c.shadowColor = changed;
            c.shadowBlur = 14;
          }
          c.fill();
          c.shadowBlur = 0;
          c.globalAlpha = 1.0;
          c.strokeStyle = DARK.canvas;
        } else {
          c.fillStyle = nStyle.color;
          c.globalAlpha = finalAlpha;
          c.fill();
          c.globalAlpha = 1.0;
          c.strokeStyle = '#fff';
        }
        c.lineWidth = 1;
        c.stroke();

        const showLabel = nStyle.label || (dark && (changed != null || isSelected || isLocked) && cfgZoom >= 1.5);
        if (showLabel) {
          c.globalAlpha = dark ? 1 : finalAlpha;
          c.fillStyle = dark ? DARK.label : '#374151';
          c.font = '10px sans-serif';
          c.textAlign = 'center';
          c.fillText(n.name, n.x, n.y + radius + 10);
          c.globalAlpha = 1.0;
        }

        // Rings: locked is solid, selected is dashed; a node can carry both
        if (isLocked && dark) {
          c.beginPath();
          c.arc(n.x, n.y, radius + 5, 0, 2 * Math.PI);
          c.strokeStyle = DARK.locked;
          c.lineWidth = 2;
          c.stroke();
        }
        if (isSelected) {
          c.beginPath();
          c.arc(n.x, n.y, radius + 2, 0, 2 * Math.PI);
          c.strokeStyle = dark ? DARK.selected : '#3b82f6';
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

    const anchors = buildAreaAnchors(areas, anchorsRef.current);
    anchorsRef.current = new Map(anchors.map((a) => [a.areaId, a]));
    const areasById = new Map(areas.map((a) => [a.id, a]));
    const simEdgePairs: Array<[string, string]> = simEdges.map((e) => [
      e.source as unknown as string,
      e.target as unknown as string,
    ]);
    const crossAreaWeights = buildCrossAreaEdgeWeights(simEdgePairs, nodeToAreas);
    const nodeCrossAreaTargets = buildNodeCrossAreaTargets(simEdgePairs, nodeToAreas);
    const directory = cfg.forces.directory;
    const hubData = directory ? buildDirectoryHubs(simNodes.map((n) => ({ id: n.id, filePath: n.data.filePath }))) : null;
    const hubNodes: HubNode[] = hubData
      ? hubData.hubs.map((h) => ({ id: h.id, kind: 'hub', hubKind: h.kind, path: h.path, members: [] }))
      : [];
    const hubById = new Map(hubNodes.map((h) => [h.id, h]));
    if (hubData) {
      for (const n of simNodes) {
        hubById.get(fileHubId(n.data.filePath))?.members.push(n);
        for (const folder of ancestorFolders(n.data.filePath)) hubById.get(folderHubId(folder))?.members.push(n);
      }
    }
    const hubLinks: HubLink[] = directory && hubData
      ? hubData.links.map((l) => ({
          source: l.source,
          target: l.target,
          data: undefined as unknown as AnalysisEdge,
          bond: { distance: directory.tiers[l.kind].distance, strength: directory.tiers[l.kind].strength },
          edgeKind: l.kind,
        }))
      : [];
    const allSimNodes: Array<SimpleNode | AreaAnchorNode | HubNode> = [...simNodes, ...anchors, ...hubNodes];
    const bondLinks: SimpleEdge[] = cfg.forces.bonds
      ? buildStructuralBonds(
          simNodes.map((n) => n.data),
          cfg.forces.bonds,
          new Map([...nodeToAreas].map(([id, list]) => [id, list.map((a) => a.id)])),
        ).map((b) => ({
          source: b.source,
          target: b.target,
          data: undefined as unknown as AnalysisEdge,
          bond: { distance: b.distance, strength: b.strength },
        }))
      : [];

    const simulation = d3
      .forceSimulation<any>(allSimNodes)
      .force(
        'link',
        d3
          .forceLink<SimpleNode, SimpleEdge>([...simEdges, ...bondLinks, ...hubLinks])
          .id((d) => d.id)
          .distance((d: any) => (d.bond ?? cfg.forces.edge(d.data)).distance)
          .strength((d: any) => (d.bond ?? cfg.forces.edge(d.data)).strength)
      )
      .force('charge', d3.forceManyBody<any>()
        .strength((d: any) => {
          if (d.kind === 'anchor') return 0;
          if (d.kind === 'hub') return directory?.hubs[d.hubKind as DirectoryHubKind].charge ?? 0;
          return cfg.forces.node(d.data).charge;
        }))
      .force('center', d3.forceCenter(width / 2, height / 2)
        .strength(cfg.simulation.centerStrength))
      .force('collide', d3.forceCollide<any>()
        .radius((d: any) => {
          if (d.kind === 'anchor' || d.kind === 'hub') return 0;
          const nStyle = cfg.style.node(d.data, d.degree);
          return nStyle.radius + cfg.simulation.collisionPadding;
        }))
      .force('anchorRepel', createAnchorRepelForce(anchors, simNodes, nodeToAreas, areasById, cfg.forces.anchorRepel))
      .force('clusterPull', createClusterPullForce(simNodes, nodeToAreas, anchorsRef.current, cfg.forces.areaCluster))
      .force('areaAttract', createAreaAttractForce(anchors, crossAreaWeights, cfg.forces.areaAttract))
      .force('parentPull', createParentPullForce(anchors, areasById, cfg.forces.areaParent))
      .force('areaPin', createAreaPinForce(anchors, areasById, width, height, cfg.forces.areaPin))
      .force('crossAreaPull', createCrossAreaPullForce(
        simNodes,
        nodeToAreas,
        nodeCrossAreaTargets,
        anchorsRef.current,
        areasById,
        width,
        height,
        cfg.forces.crossAreaPull,
      ))
      .force('areaHullCollision', createAreaHullCollisionForce(
        simNodes,
        areas,
        areasById,
        cfg.forces.areaHullCollision,
      ));

    // Data Flow view only: pull nodes manually tagged with a `storage`/`api`/`ux` Area
    // toward a concentric ring keyed by that area's name (see DATA_FLOW_LAYER_RADII).
    // `cfg.forces.layerRadii` is undefined for every other view, so this is a no-op there.
    if (cfg.forces.layerRadii) {
      const layerRadii = cfg.forces.layerRadii;
      const targetRadiusOf = (d: SimpleNode | AreaAnchorNode): number | null => {
        if ('kind' in d && d.kind === 'anchor') return null;
        const memberAreas = nodeToAreas.get((d as SimpleNode).id) ?? [];
        const radii = memberAreas
          .map((a) => layerRadii[a.name])
          .filter((r): r is number => r != null);
        if (radii.length === 0) return null;
        return radii.reduce((sum, r) => sum + r, 0) / radii.length;
      };
      simulation.force(
        'layerRadial',
        d3.forceRadial<any>((d) => targetRadiusOf(d) ?? 0, width / 2, height / 2)
          .strength((d) => (targetRadiusOf(d) == null ? 0 : 0.3)),
      );
    }

    // Directory views: pull each hub to the centroid of what it holds, so the hub and the overlay centered on it sit in the middle of their members
    if (directory && directory.hubCenter > 0) {
      const k = directory.hubCenter;
      simulation.force('hubCenter', () => {
        for (const hub of hubNodes) {
          if (hub.x == null || hub.y == null) continue;
          let sx = 0, sy = 0, count = 0;
          for (const m of hub.members) if (m.x != null && m.y != null) { sx += m.x; sy += m.y; count++; }
          if (count) { hub.vx = (sx / count - hub.x) * k; hub.vy = (sy / count - hub.y) * k; }
        }
      });
    }

    const updateOverlays = () => {
      if (!directory?.overlay) return;
      const inputs: OverlayInput[] = [];
      for (const hub of hubNodes) {
        if (hub.hubKind !== 'FILE') continue;
        inputs.push({
          id: hub.id,
          path: hub.path,
          center: hub.x != null && hub.y != null ? { x: hub.x, y: hub.y } : null,
          members: hub.members
            .filter((m) => m.x != null && m.y != null)
            .map((m) => ({ x: m.x as number, y: m.y as number, r: cfg.style.node(m.data, m.degree).radius })),
        });
      }
      // In the dark theme a file holding a selected or locked node keeps its overlay however few nodes it has
      let keep: Set<string> | undefined;
      if (themeRef.current === 'dark') {
        keep = new Set();
        for (const hub of hubNodes) {
          if (hub.hubKind === 'FILE' && hub.members.some((m) => selectedNodeIdsRef.current.has(m.id) || lockedNodeIdsRef.current.has(m.id))) keep.add(hub.id);
        }
      }
      overlaysRef.current = [...computeFileOverlays(inputs, directory.overlay, keep).values()];
    };

    // d3's simulation.tick() does not fire 'tick', so a caller that steps the simulation by hand must refresh the overlays itself
    refreshOverlaysRef.current = updateOverlays;

    simulation.alphaDecay(cfg.simulation.alphaDecay);
    simulation.velocityDecay(cfg.simulation.velocityDecay);

    simulationRef.current = simulation;
    simulation.on('tick', () => {
      updateOverlays();
      drawFrame();
    });

    const zoomBehavior = d3
      .zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.1, 8])
      .on('zoom', (event) => {
        zoomTransformRef.current = event.transform;
        drawFrame();
      });
    zoomRef.current = zoomBehavior;
    d3.select(canvas as any).call(zoomBehavior as any);

    // Click-to-select using native events to avoid d3-zoom interference
    let pointerDownPos: { x: number; y: number } | null = null;

    const onPointerDown = (event: PointerEvent) => {
      pointerDownPos = { x: event.clientX, y: event.clientY };
    };

    const onPointerUp = (event: PointerEvent) => {
      if (!pointerDownPos) return;
      const pdx = event.clientX - pointerDownPos.x;
      const pdy = event.clientY - pointerDownPos.y;
      pointerDownPos = null;
      if (Math.sqrt(pdx * pdx + pdy * pdy) > 3) return; // was a drag/pan

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
          toggleNodeRef.current(n.id);
          return;
        }
      }
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointerup', onPointerUp);

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
      overlaysRef.current = [];
      hoveredOverlayRef.current = null;
      zoomRef.current = null;
      drawFrameRef.current = null;
      refreshOverlaysRef.current = null;
      resizeObserver.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
    };
  }, [simNodes, simEdges, areas, nodeToAreas]);

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

      // If simulation exists but hasn't settled, fast-forward it
      if (simulationRef.current) {
        const sim = simulationRef.current;
        if (sim.alpha() > sim.alphaMin()) {
          sim.stop();
          while (sim.alpha() > sim.alphaMin()) {
            sim.tick();
          }
          refreshOverlaysRef.current?.();
          drawFrameRef.current?.();
        }
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

      // Compute zoom transform to fit bounding box with padding
      const padding = 60;
      const bboxW = maxX - minX;
      const bboxH = maxY - minY;
      const scale = Math.min(
        (w - 2 * padding) / Math.max(bboxW, 1),
        (h - 2 * padding) / Math.max(bboxH, 1),
        3, // max zoom — don't zoom too close on single nodes
      );
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const transform = d3.zoomIdentity
        .translate(w / 2 - cx * scale, h / 2 - cy * scale)
        .scale(scale);

      d3.select(canvas as any)
        .transition()
        .duration(300)
        .call((zoomRef.current as any).transform, transform);
    }

    tryZoomToFit();
    return () => { cancelled = true; };
  }, [activeNodeIds]);

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
    <div style={{ width: '100%', height: '100%', background: theme === 'dark' ? DARK.canvas : '#fff', borderRadius: 8, border: `1px solid ${theme === 'dark' ? DARK.border : '#ccc'}`, position: 'relative' }}>
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
