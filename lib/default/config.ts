import type { SyntaxType } from '@/lib/analysis/types';
import type { LinkKind, Tier } from './types';

/**
 * Display settings of the default view. This is the one place to tune node and edge looks.
 *
 * @remarks
 * Each setting is either a plain value or a function of its context, so a rule can depend on
 * tier, syntax type, link kind or depth. Layout and renderer read settings only through
 * {@link nodeStyle}, {@link edgeStyle}, {@link edgeLength}, {@link bandHue} and {@link bandStyle}.
 */

/** What a node setting can depend on. */
export interface NodeContext {
  tier: Tier;
  /** hops from the root */
  depth: number;
  /** set for symbols only */
  syntaxType?: SyntaxType;
}

/** What an edge setting can depend on. */
export interface EdgeContext {
  kind: LinkKind;
  /** depth of the child end of the edge */
  depth: number;
  /** the child node's resolved color, so an edge can match its node */
  childColor: string;
}

/** What a band's hue can depend on. A band is the translucent region behind a folder's or file's descendants. */
export interface HueContext {
  tier: 'folder' | 'file';
  /** the parent folder's hue, `null` directly under the root */
  parentHue: number | null;
  /** position among the root's children, which seeds each top-level hue */
  topIndex: number;
  /** position among siblings of the same tier, in layout order */
  siblingIndex: number;
  siblingCount: number;
}

/** What a band's color and opacity can depend on. */
export interface BandContext {
  tier: 'folder' | 'file';
  /** hops from the root: top-level folders are 1 */
  depth: number;
  path: string;
  /** hue from {@link DisplayConfig.band}'s `hue` rule, 0-360 */
  hue: number;
  /** position among siblings of the same tier, in layout order */
  siblingIndex: number;
  siblingCount: number;
}

/** A value, or a rule that computes it from a context. */
export type Setting<T, C> = T | ((ctx: C) => T);

export interface DisplayConfig {
  node: {
    radius: Setting<number, NodeContext>;
    color: Setting<string, NodeContext>;
    /** arc length in px a node claims along its ring, so neighbours keep clear of each other */
    spacing: Setting<number, NodeContext>;
  };
  edge: {
    /** radial gap between the two ends of the edge, in px */
    length: Setting<number, EdgeContext>;
    width: Setting<number, EdgeContext>;
    color: Setting<string, EdgeContext>;
  };
  /** the sectors behind the symbols: one per file and one per folder */
  band: {
    hue: Setting<number, HueContext>;
    color: Setting<string, BandContext>;
    opacity: Setting<number, BandContext>;
  };
  /** the stroke around every band that keeps neighbours apart */
  separator: {
    /** constant on screen at any zoom, in px */
    width: number;
    /** the canvas background color, so the stroke reads as a gap */
    color: string;
  };
  hover: {
    /** opacity multiplier for the hovered band and its ancestors */
    slice: number;
    /** opacity multiplier for the descendants of a hovered folder */
    descendant: number;
    /** opacity multiplier for everything outside the slice */
    rest: number;
    /** the one border around the whole highlighted slice */
    border: { width: number; color: string; opacity: number };
  };
  /** how diff mode marks added, modified and deleted symbols */
  diff: {
    color: Record<'added' | 'modified' | 'deleted', string>;
    /** opacity multiplier for a band with no changed symbol beneath it */
    unchangedBand: number;
    /** opacity multiplier for an unchanged symbol */
    unchangedSymbol: number;
    /** opacity multiplier for a ghost, a deleted symbol drawn from the base commit */
    ghost: number;
    /** the ring around a changed symbol; width and gap in px, dash as [dash, gap] in px for a deleted one */
    outline: { width: number; gap: number; dash: [number, number] };
    /** the stacked added / modified / deleted strip beside a changed file; all in px */
    rim: { width: number; gap: number; minArc: number };
  };
  label: {
    minFont: number;
    maxFont: number;
    /** a visible label disappears only below this size */
    hideBelow: number;
    /** padding in px around the text box */
    padding: number;
    /** added to a horizontal fit when modes are compared, so horizontal wins unless another is clearly larger */
    horizontalBonus: number;
    /** added to a radial fit when modes are compared */
    radialPenalty: number;
    /** a label keeps its mode unless another is at least this many px bigger */
    switchMargin: number;
    /** fade time of a label appearing or disappearing, in ms */
    fadeMs: number;
  };
}

const NEUTRAL_COLOR = '#6b7280';

const SYMBOL_COLOR: Partial<Record<SyntaxType, string>> = {
  FUNCTION: '#f59e0b',
  CLASS: '#ef4444',
  INTERFACE: '#8b5cf6',
  TYPE_ALIAS: '#a78bfa',
  ENUM: '#ec4899',
  VARIABLE: '#10b981',
  NAMESPACE: '#14b8a6',
};

// one gap for all three, so every band of a tier has the same radial thickness
const RING_GAP = 300;

const EDGE_LENGTH: Record<LinkKind, number> = {
  'symbol-file': RING_GAP,
  'file-folder': RING_GAP,
  'folder-folder': RING_GAP,
};

