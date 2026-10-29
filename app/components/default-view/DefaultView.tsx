'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { easeCubicOut } from 'd3-ease';
import { select } from 'd3-selection';
import 'd3-transition';
import { zoom, zoomIdentity } from 'd3-zoom';
import type { ZoomBehavior } from 'd3-zoom';
import type { AnalysisResult, EdgeKind } from '@/lib/analysis/types';
import { buildHierarchy } from '@/lib/default/adapter';
import { layoutBands } from '@/lib/default/bands';
import type { Band } from '@/lib/default/bands';
import { centreOn, fitTransform } from '@/lib/default/camera';
import { cardContent, connectionsView, defaultDirection, EDGE_KIND_STYLE } from '@/lib/default/card';
import { rollupDiff } from '@/lib/default/diff';
import { buildConnections } from '@/lib/default/connections';
import { treeCurve } from '@/lib/default/edge-arc';
import { CANVAS_BACKGROUND, DEFAULT_VIEW_CONFIG, nodeStyle } from '@/lib/default/config';
import { emphasisedOpacity, parentMap, sliceOf } from '@/lib/default/hover';
import type { Slice } from '@/lib/default/hover';
import { layoutLabels } from '@/lib/default/labels';
import type { LabelPlacement, LabelState, Measure } from '@/lib/default/labels';
import { layoutRadial, nodeContext } from '@/lib/default/layout';
import type { PositionedNode } from '@/lib/default/layout';
import type { Direction, DotEdge, HierarchyNode } from '@/lib/default/types';
import InfoCard from './InfoCard';
import SymbolSearch from './SymbolSearch';

interface DefaultViewProps {
  analysisData: AnalysisResult | null;
  loading: boolean;
  error: string | null;
  /** `analysisData` is a diff result (nodes carry `diffStatus`, plus ghosts): mark the changes. Off draws as before. */
  diffMode?: boolean;
}

const { separator, hover: hoverStyle, label: labelStyle, diff: diffStyle } = DEFAULT_VIEW_CONFIG;

/** A press that moves farther than this many px is a pan, never a click. */
const CLICK_SLOP = 4;
/** The docked card's width (300px) plus its right margin, kept clear when fitting the camera. */
const CARD_FOOTPRINT = 312;
/** Past this many edges at one symbol, a pin draws none until a category narrows them. */
const MAX_DRAWN_EDGES = 300;
const CAMERA_MS = 500;
/** Drawing values for pinned-symbol edges: alpha, width (px) and arrowhead size (px). */
const EDGE_DRAW = {
  all: { alpha: 0.5, width: 1.3, arrow: 8 },
  strong: { alpha: 0.95, width: 2.2, arrow: 11 },
  faint: { alpha: 0.1, width: 1, arrow: 0 },
};

/**
 * Radial hierarchy of the repository, drawn as bands and symbols: a translucent band per folder and file, and a dot
 * per top-level symbol. Folder and file nodes and the edges between them are laid out but not drawn.
 *
 * @remarks
 * Pan and zoom with d3-zoom, hover and clicking a symbol are the interactions. Hovering a folder band, a file
 * band or a symbol highlights its slice (the band, its ancestors, and everything beneath a folder), dims the rest, and
 * fills a docked info card, which keeps showing the last hovered item after the pointer leaves. Clicking a symbol
 * pins it: the card takes the pointer and lists its connections by edge kind, and every edge at the symbol is drawn.
 * Clicking a category on the card fits the camera to the symbol and that category's targets and dims the rest; Esc
 * clears the category, then the pin, and so does a click that is not on a symbol (band or empty canvas). A press that
 * moves more than a few px is a pan and never pins or unpins. A fuzzy search box in the top left (`SymbolSearch`) pins a
 * symbol the same way and also centres it, keeping the zoom; unpinning returns to the earlier camera. Member edges show on the owning symbol's dot
 * (`buildConnections`). Reloading `analysisData` clears the pin. Folder names are
 * placed on the bands in screen space by `layoutLabels`, recomputed (one animation frame at a time) when the pan or
 * zoom changes. Structure comes from `buildHierarchy`, positions from `layoutRadial`, bands from `layoutBands`, and
 * every size and color from the config, so this component holds no display values of its own.
 *
 * With `diffMode` on, `analysisData` is a diff result. Changed files keep their color and carry a stacked added /
 * modified / deleted rim, unchanged files fade and unchanged symbols dim, and changed symbols get a thin outline (dashed
 * for a deleted one, drawn as a ghost from the base commit). The rollups are found once per result in `model`, so hover
 * and pin never recompute them.
 *
 * @param analysisData - The page's analysis result, or a diff result in diff mode.
 * @param loading - Whether the analysis is running.
 * @param error - The analysis error, if any.
 * @param diffMode - Whether to mark the changes in `analysisData`.
 */
