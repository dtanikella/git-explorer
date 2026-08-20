import { DEFAULT_REPO_GRAPH_CONFIG, DEFAULT_NODE_FORCES } from '@/lib/analysis/graph-config';
import type { NodeForces } from '@/lib/analysis/graph-config';
import type { AnalysisEdge } from '@/lib/analysis/types';
import type { ChargeStrategy } from './types';

/**
 * `k` — the single global charge coefficient for the v2 scheme (report §1.8).
 * Replaces both the flat `-200` default and the hand-tuned log-scaling range of
 * `INTERNAL_PROCESSING_CONFIG`. `-k·sqrt(degree)` at degree 1 equals `-k`, so
 * `200` keeps the default scale while making high-degree hubs repel sub-linearly.
 */
export const CHARGE_COEFFICIENT_K = 200;

/** Node degree (in + out edge occurrences) keyed by `scipSymbol`. */
function incidentEdgeCount(edges: AnalysisEdge[]): Map<string, number> {
  const degrees = new Map<string, number>();
  for (const edge of edges) {
    degrees.set(edge.fromSymbol, (degrees.get(edge.fromSymbol) ?? 0) + 1);
    degrees.set(edge.toSymbol, (degrees.get(edge.toSymbol) ?? 0) + 1);
  }
  return degrees;
}

/**
 * Legacy charge strategy — the old constant-based behavior, wrapped verbatim
 * (moved not rewritten): every node gets the flat `-200` default force.
 *
 * The Phase-4 wiring leaves the config's existing accessor untouched while the
 * active scheme is `'legacy'`, so this factory is the reference implementation
 * pinned by the parity regression test rather than the live simulation's path.
 */
export const legacyCharge: ChargeStrategy = () => DEFAULT_REPO_GRAPH_CONFIG.forces.node;

/**
 * v2 charge strategy (report §1.8): `charge(i) = -k·sqrt(degree(i))`.
 *
 * Repulsion grows sub-linearly with degree so hub nodes don't dominate the
 * layout, while staying visually distinguishable from leaf nodes. Degree-0
 * nodes (isolated) get charge 0 — no repulsion — matching the sign convention
 * `-k·sqrt(0) = 0`.
 */
export const degreeScaledCharge: ChargeStrategy = (context) => {
  const degrees = incidentEdgeCount(context.edges);
  const k = CHARGE_COEFFICIENT_K;
  return (node): NodeForces => {
    const degree = degrees.get(node.scipSymbol) ?? 0;
    return {
      ...DEFAULT_NODE_FORCES,
      charge: degree === 0 ? 0 : -k * Math.sqrt(degree),
    };
  };
};