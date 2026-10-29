import type { HierarchyNode } from './types';

/** A point in layout space. */
export interface Point {
  x: number;
  y: number;
}

/** The lowest node that is an ancestor of, or is, both `a` and `b`; null when they share none. */
export function commonAncestor(a: HierarchyNode, b: HierarchyNode, parents: ReadonlyMap<string, HierarchyNode>): HierarchyNode | null {
  const above = new Set<string>();
  for (let n: HierarchyNode | undefined = a; n; n = parents.get(n.id)) above.add(n.id);
  for (let n: HierarchyNode | undefined = b; n; n = parents.get(n.id)) if (above.has(n.id)) return n;
  return null;
}

/** A curve as an SVG path, and the point its last segment is drawn toward the end from, for the arrowhead. */
export interface EdgeCurve {
  d: string;
  /** the last Bezier control point, so the arrowhead can point along the curve's end */
  tail: Point;
}

/** The nodes an edge passes through: up from `a` to the shared ancestor, then down to `b`. Null when they share none. */
export function treePath(a: HierarchyNode, b: HierarchyNode, parents: ReadonlyMap<string, HierarchyNode>): HierarchyNode[] | null {
  const top = commonAncestor(a, b, parents);
  if (!top) return null;
  const up = (n: HierarchyNode) => {
    const chain = [n];
    while (chain[chain.length - 1] !== top) chain.push(parents.get(chain[chain.length - 1].id)!);
    return chain;
  };
  return [...up(a), ...up(b).reverse().slice(1)];
}

/**
 * The curve that joins two symbols by following the hierarchy through every node between them.
 *
 * @remarks
 * It climbs from the first symbol through its file and each folder to the lowest node holding both, then descends to the second.
 * A Catmull-Rom spline runs through every one of those nodes, so the curve passes exactly through each.
 * Two symbols in one file go up to the file and back, and symbols in different files cross the folder that holds both.
 * Falls back to a straight line when the symbols share no ancestor or a node has no position.
 *
 * @param a - Start of the edge.
 * @param b - End of the edge.
 * @param parents - Parent of every node, by id.
 * @param positions - Layout position of every node, folders and files included, by node id.
 */
export function treeCurve(
  a: { node: HierarchyNode; x: number; y: number },
  b: { node: HierarchyNode; x: number; y: number },
  parents: ReadonlyMap<string, HierarchyNode>,
  positions: ReadonlyMap<string, Point>,
): EdgeCurve {
  const nodes = treePath(a.node, b.node, parents);
  const pts = nodes?.map((n) => (n === a.node ? a : n === b.node ? b : positions.get(n.id)));
  if (!pts || pts.some((p) => !p)) return { d: `M ${a.x} ${a.y} L ${b.x} ${b.y}`, tail: { x: a.x, y: a.y } };
  const p = pts as Point[];
  let d = `M ${p[0].x} ${p[0].y}`;
  let tail = p[0];
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[Math.max(i - 1, 0)];
    const p1 = p[i];
    const p2 = p[i + 1];
    const p3 = p[Math.min(i + 2, p.length - 1)];
    tail = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C ${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6} ${tail.x} ${tail.y} ${p2.x} ${p2.y}`;
  }
  return { d, tail };
}
