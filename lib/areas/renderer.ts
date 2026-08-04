import * as d3 from 'd3';
import type { Area, AreaRuntimeState } from './types';

const HULL_PADDING = 55; // px padding around member nodes

export type HullResult =
  | { type: 'circle'; cx: number; cy: number; r: number }
  | { type: 'polygon'; points: [number, number][] }
  | null;

export function getTransitiveContains(
  area: Area,
  areasById: Map<string, Area>,
): string[] {
  const symbols = new Set(area.contains);
  const visited = new Set<string>([area.id]);
  const queue = [...area.children];

  while (queue.length > 0) {
    const childId = queue.shift()!;
    if (visited.has(childId)) continue;
    visited.add(childId);

    const child = areasById.get(childId);
    if (!child) continue;

    for (const symbol of child.contains) symbols.add(symbol);
    queue.push(...child.children);
  }

  return [...symbols];
}

export function computeAreaHull(
  area: Area,
  nodePositions: Map<string, { x: number; y: number; radius: number }>,
  areasById: Map<string, Area> = new Map(),
): HullResult {
  const memberSymbols = getTransitiveContains(area, areasById);
  const memberPositions: { x: number; y: number; radius: number }[] = [];
  for (const symbol of memberSymbols) {
    const pos = nodePositions.get(symbol);
    if (pos) memberPositions.push(pos);
  }

  if (memberPositions.length === 0) return null;

  if (memberPositions.length === 1) {
    const p = memberPositions[0];
    return { type: 'circle', cx: p.x, cy: p.y, r: p.radius + HULL_PADDING };
  }

  if (memberPositions.length === 2) {
    const [a, b] = memberPositions;
    const cx = (a.x + b.x) / 2;
    const cy = (a.y + b.y) / 2;
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    const r = dist / 2 + Math.max(a.radius, b.radius) + HULL_PADDING;
    return { type: 'circle', cx, cy, r };
  }

  // 3+ nodes: compute convex hull
  const points: [number, number][] = memberPositions.map((p) => [p.x, p.y]);
  const hull = d3.polygonHull(points);
  if (!hull) return null;

  const expanded = expandHull(hull, HULL_PADDING);
  return { type: 'polygon', points: expanded };
}

export function expandHull(
  hull: [number, number][],
  padding: number,
): [number, number][] {
  const n = hull.length;
  if (n < 3) return hull;

  // Compute centroid
  let cx = 0, cy = 0;
  for (const [x, y] of hull) {
    cx += x;
    cy += y;
  }
  cx /= n;
  cy /= n;

  // Expand each vertex outward from centroid by padding
  return hull.map(([x, y]) => {
    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.hypot(dx, dy);
    if (dist === 0) return [x, y] as [number, number];
    const scale = (dist + padding) / dist;
    return [cx + dx * scale, cy + dy * scale] as [number, number];
  });
}

export function drawAreaOverlays(
  ctx: CanvasRenderingContext2D,
  areas: Area[],
  runtimeState: Map<string, AreaRuntimeState>,
  nodePositions: Map<string, { x: number; y: number; radius: number }>,
): void {
  const areasById = new Map(areas.map((a) => [a.id, a]));

  for (const area of areas) {
    const state = runtimeState.get(area.id);
    if (!state || !state.visible) continue;

    const hull = computeAreaHull(area, nodePositions, areasById);
    if (!hull) continue;

    ctx.save();

    if (hull.type === 'circle') {
      ctx.beginPath();
      ctx.arc(hull.cx, hull.cy, hull.r, 0, 2 * Math.PI);
      ctx.fillStyle = state.color;
      ctx.globalAlpha = 0.08;
      ctx.fill();
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = state.color;
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      ctx.beginPath();
      const [first, ...rest] = hull.points;
      ctx.moveTo(first[0], first[1]);
      for (const [x, y] of rest) {
        ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = state.color;
      ctx.globalAlpha = 0.08;
      ctx.fill();
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = state.color;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.restore();
  }
}
