# RepoGraph Customization Config — Design Spec

**Issue:** [#22 — Customizing repo graph](https://github.com/dtanikella/git-explorer/issues/22)
**Date:** 2026-04-29
**Status:** Approved

## Problem

The RepoGraph component renders a force-directed graph of repository symbols (functions, classes, interfaces, etc.) using D3. All visual and force parameters are currently hardcoded — node colors, sizes, charge strength, link distances, and filtering logic are baked into the component.

This issue adds a programmatic configuration API that lets each visual/force property be controlled independently. The goal is to set up the right scaffolding so that issue #12 can compose named presets (e.g., "function flow view," "data structure usage view") on top of this API.

## Approach: Layered Resolver Pattern

Separate concerns into independent accessor functions grouped by layer (filtering, styling, forces), with composition helpers and typed defaults. This avoids the TsGraph rule system's weakness of bundling orthogonal concerns into single rules with first-match-wins semantics.

### Why Not Extend TsGraph's Rule System?

The `NodeForceRule`/`EdgeForceRule` pattern bundles filtering, forces, and style into one rule. When dimensions are orthogonal (e.g., "color by syntaxType AND size by degree AND filter by isExported"), this creates conflicts — the first matching rule swallows all properties, preventing other rules from contributing. The layered resolver avoids this by keeping each property axis independent.

## Core Config Types

All types live in `lib/analysis/graph-config.ts`.

### Resolved Value Types

These are the concrete values the graph component consumes:

```ts
interface NodeStyle {
  color: string;      // hex color
  radius: number;     // px
  opacity: number;    // 0-1
  label: boolean;     // whether to show text label
}

interface EdgeStyle {
  color: string;
  width: number;      // px
  opacity: number;
}

interface NodeForces {
  charge: number;           // repulsion (negative = repel)
  collideRadius: number;    // collision sphere padding
  fx: number | null;        // fixed x position (null = free)
  fy: number | null;        // fixed y position (null = free)
}

interface EdgeForces {
  distance: number;         // ideal link length
  strength: number;         // link tension 0-1
}

interface SimulationParams {
  centerStrength: number;   // gravity toward center
  collisionPadding: number; // extra collision buffer beyond node radius
  alphaDecay: number;       // simulation cooling rate
  velocityDecay: number;    // node friction
}
```

### Accessor Function Types

Each visual property is an independent function. This is the key pattern — properties don't interfere with each other.

```ts
type NodePredicate = (node: AnalysisNode) => boolean;
type EdgePredicate = (edge: AnalysisEdge) => boolean;
type NodeStyler   = (node: AnalysisNode, degree: number) => NodeStyle;
type EdgeStyler   = (edge: AnalysisEdge) => EdgeStyle;
type NodeForcer   = (node: AnalysisNode) => NodeForces;
type EdgeForcer   = (edge: AnalysisEdge) => EdgeForces;
```

`NodeStyler` receives `degree` (edge count) as a second argument because node sizing typically depends on connectivity, and requiring the styler to recompute degree would be wasteful.

### The Config Object

```ts
interface RepoGraphConfig {
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
```

## Defaults

Every property has a sensible default. The default config replicates the current hardcoded behavior of RepoGraph so there is no visual change when adopting the new API.

```ts
const DEFAULT_NODE_STYLE: NodeStyle = {
  color: '#6b7280', radius: 6, opacity: 1, label: false,
};

const DEFAULT_EDGE_STYLE: EdgeStyle = {
  color: '#9ca3af', width: 1, opacity: 0.6,
};

const DEFAULT_NODE_FORCES: NodeForces = {
  charge: -200, collideRadius: 10, fx: null, fy: null,
};

const DEFAULT_EDGE_FORCES: EdgeForces = {
  distance: 80, strength: 0.5,
};

const DEFAULT_SIMULATION: SimulationParams = {
  centerStrength: 0.1, collisionPadding: 3,
  alphaDecay: 0.0228, velocityDecay: 0.4,
};
```

`DEFAULT_REPO_GRAPH_CONFIG` is the fully assembled default config using these values. It passes all nodes/edges through, applies default styling (with a `SyntaxType → color` map matching current behavior), and uses the force defaults above.

## Builder Helpers

Helpers that make it easy to create accessor functions from simple data.

### `createNodeStyler`

Builds a `NodeStyler` from a `SyntaxType → Partial<NodeStyle>` map and an optional degree-based sizing function:

```ts
function createNodeStyler(
  mapping: Partial<Record<SyntaxType, Partial<NodeStyle>>>,
  sizeFn?: (degree: number) => number,
): NodeStyler;
```

Nodes matching a SyntaxType in the mapping get those style overrides; unmatched nodes get `DEFAULT_NODE_STYLE`. If `sizeFn` is provided, it overrides the `radius` for all nodes.

### `createEdgeForcer`

Builds an `EdgeForcer` from an `EdgeKind → Partial<EdgeForces>` map:

```ts
function createEdgeForcer(
  mapping: Partial<Record<EdgeKind, Partial<EdgeForces>>>,
): EdgeForcer;
```

### `combineFilters`

ANDs together multiple predicates. Generic over predicate type so it works for both nodes and edges:

```ts
function combineFilters<T>(...predicates: Array<(item: T) => boolean>): (item: T) => boolean;
```

### `mergeConfigs`

Deep-merges config objects. Later overrides win. For accessor functions (which can't be deep-merged), the override replaces the base entirely.

```ts
function mergeConfigs(
  base: RepoGraphConfig,
  ...overrides: DeepPartial<RepoGraphConfig>[]
): RepoGraphConfig;
```

### Usage Example

```ts
const myConfig = mergeConfigs(DEFAULT_REPO_GRAPH_CONFIG, {
  style: {
    node: createNodeStyler({
      [SyntaxType.CLASS]: { color: '#ef4444', radius: 14 },
      [SyntaxType.FUNCTION]: { color: '#3b82f6', radius: 8 },
    }),
  },
  forces: {
    edge: createEdgeForcer({
      [EdgeKind.CALLS]: { distance: 30, strength: 0.8 },
    }),
  },
  filters: {
    node: combineFilters(
      (n) => n.isExported,
      (n) => !n.inTestFile,
    ),
  },
});
```

## RepoGraph Integration

`RepoGraph.tsx` accepts an optional `config` prop (defaults to `DEFAULT_REPO_GRAPH_CONFIG`). The component uses config accessors at three points:

### 1. Filtering (before SimNode creation)

```ts
const visibleNodes = data.nodes.filter(config.filters.node);
const visibleNodeIds = new Set(visibleNodes.map(n => n.scipSymbol));
const visibleEdges = data.edges.filter(e =>
  config.filters.edge(e) &&
  visibleNodeIds.has(e.fromSymbol) && visibleNodeIds.has(e.toSymbol)
);
```

Edge filtering also ensures both endpoints are visible (prevents dangling edges).

### 2. Forces (D3 simulation setup)

```ts
simulation
  .force('charge', d3.forceManyBody()
    .strength(d => config.forces.node(d.data).charge))
  .force('link', d3.forceLink()
    .distance(d => config.forces.edge(d.data).distance)
    .strength(d => config.forces.edge(d.data).strength))
  .force('collide', d3.forceCollide()
    .radius(d => config.forces.node(d.data).collideRadius + config.simulation.collisionPadding))
  .force('x', d3.forceX(w/2).strength(config.simulation.centerStrength))
  .force('y', d3.forceY(h/2).strength(config.simulation.centerStrength));

simulation.alphaDecay(config.simulation.alphaDecay);
simulation.velocityDecay(config.simulation.velocityDecay);
```

### 3. Styling (canvas draw)

```ts
// Node rendering
const style = config.style.node(node.data, node.degree);
ctx.fillStyle = style.color;
ctx.globalAlpha = style.opacity;
ctx.arc(x, y, style.radius, 0, 2 * Math.PI);
if (style.label) { ctx.fillText(node.data.name, x, y + style.radius + 10); }

// Edge rendering
const eStyle = config.style.edge(edge.data);
ctx.strokeStyle = eStyle.color;
ctx.lineWidth = eStyle.width;
ctx.globalAlpha = eStyle.opacity;
```

### Config Change Handling

- Config stored in a `useRef` to avoid stale D3 closures
- When config prop changes, simulation restarts with new forces and canvas redraws
- This follows the same ref pattern TsGraph uses for its rule arrays

## Available Dimensions

All `AnalysisNode` and `AnalysisEdge` properties are available since accessor functions receive the full objects. Current properties:

**Node:** `syntaxType`, `name`, `filePath`, `isAsync`, `isExported`, `inTestFile`, `params`, `returnTypeText`, `scipSymbol`, `isDefinition`, `referencedAt`, `outboundRefs`

**Edge:** `kind`, `fromFile`, `toFile`, `fromName`, `toName`, `isExternal`, `isAsync`, `isOptionalChain`

New properties added to these types in the future automatically become available to config functions — no changes to the config system needed.

## File Changes

### New Files

| File | Purpose |
|------|---------|
| `lib/analysis/graph-config.ts` | Config types, defaults, builder helpers, `mergeConfigs` |
| `__tests__/unit/graph-config.test.ts` | Unit tests for all exports |

### Modified Files

| File | Changes |
|------|---------|
| `app/components/repo-graph/RepoGraph.tsx` | Accept `config?: RepoGraphConfig` prop; use accessors for filtering, forces, styling |
| `app/page.tsx` | Pass config to RepoGraph (default config for now) |

## Testing

Unit tests for `lib/analysis/graph-config.ts`:

- Default config produces expected values for each SyntaxType/EdgeKind
- `createNodeStyler` maps SyntaxType to style, falls back to defaults for unmapped types
- `createEdgeForcer` maps EdgeKind to forces, falls back to defaults
- `combineFilters` ANDs predicates correctly
- `mergeConfigs` handles: full override, partial override, multiple overrides, accessor function replacement
- Edge cases: empty mapping, all-false filter, unknown enum values

Existing tests remain unmodified — default config replicates current hardcoded behavior.

## Out of Scope

- **UI controls** — no sidebar, toolbar, or settings panel in this issue
- **Named presets** — deferred to #12
- **Config serialization/persistence** — not needed until UI exists
- **TsGraph changes** — this issue only affects RepoGraph
- **CirclePackingGraph** — not implemented yet, not affected
