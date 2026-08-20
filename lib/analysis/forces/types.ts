import type { AnalysisNode, AnalysisEdge } from '@/lib/analysis/types';
import type { CommunityMap } from '@/lib/analysis/communities/detect';
import type { NodeForcer, EdgeForcer } from '@/lib/analysis/graph-config';

/**
 * Context passed to a charge strategy factory: the full node/edge set that will
 * appear in the simulation (post-filter), so the factory can aggregate
 * graph-wide quantities (degrees, weights) before producing the per-node
 * accessor the simulation already consumes.
 */
export interface ChargeStrategyContext {
  nodes: AnalysisNode[];
  edges: AnalysisEdge[];
}

/**
 * Context for edge strategies: the node/edge set plus the community partition
 * (node → communityId) used to decide same- vs cross-community membership.
 */
export interface EdgeForceStrategyContext extends ChargeStrategyContext {
  communityOf: CommunityMap;
}

/**
 * A charge strategy factory: aggregate over the full graph, then return a
 * per-node `NodeForcer` in the exact shape `RepoGraph` already consumes.
 */
export type ChargeStrategy = (context: ChargeStrategyContext) => NodeForcer;

/**
 * An edge strategy factory: aggregate over the full graph + partition, then
 * return a per-edge `EdgeForcer` in the exact shape `RepoGraph` already
 * consumes.
 */
export type EdgeForceStrategy = (context: EdgeForceStrategyContext) => EdgeForcer;