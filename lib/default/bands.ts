import { bandHue, bandStyle, DEFAULT_VIEW_CONFIG, nodeStyle } from './config';
import type { DisplayConfig } from './config';
import { fileOverlays, nodeContext } from './layout';
import type { PositionedNode, RadialLayout } from './layout';
import type { HierarchyNode } from './types';

/**
 * The translucent region behind a folder's or a file's descendants, drawn as an annular sector.
 *
 * @remarks
 * Bands tile outward by tier. A file band runs from the file's ring out past its farthest symbol. A folder band
 * runs from the folder's ring to the ring of its children, so it fills the stretch between folder and children.
 * Every band spans, in angle, the symbols beneath it, so a band lines up with the bands above and below.
 */
export interface Band {
  tier: 'folder' | 'file';
  /** the folder or file this band belongs to */
  node: PositionedNode;
  /** hops from the root */
  depth: number;
  inner: number;
  outer: number;
  /** radians, same convention as {@link PositionedNode.angle} */
  startAngle: number;
  endAngle: number;
  /** the symbols beneath the band: a file's own, or all those under the folder */
  symbols: PositionedNode[];
  hue: number;
  color: string;
  opacity: number;
}

/**
 * Lays out the bands of a radial layout: exactly one per folder and one per file with symbols.
 *
 * @remarks
 * Subfolders and files of one folder sit on the same ring, so a folder needs just one band. Hue is inherited down
 * the tree through `band.hue` in the config. The root has no band. Output is ordered shallow to deep. Neighbours
 * touch; the view separates them with a stroke.
 *
 * @param layout - A laid-out tree.
 * @param config - Display settings, for band colors and for node radius and spacing.
 */
export function layoutBands(layout: RadialLayout, config: DisplayConfig = DEFAULT_VIEW_CONFIG): Band[] {
  if (layout.nodes.length === 0) return [];
  const placed = new Map(layout.nodes.map((p) => [p.node, p]));
  const filesBySymbols = new Map(fileOverlays(layout, config).map((o) => [o.file.node, o]));
  const symbolsUnder = (n: HierarchyNode): HierarchyNode[] => (n.tier === 'symbol' ? [n] : n.children.flatMap(symbolsUnder));
  const halfAngle = (p: PositionedNode) => nodeStyle(nodeContext(p.node), config).spacing / 2 / Math.max(p.radius, 1);
  const out: Band[] = [];

  const walk = (n: HierarchyNode, parentHue: number | null, topIndex: number, siblingIndex: number, siblingCount: number) => {
    if (n.tier === 'root') {
      n.children.forEach((c, i) => walk(c, null, i, siblingIndexAmong(n, c), siblingsOf(n, c)));
      return;
    }
    const tier = n.tier as 'folder' | 'file';
    const hue = bandHue({ tier, parentHue, topIndex, siblingIndex, siblingCount }, config);
    const style = bandStyle({ tier, depth: n.depth, path: n.path, hue, siblingIndex, siblingCount }, config);
    const node = placed.get(n)!;

    if (tier === 'file') {
      const overlay = filesBySymbols.get(n);
      if (overlay) out.push(band(tier, node, n.depth, overlay.inner, overlay.outer, overlay.startAngle, overlay.endAngle, overlay.symbols, hue, style));
    } else {
      const symbols = symbolsUnder(n).map((x) => placed.get(x)!);
      if (symbols.length > 0) {
        const outer = Math.max(...n.children.map((c) => placed.get(c)!.radius));
        const start = Math.min(...symbols.map((x) => x.angle - halfAngle(x)));
        const end = Math.max(...symbols.map((x) => x.angle + halfAngle(x)));
        out.push(band(tier, node, n.depth, node.radius, outer, start, end, symbols, hue, style));
      }
    }
    n.children.forEach((c) => walk(c, hue, topIndex, siblingIndexAmong(n, c), siblingsOf(n, c)));
  };
  walk(layout.nodes[0].node, null, 0, 0, 1); // the root comes first in layout order
  return out.sort((a, b) => a.depth - b.depth || (a.tier === b.tier ? 0 : a.tier === 'folder' ? -1 : 1));
}

function band(
  tier: Band['tier'], node: PositionedNode, depth: number, inner: number, outer: number, start: number, end: number,
  symbols: PositionedNode[], hue: number, style: { color: string; opacity: number },
): Band {
  return { tier, node, depth, inner, outer, startAngle: start, endAngle: end, symbols, hue, color: style.color, opacity: style.opacity };
}

const sameTier = (parent: HierarchyNode, child: HierarchyNode) => parent.children.filter((c) => c.tier === child.tier);
const siblingIndexAmong = (parent: HierarchyNode, child: HierarchyNode) => sameTier(parent, child).indexOf(child);
const siblingsOf = (parent: HierarchyNode, child: HierarchyNode) => sameTier(parent, child).length;
