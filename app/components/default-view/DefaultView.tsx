'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { select } from 'd3-selection';
import { zoom, zoomIdentity } from 'd3-zoom';
import type { AnalysisResult } from '@/lib/analysis/types';
import { buildHierarchy } from '@/lib/default/adapter';
import { layoutBands } from '@/lib/default/bands';
import type { Band } from '@/lib/default/bands';
import { cardContent } from '@/lib/default/card';
import { CANVAS_BACKGROUND, DEFAULT_VIEW_CONFIG, nodeStyle } from '@/lib/default/config';
import { emphasisedOpacity, parentMap, sliceOf } from '@/lib/default/hover';
import type { Slice } from '@/lib/default/hover';
import { layoutLabels } from '@/lib/default/labels';
import type { LabelPlacement, LabelState, Measure } from '@/lib/default/labels';
import { layoutRadial, nodeContext } from '@/lib/default/layout';
import type { HierarchyNode } from '@/lib/default/types';
import InfoCard from './InfoCard';

interface DefaultViewProps {
  analysisData: AnalysisResult | null;
  loading: boolean;
  error: string | null;
}

const { separator, hover: hoverStyle, label: labelStyle } = DEFAULT_VIEW_CONFIG;

/**
 * Radial hierarchy of the repository, drawn as bands and symbols: a translucent band per folder and file, and a dot
 * per top-level symbol. Folder and file nodes and the edges between them are laid out but not drawn.
 *
 * @remarks
 * Pan and zoom with d3-zoom and hover are the only interactions; clicks do nothing. Hovering a folder band, a file
 * band or a symbol highlights its slice (the band, its ancestors, and everything beneath a folder), dims the rest, and
 * fills a docked info card, which keeps showing the last hovered item after the pointer leaves. Folder names are
 * placed on the bands in screen space by `layoutLabels`, recomputed (one animation frame at a time) when the pan or
 * zoom changes. Structure comes from `buildHierarchy`, positions from `layoutRadial`, bands from `layoutBands`, and
 * every size and color from the config, so this component holds no display values of its own.
 *
 * @param analysisData - The page's analysis result.
 * @param loading - Whether the analysis is running.
 * @param error - The analysis error, if any.
 */
export default function DefaultView({ analysisData, loading, error }: DefaultViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const groupRef = useRef<SVGGElement>(null);
  const transformRef = useRef(zoomIdentity);
  const labelStateRef = useRef<LabelState>(new Map());
  const [hovered, setHovered] = useState<HierarchyNode | null>(null);
  const [shown, setShown] = useState<HierarchyNode | null>(null);
  const [labels, setLabels] = useState<LabelPlacement[]>([]);

  const model = useMemo(() => {
    if (!analysisData) return null;
    const rootName = analysisData.metadata.repoPath.split('/').filter(Boolean).pop() ?? '/';
    const root = buildHierarchy(analysisData, rootName);
    const layout = layoutRadial(root);
    return { root, layout, bands: layoutBands(layout), parents: parentMap(root) };
  }, [analysisData]);

  const slice = useMemo(() => (model && hovered ? sliceOf(hovered, model.parents) : null), [model, hovered]);

  // Rebuilt when the layout or the hovered slice changes. The transform is applied to the group directly, so pan and
  // zoom never re-render these.
  const shapes = useMemo(() => {
    if (!model) return null;
    const { bands, layout, parents } = model;
    const enter = (node: HierarchyNode) => ({ onMouseEnter: () => setHovered(node), onMouseLeave: () => setHovered(null) });
    const inSlice = (id: string) => !slice || slice.chain.has(id) || slice.below.has(id);
    const highlighted = slice ? bands.filter((b) => inSlice(b.node.node.id)) : [];
    const sectors = (list: Band[], props: (b: Band) => React.SVGProps<SVGPathElement>) =>
      list.map((b) => <path key={b.node.node.id} d={sectorPath(b)} {...props(b)} />);
    const separated = (b: Band) => ({
      fill: b.color,
      fillOpacity: emphasisedOpacity(b.opacity, b.node.node.id, slice),
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
          return (
            <circle
              key={p.node.id}
              cx={p.x}
              cy={p.y}
              r={s.radius}
              fill={s.color}
              opacity={inSlice(fileId) ? 1 : hoverStyle.rest}
              {...enter(p.node)}
            />
          );
        })}
      </>
    );
  }, [model, slice]);

  useEffect(() => {
    if (hovered) setShown(hovered);
  }, [hovered]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !model) return;
    const { clientWidth: w, clientHeight: h } = svg;
    const extent = Math.max(...model.layout.nodes.map((n) => n.radius), 1);
    const fit = Math.min(w, h) / 2 / (extent * 1.05);
    const measure = textMeasurer();
    labelStateRef.current = new Map();
    let frame = 0;
    const placeLabels = () => {
      frame = 0;
      labelStateRef.current = layoutLabels(model.bands, transformRef.current, { width: svg.clientWidth, height: svg.clientHeight }, labelStateRef.current, DEFAULT_VIEW_CONFIG, measure);
      setLabels([...labelStateRef.current.values()]);
    };
    const behavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([fit / 4, 40])
      .on('zoom', (e) => {
        transformRef.current = e.transform;
        groupRef.current?.setAttribute('transform', e.transform.toString());
        if (!frame) frame = requestAnimationFrame(placeLabels);
      });
    const sel = select(svg);
    sel.call(behavior);
    sel.call(behavior.transform, zoomIdentity.translate(w / 2, h / 2).scale(fit));
    return () => {
      sel.on('.zoom', null);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [model]);

  if (!analysisData) {
    if (loading) return <div className="w-full h-full flex items-center justify-center text-gray-500">Analyzing repository...</div>;
    if (error) return <div className="w-full h-full flex items-center justify-center text-red-500">{error}</div>;
    return null;
  }
  if (!model) return null;

  const shownHue = shown ? model.bands.find((b) => b.node.node === shown)?.hue ?? null : null;

  return (
    <div className="relative w-full h-full border border-gray-200 rounded-md overflow-hidden" style={{ backgroundColor: CANVAS_BACKGROUND }}>
      <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing">
        <g ref={groupRef}>{shapes}</g>
        <LabelLayer labels={labels} slice={slice} />
      </svg>
      {shown && <InfoCard content={cardContent(shown, model.root)} hue={shownHue} />}
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