export default function DefaultView({ analysisData, loading, error, diffMode = false }: DefaultViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const groupRef = useRef<SVGGElement>(null);
  const transformRef = useRef(zoomIdentity);
  const labelStateRef = useRef<LabelState>(new Map());
  const [hovered, setHovered] = useState<HierarchyNode | null>(null);
  const [shown, setShown] = useState<HierarchyNode | null>(null);
  const [labels, setLabels] = useState<LabelPlacement[]>([]);
  const [pinned, setPinned] = useState<string | null>(null);
  const [direction, setDirection] = useState<Direction>('out');
  const [category, setCategory] = useState<EdgeKind | null>(null);
  const [preview, setPreview] = useState<EdgeKind | null>(null);
  const [scale, setScale] = useState(1);
  const behaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const fitRef = useRef(1);
  /** the camera from before the active category's fit, restored when the category ends */
  const savedCameraRef = useRef<typeof zoomIdentity | null>(null);
  const downRef = useRef<{ x: number; y: number } | null>(null);

  const model = useMemo(() => {
    if (!analysisData) return null;
    const rootName = analysisData.metadata.repoPath.split('/').filter(Boolean).pop() ?? '/';
    const root = buildHierarchy(analysisData, rootName);
    const layout = layoutRadial(root);
    const dots = new Map(layout.nodes.filter((p) => p.node.tier === 'symbol').map((p) => [p.node.id, p]));
    const byId = new Map([...dots].map(([id, p]) => [id, p.node]));
    const conn = buildConnections(analysisData.edges, new Set(dots.keys()));
    const positions = new Map(layout.nodes.map((p) => [p.node.id, p]));
    return { root, layout, bands: layoutBands(layout), parents: parentMap(root), positions, dots, byId, conn, symbols: [...byId.values()], diff: diffMode ? rollupDiff(root) : null };
  }, [analysisData, diffMode]);

  const pinnedConn = model && pinned ? model.conn.byDot.get(pinned) : undefined;
  const incident = useMemo(() => (model && pinned ? model.conn.edges.filter((e) => e.from === pinned || e.to === pinned) : []), [model, pinned]);
  const tooMany = incident.length > MAX_DRAWN_EDGES;
  const targets = useMemo(() => (category ? pinnedConn?.[direction].get(category) ?? [] : []), [pinnedConn, direction, category]);

  // While pinned, hover changes nothing; under a category, the pinned symbol's and its targets' files are the slice.
  const slice = useMemo(() => {
    if (!model) return null;
    if (!pinned) return hovered ? sliceOf(hovered, model.parents) : null;
    if (!category) return null;
    const chain = new Set<string>();
    for (const id of [pinned, ...targets]) {
      const node = model.byId.get(id);
      if (node) sliceOf(node, model.parents).chain.forEach((c) => chain.add(c));
    }
    return { chain, below: new Set<string>() } as Slice;
  }, [model, hovered, pinned, category, targets]);
  const dimExcept = useMemo(() => (category && pinned ? new Set([pinned, ...targets]) : null), [category, pinned, targets]);

  const restoreCamera = () => {
    const saved = savedCameraRef.current;
    savedCameraRef.current = null;
    const svg = svgRef.current;
    const behavior = behaviorRef.current;
    if (saved && svg && behavior) select(svg).transition().duration(CAMERA_MS).ease(easeCubicOut).call(behavior.transform, saved);
  };
  const pin = (id: string) => {
    restoreCamera();
    setHovered(null);
    setPinned(id);
    setCategory(null);
    setPreview(null);
    setDirection(defaultDirection(model?.conn.byDot.get(id)));
  };
  const unpin = () => {
    restoreCamera();
    setPinned(null);
    setCategory(null);
    setPreview(null);
  };
  const selectCategory = (kind: EdgeKind | null) => {
    setCategory(kind);
    if (!kind || !model || !pinned) return restoreCamera();
    const svg = svgRef.current;
    const behavior = behaviorRef.current;
    const ids = [pinned, ...(pinnedConn?.[direction].get(kind) ?? [])];
    const points = ids.flatMap((id) => model.dots.get(id) ?? []);
    if (!svg || !behavior || points.length === 0) return;
    if (!savedCameraRef.current) savedCameraRef.current = transformRef.current;
    const t = fitTransform(points, { viewport: { width: svg.clientWidth, height: svg.clientHeight }, cardWidth: CARD_FOOTPRINT, defaultFit: fitRef.current });
    select(svg).transition().duration(CAMERA_MS).ease(easeCubicOut).call(behavior.transform, zoomIdentity.translate(t.x, t.y).scale(t.k));
  };
  // Choosing a search result pins it like a click, then centres it (zoom kept) in the area left of the card. The camera
  // from before is saved so unpinning returns to it.
  const pickFromSearch = (id: string) => {
    const base = savedCameraRef.current ?? transformRef.current;
    pin(id);
    const svg = svgRef.current;
    const behavior = behaviorRef.current;
    const at = model?.dots.get(id);
    if (!svg || !behavior || !at) return;
    savedCameraRef.current = base;
    const k = transformRef.current.k;
    const t = centreOn(at, { width: svg.clientWidth, height: svg.clientHeight }, CARD_FOOTPRINT, k);
    select(svg).transition().duration(CAMERA_MS).ease(easeCubicOut).call(behavior.transform, zoomIdentity.translate(t.x, t.y).scale(t.k));
  };
  const changeDirection = (d: Direction) => {
    setDirection(d);
    setCategory(null);
    restoreCamera();
  };

  // Esc clears the category, then unpins.
  useEffect(() => {
    if (!pinned) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || (e.target as Element | null)?.tagName === 'INPUT') return; // Esc in the search box is the box's
      if (category) selectCategory(null);
      else unpin();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinned, category]);

  // A new analysis result drops the pin.
  useEffect(() => {
    savedCameraRef.current = null;
    setPinned(null);
    setCategory(null);
    setPreview(null);
  }, [model]);

  // Rebuilt when the layout or the hovered slice changes. The transform is applied to the group directly, so pan and
  // zoom never re-render these.
  const shapes = useMemo(() => {
    if (!model) return null;
    const { bands, layout, parents, diff } = model;
    const enter = (node: HierarchyNode) => (pinned ? {} : { onMouseEnter: () => setHovered(node), onMouseLeave: () => setHovered(null) });
    const inSlice = (id: string) => !slice || slice.chain.has(id) || slice.below.has(id);
    const highlighted = slice && !pinned ? bands.filter((b) => inSlice(b.node.node.id)) : [];
    const sectors = (list: Band[], props: (b: Band) => React.SVGProps<SVGPathElement>) =>
      list.map((b) => <path key={b.node.node.id} d={sectorPath(b)} {...props(b)} />);
    const separated = (b: Band) => ({
      fill: b.color,
      fillOpacity: emphasisedOpacity(b.opacity, b.node.node.id, slice) * (diff && !diff.changedIds.has(b.node.node.id) ? diffStyle.unchangedBand : 1),
      stroke: separator.color,
      strokeWidth: separator.width,
      vectorEffect: 'non-scaling-stroke' as const,
      strokeLinejoin: 'round' as const,
    });
    return (
      <>
        {bands.map((b) => (
          <path key={b.node.node.id} data-testid="band" data-tier={b.tier} d={sectorPath(b)} {...separated(b)} {...enter(b.node.node)} />
        ))}
        {highlighted.length > 0 && (
          // One border around the whole slice, outside the separator gap: stroke the slice wide, wipe the inner part
          // and the seams with the background, then redraw the slice on top.
          <g pointerEvents="none" data-testid="slice-border">
            {sectors(highlighted, () => ({
              fill: 'none',
              stroke: hoverStyle.border.color,
              strokeOpacity: hoverStyle.border.opacity,
              strokeWidth: separator.width + 2 * hoverStyle.border.width,
              vectorEffect: 'non-scaling-stroke',
              strokeLinejoin: 'round',
            }))}
            {sectors(highlighted, () => ({ fill: CANVAS_BACKGROUND }))}
            {sectors(highlighted, separated)}
          </g>
        )}
        {layout.nodes.filter((p) => p.node.tier === 'symbol').map((p) => {
          const s = nodeStyle(nodeContext(p.node));
          const fileId = parents.get(p.node.id)?.id ?? '';
          const status = diff && p.node.diffStatus && p.node.diffStatus !== 'unchanged' ? p.node.diffStatus : null;
          const diffOpacity = !diff ? 1 : !status ? diffStyle.unchangedSymbol : p.node.ghost ? diffStyle.ghost : 1;
          const opacity = (inSlice(fileId) && (!dimExcept || dimExcept.has(p.node.id)) ? 1 : hoverStyle.rest) * diffOpacity;
          return (
            <g key={p.node.id}>
              <circle
                cx={p.x}
                cy={p.y}
                r={s.radius}
                fill={s.color}
                opacity={opacity}
                data-symbol-id={p.node.id}
                data-diff-status={status ?? undefined}
                stroke="transparent"
                strokeWidth={6}
                vectorEffect="non-scaling-stroke"
                pointerEvents="all"
                {...enter(p.node)}
              />
              {status && (
                <circle
                  data-testid="diff-outline"
                  data-status={status}
                  cx={p.x}
                  cy={p.y}
                  r={s.radius + diffStyle.outline.gap}
                  fill="none"
                  stroke={diffStyle.color[status]}
                  strokeWidth={diffStyle.outline.width}
                  strokeDasharray={status === 'deleted' ? diffStyle.outline.dash.join(' ') : undefined}
                  vectorEffect="non-scaling-stroke"
                  opacity={opacity}
                  pointerEvents="none"
                />
              )}
            </g>
          );
        })}
      </>
    );
  }, [model, slice, pinned, dimExcept]);

  // The stacked rim beside each changed file. Sized by the zoom `scale`, so it keeps its width and gap on screen.
  const rimLayer = useMemo(() => {
    if (!model?.diff) return null;
    const { diff } = model;
    const { rim, color } = diffStyle;
    const u = 1 / scale;
    const at = (r: number, a: number) => `${r * Math.sin(a)} ${-r * Math.cos(a)}`;
    return (
      <g pointerEvents="none" data-testid="diff-rim">
        {model.bands.flatMap((b) => {
          const counts = b.tier === 'file' ? diff.byFile.get(b.node.node.id) : undefined;
          if (!counts) return [];
          const radius = b.outer + rim.gap * u;
          const width = Math.max(b.endAngle - b.startAngle, (rim.minArc * u) / radius);
          let from = (b.startAngle + b.endAngle) / 2 - width / 2;
          return (['added', 'modified', 'deleted'] as const).flatMap((status) => {
            if (!counts[status]) return [];
            const to = from + (width * counts[status]) / counts.changed;
            const d = `M ${at(radius, from)} A ${radius} ${radius} 0 ${to - from > Math.PI ? 1 : 0} 1 ${at(radius, to)}`;
            from = to;
            return [<path key={`${b.node.node.id}-${status}`} data-status={status} d={d} fill="none" stroke={color[status]} strokeWidth={rim.width} vectorEffect="non-scaling-stroke" />];
          });
        })}
      </g>
    );
  }, [model, scale]);

  // The pinned symbol's edges, rings and arrowheads. Sized by the zoom `scale`, so lines stay readable.
  const edgeLayer = useMemo(() => {
    if (!model || !pinned) return null;
    return drawEdges({ model, pinned, incident, tooMany, direction, emphasis: category ?? preview, targets, category, scale, fit: fitRef.current });
  }, [model, pinned, incident, tooMany, direction, category, preview, targets, scale]);

  useEffect(() => {
    if (hovered) setShown(hovered);
  }, [hovered]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !model) return;
    const { clientWidth: w, clientHeight: h } = svg;
    const extent = Math.max(...model.layout.nodes.map((n) => n.radius), 1);
    const fit = Math.min(w, h) / 2 / (extent * 1.05);
    fitRef.current = fit;
    const measure = textMeasurer();
    labelStateRef.current = new Map();
    let frame = 0;
    const placeLabels = () => {
      frame = 0;
      labelStateRef.current = layoutLabels(model.bands, transformRef.current, { width: svg.clientWidth, height: svg.clientHeight }, labelStateRef.current, DEFAULT_VIEW_CONFIG, measure);
      setLabels([...labelStateRef.current.values()]);
      setScale(transformRef.current.k);
    };
    const behavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([fit / 4, 40])
      .on('zoom', (e) => {
        transformRef.current = e.transform;
        groupRef.current?.setAttribute('transform', e.transform.toString());
        if (!frame) frame = requestAnimationFrame(placeLabels);
      });
    behaviorRef.current = behavior;
    const sel = select(svg);
    sel.call(behavior);
    sel.call(behavior.transform, zoomIdentity.translate(w / 2, h / 2).scale(fit));
    return () => {
      sel.on('.zoom', null).interrupt();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [model]);

  if (!analysisData) {
    if (loading) return <div className="w-full h-full flex items-center justify-center text-gray-500">Analyzing repository...</div>;
    if (error) return <div className="w-full h-full flex items-center justify-center text-red-500">{error}</div>;
    return null;
  }
  if (!model) return null;

  const cardNode = (pinned && model.byId.get(pinned)) || shown;
  const cardHue = cardNode ? model.bands.find((b) => b.node.node === cardNode)?.hue ?? null : null;
  const onSvgClick = (e: React.MouseEvent) => {
    const down = downRef.current;
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > CLICK_SLOP) return; // a pan
    const id = (e.target as Element).closest('[data-symbol-id]')?.getAttribute('data-symbol-id');
    if (id) {
      if (id !== pinned) pin(id);
    } else if (pinned) unpin();
  };

  return (
    <div className="relative w-full h-full border border-gray-200 rounded-md overflow-hidden" style={{ backgroundColor: CANVAS_BACKGROUND }}>
      <svg
        ref={svgRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onPointerDown={(e) => (downRef.current = { x: e.clientX, y: e.clientY })}
        onClick={onSvgClick}
      >
        <g ref={groupRef}>
          {shapes}
          {rimLayer}
          {edgeLayer}
        </g>
        <LabelLayer labels={labels} slice={slice} />
      </svg>
      <SymbolSearch symbols={model.symbols} onPick={pickFromSearch} />
      {cardNode && (
        <InfoCard
          content={cardContent(cardNode, model.root, model.diff)}
          hue={cardHue}
          pinned={
            pinned
              ? {
                  view: connectionsView(pinnedConn, direction, model.byId),
                  kind: category,
                  tooMany,
                  onDirection: changeDirection,
                  onKind: selectCategory,
                  onPreview: setPreview,
                  onPick: pin,
                  onClose: unpin,
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

/** Folder names in screen space, above the zoomed group. They ease in and out and dim outside the hovered slice. */
function LabelLayer({ labels, slice }: { labels: LabelPlacement[]; slice: Slice | null }) {
  return (
    <g pointerEvents="none" fontFamily="system-ui, sans-serif" fontWeight={500} textAnchor="middle" fill="#111827">
      <defs>
        {labels.filter((l) => l.arcPath).map((l) => (
          <path key={l.id} id={arcId(l.id)} d={l.arcPath} />
        ))}
      </defs>
      {labels.map((l) => {
        const dim = slice && !slice.chain.has(l.id) && !slice.below.has(l.id) ? hoverStyle.rest : 1;
        const common = {
          fontSize: l.fontSize,
          stroke: CANVAS_BACKGROUND,
          strokeWidth: 3,
          paintOrder: 'stroke',
          style: { opacity: l.visible ? dim : 0, transition: `opacity ${labelStyle.fadeMs}ms` },
        };
        return l.arcPath ? (
          <text key={l.id} data-testid="folder-label" {...common}>
            <textPath href={`#${arcId(l.id)}`} startOffset="50%">
              {l.text}
            </textPath>
          </text>
        ) : (
          <text key={l.id} data-testid="folder-label" x={l.x} y={l.y} dominantBaseline="central" transform={`rotate(${l.rotation} ${l.x} ${l.y})`} {...common}>
            {l.text}
          </text>
        );
      })}
    </g>
  );
}

/** A DOM-safe id for a folder's label path. */
const arcId = (nodeId: string) => `label-arc-${nodeId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

/** Measures text with a canvas when there is one, else estimates. */
function textMeasurer(): Measure {
  const ctx = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
  if (!ctx) return (text, size) => text.length * size * 0.56;
  return (text, size) => {
    ctx.font = `500 ${size}px system-ui, sans-serif`;
    return ctx.measureText(text).width;
  };
}

/** SVG path for a band: the annular sector between its inner and outer radius and its two angles. */
function sectorPath({ inner, outer, startAngle, endAngle }: Band): string {
  const at = (r: number, a: number) => `${r * Math.sin(a)} ${-r * Math.cos(a)}`;
  const large = endAngle - startAngle > Math.PI ? 1 : 0;
  return (
    `M ${at(outer, startAngle)} A ${outer} ${outer} 0 ${large} 1 ${at(outer, endAngle)} ` +
    `L ${at(inner, endAngle)} A ${inner} ${inner} 0 ${large} 0 ${at(inner, startAngle)} Z`
  );
}

interface EdgeDrawing {
  model: { dots: ReadonlyMap<string, PositionedNode>; positions: ReadonlyMap<string, PositionedNode>; parents: ReadonlyMap<string, HierarchyNode> };
  pinned: string;
  incident: DotEdge[];
  tooMany: boolean;
  direction: Direction;
  /** the kind being previewed or selected, if any */
  emphasis: EdgeKind | null;
  targets: string[];
  category: EdgeKind | null;
  scale: number;
  fit: number;
}

/**
 * The edges at a pinned symbol, as curves with arrowheads, plus the pin ring and the rings on a category's targets.
 *
 * @remarks
 * Each edge is a spline that follows the hierarchy through every node between its ends, topping out on the lowest node
 * holding both: the file for two symbols of one file, the folder for symbols in different files (`treeCurve`). With nothing selected every edge is faint; with a previewed or
 * selected kind and direction those edges are strong and the others almost vanish. A hub symbol with more than
 * `MAX_DRAWN_EDGES` edges draws only the emphasised ones. Sizes are in px, divided by the zoom so they stay put.
 */
function drawEdges({ model, pinned, incident, tooMany, direction, emphasis, targets, category, scale, fit }: EdgeDrawing) {
  const k = scale;
  const grow = Math.max(1, Math.min(k / fit, 2.5));
  const at = model.dots.get(pinned);
  if (!at) return null;
  const r0 = nodeStyle(nodeContext(at.node)).radius;
  const isEmphasised = (e: DotEdge) => !!emphasis && e.kind === emphasis && (direction === 'out' ? e.from === pinned : e.to === pinned);

  const curves = incident.flatMap((e, i) => {
    const strong = isEmphasised(e);
    if (tooMany && !strong) return [];
    const look = !emphasis ? EDGE_DRAW.all : strong ? EDGE_DRAW.strong : EDGE_DRAW.faint;
    const a = model.dots.get(e.from);
    const b = model.dots.get(e.to);
    if (!a || !b) return [];
    const color = EDGE_KIND_STYLE[e.kind].color;
    const { d, tail } = treeCurve(a, b, model.parents, model.positions);
    const arrow = (look.arrow * grow) / k;
    const dx = b.x - tail.x;
    const dy = b.y - tail.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const tipX = b.x - ux * (r0 + 1 / k);
    const tipY = b.y - uy * (r0 + 1 / k);
    return [
      <g key={`${e.kind}-${e.from}-${e.to}-${i}`} data-testid="pin-edge" data-kind={e.kind} data-emphasised={strong || undefined} pointerEvents="none" opacity={look.alpha}>
        <path d={d} fill="none" stroke={color} strokeWidth={(look.width * grow) / k} />
        {look.arrow > 0 && (
          <polygon
            points={`${tipX},${tipY} ${tipX - ux * arrow - uy * arrow * 0.4},${tipY - uy * arrow + ux * arrow * 0.4} ${tipX - ux * arrow + uy * arrow * 0.4},${tipY - uy * arrow - ux * arrow * 0.4}`}
            fill={color}
          />
        )}
      </g>,
    ];
  });

  const ringColor = category ? EDGE_KIND_STYLE[category].color : null;
  return (
    <g pointerEvents="none" data-testid="pin-layer">
      {curves}
      {ringColor &&
        targets.map((id) => {
          const p = model.dots.get(id);
          return p ? <circle key={id} cx={p.x} cy={p.y} r={r0 + 3 / k} fill="none" stroke={ringColor} strokeWidth={2 / k} /> : null;
        })}
      <circle data-testid="pin-ring" cx={at.x} cy={at.y} r={r0 + 4 / k} fill="#fff" stroke="#111827" strokeWidth={2.5 / k} />
      <circle cx={at.x} cy={at.y} r={r0} fill={nodeStyle(nodeContext(at.node)).color} />
    </g>
  );
}
