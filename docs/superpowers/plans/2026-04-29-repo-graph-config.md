# RepoGraph Customization Config — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a layered resolver config API to RepoGraph so filtering, styling, and forces can each be controlled independently via accessor functions.

**Architecture:** A new `lib/analysis/graph-config.ts` module defines the `RepoGraphConfig` interface (filters, style, forces, simulation params), typed defaults, and builder helpers (`createNodeStyler`, `createEdgeForcer`, `combineFilters`, `mergeConfigs`). `RepoGraph.tsx` accepts an optional `config` prop and delegates all visual/force decisions to it. Default config replicates current hardcoded behavior — no visual change.

**Tech Stack:** TypeScript, D3.js, React (Next.js), Jest

**Spec:** `docs/superpowers/specs/2026-04-29-repo-graph-config-design.md`

---

### Task 1: Core Config Types and Defaults

**Files:**
- Create: `lib/analysis/graph-config.ts`
- Create: `__tests__/unit/graph-config.test.ts`

- [ ] **Step 1: Write failing tests for defaults**

Create `__tests__/unit/graph-config.test.ts`:

```ts
import {
  DEFAULT_NODE_STYLE,
  DEFAULT_EDGE_STYLE,
  DEFAULT_NODE_FORCES,
  DEFAULT_EDGE_FORCES,
  DEFAULT_SIMULATION,
} from '@/lib/analysis/graph-config';

describe('graph-config defaults', () => {
  describe('DEFAULT_NODE_STYLE', () => {
    it('has a hex color string', () => {
      expect(DEFAULT_NODE_STYLE.color).toMatch(/^#[0-9a-fA-F]{6}$/);
    });

    it('has a positive radius', () => {
      expect(DEFAULT_NODE_STYLE.radius).toBeGreaterThan(0);
    });

    it('has opacity between 0 and 1', () => {
      expect(DEFAULT_NODE_STYLE.opacity).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_NODE_STYLE.opacity).toBeLessThanOrEqual(1);
    });

    it('has label disabled by default', () => {
      expect(DEFAULT_NODE_STYLE.label).toBe(false);
    });
  });

  describe('DEFAULT_EDGE_STYLE', () => {
    it('has a hex color string', () => {
      expect(DEFAULT_EDGE_STYLE.color).toMatch(/^#[0-9a-fA-F]{6}$/);
    });

    it('has a positive width', () => {
      expect(DEFAULT_EDGE_STYLE.width).toBeGreaterThan(0);
    });

    it('has opacity between 0 and 1', () => {
      expect(DEFAULT_EDGE_STYLE.opacity).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_EDGE_STYLE.opacity).toBeLessThanOrEqual(1);
    });
  });

  describe('DEFAULT_NODE_FORCES', () => {
    it('has negative charge (repulsive)', () => {
      expect(DEFAULT_NODE_FORCES.charge).toBeLessThan(0);
    });

    it('has positive collide radius', () => {
      expect(DEFAULT_NODE_FORCES.collideRadius).toBeGreaterThan(0);
    });

    it('has null fixed positions (free movement)', () => {
      expect(DEFAULT_NODE_FORCES.fx).toBeNull();
      expect(DEFAULT_NODE_FORCES.fy).toBeNull();
    });
  });

  describe('DEFAULT_EDGE_FORCES', () => {
    it('has positive distance', () => {
      expect(DEFAULT_EDGE_FORCES.distance).toBeGreaterThan(0);
    });

    it('has strength between 0 and 1', () => {
      expect(DEFAULT_EDGE_FORCES.strength).toBeGreaterThan(0);
      expect(DEFAULT_EDGE_FORCES.strength).toBeLessThanOrEqual(1);
    });
  });

  describe('DEFAULT_SIMULATION', () => {
    it('has positive centerStrength', () => {
      expect(DEFAULT_SIMULATION.centerStrength).toBeGreaterThan(0);
    });

    it('has positive collisionPadding', () => {
      expect(DEFAULT_SIMULATION.collisionPadding).toBeGreaterThan(0);
    });

    it('has positive alphaDecay', () => {
      expect(DEFAULT_SIMULATION.alphaDecay).toBeGreaterThan(0);
    });

    it('has positive velocityDecay', () => {
      expect(DEFAULT_SIMULATION.velocityDecay).toBeGreaterThan(0);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/unit/graph-config.test.ts --no-cache`
