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

const SYNTAX_TYPE_COLORS: Partial<Record<SyntaxType, string>> = {
  [SyntaxType.FUNCTION]: '#3b82f6',
  [SyntaxType.METHOD]: '#60a5fa',
  [SyntaxType.CLASS]: '#8b5cf6',
  [SyntaxType.INTERFACE]: '#10b981',
  [SyntaxType.TYPE_ALIAS]: '#f59e0b',
  [SyntaxType.MODULE]: '#ec4899',
};

const PROCESSING_NODE_TYPES = new Set<SyntaxType>([
  SyntaxType.FUNCTION,
  SyntaxType.METHOD,
  SyntaxType.CLASS,
]);

export const DEFAULT_REPO_GRAPH_CONFIG: RepoGraphConfig = {
  filters: {
    node: () => true,
    edge: () => true,
  },
  style: {
    node: (node: AnalysisNode, _degree: number): NodeStyle => {
      const color = SYNTAX_TYPE_COLORS[node.syntaxType] ?? DEFAULT_NODE_STYLE.color;
      return { ...DEFAULT_NODE_STYLE, color };
    },
    edge: (): EdgeStyle => ({ ...DEFAULT_EDGE_STYLE }),
  },
  forces: {
    node: (): NodeForces => ({ ...DEFAULT_NODE_FORCES }),
    edge: (): EdgeForces => ({ ...DEFAULT_EDGE_FORCES }),
  },
  simulation: { ...DEFAULT_SIMULATION },
};

export const INTERNAL_PROCESSING_CONFIG: RepoGraphConfig = {
  filters: {
    node: (node: AnalysisNode) => PROCESSING_NODE_TYPES.has(node.syntaxType),
    edge: (edge: AnalysisEdge) => !edge.isExternal,
  },
  style: {
    node: (node: AnalysisNode, _degree: number): NodeStyle => {
      const color = SYNTAX_TYPE_COLORS[node.syntaxType] ?? DEFAULT_NODE_STYLE.color;
      const radius = Math.min(Math.max(3 + node.outboundRefs.length, 3), 30);
      return { ...DEFAULT_NODE_STYLE, color, radius };
    },
    edge: (): EdgeStyle => ({ ...DEFAULT_EDGE_STYLE }),
  },
  forces: {
    node: (node: AnalysisNode): NodeForces => {
      const charge = Math.max(-(100 + node.referencedAt.length * 20), -600);
      const radius = Math.min(Math.max(3 + node.outboundRefs.length, 3), 30);
      return { ...DEFAULT_NODE_FORCES, charge, collideRadius: radius + 2 };
    },
    edge: createEdgeForcer({
      [EdgeKind.CALLS]: { distance: 30, strength: 0.8 },
      [EdgeKind.INSTANTIATES]: { distance: 50, strength: 0.6 },
      [EdgeKind.EXTENDS]: { distance: 50, strength: 0.6 },
      [EdgeKind.IMPLEMENTS]: { distance: 50, strength: 0.6 },
      [EdgeKind.IMPORTS]: { distance: 100, strength: 0.3 },
      [EdgeKind.USES_TYPE]: { distance: 100, strength: 0.3 },
    }),
  },
  simulation: { ...DEFAULT_SIMULATION },
};


export function createNodeStyler(
  mapping: Partial<Record<SyntaxType, Partial<NodeStyle>>>,
  sizeFn?: (degree: number) => number,
): NodeStyler {
  return (node: AnalysisNode, degree: number): NodeStyle => {
    const overrides = mapping[node.syntaxType];
    const base = overrides
      ? { ...DEFAULT_NODE_STYLE, ...overrides }
      : { ...DEFAULT_NODE_STYLE };
    if (sizeFn) {
      base.radius = sizeFn(degree);
    }
    return base;
  };
}

export function combineFilters<T>(...predicates: Array<(item: T) => boolean>): (item: T) => boolean {
  if (predicates.length === 0) return () => true;
  return (item: T) => predicates.every((p) => p(item));
}

export function createEdgeForcer(
  mapping: Partial<Record<EdgeKind, Partial<EdgeForces>>>,
): EdgeForcer {
  return (edge: AnalysisEdge): EdgeForces => {
    const overrides = mapping[edge.kind];
    if (!overrides) return { ...DEFAULT_EDGE_FORCES };
    return { ...DEFAULT_EDGE_FORCES, ...overrides };
  };
}

type DeepPartial<T> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [K in keyof T]?: T[K] extends (...args: any[]) => any
    ? T[K]
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K];
};

export type { DeepPartial };

export function mergeConfigs(
  base: RepoGraphConfig,
  ...overrides: DeepPartial<RepoGraphConfig>[]
): RepoGraphConfig {
  const result: RepoGraphConfig = {
    filters: { ...base.filters },
    style: { ...base.style },
    forces: { ...base.forces },
    simulation: { ...base.simulation },
  };

  for (const override of overrides) {
    if (override.filters) {
      result.filters = {
        node: override.filters.node ?? result.filters.node,
        edge: override.filters.edge ?? result.filters.edge,
      };
    }
    if (override.style) {
      result.style = {
        node: override.style.node ?? result.style.node,
        edge: override.style.edge ?? result.style.edge,
      };
    }
    if (override.forces) {
      result.forces = {
        node: override.forces.node ?? result.forces.node,
        edge: override.forces.edge ?? result.forces.edge,
      };
    }
    if (override.simulation) {
      result.simulation = { ...result.simulation, ...override.simulation };
    }
  }

  return result;
}