/** Background of the view. The band separator takes the same color, so a gap reads as a gap. */
export const CANVAS_BACKGROUND = '#ffffff';

const GOLDEN_ANGLE = 137.508;

const NODE_RADIUS = 5;

// each node claims its own diameter plus a 10px margin along its ring, so neighbouring circles never touch
const NODE_SPACING = 2 * NODE_RADIUS + 10;

/** The active configuration. Edit values here and reload. */
export const DEFAULT_VIEW_CONFIG: DisplayConfig = {
  node: {
    radius: NODE_RADIUS,
    // gray everywhere except symbols, which are colored by kind
    color: (ctx) => (ctx.tier === 'symbol' && ctx.syntaxType && SYMBOL_COLOR[ctx.syntaxType]) || NEUTRAL_COLOR,
    spacing: (ctx) => (ctx.tier === 'root' ? 0 : NODE_SPACING),
  },
  edge: {
    length: (ctx) => EDGE_LENGTH[ctx.kind],
    width: 1,
    // gray except symbol -> file edges, which take the symbol's color
    color: (ctx) => (ctx.kind === 'symbol-file' ? ctx.childColor : NEUTRAL_COLOR),
  },
  band: {
    // A top-level folder takes a golden-angle hue so neighbours differ. Below that, sibling folders spread evenly around
    // the parent's hue by up to +-70deg (an only child keeps it), and files take their folder's hue, so a subtree reads
    // as one color family.
    hue: (ctx) => {
      if (ctx.tier === 'file' && ctx.parentHue !== null) return ctx.parentHue;
      if (ctx.parentHue === null) return (ctx.topIndex * GOLDEN_ANGLE) % 360;
      const width = Math.min(140, 40 * ctx.siblingCount);
      const offset = ctx.siblingCount > 1 ? (ctx.siblingIndex / (ctx.siblingCount - 1) - 0.5) * width : 0;
      return (ctx.parentHue + offset + 360) % 360;
    },
    // Folder bands darken with depth and alternate by sibling. File bands step evenly from light to dark across a
    // folder's files (a lone file sits at 58%).
    color: (ctx) =>
      ctx.tier === 'file'
        ? `hsl(${ctx.hue}, 66%, ${ctx.siblingCount > 1 ? 76 - (38 * ctx.siblingIndex) / (ctx.siblingCount - 1) : 58}%)`
        : `hsl(${ctx.hue}, 58%, ${Math.max(34, 50 - (ctx.depth - 1) * 3 + (ctx.siblingIndex % 2 ? 9 : -2))}%)`,
    opacity: (ctx) => (ctx.tier === 'file' ? 0.34 : 0.3 + Math.min(ctx.depth - 1, 2) * 0.05),
  },
  separator: { width: 5, color: CANVAS_BACKGROUND },
  hover: {
    slice: 1.45,
    descendant: 1.2,
    rest: 0.5,
    border: { width: 2, color: '#111827', opacity: 0.85 },
  },
  diff: {
    color: { added: '#16a34a', modified: '#d97706', deleted: '#dc2626' },
    unchangedBand: 0.1,
    unchangedSymbol: 0.2,
    ghost: 0.45,
    outline: { width: 1.6, gap: 2, dash: [3, 2] },
    rim: { width: 5, gap: 9, minArc: 11 },
  },
  label: {
    minFont: 10,
    maxFont: 18,
    hideBelow: 8.5,
    padding: 3,
    horizontalBonus: 2,
    radialPenalty: 1,
    switchMargin: 3,
    fadeMs: 120,
  },
};

function resolve<T, C>(setting: Setting<T, C>, ctx: C): T {
  return typeof setting === 'function' ? (setting as (c: C) => T)(ctx) : setting;
}

/** Resolved look of a node. */
export function nodeStyle(ctx: NodeContext, config: DisplayConfig = DEFAULT_VIEW_CONFIG): { radius: number; color: string; spacing: number } {
  return { radius: resolve(config.node.radius, ctx), color: resolve(config.node.color, ctx), spacing: resolve(config.node.spacing, ctx) };
}

/** Resolved look of an edge, without its length. */
export function edgeStyle(ctx: EdgeContext, config: DisplayConfig = DEFAULT_VIEW_CONFIG): { width: number; color: string } {
  return { width: resolve(config.edge.width, ctx), color: resolve(config.edge.color, ctx) };
}

/** Radial gap the layout puts between the two ends of an edge. */
export function edgeLength(ctx: EdgeContext, config: DisplayConfig = DEFAULT_VIEW_CONFIG): number {
  return resolve(config.edge.length, ctx);
}

/** Hue of a band, 0-360. */
export function bandHue(ctx: HueContext, config: DisplayConfig = DEFAULT_VIEW_CONFIG): number {
  return resolve(config.band.hue, ctx);
}

/** Resolved look of a band. */
export function bandStyle(ctx: BandContext, config: DisplayConfig = DEFAULT_VIEW_CONFIG): { color: string; opacity: number } {
  return { color: resolve(config.band.color, ctx), opacity: resolve(config.band.opacity, ctx) };
}
