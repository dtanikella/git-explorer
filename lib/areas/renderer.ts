import * as d3 from 'd3';
import type { Area, AreaRuntimeState } from './types';
import { getAreaColor, deriveBorderColor } from './color';
import { saturate } from '@/lib/diff/diff-view-config';

const HULL_PADDING = 55;
const PILL_LABEL_OFFSET = 14;

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

  let cx = 0, cy = 0;
  for (const [x, y] of hull) {
    cx += x;
    cy += y;
  }
  cx /= n;
  cy /= n;

  return hull.map(([x, y]) => {
    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.hypot(dx, dy);
    if (dist === 0) return [x, y] as [number, number];
    const scale = (dist + padding) / dist;
    return [cx + dx * scale, cy + dy * scale] as [number, number];
  });
}

/**
 * Draw area overlays on the graph canvas.
 *
 * When `touchedAreaIds` is provided (diff tab), areas with members in that set draw
 * at full saturation with a 14% fill alpha, while untouched areas draw at 50% saturation
 * and 60% overall opacity. When `touchedAreaIds` is absent, draws exactly as before.
 *
 * @param highlightedAreaId when non-null, draws a hover ring 5px outside the area hull.
 */
export function drawAreaOverlays(
  ctx: CanvasRenderingContext2D,
  areas: Area[],
  runtimeState: Map<string, AreaRuntimeState>,
  nodePositions: Map<string, { x: number; y: number; radius: number }>,
  highlightedAreaId?: string | null,
  touchedAreaIds?: Set<string>,
): void {
  const areasById = new Map(areas.map((a) => [a.id, a]));

  for (const area of areas) {
    const state = runtimeState.get(area.id);
    if (!state || !state.visible) continue;

    const hull = computeAreaHull(area, nodePositions, areasById);
    if (!hull) continue;

    const fillColor = getAreaColor(area);
    const borderColor = deriveBorderColor(fillColor);
    const isHighlighted = highlightedAreaId === area.id;

    const isDiffMode = touchedAreaIds !== undefined;
    const isTouched = isDiffMode && touchedAreaIds!.has(area.id);

    ctx.save();

    const areaColor = fillColor;
    const drawColor = isDiffMode
      ? (isTouched ? areaColor : saturate(areaColor, 0.5))
      : areaColor;
    const fillAlpha = isDiffMode
      ? (isTouched ? 0.14 : 0.08)
      : (isHighlighted ? 0.22 : 0.08);
    const strokeAlpha = isDiffMode
      ? (isTouched ? 1.0 : 0.3)
      : (isHighlighted ? 0.6 : 0.3);
    const strokeWidth = isDiffMode
      ? (isTouched ? 2 : 2.5)
      : (isHighlighted ? 3.5 : 2.5);

    // Overall opacity multiplier for untouched areas in diff mode
    const untouchedMultiplier = (isDiffMode && !isTouched) ? 0.6 : 1.0;

    if (hull.type === 'circle') {
      ctx.beginPath();
      ctx.arc(hull.cx, hull.cy, hull.r, 0, 2 * Math.PI);

      // Fill
      ctx.fillStyle = drawColor;
      ctx.globalAlpha = fillAlpha * untouchedMultiplier;
      ctx.fill();

      // Stroke
      ctx.globalAlpha = strokeAlpha * untouchedMultiplier;
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = strokeWidth;
      ctx.stroke();
    } else {
      ctx.beginPath();
      const [first, ...rest] = hull.points;
      ctx.moveTo(first[0], first[1]);
      for (const [x, y] of rest) {
        ctx.lineTo(x, y);
      }
      ctx.closePath();

      ctx.fillStyle = drawColor;
      ctx.globalAlpha = fillAlpha * untouchedMultiplier;
      ctx.fill();

      ctx.globalAlpha = strokeAlpha * untouchedMultiplier;
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = strokeWidth;
      ctx.stroke();
    }

    // Hover ring: 2px wide, 5px outside hull, at 55% opacity
    if (isHighlighted) {
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 2;
      if (hull.type === 'circle') {
        ctx.beginPath();
        ctx.arc(hull.cx, hull.cy, hull.r + 5, 0, 2 * Math.PI);
        ctx.stroke();
      } else {
        ctx.beginPath();
        const [hf, ...hr] = hull.points;
        ctx.moveTo(hf[0], hf[1]);
        for (const [x, y] of hr) {
          ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
      }
    }

    // Label: in diff mode use 600 11px system-ui; otherwise use existing pill style
    if (isDiffMode) {
      drawDiffModeAreaLabel(ctx, hull, area.name, drawColor);
    } else {
      drawAreaLabel(ctx, hull, area.name, fillColor, isHighlighted);
    }

    ctx.restore();
  }
}

function drawAreaLabel(
  ctx: CanvasRenderingContext2D,
  hull: Exclude<HullResult, null>,
  name: string,
  fillColor: string,
  isHighlighted: boolean,
): void {
  let labelX: number, labelY: number;

  if (hull.type === 'circle') {
    labelX = hull.cx;
    labelY = hull.cy - hull.r - PILL_LABEL_OFFSET;
  } else {
    let sumX = 0;
    let minY = Infinity;
    for (const [x, y] of hull.points) {
      sumX += x;
      if (y < minY) minY = y;
    }
    labelX = sumX / hull.points.length;
    labelY = minY - PILL_LABEL_OFFSET;
  }

  const fontSize = isHighlighted ? 16 : 15;
  ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
  const textWidth = ctx.measureText(name).width;
  const padding = 10;
  const borderRadius = 8;
  const pillWidth = textWidth + padding * 2;
  const pillHeight = fontSize + padding;
  const pillX = labelX - pillWidth / 2;
  const pillY = labelY - pillHeight / 2;

  ctx.beginPath();
  ctx.moveTo(pillX + borderRadius, pillY);
  ctx.lineTo(pillX + pillWidth - borderRadius, pillY);
  ctx.arcTo(pillX + pillWidth, pillY, pillX + pillWidth, pillY + borderRadius, borderRadius);
  ctx.lineTo(pillX + pillWidth, pillY + pillHeight - borderRadius);
  ctx.arcTo(pillX + pillWidth, pillY + pillHeight, pillX + pillWidth - borderRadius, pillY + pillHeight, borderRadius);
  ctx.lineTo(pillX + borderRadius, pillY + pillHeight);
  ctx.arcTo(pillX, pillY + pillHeight, pillX, pillY + pillHeight - borderRadius, borderRadius);
  ctx.lineTo(pillX, pillY + borderRadius);
  ctx.arcTo(pillX, pillY, pillX + borderRadius, pillY, borderRadius);
  ctx.closePath();
  ctx.fillStyle = fillColor;
  ctx.globalAlpha = 1;
  ctx.fill();

  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.globalAlpha = 1;
  ctx.fillText(name, labelX, labelY + 1);
}

/**
 * Diff-mode label: "600 11px system-ui", centered 6px above the area circle, area color.
 */
function drawDiffModeAreaLabel(
  ctx: CanvasRenderingContext2D,
  hull: Exclude<HullResult, null>,
  name: string,
  color: string,
): void {
  let labelX: number, labelY: number;

  if (hull.type === 'circle') {
    labelX = hull.cx;
    labelY = hull.cy - hull.r - 6;
  } else {
    let sumX = 0;
    let minY = Infinity;
    for (const [x, y] of hull.points) {
      sumX += x;
      if (y < minY) minY = y;
    }
    labelX = sumX / hull.points.length;
    labelY = minY - 6;
  }

  ctx.font = '600 11px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = color;
  ctx.globalAlpha = 1;
  ctx.fillText(name, labelX, labelY);
}