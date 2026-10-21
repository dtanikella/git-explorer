import type { AnalysisEdge, EdgeKind } from '@/lib/analysis/types';
import { ownerOf } from './owner';
import type { ConnectionModel, Direction, DotConnections, DotEdge } from './types';

/**
 * Turns analysis edges into the connections of each symbol dot.
 *
 * @remarks
 * The default view keeps only top-level declarations, so an endpoint that is a member rolls up to the nearest
 * owner that has a dot (`ownerOf`). An edge between a dot and itself is dropped, and edges of the same kind
 * between the same two dots collapse into one connection, so a connection count is a count of distinct connected
 * symbols. An edge with an external or unresolved end, or an end whose owners have no dot, cannot be drawn: it
 * is counted in `undrawn` on the end that does have a dot. Order follows the input, so output is deterministic.
 *
 * @param edges - The analysis edges.
 * @param dotIds - Ids of the kept symbols, the ones drawn as dots.
 */
export function buildConnections(edges: readonly AnalysisEdge[], dotIds: ReadonlySet<string>): ConnectionModel {
  const byDot = new Map<string, DotConnections>();
  const entry = (id: string) => {
    let c = byDot.get(id);
    if (!c) byDot.set(id, (c = { out: new Map(), in: new Map(), undrawn: 0 }));
    return c;
  };
  const resolve = (symbol: string): string | null => {
    for (let s: string | null = symbol; s; s = ownerOf(s)) if (dotIds.has(s)) return s;
    return null;
  };
  const add = (map: Map<EdgeKind, string[]>, kind: EdgeKind, other: string) => {
    const list = map.get(kind);
    if (!list) map.set(kind, [other]);
    else if (!list.includes(other)) list.push(other);
  };

  const seen = new Set<string>();
  const out: DotEdge[] = [];
  for (const e of edges) {
    const from = e.fromSymbol ? resolve(e.fromSymbol) : null;
    const to = e.isExternal || !e.toSymbol ? null : resolve(e.toSymbol);
    if (from && to) {
      if (from === to) continue;
      const key = `${e.kind}\0${from}\0${to}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ kind: e.kind, from, to });
      add(entry(from).out, e.kind, to);
      add(entry(to).in, e.kind, from);
    } else if (from) {
      entry(from).undrawn++;
    } else if (to) {
      entry(to).undrawn++;
    }
  }
  return { byDot, edges: out };
}

/** A kind and how many distinct symbols it connects to. */
export interface KindCount {
  kind: EdgeKind;
  count: number;
}

/**
 * The edge kinds a dot has in one direction, most connections first.
 *
 * @remarks
 * Kinds with no connections are left out. Ties keep the order in which kinds were first seen.
 */
export function rankedKinds(conn: DotConnections | undefined, direction: Direction): KindCount[] {
  if (!conn) return [];
  return [...conn[direction]]
    .map(([kind, others]) => ({ kind, count: others.length }))
    .sort((a, b) => b.count - a.count);
}

/** Number of distinct symbols a dot is connected to in one direction, across all kinds. */
export function distinctConnected(conn: DotConnections | undefined, direction: Direction): number {
  if (!conn) return 0;
  return new Set([...conn[direction].values()].flat()).size;
}