Expected: FAIL — module `@/lib/analysis/graph-config` cannot be found.

- [ ] **Step 3: Implement types and defaults**

Create `lib/analysis/graph-config.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/unit/graph-config.test.ts --no-cache`
Expected: All 14 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/analysis/graph-config.ts __tests__/unit/graph-config.test.ts
git commit -m "feat(graph-config): add core types and defaults for RepoGraph config (#22)"
```

---

### Task 2: DEFAULT_REPO_GRAPH_CONFIG

**Files:**
- Modify: `lib/analysis/graph-config.ts`
- Modify: `__tests__/unit/graph-config.test.ts`

- [ ] **Step 1: Write failing tests for DEFAULT_REPO_GRAPH_CONFIG**

Append to `__tests__/unit/graph-config.test.ts`:

```ts
import {
  DEFAULT_REPO_GRAPH_CONFIG,
  DEFAULT_NODE_STYLE,
  DEFAULT_EDGE_STYLE,
  DEFAULT_NODE_FORCES,
  DEFAULT_EDGE_FORCES,
  DEFAULT_SIMULATION,
} from '@/lib/analysis/graph-config';
import { SyntaxType, EdgeKind } from '@/lib/analysis/types';
import type { AnalysisNode, AnalysisEdge } from '@/lib/analysis/types';

const makeNode = (overrides?: Partial<AnalysisNode>): AnalysisNode => ({
  syntaxType: SyntaxType.FUNCTION,
  name: 'testFn',
  filePath: '/src/test.ts',
  startLine: 1,
  startCol: 0,
  isAsync: false,
  isExported: true,
  params: [],
  returnTypeText: null,
  scipSymbol: 'test#testFn.',
  isDefinition: true,
  inTestFile: false,
  referencedAt: [],
  outboundRefs: [],
  ...overrides,
});

const makeEdge = (overrides?: Partial<AnalysisEdge>): AnalysisEdge => ({
  kind: EdgeKind.CALLS,
  fromFile: '/src/a.ts',
  fromName: 'foo',
  fromSymbol: 'test#foo.',
  toText: 'bar',
  toFile: '/src/b.ts',
  toName: 'bar',
  toSymbol: 'test#bar.',
  isExternal: false,
  edgePosition: { line: 1, col: 0 },
  isOptionalChain: false,
  isAsync: false,
  ...overrides,
});

