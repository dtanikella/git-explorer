import { DEFAULT_REPO_GRAPH_CONFIG, DEFAULT_EDGE_FORCES } from '@/lib/analysis/graph-config';
import type { EdgeForces } from '@/lib/analysis/graph-config';
import type { AnalysisEdge } from '@/lib/analysis/types';
import { EdgeKind } from '@/lib/analysis/types';
import type { EdgeForceStrategy } from './types';

/**
 * `ρ` — inter-community edge strength multiplier (report §1.7). Default 0.4
 * (report's suggested range 0.3–0.5).
 */
export const RHO_DEFAULT = 0.4;

/**
 * `β` — inter-community edge distance multiplier (report §1.7). Default 2.0
 * (report's suggested range 1.5–2.5).
 */
export const BETA_DEFAULT = 2.0;

/**
 * `d0` — base edge distance for same-community edges, matching the legacy
 * `DEFAULT_EDGE_FORCES.distance` (80) so intra-cluster spacing stays familiar.
 */
export const BASE_DISTANCE_DEFAULT = DEFAULT_EDGE_FORCES.distance;

/**
 * Optional secondary per-edge-kind multiplier kept from the old lookup table
 * (report §1.7: kind is "no longer the primary driver", but semantically
 * meaningful kinds may stay visually distinct). `EXTENDS`/`IMPLEMENTS`/
 * `INSTANTIATES` edges are stretched slightly and held a touch more loosely.
 */
const KIND_SECONDARY_MULTIPLIERS: Partial<
  Record<EdgeKind, { distance: number; strength: number }>
> = {
  [EdgeKind.EXTENDS]: { distance: 1.25, strength: 0.8 },
  [EdgeKind.IMPLEMENTS]: { distance: 1.25, strength: 0.8 },
  [EdgeKind.INSTANTIATES]: { distance: 1.25, strength: 0.8 },
};

/** Raw call weight of a directed edge: how many edges share its (from,to) pair. */
export function callWeightOf(edges: AnalysisEdge[], edge: AnalysisEdge): number {
  let weight = 0;
  for (const e of edges) {
    if (e.fromSymbol === edge.fromSymbol && e.toSymbol === edge.toSymbol) weight++;
  }
  return weight;
}

/** Maximum raw call weight across all edges (0 when there are no edges). */
export function maxCallWeight(edges: AnalysisEdge[]): number {
  let max = 0;
  for (const e of edges) {
    const w = callWeightOf(edges, e);
    if (w > max) max = w;
  }
  return max;
}

/** Normalize a call weight into [0,1]; the max-weight edge normalizes to 1. */
export function normalizeCallWeight(weight: number, maxWeight: number): number {
  if (maxWeight <= 0) return 0;
  return weight / maxWeight;
}

/**
 * Legacy edge strategy — the old per-kind lookup table, wrapped verbatim
 * (moved not rewritten): the default config's per-edge accessor.
 *
 * As with `legacyCharge`, the Phase-4 wiring leaves the config's existing
 * accessor untouched while the active scheme is `'legacy'`; this factory is the
 * reference implementation pinned by the parity regression test.
 */
export const legacyEdge: EdgeForceStrategy = () => DEFAULT_REPO_GRAPH_CONFIG.forces.edge;

/**
 * v2 edge strategy (report §1.7): same-community modulation driven by raw call
 * weight and community membership, replacing the per-edge-kind lookup table:
 *
 *   strength(e) = normalize(callWeight(e)) · (sameCommunity ? 1 : ρ) · kindMult
 *   distance(e) = d0 · (sameCommunity ? 1 : β) · kindMult
 *
 * Intra-cluster edges pull tight (strength ~ weight), inter-cluster edges relax
 * (weaker + farther), which is the community-aware layout technique from
 * ForceAtlas2's LinLog / OpenOrd.
 */
export const weightModulatedEdge: EdgeForceStrategy = (context) => {
  const maxWeight = maxCallWeight(context.edges);

  return (edge): EdgeForces => {
    const weight = callWeightOf(context.edges, edge);
    const normalized = normalizeCallWeight(weight, maxWeight);
    const sameCommunity =
      context.communityOf.get(edge.fromSymbol) === context.communityOf.get(edge.toSymbol);

    const kindMultiplier = KIND_SECONDARY_MULTIPLIERS[edge.kind] ?? {
      distance: 1,
      strength: 1,
    };

    return {
      distance: BASE_DISTANCE_DEFAULT * (sameCommunity ? 1 : BETA_DEFAULT) * kindMultiplier.distance,
      strength: normalized * (sameCommunity ? 1 : RHO_DEFAULT) * kindMultiplier.strength,
    };
  };
};