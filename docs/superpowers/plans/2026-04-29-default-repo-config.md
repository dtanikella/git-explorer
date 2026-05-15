# Default Repo Graph Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create an `INTERNAL_PROCESSING_CONFIG` that shows how functions, methods, and classes interact — with node size driven by outbound refs, charge driven by inbound refs, and edge distance/strength tiered by EdgeKind.

**Architecture:** Single new config object in `lib/analysis/graph-config.ts` using existing helper functions (`combineFilters`, `createEdgeForcer`, `createNodeStyler`). Wired into `app/page.tsx` as the default `config` prop for `<RepoGraph>`.

**Tech Stack:** TypeScript, D3 force simulation (consumed via existing `RepoGraphConfig` interface)

---

### Task 1: Tests for INTERNAL_PROCESSING_CONFIG

**Files:**
- Modify: `__tests__/unit/graph-config.test.ts` (append new describe block)

- [ ] **Step 1: Write failing tests for node filter**

Add to the end of `__tests__/unit/graph-config.test.ts`:

```typescript
describe('INTERNAL_PROCESSING_CONFIG', () => {
  describe('node filter', () => {
    it('accepts FUNCTION nodes', () => {
      const node = makeNode({ syntaxType: SyntaxType.FUNCTION });
      expect(INTERNAL_PROCESSING_CONFIG.filters.node(node)).toBe(true);
    });

    it('accepts METHOD nodes', () => {
      const node = makeNode({ syntaxType: SyntaxType.METHOD });
      expect(INTERNAL_PROCESSING_CONFIG.filters.node(node)).toBe(true);
    });

    it('accepts CLASS nodes', () => {
      const node = makeNode({ syntaxType: SyntaxType.CLASS });
      expect(INTERNAL_PROCESSING_CONFIG.filters.node(node)).toBe(true);
    });

    it('rejects INTERFACE nodes', () => {
      const node = makeNode({ syntaxType: SyntaxType.INTERFACE });
      expect(INTERNAL_PROCESSING_CONFIG.filters.node(node)).toBe(false);
    });

    it('rejects TYPE_ALIAS nodes', () => {
      const node = makeNode({ syntaxType: SyntaxType.TYPE_ALIAS });
      expect(INTERNAL_PROCESSING_CONFIG.filters.node(node)).toBe(false);
    });

    it('rejects MODULE nodes', () => {
      const node = makeNode({ syntaxType: SyntaxType.MODULE });
      expect(INTERNAL_PROCESSING_CONFIG.filters.node(node)).toBe(false);
    });
  });

  describe('edge filter', () => {
    it('accepts non-external edges', () => {
      const edge = makeEdge({ isExternal: false });
      expect(INTERNAL_PROCESSING_CONFIG.filters.edge(edge)).toBe(true);
    });

    it('rejects external edges', () => {
      const edge = makeEdge({ isExternal: true });
      expect(INTERNAL_PROCESSING_CONFIG.filters.edge(edge)).toBe(false);
    });
  });

  describe('node style', () => {
    it('scales radius by outboundRefs count', () => {
      const nodeWith0 = makeNode({ outboundRefs: [] });
      const nodeWith5 = makeNode({
        outboundRefs: Array.from({ length: 5 }, (_, i) => ({
          filePath: '/src/a.ts', line: i, col: 0, scipSymbol: `s${i}`,
        })),
      });
      const style0 = INTERNAL_PROCESSING_CONFIG.style.node(nodeWith0, 0);
      const style5 = INTERNAL_PROCESSING_CONFIG.style.node(nodeWith5, 0);
      expect(style5.radius).toBeGreaterThan(style0.radius);
    });

    it('clamps radius to minimum of 3', () => {
      const node = makeNode({ outboundRefs: [] });
      const style = INTERNAL_PROCESSING_CONFIG.style.node(node, 0);
      expect(style.radius).toBeGreaterThanOrEqual(3);
    });

    it('clamps radius to maximum of 30', () => {
      const node = makeNode({
        outboundRefs: Array.from({ length: 100 }, (_, i) => ({
          filePath: '/src/a.ts', line: i, col: 0, scipSymbol: `s${i}`,
        })),
      });
      const style = INTERNAL_PROCESSING_CONFIG.style.node(node, 0);
      expect(style.radius).toBeLessThanOrEqual(30);
    });

    it('uses syntax type color for FUNCTION', () => {
      const node = makeNode({ syntaxType: SyntaxType.FUNCTION });
      const style = INTERNAL_PROCESSING_CONFIG.style.node(node, 0);
      expect(style.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(style.color).not.toBe(DEFAULT_NODE_STYLE.color);
    });
  });

  describe('node forces', () => {
    it('scales charge by referencedAt count', () => {
      const nodeWith0 = makeNode({ referencedAt: [] });
      const nodeWith5 = makeNode({
        referencedAt: Array.from({ length: 5 }, (_, i) => ({
          filePath: '/src/a.ts', line: i, col: 0, scipSymbol: `s${i}`,
        })),
      });
      const forces0 = INTERNAL_PROCESSING_CONFIG.forces.node(nodeWith0);
      const forces5 = INTERNAL_PROCESSING_CONFIG.forces.node(nodeWith5);
      expect(forces5.charge).toBeLessThan(forces0.charge);
    });

    it('clamps charge to minimum of -600', () => {
      const node = makeNode({
        referencedAt: Array.from({ length: 100 }, (_, i) => ({
          filePath: '/src/a.ts', line: i, col: 0, scipSymbol: `s${i}`,
        })),
      });
      const forces = INTERNAL_PROCESSING_CONFIG.forces.node(node);
      expect(forces.charge).toBeGreaterThanOrEqual(-600);
    });

    it('has base charge of -100 for unreferenced nodes', () => {
      const node = makeNode({ referencedAt: [] });
      const forces = INTERNAL_PROCESSING_CONFIG.forces.node(node);
      expect(forces.charge).toBe(-100);
    });
  });

  describe('edge forces', () => {
    it('returns tight forces for CALLS edges', () => {
      const edge = makeEdge({ kind: EdgeKind.CALLS });
      const forces = INTERNAL_PROCESSING_CONFIG.forces.edge(edge);
      expect(forces.distance).toBe(30);
      expect(forces.strength).toBe(0.8);
    });

    it('returns structural forces for EXTENDS edges', () => {
      const edge = makeEdge({ kind: EdgeKind.EXTENDS });
      const forces = INTERNAL_PROCESSING_CONFIG.forces.edge(edge);
      expect(forces.distance).toBe(50);
      expect(forces.strength).toBe(0.6);
    });

    it('returns structural forces for IMPLEMENTS edges', () => {
      const edge = makeEdge({ kind: EdgeKind.IMPLEMENTS });
      const forces = INTERNAL_PROCESSING_CONFIG.forces.edge(edge);
      expect(forces.distance).toBe(50);
      expect(forces.strength).toBe(0.6);
    });

    it('returns structural forces for INSTANTIATES edges', () => {
      const edge = makeEdge({ kind: EdgeKind.INSTANTIATES });
      const forces = INTERNAL_PROCESSING_CONFIG.forces.edge(edge);
      expect(forces.distance).toBe(50);
      expect(forces.strength).toBe(0.6);
    });

    it('returns loose forces for IMPORTS edges', () => {
      const edge = makeEdge({ kind: EdgeKind.IMPORTS });
      const forces = INTERNAL_PROCESSING_CONFIG.forces.edge(edge);
      expect(forces.distance).toBe(100);
      expect(forces.strength).toBe(0.3);
    });

    it('returns loose forces for USES_TYPE edges', () => {
      const edge = makeEdge({ kind: EdgeKind.USES_TYPE });
      const forces = INTERNAL_PROCESSING_CONFIG.forces.edge(edge);
      expect(forces.distance).toBe(100);
      expect(forces.strength).toBe(0.3);
    });
  });

  describe('simulation', () => {
    it('uses default simulation params', () => {
      expect(INTERNAL_PROCESSING_CONFIG.simulation).toEqual(DEFAULT_SIMULATION);
    });
  });
});
```

