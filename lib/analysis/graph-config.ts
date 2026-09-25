import type { AnalysisNode, AnalysisEdge } from '@/lib/analysis/types';
import { SyntaxType, EdgeKind } from '@/lib/analysis/types';

// ── Resolved value types ──

/**
 * Visual style properties for a graph node.
 *
 * @remarks
 * These are resolved values (not overrides) consumed by the canvas
 * renderer. All properties are required — use partial overrides and
 * merge with defaults for per-type customization.
 */
export interface NodeStyle {
  /** fill color as CSS hex string */
  color: string;
  /** node radius in simulation units */
  radius: number;
  /** fill opacity 0-1 */
  opacity: number;
  /** whether to render a text label next to the node */
  label: boolean;
}

/**
 * Visual style properties for a graph edge.
 */
export interface EdgeStyle {
  /** stroke color as CSS hex string */
  color: string;
  /** stroke width in px */
  width: number;
  /** stroke opacity 0-1 */
  opacity: number;
  /** optional gradient start color (source side) */
  gradientSourceColor?: string;
  /** optional gradient end color (target side) */
  gradientTargetColor?: string;
}

/**
 * D3 force parameters for a single node.
 */
export interface NodeForces {
  /** node charge (negative = repulsion) */
  charge: number;
  /** collision radius padding */
  collideRadius: number;
  /** fixed x position, or null for free movement */
  fx: number | null;
  /** fixed y position, or null for free movement */
  fy: number | null;
}

/**
 * D3 force parameters for a single edge.
 */
export interface EdgeForces {
  /** target edge distance in simulation units */
  distance: number;
  /** edge spring strength 0-1 */
  strength: number;
}

/**
 * Top-level D3 simulation parameters.
 */
export interface SimulationParams {
  /** strength of the centering force toward the canvas center */
  centerStrength: number;
  /** extra padding around each node for collision detection */
  collisionPadding: number;
  /** simulation energy decay rate; higher = faster settling */
  alphaDecay: number;
  /** velocity decay per tick; higher = more damping */
  velocityDecay: number;
}

// ── Accessor function types ──

/**
 * Filters nodes from the analysis set.
 * @param node - The analysis node to evaluate.
 * @returns True to include the node in the graph.
 */
export type NodePredicate = (node: AnalysisNode) => boolean;

/**
 * Filters edges from the analysis set.
 * @param edge - The analysis edge to evaluate.
 * @returns True to include the edge in the graph.
 */
export type EdgePredicate = (edge: AnalysisEdge) => boolean;

/**
 * Resolves node style from an analysis node and its degree.
 * @param node - The analysis node.
 * @param degree - The node's connection degree (inbound + outbound references).
 * @returns A fully resolved {@link NodeStyle}.
 */
export type NodeStyler = (node: AnalysisNode, degree: number) => NodeStyle;

/**
 * Resolves edge style from an analysis edge.
 * @param edge - The analysis edge.
 * @returns A fully resolved {@link EdgeStyle}.
 */
export type EdgeStyler = (edge: AnalysisEdge) => EdgeStyle;

/**
 * Resolves node force parameters from an analysis node.
 * @param node - The analysis node.
 * @returns A fully resolved {@link NodeForces}.
 */
export type NodeForcer = (node: AnalysisNode) => NodeForces;

/**
 * Resolves edge force parameters from an analysis edge.
 * @param edge - The analysis edge.
 * @returns A fully resolved {@link EdgeForces}.
 */
export type EdgeForcer = (edge: AnalysisEdge) => EdgeForces;

// ── Config object ──

/**
 * Complete graph configuration: filters, styles, forces, and simulation.
 *
 * @remarks
 * View-specific configs (Modules, Data Flow, Internal Processing) are
 * created by merging overrides into {@link DEFAULT_REPO_GRAPH_CONFIG}
 * via {@link mergeConfigs}.
 *
 * @see commit a570b03
 */
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
    areaPin: number;
    crossAreaPull: number;
    areaHullCollision: number;
    layerRadii?: Record<string, number>;
  };
  simulation: SimulationParams;
}