describe('DEFAULT_REPO_GRAPH_CONFIG', () => {
  it('passes all nodes through the node filter', () => {
    const node = makeNode();
    expect(DEFAULT_REPO_GRAPH_CONFIG.filters.node(node)).toBe(true);
  });

  it('passes all edges through the edge filter', () => {
    const edge = makeEdge();
    expect(DEFAULT_REPO_GRAPH_CONFIG.filters.edge(edge)).toBe(true);
  });

  it('returns default node style for an unknown syntax type', () => {
    const node = makeNode({ syntaxType: 'UNKNOWN' as SyntaxType });
    const style = DEFAULT_REPO_GRAPH_CONFIG.style.node(node, 0);
    expect(style).toEqual(DEFAULT_NODE_STYLE);
  });

  it('returns a color for FUNCTION nodes', () => {
    const node = makeNode({ syntaxType: SyntaxType.FUNCTION });
    const style = DEFAULT_REPO_GRAPH_CONFIG.style.node(node, 0);
    expect(style.color).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it('returns a color for CLASS nodes', () => {
    const node = makeNode({ syntaxType: SyntaxType.CLASS });
    const style = DEFAULT_REPO_GRAPH_CONFIG.style.node(node, 0);
    expect(style.color).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it('returns a color for INTERFACE nodes', () => {
    const node = makeNode({ syntaxType: SyntaxType.INTERFACE });
    const style = DEFAULT_REPO_GRAPH_CONFIG.style.node(node, 0);
    expect(style.color).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it('returns default edge style', () => {
    const edge = makeEdge();
    const style = DEFAULT_REPO_GRAPH_CONFIG.style.edge(edge);
    expect(style).toEqual(DEFAULT_EDGE_STYLE);
  });

  it('returns default node forces', () => {
    const node = makeNode();
    const forces = DEFAULT_REPO_GRAPH_CONFIG.forces.node(node);
    expect(forces).toEqual(DEFAULT_NODE_FORCES);
  });

  it('returns default edge forces', () => {
    const edge = makeEdge();
    const forces = DEFAULT_REPO_GRAPH_CONFIG.forces.edge(edge);
    expect(forces).toEqual(DEFAULT_EDGE_FORCES);
  });

  it('has default simulation params', () => {
    expect(DEFAULT_REPO_GRAPH_CONFIG.simulation).toEqual(DEFAULT_SIMULATION);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/unit/graph-config.test.ts --no-cache`
Expected: FAIL — `DEFAULT_REPO_GRAPH_CONFIG` is not exported.

- [ ] **Step 3: Implement DEFAULT_REPO_GRAPH_CONFIG**

Append to `lib/analysis/graph-config.ts`:

```ts
const SYNTAX_TYPE_COLORS: Partial<Record<SyntaxType, string>> = {
  [SyntaxType.FUNCTION]: '#3b82f6',
  [SyntaxType.METHOD]: '#60a5fa',
  [SyntaxType.CLASS]: '#8b5cf6',
  [SyntaxType.INTERFACE]: '#10b981',
  [SyntaxType.TYPE_ALIAS]: '#f59e0b',
  [SyntaxType.MODULE]: '#ec4899',
};

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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/unit/graph-config.test.ts --no-cache`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/analysis/graph-config.ts __tests__/unit/graph-config.test.ts
git commit -m "feat(graph-config): add DEFAULT_REPO_GRAPH_CONFIG with SyntaxType color map (#22)"
```

---

### Task 3: Builder Helper — `combineFilters`

**Files:**
- Modify: `lib/analysis/graph-config.ts`
- Modify: `__tests__/unit/graph-config.test.ts`

- [ ] **Step 1: Write failing tests for `combineFilters`**

Append to `__tests__/unit/graph-config.test.ts`:

```ts
import { combineFilters } from '@/lib/analysis/graph-config';

describe('combineFilters', () => {
  it('returns a predicate that ANDs all predicates together', () => {
    const isExported = (n: AnalysisNode) => n.isExported;
    const isNotTest = (n: AnalysisNode) => !n.inTestFile;
    const combined = combineFilters(isExported, isNotTest);

    expect(combined(makeNode({ isExported: true, inTestFile: false }))).toBe(true);
    expect(combined(makeNode({ isExported: false, inTestFile: false }))).toBe(false);
    expect(combined(makeNode({ isExported: true, inTestFile: true }))).toBe(false);
  });

  it('returns true for all inputs when no predicates are provided', () => {
    const combined = combineFilters<AnalysisNode>();
    expect(combined(makeNode())).toBe(true);
  });

  it('works with edge predicates', () => {
    const isNotExternal = (e: AnalysisEdge) => !e.isExternal;
    const isCalls = (e: AnalysisEdge) => e.kind === EdgeKind.CALLS;
    const combined = combineFilters(isNotExternal, isCalls);

    expect(combined(makeEdge({ isExternal: false, kind: EdgeKind.CALLS }))).toBe(true);
    expect(combined(makeEdge({ isExternal: true, kind: EdgeKind.CALLS }))).toBe(false);
    expect(combined(makeEdge({ isExternal: false, kind: EdgeKind.IMPORTS }))).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/unit/graph-config.test.ts --no-cache`
Expected: FAIL — `combineFilters` is not exported.

- [ ] **Step 3: Implement `combineFilters`**

Add to `lib/analysis/graph-config.ts`:

```ts
export function combineFilters<T>(...predicates: Array<(item: T) => boolean>): (item: T) => boolean {
  if (predicates.length === 0) return () => true;
  return (item: T) => predicates.every((p) => p(item));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/unit/graph-config.test.ts --no-cache`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/analysis/graph-config.ts __tests__/unit/graph-config.test.ts
git commit -m "feat(graph-config): add combineFilters helper (#22)"
```

---

### Task 4: Builder Helper — `createNodeStyler`

**Files:**
- Modify: `lib/analysis/graph-config.ts`
- Modify: `__tests__/unit/graph-config.test.ts`

- [ ] **Step 1: Write failing tests for `createNodeStyler`**

Append to `__tests__/unit/graph-config.test.ts`:

```ts
import { createNodeStyler } from '@/lib/analysis/graph-config';

describe('createNodeStyler', () => {
  it('returns overridden style for mapped SyntaxType', () => {
    const styler = createNodeStyler({
      [SyntaxType.CLASS]: { color: '#ef4444', radius: 14 },
    });
    const style = styler(makeNode({ syntaxType: SyntaxType.CLASS }), 5);
    expect(style.color).toBe('#ef4444');
    expect(style.radius).toBe(14);
    expect(style.opacity).toBe(DEFAULT_NODE_STYLE.opacity);
    expect(style.label).toBe(DEFAULT_NODE_STYLE.label);
  });

  it('returns default style for unmapped SyntaxType', () => {
    const styler = createNodeStyler({
      [SyntaxType.CLASS]: { color: '#ef4444' },
    });
    const style = styler(makeNode({ syntaxType: SyntaxType.FUNCTION }), 5);
    expect(style).toEqual(DEFAULT_NODE_STYLE);
  });

  it('uses sizeFn to override radius for all nodes', () => {
    const styler = createNodeStyler(
      { [SyntaxType.FUNCTION]: { color: '#3b82f6' } },
      (degree) => degree * 2 + 4,
    );
    const style = styler(makeNode({ syntaxType: SyntaxType.FUNCTION }), 10);
    expect(style.radius).toBe(24);
    expect(style.color).toBe('#3b82f6');
  });

  it('applies sizeFn even for unmapped types', () => {
    const styler = createNodeStyler(
      {},
      (degree) => degree + 1,
    );
    const style = styler(makeNode({ syntaxType: SyntaxType.MODULE }), 5);
    expect(style.radius).toBe(6);
    expect(style.color).toBe(DEFAULT_NODE_STYLE.color);
  });

  it('handles empty mapping', () => {
    const styler = createNodeStyler({});
    const style = styler(makeNode(), 0);
    expect(style).toEqual(DEFAULT_NODE_STYLE);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/unit/graph-config.test.ts --no-cache`
Expected: FAIL — `createNodeStyler` is not exported.

- [ ] **Step 3: Implement `createNodeStyler`**

Add to `lib/analysis/graph-config.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/unit/graph-config.test.ts --no-cache`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/analysis/graph-config.ts __tests__/unit/graph-config.test.ts
git commit -m "feat(graph-config): add createNodeStyler builder (#22)"
```

---

### Task 5: Builder Helper — `createEdgeForcer`

**Files:**
- Modify: `lib/analysis/graph-config.ts`
- Modify: `__tests__/unit/graph-config.test.ts`

- [ ] **Step 1: Write failing tests for `createEdgeForcer`**

Append to `__tests__/unit/graph-config.test.ts`:

```ts
import { createEdgeForcer } from '@/lib/analysis/graph-config';

describe('createEdgeForcer', () => {
  it('returns overridden forces for mapped EdgeKind', () => {
    const forcer = createEdgeForcer({
      [EdgeKind.CALLS]: { distance: 30, strength: 0.8 },
    });
    const forces = forcer(makeEdge({ kind: EdgeKind.CALLS }));
    expect(forces.distance).toBe(30);
    expect(forces.strength).toBe(0.8);
  });

  it('returns default forces for unmapped EdgeKind', () => {
    const forcer = createEdgeForcer({
      [EdgeKind.CALLS]: { distance: 30 },
    });
    const forces = forcer(makeEdge({ kind: EdgeKind.IMPORTS }));
    expect(forces).toEqual(DEFAULT_EDGE_FORCES);
  });

  it('partially overrides — fills remaining from defaults', () => {
    const forcer = createEdgeForcer({
      [EdgeKind.USES_TYPE]: { distance: 120 },
    });
    const forces = forcer(makeEdge({ kind: EdgeKind.USES_TYPE }));
    expect(forces.distance).toBe(120);
    expect(forces.strength).toBe(DEFAULT_EDGE_FORCES.strength);
  });

  it('handles empty mapping', () => {
    const forcer = createEdgeForcer({});
    const forces = forcer(makeEdge());
    expect(forces).toEqual(DEFAULT_EDGE_FORCES);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/unit/graph-config.test.ts --no-cache`
Expected: FAIL — `createEdgeForcer` is not exported.

- [ ] **Step 3: Implement `createEdgeForcer`**

Add to `lib/analysis/graph-config.ts`:

```ts
export function createEdgeForcer(
  mapping: Partial<Record<EdgeKind, Partial<EdgeForces>>>,
): EdgeForcer {
  return (edge: AnalysisEdge): EdgeForces => {
    const overrides = mapping[edge.kind];
    if (!overrides) return { ...DEFAULT_EDGE_FORCES };
    return { ...DEFAULT_EDGE_FORCES, ...overrides };
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/unit/graph-config.test.ts --no-cache`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/analysis/graph-config.ts __tests__/unit/graph-config.test.ts
git commit -m "feat(graph-config): add createEdgeForcer builder (#22)"
```

---

### Task 6: Builder Helper — `mergeConfigs`

**Files:**
- Modify: `lib/analysis/graph-config.ts`
- Modify: `__tests__/unit/graph-config.test.ts`

- [ ] **Step 1: Write failing tests for `mergeConfigs`**

Append to `__tests__/unit/graph-config.test.ts`:

```ts
import { mergeConfigs } from '@/lib/analysis/graph-config';

describe('mergeConfigs', () => {
  it('returns base config when no overrides are provided', () => {
    const result = mergeConfigs(DEFAULT_REPO_GRAPH_CONFIG);
    expect(result.simulation).toEqual(DEFAULT_SIMULATION);
    expect(result.filters.node(makeNode())).toBe(true);
  });

  it('overrides simulation params', () => {
    const result = mergeConfigs(DEFAULT_REPO_GRAPH_CONFIG, {
      simulation: { centerStrength: 0.5 },
    });
    expect(result.simulation.centerStrength).toBe(0.5);
    expect(result.simulation.collisionPadding).toBe(DEFAULT_SIMULATION.collisionPadding);
    expect(result.simulation.alphaDecay).toBe(DEFAULT_SIMULATION.alphaDecay);
    expect(result.simulation.velocityDecay).toBe(DEFAULT_SIMULATION.velocityDecay);
  });

  it('replaces accessor functions entirely', () => {
    const customFilter = (n: AnalysisNode) => n.isExported;
    const result = mergeConfigs(DEFAULT_REPO_GRAPH_CONFIG, {
      filters: { node: customFilter },
    });
    expect(result.filters.node).toBe(customFilter);
    // Edge filter should remain the default
    expect(result.filters.edge(makeEdge())).toBe(true);
  });

  it('applies multiple overrides in order (last wins)', () => {
    const result = mergeConfigs(
      DEFAULT_REPO_GRAPH_CONFIG,
      { simulation: { centerStrength: 0.3 } },
      { simulation: { centerStrength: 0.9 } },
    );
    expect(result.simulation.centerStrength).toBe(0.9);
  });

  it('does not mutate the base config', () => {
    const originalCenter = DEFAULT_REPO_GRAPH_CONFIG.simulation.centerStrength;
    mergeConfigs(DEFAULT_REPO_GRAPH_CONFIG, {
      simulation: { centerStrength: 99 },
    });
    expect(DEFAULT_REPO_GRAPH_CONFIG.simulation.centerStrength).toBe(originalCenter);
  });

  it('merges style layer with node override only', () => {
    const customNodeStyler: NodeStyler = (_node, _degree) => ({
      color: '#ff0000', radius: 20, opacity: 0.5, label: true,
    });
    const result = mergeConfigs(DEFAULT_REPO_GRAPH_CONFIG, {
      style: { node: customNodeStyler },
    });
    expect(result.style.node).toBe(customNodeStyler);
    // Edge styler remains default
    const edgeStyle = result.style.edge(makeEdge());
    expect(edgeStyle).toEqual(DEFAULT_EDGE_STYLE);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/unit/graph-config.test.ts --no-cache`
Expected: FAIL — `mergeConfigs` is not exported.

- [ ] **Step 3: Implement `mergeConfigs`**

Add to `lib/analysis/graph-config.ts`:

```ts
type DeepPartial<T> = {
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
  let result: RepoGraphConfig = {
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/unit/graph-config.test.ts --no-cache`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/analysis/graph-config.ts __tests__/unit/graph-config.test.ts
git commit -m "feat(graph-config): add mergeConfigs helper (#22)"
```

---

### Task 7: Integrate Config into RepoGraph Component

**Files:**
- Modify: `app/components/repo-graph/RepoGraph.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Update RepoGraph to accept and use config prop**

In `app/components/repo-graph/RepoGraph.tsx`, make these changes:

1. Add import at top:
```ts
import type { RepoGraphConfig } from '@/lib/analysis/graph-config';
import { DEFAULT_REPO_GRAPH_CONFIG } from '@/lib/analysis/graph-config';
```

2. Update `RepoGraphProps` interface:
```ts
interface RepoGraphProps {
  repoPath: string;
  hideTestFiles: boolean;
  config?: RepoGraphConfig;
  onSearchNode?: (handler: (query: string) => boolean) => void;
}
```

3. Update component signature to destructure `config`:
```ts
export default function RepoGraph({ repoPath, hideTestFiles, config, onSearchNode }: RepoGraphProps) {
```

4. Add config ref after existing refs (line ~40):
```ts
const configRef = useRef<RepoGraphConfig>(config ?? DEFAULT_REPO_GRAPH_CONFIG);
```

5. Add a useEffect to keep configRef in sync:
```ts
useEffect(() => {
  configRef.current = config ?? DEFAULT_REPO_GRAPH_CONFIG;
}, [config]);
```

6. Update the `SimpleNode` interface to carry the original `AnalysisNode` data and a computed degree:
```ts
interface SimpleNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  data: AnalysisNode;
  degree: number;
}
```

Add import for `AnalysisNode`:
```ts
import type { AnalysisResult, AnalysisNode, AnalysisEdge } from '@/lib/analysis/types';
```

7. Update the `SimpleEdge` interface to carry `AnalysisEdge` data:
```ts
interface SimpleEdge extends d3.SimulationLinkDatum<SimpleNode> {
  source: string;
  target: string;
  data: AnalysisEdge;
}
```

8. Update the adapter `useMemo` for `simNodes` to apply the node filter and carry data:
```ts
const simNodes: SimpleNode[] = useMemo(() => {
  if (!analysisData) return [];
  const cfg = configRef.current;
  return analysisData.nodes
    .filter(cfg.filters.node)
    .map((n) => ({
      id: n.scipSymbol,
      name: n.name,
      data: n,
      degree: 0,
    }));
}, [analysisData, config]);
```

9. Update the adapter `useMemo` for `simEdges` to apply edge filter and carry data:
```ts
const simEdges: SimpleEdge[] = useMemo(() => {
  if (!analysisData) return [];
  const cfg = configRef.current;
  const nodeIds = new Set(simNodes.map((n) => n.id));
  return analysisData.edges
    .filter((e) =>
      cfg.filters.edge(e) &&
      nodeIds.has(e.fromSymbol) && nodeIds.has(e.toSymbol)
    )
    .map((e) => ({
      source: e.fromSymbol,
      target: e.toSymbol,
      data: e,
    }));
}, [analysisData, simNodes, config]);
```

10. Add a degree computation after `simEdges`, and before the simulation `useEffect`:
```ts
useEffect(() => {
  const degreeCounts = new Map<string, number>();
  for (const e of simEdges) {
    degreeCounts.set(e.source as string, (degreeCounts.get(e.source as string) ?? 0) + 1);
    degreeCounts.set(e.target as string, (degreeCounts.get(e.target as string) ?? 0) + 1);
  }
  for (const n of simNodes) {
    n.degree = degreeCounts.get(n.id) ?? 0;
  }
}, [simNodes, simEdges]);
```

11. Remove the hardcoded constants at the top of the file:
```ts
// DELETE these lines:
// const NODE_RADIUS = 6;
// const NODE_COLOR = '#999999';
// const EDGE_COLOR = '#999999';
// const EDGE_WIDTH = 1;
// const EDGE_OPACITY = 0.6;
```
Keep `HIGHLIGHT_COLOR` — that's for search highlighting, not config-controlled.

12. Update the `drawFrame` function inside the simulation `useEffect` to use config:
```ts
function drawFrame() {
  const c = ctxRef.current;
  const cv = canvasRef.current;
  if (!c || !cv) return;
  const t = zoomTransformRef.current;
  const cfg = configRef.current;

  c.clearRect(0, 0, cv.width, cv.height);
  c.save();
  c.setTransform(t.k, 0, 0, t.k, t.x, t.y);

  // Draw edges
  for (const e of simEdges) {
    const src = e.source as unknown as SimpleNode;
    const tgt = e.target as unknown as SimpleNode;
    if (src.x == null || src.y == null || tgt.x == null || tgt.y == null) continue;
    const eStyle = cfg.style.edge(e.data);
    c.beginPath();
    c.moveTo(src.x, src.y);
    c.lineTo(tgt.x, tgt.y);
    c.strokeStyle = eStyle.color;
    c.lineWidth = eStyle.width;
    c.globalAlpha = eStyle.opacity;
    c.stroke();
    c.globalAlpha = 1.0;
  }

  // Draw nodes
  for (const n of simNodes) {
    if (n.x == null || n.y == null) continue;
    const nStyle = cfg.style.node(n.data, n.degree);
    c.beginPath();
    c.arc(n.x, n.y, nStyle.radius, 0, 2 * Math.PI);
    c.fillStyle = nStyle.color;
    c.globalAlpha = nStyle.opacity;
    c.fill();
    c.globalAlpha = 1.0;
    c.strokeStyle = '#fff';
    c.lineWidth = 1;
    c.stroke();
    if (nStyle.label) {
      c.fillStyle = '#374151';
      c.font = '10px sans-serif';
      c.textAlign = 'center';
      c.fillText(n.name, n.x, n.y + nStyle.radius + 10);
    }
    if (highlightedNodeIdRef.current === n.id) {
      c.beginPath();
      c.arc(n.x, n.y, nStyle.radius + 2, 0, 2 * Math.PI);
      c.strokeStyle = HIGHLIGHT_COLOR;
      c.lineWidth = 4;
      c.stroke();
    }
  }

  c.restore();
}
```

13. Update the D3 simulation setup to use config for forces:
```ts
const cfg = configRef.current;

const simulation = d3
  .forceSimulation<SimpleNode>(simNodes)
  .force(
    'link',
    d3
      .forceLink<SimpleNode, SimpleEdge>(simEdges)
      .id((d) => d.id)
      .distance((d: any) => cfg.forces.edge(d.data).distance)
      .strength((d: any) => cfg.forces.edge(d.data).strength)
  )
  .force('charge', d3.forceManyBody<SimpleNode>()
    .strength((d: any) => cfg.forces.node(d.data).charge))
  .force('center', d3.forceCenter(width / 2, height / 2)
    .strength(cfg.simulation.centerStrength))
  .force('collide', d3.forceCollide<SimpleNode>()
    .radius((d: any) => {
      const nStyle = cfg.style.node(d.data, d.degree);
      return nStyle.radius + cfg.simulation.collisionPadding;
    }));

simulation.alphaDecay(cfg.simulation.alphaDecay);
simulation.velocityDecay(cfg.simulation.velocityDecay);
```

14. Update the `handleMouseMove` hit detection to use config-driven radius instead of `NODE_RADIUS`:
```ts
const cfg = configRef.current;
// ...inside the for loop:
const nStyle = cfg.style.node(n.data, n.degree);
if (Math.sqrt(dx * dx + dy * dy) <= nStyle.radius) {
```

- [ ] **Step 2: Update page.tsx (no changes needed)**

`app/page.tsx` does not need changes — `config` is optional and defaults to `DEFAULT_REPO_GRAPH_CONFIG`. The component will behave identically to before.

Verify no changes needed by inspecting that `<RepoGraph>` in `page.tsx` doesn't pass a `config` prop — the component's default handles it.

- [ ] **Step 3: Run the existing RepoGraph tests**

Run: `npx jest __tests__/components/RepoGraph.test.tsx --no-cache`

The tests should still pass because:
- The D3 mock stubs out force methods (they return `jest.fn()`)
- The component's default config replicates the old hardcoded behavior
- The D3 simulation mock assigns `x`/`y` to nodes

If tests fail due to the new `data` property on `SimpleNode`/`SimpleEdge`, update the D3 mock's `forceSimulation` to preserve the `data` property on nodes. The mock already spreads position into nodes, so `data` should persist.

- [ ] **Step 4: Run the full test suite to verify no regressions**

Run: `npx jest --no-cache`
Expected: All tests PASS. No existing behavior changed.

- [ ] **Step 5: Commit**

```bash
git add app/components/repo-graph/RepoGraph.tsx
git commit -m "feat(RepoGraph): integrate RepoGraphConfig for filtering, styling, and forces (#22)"
```

---

### Task 8: Final Verification

**Files:** None (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npx jest --no-cache`
Expected: All tests PASS.

- [ ] **Step 2: Run the linter**

Run: `npm run lint`
Expected: No errors.

- [ ] **Step 3: Run the build**

Run: `npm run build`
Expected: Build succeeds with no type errors.

- [ ] **Step 4: Verify exports are correct**

Run: `npx ts-node -e "import { RepoGraphConfig, DEFAULT_REPO_GRAPH_CONFIG, combineFilters, createNodeStyler, createEdgeForcer, mergeConfigs } from './lib/analysis/graph-config'; console.log('All exports OK');"`

Or verify via a quick TypeScript compilation check:
Run: `npx tsc --noEmit`
Expected: No errors.
