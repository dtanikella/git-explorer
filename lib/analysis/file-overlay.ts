import * as d3 from 'd3';
import { hashToColor, deriveBorderColor } from '@/lib/areas/color';

/** Number of angles in an overlay's radial profile. */
export const OVERLAY_ANGLES = 72;
const STEP = (2 * Math.PI) / OVERLAY_ANGLES;
const MIN_BASE_RADIUS = 12;

/**
 * Shape and style of the file overlays.
 *
 * @remarks
 * Display only: overlays are derived from node and hub positions each tick and never feed the simulation.
 * With the default `reach` of `Infinity` every node of a file is inside its overlay, and the outline hugs the nodes.
 */
export interface FileOverlayConfig {
  /** draw a pill with the file name above each overlay */
  labels: boolean;
  /** base circle radius = this percentile (0–1) of member distance from the file hub, plus `padding`; lower is tighter */
  percentile: number;
  /** margin between a node and the outline */
  padding: number;
  /** members farther than `reach` × the base radius are left outside the overlay; `Infinity` includes every member */
  reach: number;
  /** angular width in degrees of the bulge toward each outlying node; lower is tighter */
  smooth: number;
  /** hide files holding fewer nodes than this */
  minMembers: number;
  fillOpacity: number;
  strokeOpacity: number;
}

/** Default overlay: every file of at least 3 nodes, outlined tightly around all of them. */
export const DEFAULT_FILE_OVERLAY: FileOverlayConfig = {
  labels: true,
  percentile: 0.3,
  padding: 6,
  reach: Infinity,
  smooth: 10,
  minMembers: 3,
  fillOpacity: 0.12,
  strokeOpacity: 0.4,
};

/** A positioned member of a file: a node's centre and radius. */
export interface OverlayMember {
  x: number;
  y: number;
  r: number;
}

/** One file as the overlay sees it. */
export interface OverlayInput {
  id: string;
  /** file path */
  path: string;
  /** hub position, or null before the simulation has placed it */
  center: { x: number; y: number } | null;
  members: OverlayMember[];
}

/** A computed file overlay: a radial profile around the file hub. */
export interface FileOverlay {
  id: string;
  path: string;
  /** last path segment */
  name: string;
  cx: number;
  cy: number;
  /** the circle before molding */
  baseRadius: number;
  memberCount: number;
  /** radius at each of {@link OVERLAY_ANGLES} evenly spaced angles, starting at angle 0 */
  radii: Float64Array;
  /** the outline, one point per angle */
  points: [number, number][];
}

const fileName = (path: string) => path.slice(path.lastIndexOf('/') + 1);
const wrap = (k: number) => ((k % OVERLAY_ANGLES) + OVERLAY_ANGLES) % OVERLAY_ANGLES;

/**
 * Computes the overlay of every eligible file.
 *
 * @remarks
 * Each overlay is a radial profile around its file hub. The base radius is a percentile of member
 * distance from the hub, plus padding. A member outside it raises the profile toward itself with a
 * cosine falloff {@link FileOverlayConfig.smooth} wide, unless it lies beyond `reach` × the base radius,
 * in which case it is left uncovered.
 *
 * @param inputs - The files, with positioned members.
 * @param config - Shape and filtering.
 * @param keepIds - File ids that skip the `minMembers` filter (they still need at least one positioned member), so a file holding a highlighted node always has an overlay.
 * @returns Overlays by file id; files that are filtered out or not yet positioned are absent.
 */
export function computeFileOverlays(
  inputs: readonly OverlayInput[],
  config: FileOverlayConfig,
  keepIds?: ReadonlySet<string>,
): Map<string, FileOverlay> {
  const out = new Map<string, FileOverlay>();
  const win = Math.max((config.smooth * Math.PI) / 180, 2 * STEP);

  for (const inp of inputs) {
    if (!inp.center || inp.members.length === 0) continue;
    if (inp.members.length < config.minMembers && !keepIds?.has(inp.id)) continue;
    const { x: cx, y: cy } = inp.center;

    const dists = inp.members.map((m) => Math.hypot(m.x - cx, m.y - cy)).sort((a, b) => a - b);
    const q = dists[Math.min(dists.length - 1, Math.floor(config.percentile * dists.length))];
    const base = Math.max(MIN_BASE_RADIUS, q + config.padding);
    const radii = new Float64Array(OVERLAY_ANGLES).fill(base);

    // raise the profile toward `need` at `angle`: flat within one step, cosine falloff out to `width`
    const bump = (angle: number, need: number, width: number) => {
      const k0 = Math.round(angle / STEP);
      const span = Math.ceil(width / STEP);
      for (let j = -span; j <= span; j++) {
        const dl = Math.abs((k0 + j) * STEP - angle);
        const x = dl <= STEP ? 0 : (dl - STEP) / (width - STEP);
        if (x >= 1) continue;
        const v = base + (need - base) * 0.5 * (1 + Math.cos(Math.PI * x));
        const k = wrap(k0 + j);
        if (v > radii[k]) radii[k] = v;
      }
    };

    for (const m of inp.members) {
      const d = Math.hypot(m.x - cx, m.y - cy);
      const need = d + m.r + config.padding;
      if (need <= base || d > config.reach * base) continue;
      bump(Math.atan2(m.y - cy, m.x - cx), need, win);
    }

    out.set(inp.id, {
      id: inp.id,
      path: inp.path,
      name: fileName(inp.path),
      cx,
      cy,
      baseRadius: base,
      memberCount: inp.members.length,
      radii,
      points: Array.from(radii, (r, k): [number, number] => [cx + r * Math.cos(k * STEP), cy + r * Math.sin(k * STEP)]),
    });
  }
  return out;
}

