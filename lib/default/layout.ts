import { hierarchy, tree } from 'd3-hierarchy';
import { DEFAULT_VIEW_CONFIG, edgeLength, nodeStyle } from './config';
import type { DisplayConfig, EdgeContext, NodeContext } from './config';
import type { HierarchyNode, LinkKind, Tier } from './types';

/** A hierarchy node with its polar and cartesian position. */
export interface PositionedNode {
  node: HierarchyNode;
  /** radians, 0 at 12 o'clock, clockwise */
  angle: number;
  radius: number;
  x: number;
  y: number;
}

export interface PositionedLink {
  kind: LinkKind;
  source: PositionedNode;
  target: PositionedNode;
}

export interface RadialLayout {
  nodes: PositionedNode[];
  links: PositionedLink[];
}

const LINK_KIND: Record<Exclude<Tier, 'root'>, LinkKind> = {
  symbol: 'symbol-file',
  file: 'file-folder',
  folder: 'folder-folder',
};

/** Kind of the link from a node up to its parent. */
export const linkKindOf = (tier: Exclude<Tier, 'root'>): LinkKind => LINK_KIND[tier];

/** Context for resolving a node's style. */
export const nodeContext = (n: HierarchyNode): NodeContext => ({ tier: n.tier, depth: n.depth, syntaxType: n.symbol?.syntaxType });

/** Context for resolving the style or length of the link from `child` up to its parent. */
export function edgeContext(child: HierarchyNode, config: DisplayConfig = DEFAULT_VIEW_CONFIG): EdgeContext {
  return {
    kind: linkKindOf(child.tier as Exclude<Tier, 'root'>),
    depth: child.depth,
    childColor: nodeStyle(nodeContext(child), config).color,
  };
}

/**
 * Lays the hierarchy out as a radial tree (GM-5).
 *
 * @remarks
 * A node's radius is its parent's radius plus the edge length from the config, so rings follow hierarchy
 * depth and the gaps are tunable. `d3.tree` gives each node its angle, with spacing set from the radius
 * each neighbour sits at so nodes stay clear of each other. Computed once,
 * with no force simulation, so identical input gives identical output.
 *
 * @param root - The hierarchy from the adapter.
 * @param config - Display settings, for edge lengths.
 */
export function layoutRadial(root: HierarchyNode, config: DisplayConfig = DEFAULT_VIEW_CONFIG): RadialLayout {
  // Radii depend only on the hierarchy and the config, so they are known before any angle is.
  const radii = new Map<HierarchyNode, number>();
  const assignRadius = (n: HierarchyNode, parentRadius: number | null) => {
    const r = parentRadius === null ? 0 : parentRadius + edgeLength(edgeContext(n, config), config);
    radii.set(n, r);
    n.children.forEach((c) => assignRadius(c, r));
  };
  assignRadius(root, null);
  const spacing = (n: HierarchyNode) => nodeStyle(nodeContext(n), config).spacing;

  // d3 normally assumes every level sits on one ring. Here rings follow the config, so the angle two
  // neighbours need is their arc spacing divided by the radius they sit at: far out takes less angle,
  // close in takes more. d3 then scales the total to the full circle.
  const h = hierarchy(root, (d) => d.children);
  tree<HierarchyNode>()
    .size([2 * Math.PI, 1])
    .separation((a, b) => {
      const arc = (spacing(a.data) + spacing(b.data)) / 2;
      const r = Math.max((radii.get(a.data)! + radii.get(b.data)!) / 2, 1);
      return ((a.parent === b.parent ? 1 : 2) * arc) / r;
    })(h);

  const placed = new Map<HierarchyNode, PositionedNode>();
  const nodes: PositionedNode[] = [];
  const links: PositionedLink[] = [];

  h.each((d) => {
    const parent = d.parent ? placed.get(d.parent.data)! : undefined;
    const angle = (d as unknown as { x: number }).x;
    const radius = radii.get(d.data)!;
    const p: PositionedNode = { node: d.data, angle, radius, x: radius * Math.sin(angle), y: -radius * Math.cos(angle) };
    placed.set(d.data, p);
    nodes.push(p);
    if (parent) links.push({ kind: edgeContext(d.data, config).kind, source: parent, target: p });
  });
  return { nodes, links };
}

/** The sector behind one file's symbols, from the file's own ring out past its outermost symbol. */
export interface FileOverlay {
  file: PositionedNode;
  symbols: PositionedNode[];
  inner: number;
  outer: number;
  /** radians, same convention as {@link PositionedNode.angle} */
  startAngle: number;
  endAngle: number;
}

/**
 * One overlay per file that has symbols.
 *
 * @remarks
 * The sector starts at the file's radius and ends past its farthest symbol (padded by the node radius).
 * It spans the file's symbols, each widened by half its arc spacing, so neighbouring files' sectors
 * do not touch. Overlays follow layout order.
 *
 * @param layout - A laid-out tree.
 * @param config - Display settings, for node radius and spacing.
 */
export function fileOverlays(layout: RadialLayout, config: DisplayConfig = DEFAULT_VIEW_CONFIG): FileOverlay[] {
  const byFile = new Map<PositionedNode, PositionedNode[]>();
  for (const l of layout.links) {
    if (l.kind !== 'symbol-file') continue;
    const list = byFile.get(l.source) ?? [];
    list.push(l.target);
    byFile.set(l.source, list);
  }
  const out: FileOverlay[] = [];
  for (const file of layout.nodes) {
    const symbols = byFile.get(file);
    if (!symbols) continue;
    const style = nodeStyle(nodeContext(symbols[0].node), config);
    const half = (p: PositionedNode) => style.spacing / 2 / Math.max(p.radius, 1);
    out.push({
      file,
      symbols,
      inner: file.radius,
      outer: Math.max(...symbols.map((p) => p.radius)) + style.radius,
      startAngle: Math.min(...symbols.map((p) => p.angle - half(p))),
      endAngle: Math.max(...symbols.map((p) => p.angle + half(p))),
    });
  }
  return out;
}

/**
 * The node closest to a point, in layout coordinates.
 *
 * @returns The nearest of `candidates`, or `null` when there are none.
 */
export function nearestNode(candidates: readonly PositionedNode[], x: number, y: number): PositionedNode | null {
  let best: PositionedNode | null = null;
  let bestD = Infinity;
  for (const n of candidates) {
    const d = (n.x - x) ** 2 + (n.y - y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return best;
}
