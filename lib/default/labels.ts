import { DEFAULT_VIEW_CONFIG } from './config';
import type { DisplayConfig } from './config';
import type { Band } from './bands';

/** How a label's text runs: horizontally, along the arc of its band, or along the band's radius. */
export type LabelMode = 'H' | 'C' | 'R';

/** The current pan and zoom: a layout point (x, y) lands at screen `(tx + k x, ty + k y)`. */
export interface LabelTransform {
  x: number;
  y: number;
  k: number;
}

export interface LabelViewport {
  width: number;
  height: number;
}

/** Width in px of `text` at `fontSize`. */
export type Measure = (text: string, fontSize: number) => number;

/** Rough text width, for when no real measurer is at hand. */
export const approximateMeasure: Measure = (text, fontSize) => text.length * fontSize * 0.56;

/** Where and how one folder label is drawn, in screen px. The last placement is kept while a label is hidden, so it can fade out in place. */
export interface LabelPlacement {
  /** the folder's node id */
  id: string;
  text: string;
  visible: boolean;
  mode: LabelMode;
  fontSize: number;
  /** center of the text */
  x: number;
  y: number;
  /** degrees, for horizontal and radial labels; keeps text upright */
  rotation: number;
  /** for arc labels: the path the text follows, already running in the readable direction */
  arcPath?: string;
}

/** Placements by folder id, carried from one pan or zoom to the next for stability. */
export type LabelState = ReadonlyMap<string, LabelPlacement>;

interface Fit {
  mode: LabelMode;
  fontSize: number;
  /** angle of the anchor on the band's centerline */
  angle: number;
}

const TWO_PI = 2 * Math.PI;
const ANCHORS = 32;
const FONT_STEP = 0.5;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/**
 * Places a name on each folder band, in screen space, with the same label surviving small changes in zoom.
 *
 * @remarks
 * Fit: for each band try horizontal, then along the arc, then along the radius, at the largest font between the
 * min and max whose padded text box lies wholly inside the visible part of the band, anchored on its centerline.
 * Horizontal gets a bonus and radial a penalty when modes are compared. A name that does not fit at the min
 * font is not shown.
 * Stability: a hidden label appears once it fits at the min font and a visible one disappears only below
 * `hideBelow`. A label keeps its mode unless another is at least `switchMargin` px bigger.
 * Files and symbols are not labelled. Call this when the pan or zoom changes, not on hover.
 *
 * @param bands - From `layoutBands`; only folder bands are labelled.
 * @param transform - The current pan and zoom.
 * @param viewport - The visible size.
 * @param prev - The result of the previous call, or empty.
 * @param config - Display settings, for the label rules.
 * @param measure - Text width, defaulting to a rough estimate.
 */
export function layoutLabels(
  bands: readonly Band[],
  transform: LabelTransform,
  viewport: LabelViewport,
  prev: LabelState = new Map(),
  config: DisplayConfig = DEFAULT_VIEW_CONFIG,
  measure: Measure = approximateMeasure,
): Map<string, LabelPlacement> {
  const out = new Map<string, LabelPlacement>();
  for (const band of bands) {
    if (band.tier !== 'folder') continue;
    const id = band.node.node.id;
    const text = band.node.node.name;
    const before = prev.get(id);
    const floor = before?.visible ? config.label.hideBelow : config.label.minFont;
    const fits = (['H', 'C', 'R'] as const).map((mode) => bestFit(band, mode, text, floor, transform, viewport, config, measure)).filter((f): f is Fit => f !== null);

    const score = (f: Fit) => f.fontSize + (f.mode === 'H' ? config.label.horizontalBonus : f.mode === 'R' ? -config.label.radialPenalty : 0);
    let chosen = fits.reduce<Fit | null>((best, f) => (best === null || score(f) > score(best) ? f : best), null);
    const kept = before?.visible ? fits.find((f) => f.mode === before.mode) : undefined;
    if (kept && chosen && chosen.mode !== kept.mode && chosen.fontSize < kept.fontSize + config.label.switchMargin) chosen = kept;

    if (!chosen) {
      if (before) out.set(id, { ...before, visible: false });
      continue;
    }
    out.set(id, place(id, text, band, chosen, transform, measure(text, chosen.fontSize)));
  }
  return out;
}