Also add `INTERNAL_PROCESSING_CONFIG` to the import at the top of the file:

```typescript
import {
  DEFAULT_NODE_STYLE,
  DEFAULT_EDGE_STYLE,
  DEFAULT_NODE_FORCES,
  DEFAULT_EDGE_FORCES,
  DEFAULT_SIMULATION,
  DEFAULT_REPO_GRAPH_CONFIG,
  INTERNAL_PROCESSING_CONFIG,  // ← add this
  combineFilters,
  createNodeStyler,
  createEdgeForcer,
  mergeConfigs,
  type NodeStyler,
} from '@/lib/analysis/graph-config';
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npx jest __tests__/unit/graph-config.test.ts --no-coverage 2>&1 | tail -20`
Expected: FAIL — `INTERNAL_PROCESSING_CONFIG` is not exported

- [ ] **Step 3: Commit failing tests**

```bash
git add __tests__/unit/graph-config.test.ts
git commit -m "test: add failing tests for INTERNAL_PROCESSING_CONFIG (#25)"
```

---

### Task 2: Implement INTERNAL_PROCESSING_CONFIG

**Files:**
- Modify: `lib/analysis/graph-config.ts` (add new config export after `DEFAULT_REPO_GRAPH_CONFIG`)

- [ ] **Step 1: Add the config implementation**

Add the following after the `DEFAULT_REPO_GRAPH_CONFIG` export (around line 126) in `lib/analysis/graph-config.ts`:

```typescript
const PROCESSING_NODE_TYPES = new Set<SyntaxType>([
  SyntaxType.FUNCTION,
  SyntaxType.METHOD,
  SyntaxType.CLASS,
]);

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
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npx jest __tests__/unit/graph-config.test.ts --no-coverage 2>&1 | tail -20`
Expected: All tests PASS

- [ ] **Step 3: Commit implementation**

```bash
git add lib/analysis/graph-config.ts
git commit -m "feat: add INTERNAL_PROCESSING_CONFIG for repo graph (#25)"
```

---

### Task 3: Wire config into RepoGraph

**Files:**
- Modify: `app/page.tsx` (import and pass config prop)

- [ ] **Step 1: Add import and pass config to RepoGraph**

In `app/page.tsx`, add to the imports:

```typescript
import { INTERNAL_PROCESSING_CONFIG } from '@/lib/analysis/graph-config';
```

Then update the `<RepoGraph>` usage (around line 81) to pass the config:

```tsx
<RepoGraph
  repoPath={repoPath}
  hideTestFiles={hideTestFiles}
  config={INTERNAL_PROCESSING_CONFIG}
  onSearchNode={handleRegisterSearch}
/>
```

- [ ] **Step 2: Run full test suite to verify no regressions**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npm test -- --no-coverage 2>&1 | tail -20`
Expected: All tests PASS

- [ ] **Step 3: Run lint to verify no errors**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npm run lint 2>&1 | tail -10`
Expected: No errors

- [ ] **Step 4: Commit wiring**

```bash
git add app/page.tsx
git commit -m "feat: wire INTERNAL_PROCESSING_CONFIG into RepoGraph (#25)"
```
