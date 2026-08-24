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
  gradientSourceColor?: string;
  gradientTargetColor?: string;
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
    areaCluster: number;
    areaAttract: number;
    areaParent: number;
    anchorRepel: number;
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

export const DEFAULT_AREA_FORCES = {
  areaCluster: 0.3,
  areaAttract: 0.15,
  areaParent: 0.5,
  anchorRepel: 4000,
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

export const DATA_FLOW_PROCESSING_TYPES = new Set<SyntaxType>([
  SyntaxType.FUNCTION,
  SyntaxType.METHOD,
  SyntaxType.CLASS,
]);

export const DATA_FLOW_DATA_TYPES = new Set<SyntaxType>([
  SyntaxType.INTERFACE,
  SyntaxType.TYPE_ALIAS,
]);

export const PROCESSING_NODE_RADIUS = 6;

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
    ...DEFAULT_AREA_FORCES,
  },
  simulation: { ...DEFAULT_SIMULATION },
};

function hasCrossFileReference(node: AnalysisNode): boolean {
  return (
    node.referencedAt.some((ref) => ref.filePath !== node.filePath) ||
    node.outboundRefs.some((ref) => ref.filePath !== node.filePath)
  );
}

export const INTERNAL_PROCESSING_CONFIG: RepoGraphConfig = {
  filters: {
    node: (node: AnalysisNode) =>
      PROCESSING_NODE_TYPES.has(node.syntaxType) && hasCrossFileReference(node),
    edge: (edge: AnalysisEdge) => !edge.isExternal,
  },
  style: {
    node: (node: AnalysisNode, _degree: number): NodeStyle => {
      const color = SYNTAX_TYPE_COLORS[node.syntaxType] ?? DEFAULT_NODE_STYLE.color;
      return {
        ...DEFAULT_NODE_STYLE,
        color,
        radius: scaledValue(node.outboundRefs.length, 3, 30),
      };
    },
    edge: (): EdgeStyle => ({ ...DEFAULT_EDGE_STYLE }),
  },
  forces: {
    node: (node: AnalysisNode): NodeForces => ({
      ...DEFAULT_NODE_FORCES,
      charge: -300 - scaledValue(node.referencedAt.length, 0, 1500),
    }),
    edge: createEdgeForcer({
      [EdgeKind.CALLS]: { distance: 60, strength: 0.5 },
      [EdgeKind.EXTENDS]: { distance: 100, strength: 0.3 },
      [EdgeKind.IMPLEMENTS]: { distance: 100, strength: 0.3 },
      [EdgeKind.INSTANTIATES]: { distance: 100, strength: 0.3 },
      [EdgeKind.IMPORTS]: { distance: 200, strength: 0.1 },
      [EdgeKind.USES_TYPE]: { distance: 200, strength: 0.1 },
    }),
    ...DEFAULT_AREA_FORCES,
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

// ── Scaling helpers ──

export type ScaleFn = (count: number) => number;

const DEFAULT_SCALE_FN: ScaleFn = (count: number) => Math.log2(count + 1);

export function scaledValue(
  count: number,
  min: number,
  max: number,
  scaleFn: ScaleFn = DEFAULT_SCALE_FN,
): number {
  if (min >= max) return min;
  const scaled = scaleFn(count);
  const maxScaled = scaleFn(50);
  const normalized = Math.min(scaled / maxScaled, 1);
  return min + normalized * (max - min);
}

export function countOutboundCalls(
  node: AnalysisNode,
  edges: AnalysisEdge[],
): number {
  let count = 0;
  for (const e of edges) {
    if (e.fromSymbol === node.scipSymbol && e.kind === EdgeKind.CALLS) {
      count++;
    }
  }
  return count;
}

export function countInboundCalls(node: AnalysisNode): number {
  return node.referencedAt.length;
}

// ── Modules View ──

const MODULES_NODE_TYPES = new Set<SyntaxType>([
  SyntaxType.FUNCTION,
  SyntaxType.METHOD,
]);

export function buildSymbolKindMap(nodes: AnalysisNode[]): Map<string, SyntaxType> {
  return new Map(nodes.map((node) => [node.scipSymbol, node.syntaxType]));
}

export function countDataNodeUsage(
  edges: AnalysisEdge[],
  nodes: AnalysisNode[],
): Map<string, number> {
  const kindOf = buildSymbolKindMap(nodes);
  const usageByTarget = new Map<string, number>();

  for (const edge of edges) {
    if (
      edge.kind === EdgeKind.USES_TYPE &&
      DATA_FLOW_PROCESSING_TYPES.has(kindOf.get(edge.fromSymbol) as SyntaxType) &&
      DATA_FLOW_DATA_TYPES.has(kindOf.get(edge.toSymbol) as SyntaxType)
    ) {
      usageByTarget.set(
        edge.toSymbol,
        (usageByTarget.get(edge.toSymbol) ?? 0) + 1,
      );
    }
  }

  return usageByTarget;
}

export function createModulesViewConfig(
  edges: AnalysisEdge[],
): RepoGraphConfig {
  const outboundCallCounts = new Map<string, number>();
  for (const e of edges) {
    if (e.kind === EdgeKind.CALLS) {
      outboundCallCounts.set(
        e.fromSymbol,
        (outboundCallCounts.get(e.fromSymbol) ?? 0) + 1,
      );
    }
  }

  return mergeConfigs(DEFAULT_REPO_GRAPH_CONFIG, {
    filters: {
      node: (node: AnalysisNode) =>
        MODULES_NODE_TYPES.has(node.syntaxType),
      edge: (edge: AnalysisEdge) =>
        edge.kind === EdgeKind.CALLS && !edge.isExternal,
    },
    style: {
      node: (node: AnalysisNode, _degree: number): NodeStyle => {
        const color =
          SYNTAX_TYPE_COLORS[node.syntaxType] ?? DEFAULT_NODE_STYLE.color;
        const outbound = outboundCallCounts.get(node.scipSymbol) ?? 0;
        return {
          ...DEFAULT_NODE_STYLE,
          color,
          radius: scaledValue(outbound, 4, 30),
        };
      },
      edge: (_edge: AnalysisEdge): EdgeStyle => ({
        color: '#9ca3af',
        width: 1.5,
        opacity: 0.6,
        gradientSourceColor: '#d1d5db',
        gradientTargetColor: '#000000',
      }),
    },
    forces: {
      node: (node: AnalysisNode): NodeForces => ({
        ...DEFAULT_NODE_FORCES,
        collideRadius: scaledValue(countInboundCalls(node), 8, 40),
      }),
    },
  });
}

export function createDataFlowViewConfig(
  edges: AnalysisEdge[],
  nodes: AnalysisNode[],
): RepoGraphConfig {
  const kindOf = buildSymbolKindMap(nodes);
  const usageByTarget = countDataNodeUsage(edges, nodes);

  return mergeConfigs(DEFAULT_REPO_GRAPH_CONFIG, {
    filters: {
      node: (node: AnalysisNode) =>
        DATA_FLOW_PROCESSING_TYPES.has(node.syntaxType) ||
        DATA_FLOW_DATA_TYPES.has(node.syntaxType),
      edge: (edge: AnalysisEdge) =>
        edge.kind === EdgeKind.USES_TYPE &&
        !edge.isExternal &&
        DATA_FLOW_PROCESSING_TYPES.has(kindOf.get(edge.fromSymbol) as SyntaxType) &&
        DATA_FLOW_DATA_TYPES.has(kindOf.get(edge.toSymbol) as SyntaxType),
    },
    style: {
      node: (node: AnalysisNode, _degree: number): NodeStyle => {
        if (DATA_FLOW_DATA_TYPES.has(node.syntaxType)) {
          return {
            ...DEFAULT_NODE_STYLE,
            color: '#10b981',
            radius: scaledValue(
              usageByTarget.get(node.scipSymbol) ?? 0,
              PROCESSING_NODE_RADIUS * 2,
              PROCESSING_NODE_RADIUS * 5,
            ),
            label: true,
          };
        }

        return {
          ...DEFAULT_NODE_STYLE,
          color: '#9ca3af',
          radius: PROCESSING_NODE_RADIUS,
          label: false,
        };
      },
      edge: (_edge: AnalysisEdge): EdgeStyle => ({
        ...DEFAULT_EDGE_STYLE,
        width: 1.5,
        gradientSourceColor: '#d1d5db',
        gradientTargetColor: '#000000',
      }),
    },
    forces: {
      node: (): NodeForces => ({
        ...DEFAULT_NODE_FORCES,
        charge: -200,
      }),
      edge: (edge: AnalysisEdge): EdgeForces => ({
        distance: 90,
        strength: Math.max(
          0.05,
          0.35 / Math.sqrt(usageByTarget.get(edge.toSymbol) ?? 1),
        ),
      }),
    },
  });
}

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
        areaCluster: override.forces.areaCluster ?? result.forces.areaCluster,
        areaAttract: override.forces.areaAttract ?? result.forces.areaAttract,
        areaParent: override.forces.areaParent ?? result.forces.areaParent,
        anchorRepel: override.forces.anchorRepel ?? result.forces.anchorRepel,
      };
    }
    if (override.simulation) {
      result.simulation = { ...result.simulation, ...override.simulation };
    }
  }

  return result;
}