/** The largest font at which `mode` fits somewhere along the band, anchored nearest the band's middle. */
function bestFit(
  band: Band, mode: LabelMode, text: string, floor: number, t: LabelTransform, view: LabelViewport, config: DisplayConfig, measure: Measure,
): Fit | null {
  const span = band.endAngle - band.startAngle;
  const middle = (band.startAngle + band.endAngle) / 2;
  const radius = ((band.inner + band.outer) / 2) * t.k;
  let best: Fit | null = null;
  for (let i = 0; i < ANCHORS; i++) {
    const angle = band.startAngle + (span * (i + 0.5)) / ANCHORS;
    for (let font = config.label.maxFont; font >= floor && (!best || font >= best.fontSize); font -= FONT_STEP) {
      const points = boxPoints(mode, angle, radius, font, measure(text, font), t, config.label.padding);
      if (points.every((p) => inView(p, view) && inBand(p, band, t))) {
        if (!best || font > best.fontSize || Math.abs(angle - middle) < Math.abs(best.angle - middle)) best = { mode, fontSize: font, angle };
        break;
      }
    }
  }
  return best;
}

const at = (t: LabelTransform, r: number, angle: number): [number, number] => [t.x + r * Math.sin(angle), t.y - r * Math.cos(angle)];
const inView = ([x, y]: [number, number], v: LabelViewport) => x >= 0 && y >= 0 && x <= v.width && y <= v.height;

function inBand([x, y]: [number, number], band: Band, t: LabelTransform): boolean {
  const dx = x - t.x;
  const dy = y - t.y;
  const r = Math.hypot(dx, dy);
  if (r < band.inner * t.k || r > band.outer * t.k) return false;
  const rel = (((Math.atan2(dx, -dy) - band.startAngle) % TWO_PI) + TWO_PI) % TWO_PI;
  return rel <= band.endAngle - band.startAngle;
}

/** Points along the padded text box's outline, to test against the band. */
function boxPoints(mode: LabelMode, angle: number, radius: number, font: number, textWidth: number, t: LabelTransform, pad: number): [number, number][] {
  const w = textWidth + 2 * pad;
  const h = font * 1.2 + 2 * pad;
  const pts: [number, number][] = [];
  if (mode === 'C') {
    const half = w / 2 / radius;
    for (let s = 0; s <= 6; s++) for (const r of [radius - h / 2, radius + h / 2]) pts.push(at(t, r, angle - half + (2 * half * s) / 6));
    return pts;
  }
  const [cx, cy] = at(t, radius, angle);
  // axes of the box: along the text, and across it
  const u: [number, number] = mode === 'H' ? [1, 0] : [Math.sin(angle), -Math.cos(angle)];
  const v: [number, number] = mode === 'H' ? [0, 1] : [Math.cos(angle), Math.sin(angle)];
  for (let s = 0; s <= 6; s++) {
    const a = -w / 2 + (w * s) / 6;
    for (const b of [-h / 2, h / 2]) pts.push([cx + a * u[0] + b * v[0], cy + a * u[1] + b * v[1]]);
  }
  pts.push([cx - (w / 2) * u[0], cy - (w / 2) * u[1]], [cx + (w / 2) * u[0], cy + (w / 2) * u[1]]);
  return pts;
}

function place(id: string, text: string, band: Band, fit: Fit, t: LabelTransform, textWidth: number): LabelPlacement {
  const radius = ((band.inner + band.outer) / 2) * t.k;
  const [x, y] = at(t, radius, fit.angle);
  const base = { id, text, visible: true, mode: fit.mode, fontSize: fit.fontSize, x, y };
  if (fit.mode === 'H') return { ...base, rotation: 0 };
  if (fit.mode === 'R') {
    // text reads outward; flip it when that would turn it upside down
    let rotation = ((toDeg(fit.angle) - 90 + 540) % 360) - 180;
    if (rotation > 90) rotation -= 180;
    else if (rotation <= -90) rotation += 180;
    return { ...base, rotation };
  }
  // text runs clockwise along the top half and counter-clockwise along the bottom, so it stays upright
  const bottom = Math.cos(fit.angle) < 0;
  const baseline = radius + (bottom ? 0.35 : -0.35) * fit.fontSize;
  const span = (textWidth * 0.65) / radius; // a little longer than the text, which is centered on the path
  const [x1, y1] = at(t, baseline, bottom ? fit.angle + span : fit.angle - span);
  const [x2, y2] = at(t, baseline, bottom ? fit.angle - span : fit.angle + span);
  return { ...base, rotation: 0, arcPath: `M ${x1} ${y1} A ${baseline} ${baseline} 0 0 ${bottom ? 0 : 1} ${x2} ${y2}` };
}
