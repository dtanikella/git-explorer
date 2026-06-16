import * as d3 from 'd3';
import type { Area, AreaRuntimeState } from './types';

export type HullResult =
  | { type: 'circle'; cx: number; cy: number; r: number }
  | { type: 'polygon'; points: [number, number][] }
  | null;

export function computeAreaHull(
  area: Area,
  nodePositions: Map<string, { x: number; y: number; radius: number }>,
): HullResult {
  const memberPositions: { x: number; y: number; radius: number }[] = [];
  for (const symbol of area.contains) {
    const pos = nodePositions.get(symbol);
    if (pos) memberPositions.push(pos);
  }

  if (memberPositions.length === 0) return null;

  if (memberPositions.length === 1) {
    const p = memberPositions[0];
    return { type: 'circle', cx: p.x, cy: p.y, r: p.radius + 55 };
  }

  if (memberPositions.length === 2) {
    const [a, b] = memberPositions;
    const cx = (a.x + b.x) / 2;
    const cy = (a.y + b.y) / 2;
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    const r = dist / 2 + Math.max(a.radius, b.radius) + 55;
    return { type: 'circle', cx, cy, r };
  }

  // 3+ nodes: compute convex hull
  const points: [number, number][] = memberPositions.map((p) => [p.x, p.y]);
  const hull = d3.polygonHull(points);
  if (!hull) return null;

  const expanded = expandHull(hull, 55);
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
  for (const area of areas) {
    const state = runtimeState.get(area.id);
    if (!state || !state.visible) continue;

    const hull = computeAreaHull(area, nodePositions);
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
