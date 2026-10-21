import { DEFAULT_VIEW_CONFIG } from './config';
import type { DisplayConfig } from './config';
import type { HierarchyNode } from './types';

/** The part of the diagram a hover highlights, as node ids. */
export interface Slice {
  /** the hovered band and every ancestor band; for a symbol, its file band and the bands above it */
  chain: ReadonlySet<string>;
  /** all folder and file bands beneath a hovered folder; empty otherwise */
  below: ReadonlySet<string>;
}

/** How a band is emphasised while something is hovered. */
export type Emphasis = 'slice' | 'descendant' | 'rest';

/** Parent of every node under `root`, by id. */
export function parentMap(root: HierarchyNode): Map<string, HierarchyNode> {
  const parents = new Map<string, HierarchyNode>();
  const walk = (n: HierarchyNode) => n.children.forEach((c) => (parents.set(c.id, n), walk(c)));
  walk(root);
  return parents;
}

/**
 * The slice a hovered node highlights.
 *
 * @remarks
 * Hovering a folder highlights it, its ancestors and everything beneath it. Hovering a file highlights it and its
 * ancestors. Hovering a symbol highlights its file band and the ancestors above. The root has no band.
 *
 * @param target - The hovered folder, file or symbol.
 * @param parents - From {@link parentMap}.
 */
export function sliceOf(target: HierarchyNode, parents: ReadonlyMap<string, HierarchyNode>): Slice {
  const chain = new Set<string>();
  const below = new Set<string>();
  let up: HierarchyNode | undefined = target.tier === 'symbol' ? parents.get(target.id) : target;
  for (; up && up.tier !== 'root'; up = parents.get(up.id)) chain.add(up.id);
  if (target.tier === 'folder') {
    const down = (n: HierarchyNode) => n.children.forEach((c) => {
      if (c.tier === 'symbol') return;
      below.add(c.id);
      down(c);
    });
    down(target);
  }
  return { chain, below };
}

/** Which emphasis a band with this node id gets. */
export function emphasisOf(id: string, slice: Slice): Emphasis {
  return slice.chain.has(id) ? 'slice' : slice.below.has(id) ? 'descendant' : 'rest';
}

/** A resting opacity scaled by the emphasis, capped at 1. With no slice, opacity is unchanged. */
export function emphasisedOpacity(base: number, id: string, slice: Slice | null, config: DisplayConfig = DEFAULT_VIEW_CONFIG): number {
  if (!slice) return base;
  const factor = config.hover[emphasisOf(id, slice)];
  return Math.min(1, base * factor);
}

/** The id of the band a symbol belongs to, for dimming a symbol with its file. */
export const symbolFileId = (symbol: HierarchyNode, parents: ReadonlyMap<string, HierarchyNode>): string | undefined => parents.get(symbol.id)?.id;