// ── Defaults ──

/**
 * Default node visual style: medium gray, no label.
 *
 * @remarks
 * Overridden per-syntax-type in view-specific configs.
 */
export const DEFAULT_NODE_STYLE: NodeStyle = {
  color: '#6b7280',
  radius: 6,
  opacity: 1,
  label: false,
};

/**
 * Default edge visual style: gray stroke, no gradient.
 */
export const DEFAULT_EDGE_STYLE: EdgeStyle = {
  color: '#9ca3af',
  width: 1,
  opacity: 0.6,
};

/**
 * Default node force parameters: moderate charge, small collision buffer.
 */
export const DEFAULT_NODE_FORCES: NodeForces = {
  charge: -400,
  collideRadius: 10,
  fx: null,
  fy: null,
};

/**
 * Default edge force parameters: moderate distance, moderate strength.
 */
export const DEFAULT_EDGE_FORCES: EdgeForces = {
  distance: 80,
  strength: 0.5,
};

export const DEFAULT_AREA_FORCES = {
  areaCluster: 0.3,
  areaAttract: 0.15,
  areaParent: 0.5,
  anchorRepel: 4000,
  areaPin: 0.5,
  crossAreaPull: 0.25,
  areaHullCollision: 0.5,
};

export const DEFAULT_SIMULATION: SimulationParams = {
  centerStrength: 0.1,
  collisionPadding: 10,
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


/**
 * Builds a {@link NodeStyler} from a per-syntax-type override map and optional size function.
 *
 * @remarks
 * Merges the default node style with type-specific overrides, then applies
 * the size function (if provided) to set the radius dynamically from the
 * node's degree. Used to construct view-specific stylers without repeating
 * the default-merge logic.
 *
 * @param mapping - Partial style overrides keyed by {@link SyntaxType};
 *   types not present in the map use {@link DEFAULT_NODE_STYLE} unchanged.
 * @param sizeFn - Optional function mapping a node's degree (incoming + outgoing
 *   reference count) to a radius in simulation units.
 * @returns A {@link NodeStyler} that resolves style for any analysis node.
 * @see {@link DEFAULT_NODE_STYLE}
 * @see commit 956369f
 */
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

/**
 * Combines multiple predicate functions into one that passes only when all pass.
 *
 * @remarks
 * Returns `() => true` when no predicates are given (the identity filter).
 * Used internally by view config builders to compose {@link RepoGraphConfig.filters}.
 *
 * @param predicates - Filter functions in evaluation order; each receives an item
 *   of type `T` and returns `true` to include it.
 * @returns A single predicate that short-circuits on the first `false`.
 * @see commit 2458d6b
 */
export function combineFilters<T>(...predicates: Array<(item: T) => boolean>): (item: T) => boolean {
  if (predicates.length === 0) return () => true;
  return (item: T) => predicates.every((p) => p(item));
}

/**
 * Builds an {@link EdgeForcer} from a per-edge-kind override map.
 *
 * @remarks
 * Edge kinds not present in the mapping receive {@link DEFAULT_EDGE_FORCES}.
 * This is the standard way to customize per-edge-type physics without
 * repeating the default-merge boilerplate.
 *
 * @param mapping - Partial force overrides keyed by {@link EdgeKind}; each
 *   entry supplies distance and/or strength overrides over the defaults.
 * @returns An {@link EdgeForcer} that resolves forces for any analysis edge.
 * @see {@link DEFAULT_EDGE_FORCES}
 * @see commit 89c3772
 */
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

/**
 * A function that maps a raw count (e.g., reference count) to a normalized
 * scale factor used for sizing.
 *
 * @param count - The raw count to scale.
 * @returns A non-negative number; higher values produce larger visual units.
 */
export type ScaleFn = (count: number) => number;

const DEFAULT_SCALE_FN: ScaleFn = (count: number) => Math.log2(count + 1);

/**
 * Maps a raw count into a clamped range using a configurable scale function.
 *
 * @remarks
 * The default scale function is `log2(count + 1)`, normalized against the
 * value at `count=50` and clamped to [0,1]. This prevents a few highly-referenced
 * nodes from dominating the visual scale.
 *
 * @param count - The raw count (e.g., outbound reference count or inbound call count).
 * @param min - Minimum output value; returned when `count <= 0`.
 * @param max - Maximum output value; returned when `count >= 50` (at default scaling).
 * @param scaleFn - Optional custom normalization function; defaults to log2.
 * @returns A value in the range `[min, max]`.
 * @see commit f0119a9
 */
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

/**
 * Counts how many edges of kind {@link EdgeKind.CALLS} originate from a given node.
 *
 * @remarks
 * Used by the Modules view config to size nodes by their callee count.
 *
 * @param node - The source node whose symbol is matched against edge `fromSymbol`.
 * @param edges - All edges in the analysis; filtered in place (linear scan).
 * @returns The number of CALLS edges whose `fromSymbol` matches `node.scipSymbol`.
 * @see {@link createModulesViewConfig}
 * @see commit 2458d6b
 */
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

/**
 * Returns the number of cross-file references to a given node.
 *
 * @remarks
 * This is simply a convenience accessor over `node.referencedAt.length`
 * that makes the statistic explicit in config contexts. Used by the
 * Modules view to set collide radius.
 *
 * @param node - The node whose `referencedAt` array is counted.
 * @returns The length of `referencedAt`, which is the count of incoming cross-file references.
 * @see commit 2458d6b
 */
export function countInboundCalls(node: AnalysisNode): number {
  return node.referencedAt.length;
}

// ── Modules View ──

const MODULES_NODE_TYPES = new Set<SyntaxType>([
  SyntaxType.FUNCTION,
  SyntaxType.METHOD,
]);

/**
 * Builds a lookup map from SCIP symbol to {@link SyntaxType} for a set of nodes.
 *
 * @remarks
 * Used by view config builders that need to classify a symbol's kind (e.g.,
 * whether it is a processing or data type) without a linear scan each time.
 *
 * @param nodes - The analysis nodes to index; each node's `scipSymbol` must be unique.
 * @returns A `Map` from symbol string to {@link SyntaxType}.
 * @see commit 7136fdc
 */
export function buildSymbolKindMap(nodes: AnalysisNode[]): Map<string, SyntaxType> {
  return new Map(nodes.map((node) => [node.scipSymbol, node.syntaxType]));
}

/**
 * Counts how many processing-type nodes reference each data-type node via
 * {@link EdgeKind.USES_TYPE} edges.
 *
 * @remarks
 * Used by the Data Flow view to size data-type nodes (interfaces and type
 * aliases) proportionally to how many callers depend on them. An edge is
 * counted only when its source is a processing type (function, method, class)
 * and its target is a data type (interface, type alias).
 *
 * @param edges - All analysis edges; filtered in place (linear scan).
 * @param nodes - All analysis nodes, used to build the symbol-to-kind index.
 * @returns A map from SCIP symbol to usage count.
 * @see {@link createDataFlowViewConfig}
 * @see commit 7136fdc
 */
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

/**
 * Builds a {@link RepoGraphConfig} tailored for the "Modules" view.
 *
 * @remarks
 * Shows only function and method nodes connected by CALLS edges (excluding
 * external calls). Nodes are sized by their outbound call count, and the
 * collision radius reflects inbound reference count. This is the graph
 * effectively produced by the INTERNAL_PROCESSING_CONFIG filtering logic
 * but with a simplified edge filter (CALLS only) and node radius driven
 * by outbound calls rather than inbound references.
 *
 * @param edges - All analysis edges; used to precompute per-symbol outbound call counts.
 * @returns A complete {@link RepoGraphConfig} with filters, stylers, and forces.
 * @see {@link DEFAULT_REPO_GRAPH_CONFIG}
 * @see commit 956369f
 */
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

const DATA_FLOW_NODE_TYPES = new Set<SyntaxType>([
  ...DATA_FLOW_PROCESSING_TYPES,
  ...DATA_FLOW_DATA_TYPES,
]);

// Target radii (simulation units, from canvas center) for the three manually-assigned
// Area names a node can be tagged with in the Data Flow view: `storage` (DB/persistence-adjacent
// types) pulled toward the center, `ux` (UI-facing types) pulled toward the outer ring, `api`
// (shared contracts) in between. Untagged nodes are unaffected — see RepoGraph.tsx's `layerRadial`
// force, which only applies nonzero strength to nodes whose area membership resolves to one of
// these keys.
export const DATA_FLOW_LAYER_RADII: Record<string, number> = {
  storage: 100,
  api: 260,
  ux: 420,
};

/**
 * Builds a {@link RepoGraphConfig} tailored for the "Data Flow" view.
 *
 * @remarks
 * Shows both processing nodes (functions, methods, classes) and data nodes
 * (interfaces, type aliases) connected by any non-IMPORTS edge. Data-type
 * nodes are sized by their usage count from processing-type callers and
 * rendered with labels. The config assigns radial layer strengths for
 * area-tagged nodes (storage, api, ux) via the `layerRadii` force option.
 *
 * @param edges - All analysis edges; used to compute per-target usage counts.
 * @param nodes - All analysis nodes; used to build the symbol-to-kind index.
 * @returns A complete {@link RepoGraphConfig} with filters, stylers, and forces.
 * @see {@link DEFAULT_REPO_GRAPH_CONFIG}
 * @see commit 7136fdc
 */
export function createDataFlowViewConfig(
  edges: AnalysisEdge[],
  nodes: AnalysisNode[],
): RepoGraphConfig {
  const kindOf = buildSymbolKindMap(nodes);
  const usageByTarget = countDataNodeUsage(edges, nodes);

  return mergeConfigs(DEFAULT_REPO_GRAPH_CONFIG, {
    filters: {
      node: (node: AnalysisNode) => DATA_FLOW_NODE_TYPES.has(node.syntaxType),
      edge: (edge: AnalysisEdge) =>
        edge.kind !== EdgeKind.IMPORTS &&
        !edge.isExternal &&
        DATA_FLOW_NODE_TYPES.has(kindOf.get(edge.fromSymbol) as SyntaxType) &&
        DATA_FLOW_NODE_TYPES.has(kindOf.get(edge.toSymbol) as SyntaxType),
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
      layerRadii: DATA_FLOW_LAYER_RADII,
    },
  });
}

/**
 * Merges one or more partial config overrides into a base
 * {@link RepoGraphConfig}, replacing top-level fields shallowly and
 * force/simulation fields deeply.
 *
 * @remarks
 * Each override object is applied in order, so later overrides win for
 * colliding keys. Leaf force values (pins, distances, etc.) are preserved
 * unless the override explicitly supplies a replacement. This is the
 * standard mechanism for view-specific configs to inherit defaults
 * without repeating them.
 *
 * @param base - The base config; fields not mentioned in any override stay unchanged.
 * @param overrides - Partial configs applied in order; each may supply any subset of
 *   filters, style, forces, or simulation fields.
 * @returns A new {@link RepoGraphConfig} with the merged values.
 * @see commit a570b03
 */
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
        areaPin: override.forces.areaPin ?? result.forces.areaPin,
        crossAreaPull: override.forces.crossAreaPull ?? result.forces.crossAreaPull,
        areaHullCollision: override.forces.areaHullCollision ?? result.forces.areaHullCollision,
        layerRadii: override.forces.layerRadii ?? result.forces.layerRadii,
      };
    }
    if (override.simulation) {
      result.simulation = { ...result.simulation, ...override.simulation };
    }
  }

  return result;
}
