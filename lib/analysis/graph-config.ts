import type { AnalysisNode, AnalysisEdge } from '@/lib/analysis/types';
import { SyntaxType, EdgeKind } from '@/lib/analysis/types';

// ── Resolved value types ──

export interface NodeStyle {
  color: string;
  radius: number;
  opacity: number;
  label: boolean;
}

export interface EdgeStyle {
  color: string;
  width: number;
  opacity: number;
}

export interface NodeForces {
  charge: number;
  collideRadius: number;
  fx: number | null;
  fy: number | null;
}

export interface EdgeForces {
  distance: number;
  strength: number;
}

export interface SimulationParams {
  centerStrength: number;
  collisionPadding: number;
  alphaDecay: number;
  velocityDecay: number;
}

// ── Accessor function types ──

export type NodePredicate = (node: AnalysisNode) => boolean;
export type EdgePredicate = (edge: AnalysisEdge) => boolean;
export type NodeStyler = (node: AnalysisNode, degree: number) => NodeStyle;
export type EdgeStyler = (edge: AnalysisEdge) => EdgeStyle;
export type NodeForcer = (node: AnalysisNode) => NodeForces;
export type EdgeForcer = (edge: AnalysisEdge) => EdgeForces;

// ── Config object ──

export interface RepoGraphConfig {
  filters: {
    node: NodePredicate;
    edge: EdgePredicate;
  };
  style: {
    node: NodeStyler;
    edge: EdgeStyler;
  };
  forces: {
    node: NodeForcer;
    edge: EdgeForcer;
  };
  simulation: SimulationParams;
}

// ── Defaults ──

export const DEFAULT_NODE_STYLE: NodeStyle = {
  color: '#6b7280',
  radius: 6,
  opacity: 1,
  label: false,
};

export const DEFAULT_EDGE_STYLE: EdgeStyle = {
  color: '#9ca3af',
  width: 1,
  opacity: 0.6,
};

export const DEFAULT_NODE_FORCES: NodeForces = {
  charge: -200,
  collideRadius: 10,
  fx: null,
  fy: null,
};

export const DEFAULT_EDGE_FORCES: EdgeForces = {
  distance: 80,
  strength: 0.5,
};

export const DEFAULT_SIMULATION: SimulationParams = {
  centerStrength: 0.1,
  collisionPadding: 3,
  alphaDecay: 0.0228,
  velocityDecay: 0.4,
};