/**
 * Overlay radius in a direction, interpolated between the two nearest profile angles.
 *
 * @param overlay - The overlay.
 * @param angle - Direction in radians, as `Math.atan2` returns it.
 * @returns The radius at that angle.
 */
export function overlayRadiusAt(overlay: FileOverlay, angle: number): number {
  const t = angle / STEP;
  const k0 = Math.floor(t);
  const f = t - k0;
  return overlay.radii[wrap(k0)] * (1 - f) + overlay.radii[wrap(k0 + 1)] * f;
}

/**
 * Whether a point lies inside an overlay.
 *
 * @param overlay - The overlay.
 * @param x - Point x in simulation space.
 * @param y - Point y in simulation space.
 * @returns True if the point is inside the outline.
 */
export function overlayContains(overlay: FileOverlay, x: number, y: number): boolean {
  const dx = x - overlay.cx;
  const dy = y - overlay.cy;
  return Math.hypot(dx, dy) <= overlayRadiusAt(overlay, Math.atan2(dy, dx));
}

/**
 * The overlay containing a point; where several do, the one with the smallest base radius.
 *
 * @param overlays - Overlays to test.
 * @param x - Point x in simulation space.
 * @param y - Point y in simulation space.
 * @returns The tightest overlay that contains the point, or null.
 */
export function overlayAt(overlays: Iterable<FileOverlay>, x: number, y: number): FileOverlay | null {
  let best: FileOverlay | null = null;
  for (const o of overlays) {
    if (overlayContains(o, x, y) && (!best || o.baseRadius < best.baseRadius)) best = o;
  }
  return best;
}

/** How strongly an overlay is called out: it holds a locked node, or a selected one. */
export interface OverlayEmphasis {
  level: 'locked' | 'selected';
  /** glow, outline and label color */
  accent: string;
}

/** Options for {@link drawFileOverlays}. */
export interface DrawOverlayOptions {
  /** `dark` mutes overlays without emphasis so the emphasized ones stand out; default `light` */
  theme?: 'light' | 'dark';
  /** emphasized overlays by file id; drawn last, with a glow */
  emphasis?: ReadonlyMap<string, OverlayEmphasis>;
}

/**
 * Draws file overlays.
 *
 * @param ctx - Canvas context, already in simulation space.
 * @param overlays - Overlays to draw.
 * @param config - Labels and opacities.
 * @param hoveredId - Id of the hovered overlay, drawn stronger.
 * @param options - Theme and emphasis; omit for the plain light drawing.
 */
export function drawFileOverlays(
  ctx: CanvasRenderingContext2D,
  overlays: Iterable<FileOverlay>,
  config: FileOverlayConfig,
  hoveredId: string | null,
  options: DrawOverlayOptions = {},
): void {
  const { theme = 'light', emphasis } = options;
  const dark = theme === 'dark';
  const line = d3.line().curve(d3.curveCatmullRomClosed.alpha(0.5)).context(ctx);
  const topK = wrap(Math.round(-Math.PI / 2 / STEP));
  // emphasized overlays go last so their glow sits on top of their neighbours
  // each glow is a blurred shadow of a whole polygon, so past a few dozen emphasized overlays drop the blur
  const glow = (emphasis?.size ?? 0) <= 150;
  const ordered = emphasis?.size ? [...overlays].sort((a, b) => Number(emphasis.has(a.id)) - Number(emphasis.has(b.id))) : overlays;
  for (const o of ordered) {
    const base = hashToColor(o.path);
    const hot = o.id === hoveredId;
    const emph = emphasis?.get(o.id);
    const fill = emph ? emph.accent : base;
    ctx.save();
    ctx.beginPath();
    line(o.points);
    ctx.closePath();
    if (emph) {
      const locked = emph.level === 'locked';
      ctx.shadowColor = emph.accent;
      ctx.shadowBlur = glow ? (locked ? 28 : 20) : 0;
      ctx.fillStyle = fill;
      ctx.globalAlpha = locked ? 0.26 : 0.18;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 0.95;
      ctx.strokeStyle = emph.accent;
      ctx.lineWidth = locked ? 3 : 2.5;
      if (!locked) ctx.setLineDash([8, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      const mute = dark ? 0.6 : 1;
      ctx.fillStyle = base;
      ctx.globalAlpha = (hot ? Math.min(1, config.fillOpacity * 2) : config.fillOpacity) * mute;
      ctx.fill();
      ctx.globalAlpha = (hot ? Math.min(1, config.strokeOpacity + 0.35) : config.strokeOpacity) * mute;
      ctx.strokeStyle = dark ? base : deriveBorderColor(base);
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    if (config.labels) {
      const lx = o.cx;
      const ly = o.cy - o.radii[topK] - 12;
      ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, sans-serif';
      const pw = ctx.measureText(o.name).width + 14;
      const ph = 19;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(lx - pw / 2, ly - ph / 2, pw, ph, 6);
      else ctx.rect(lx - pw / 2, ly - ph / 2, pw, ph);
      ctx.fillStyle = fill;
      ctx.globalAlpha = emph ? 1 : dark ? 0.7 : 0.85;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = emph ? '#0b0f19' : '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(o.name, lx, ly + 1);
    }
    ctx.restore();
  }
}
