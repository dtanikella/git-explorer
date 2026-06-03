# Modules View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Modules" view that shows functions/methods connected by CALLS edges, with node radius proportional to outbound calls and collide force proportional to inbound calls, using light→dark gray edge gradients for direction.

**Architecture:** Config-only approach — a `createModulesViewConfig(edges)` factory builds a `RepoGraphConfig` preset using existing `mergeConfigs()`. RepoGraph gains gradient edge support. page.tsx adds a view dropdown. No new API endpoints or pipeline stages.

**Tech Stack:** TypeScript, D3.js (canvas), Next.js React, Jest

**Spec:** `docs/superpowers/specs/2026-05-19-modules-view-design.md`

---

### Task 1: Helper Functions and EdgeStyle Extension

**Files:**
- Modify: `lib/analysis/graph-config.ts`
- Modify: `__tests__/unit/graph-config.test.ts`

This task adds three helper functions (`scaledValue`, `countOutboundCalls`, `countInboundCalls`), the `ScaleFn` type, and extends `EdgeStyle` with optional gradient fields. All tested before moving on.

- [ ] **Step 1: Write failing tests for `scaledValue`**

Add to the end of `__tests__/unit/graph-config.test.ts`:

```typescript
import {
  // ... existing imports, add:
  scaledValue,
  countOutboundCalls,
  countInboundCalls,
  type ScaleFn,
} from '@/lib/analysis/graph-config';

describe('scaledValue', () => {
  it('returns min when count is 0', () => {
    expect(scaledValue(0, 4, 30)).toBe(4);
  });

  it('returns a value between min and max for moderate count', () => {
    const result = scaledValue(5, 4, 30);
    expect(result).toBeGreaterThan(4);
    expect(result).toBeLessThanOrEqual(30);
  });

  it('clamps to max for very large count', () => {
    const result = scaledValue(100000, 4, 30);
    expect(result).toBeLessThanOrEqual(30);
  });

  it('uses log2 scaling by default', () => {
    // log2(4+1) ≈ 2.32, log2(8+1) ≈ 3.17 — not double
    const r4 = scaledValue(4, 0, 100);
    const r8 = scaledValue(8, 0, 100);
    expect(r8).toBeGreaterThan(r4);
    expect(r8 - r4).toBeLessThan(r4); // sub-linear growth
  });

  it('accepts a custom scale function', () => {
    const linear: ScaleFn = (n) => n;
    const r4 = scaledValue(4, 0, 100, linear);
    const r8 = scaledValue(8, 0, 100, linear);
    // linear: r8 should be roughly double r4
    expect(r8).toBeGreaterThan(r4 * 1.5);
  });

  it('returns min when min equals max', () => {
    expect(scaledValue(10, 5, 5)).toBe(5);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npx jest __tests__/unit/graph-config.test.ts --no-coverage 2>&1 | tail -20`
Expected: FAIL — `scaledValue` is not exported

- [ ] **Step 3: Implement `scaledValue` and `ScaleFn`**

Add to `lib/analysis/graph-config.ts` after the `DeepPartial` type export (line ~193):

```typescript
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
  const maxScaled = scaleFn(1000);
  const normalized = Math.min(scaled / maxScaled, 1);
  return min + normalized * (max - min);
}
```

- [ ] **Step 4: Run tests to verify `scaledValue` tests pass**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npx jest __tests__/unit/graph-config.test.ts --no-coverage -t "scaledValue" 2>&1 | tail -10`
Expected: All 6 scaledValue tests PASS

- [ ] **Step 5: Write failing tests for `countOutboundCalls`**

Add to `__tests__/unit/graph-config.test.ts`:

```typescript
describe('countOutboundCalls', () => {
  it('counts CALLS edges from the node', () => {
    const node = makeNode({ scipSymbol: 'test#foo.' });
    const edges = [
      makeEdge({ fromSymbol: 'test#foo.', kind: EdgeKind.CALLS }),
      makeEdge({ fromSymbol: 'test#foo.', kind: EdgeKind.CALLS }),
      makeEdge({ fromSymbol: 'test#bar.', kind: EdgeKind.CALLS }),
    ];
    expect(countOutboundCalls(node, edges)).toBe(2);
  });

  it('ignores non-CALLS edges from the node', () => {
    const node = makeNode({ scipSymbol: 'test#foo.' });
    const edges = [
      makeEdge({ fromSymbol: 'test#foo.', kind: EdgeKind.CALLS }),
      makeEdge({ fromSymbol: 'test#foo.', kind: EdgeKind.IMPORTS }),
      makeEdge({ fromSymbol: 'test#foo.', kind: EdgeKind.USES_TYPE }),
    ];
    expect(countOutboundCalls(node, edges)).toBe(1);
  });

  it('returns 0 when node has no outbound CALLS', () => {
    const node = makeNode({ scipSymbol: 'test#foo.' });
    const edges = [
      makeEdge({ fromSymbol: 'test#bar.', kind: EdgeKind.CALLS }),
    ];
    expect(countOutboundCalls(node, edges)).toBe(0);
  });

  it('returns 0 for empty edges array', () => {
    const node = makeNode({ scipSymbol: 'test#foo.' });
    expect(countOutboundCalls(node, [])).toBe(0);
  });
});
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npx jest __tests__/unit/graph-config.test.ts --no-coverage -t "countOutboundCalls" 2>&1 | tail -10`
Expected: FAIL — `countOutboundCalls` is not exported

- [ ] **Step 7: Implement `countOutboundCalls`**

Add to `lib/analysis/graph-config.ts` after `scaledValue`:

```typescript
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
```

- [ ] **Step 8: Run tests to verify `countOutboundCalls` tests pass**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npx jest __tests__/unit/graph-config.test.ts --no-coverage -t "countOutboundCalls" 2>&1 | tail -10`
Expected: All 4 tests PASS

- [ ] **Step 9: Write failing tests for `countInboundCalls`**

Add to `__tests__/unit/graph-config.test.ts`:

```typescript
describe('countInboundCalls', () => {
  it('returns referencedAt length', () => {
    const node = makeNode({
      referencedAt: [
        { filePath: '/src/a.ts', line: 1, col: 0, scipSymbol: 's1' },
        { filePath: '/src/b.ts', line: 5, col: 0, scipSymbol: 's2' },
        { filePath: '/src/c.ts', line: 10, col: 0, scipSymbol: 's3' },
      ],
    });
    expect(countInboundCalls(node)).toBe(3);
  });

  it('returns 0 for node with no references', () => {
    const node = makeNode({ referencedAt: [] });
    expect(countInboundCalls(node)).toBe(0);
  });
});
```

- [ ] **Step 10: Run tests to verify they fail**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npx jest __tests__/unit/graph-config.test.ts --no-coverage -t "countInboundCalls" 2>&1 | tail -10`
Expected: FAIL — `countInboundCalls` is not exported

- [ ] **Step 11: Implement `countInboundCalls`**

Add to `lib/analysis/graph-config.ts` after `countOutboundCalls`:

```typescript
export function countInboundCalls(node: AnalysisNode): number {
  return node.referencedAt.length;
}
```

- [ ] **Step 12: Run tests to verify `countInboundCalls` tests pass**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npx jest __tests__/unit/graph-config.test.ts --no-coverage -t "countInboundCalls" 2>&1 | tail -10`
Expected: All 2 tests PASS

- [ ] **Step 13: Extend `EdgeStyle` with gradient fields**

In `lib/analysis/graph-config.ts`, modify the `EdgeStyle` interface (line ~13-17):

```typescript
export interface EdgeStyle {
  color: string;
  width: number;
  opacity: number;
  gradientSourceColor?: string;
  gradientTargetColor?: string;
}
```

No tests needed — this is a backward-compatible type addition. Existing code that doesn't set these fields continues to work.

- [ ] **Step 14: Run full test suite to verify nothing is broken**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npx jest __tests__/unit/graph-config.test.ts --no-coverage 2>&1 | tail -10`
Expected: All existing + new tests PASS

- [ ] **Step 15: Commit**

```bash
git add lib/analysis/graph-config.ts __tests__/unit/graph-config.test.ts
git commit -m "feat: add scaling helpers, count functions, and EdgeStyle gradient fields

Add scaledValue(), countOutboundCalls(), countInboundCalls() helpers
and optional gradientSourceColor/gradientTargetColor to EdgeStyle
for the Modules view.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 2: MODULES_VIEW_CONFIG Factory

**Files:**
- Modify: `lib/analysis/graph-config.ts`
- Modify: `__tests__/unit/graph-config.test.ts`

This task adds the `createModulesViewConfig(edges)` factory function. It's a factory (not a static config) because the node styler needs access to the edges array to count outbound CALLS per node. The factory pre-builds a lookup map from edges, then captures it in the config's accessor closures.

- [ ] **Step 1: Write failing tests for `createModulesViewConfig`**

Add to `__tests__/unit/graph-config.test.ts`:

```typescript
import {
  // ... add to existing imports:
  createModulesViewConfig,
} from '@/lib/analysis/graph-config';

describe('createModulesViewConfig', () => {
  const modulesEdges = [
    makeEdge({ fromSymbol: 'test#foo.', toSymbol: 'test#bar.', kind: EdgeKind.CALLS }),
    makeEdge({ fromSymbol: 'test#foo.', toSymbol: 'test#baz.', kind: EdgeKind.CALLS }),
    makeEdge({ fromSymbol: 'test#bar.', toSymbol: 'test#baz.', kind: EdgeKind.CALLS }),
  ];
  const config = createModulesViewConfig(modulesEdges);

  describe('node filter', () => {
    it('accepts FUNCTION nodes', () => {
      const node = makeNode({ syntaxType: SyntaxType.FUNCTION });
      expect(config.filters.node(node)).toBe(true);
    });

    it('accepts METHOD nodes', () => {
      const node = makeNode({ syntaxType: SyntaxType.METHOD });
      expect(config.filters.node(node)).toBe(true);
    });

    it('rejects CLASS nodes', () => {
      const node = makeNode({ syntaxType: SyntaxType.CLASS });
      expect(config.filters.node(node)).toBe(false);
    });

    it('rejects INTERFACE nodes', () => {
      const node = makeNode({ syntaxType: SyntaxType.INTERFACE });
      expect(config.filters.node(node)).toBe(false);
    });

    it('rejects TYPE_ALIAS nodes', () => {
      const node = makeNode({ syntaxType: SyntaxType.TYPE_ALIAS });
      expect(config.filters.node(node)).toBe(false);
    });

    it('rejects MODULE nodes', () => {
      const node = makeNode({ syntaxType: SyntaxType.MODULE });
      expect(config.filters.node(node)).toBe(false);
    });
  });

  describe('edge filter', () => {
    it('accepts CALLS edges', () => {
      expect(config.filters.edge(makeEdge({ kind: EdgeKind.CALLS, isExternal: false }))).toBe(true);
    });

    it('rejects IMPORTS edges', () => {
      expect(config.filters.edge(makeEdge({ kind: EdgeKind.IMPORTS }))).toBe(false);
    });

    it('rejects INSTANTIATES edges', () => {
      expect(config.filters.edge(makeEdge({ kind: EdgeKind.INSTANTIATES }))).toBe(false);
    });

    it('rejects USES_TYPE edges', () => {
      expect(config.filters.edge(makeEdge({ kind: EdgeKind.USES_TYPE }))).toBe(false);
    });

    it('rejects EXTENDS edges', () => {
      expect(config.filters.edge(makeEdge({ kind: EdgeKind.EXTENDS }))).toBe(false);
    });

    it('rejects external CALLS edges', () => {
      expect(config.filters.edge(makeEdge({ kind: EdgeKind.CALLS, isExternal: true }))).toBe(false);
    });
  });

  describe('node style', () => {
    it('scales radius with outbound CALLS count', () => {
      const nodeWith0 = makeNode({ scipSymbol: 'test#none.' });
      const nodeWith2 = makeNode({ scipSymbol: 'test#foo.' });
      const style0 = config.style.node(nodeWith0, 0);
      const style2 = config.style.node(nodeWith2, 0);
      expect(style2.radius).toBeGreaterThan(style0.radius);
    });

    it('clamps radius to minimum of 4', () => {
      const node = makeNode({ scipSymbol: 'test#none.' });
      const style = config.style.node(node, 0);
      expect(style.radius).toBeGreaterThanOrEqual(4);
    });

    it('clamps radius to maximum of 30', () => {
      const manyEdges = Array.from({ length: 500 }, (_, i) =>
        makeEdge({ fromSymbol: 'test#big.', toSymbol: `test#t${i}.`, kind: EdgeKind.CALLS })
      );
      const bigConfig = createModulesViewConfig(manyEdges);
      const node = makeNode({ scipSymbol: 'test#big.' });
      const style = bigConfig.style.node(node, 0);
      expect(style.radius).toBeLessThanOrEqual(30);
    });

    it('uses SyntaxType colors', () => {
      const node = makeNode({ syntaxType: SyntaxType.FUNCTION, scipSymbol: 'test#foo.' });
      const style = config.style.node(node, 0);
      expect(style.color).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
  });

  describe('edge style', () => {
    it('includes gradient source color (light gray)', () => {
      const style = config.style.edge(makeEdge());
      expect(style.gradientSourceColor).toBe('#d1d5db');
    });

    it('includes gradient target color (dark gray)', () => {
      const style = config.style.edge(makeEdge());
      expect(style.gradientTargetColor).toBe('#374151');
    });

    it('has width of 1.5', () => {
      const style = config.style.edge(makeEdge());
      expect(style.width).toBe(1.5);
    });
  });

  describe('node forces', () => {
    it('scales collide radius with inbound reference count', () => {
      const nodeWith0 = makeNode({ referencedAt: [] });
      const nodeWith3 = makeNode({
        referencedAt: [
          { filePath: '/src/a.ts', line: 1, col: 0, scipSymbol: 's1' },
          { filePath: '/src/b.ts', line: 2, col: 0, scipSymbol: 's2' },
          { filePath: '/src/c.ts', line: 3, col: 0, scipSymbol: 's3' },
        ],
      });
      const forces0 = config.forces.node(nodeWith0);
      const forces3 = config.forces.node(nodeWith3);
      expect(forces3.collideRadius).toBeGreaterThan(forces0.collideRadius);
    });

    it('clamps collide radius to minimum of 8', () => {
      const node = makeNode({ referencedAt: [] });
      const forces = config.forces.node(node);
      expect(forces.collideRadius).toBeGreaterThanOrEqual(8);
    });

    it('clamps collide radius to maximum of 40', () => {
      const manyRefs = Array.from({ length: 1000 }, (_, i) => ({
        filePath: '/src/x.ts', line: i, col: 0, scipSymbol: `test#x${i}.`,
      }));
      const node = makeNode({ referencedAt: manyRefs });
      const forces = config.forces.node(node);
      expect(forces.collideRadius).toBeLessThanOrEqual(40);
    });
  });

  describe('simulation', () => {
    it('uses DEFAULT_SIMULATION params', () => {
      expect(config.simulation).toEqual(DEFAULT_SIMULATION);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npx jest __tests__/unit/graph-config.test.ts --no-coverage -t "createModulesViewConfig" 2>&1 | tail -10`
Expected: FAIL — `createModulesViewConfig` is not exported

- [ ] **Step 3: Implement `createModulesViewConfig`**

Add to `lib/analysis/graph-config.ts` after `countInboundCalls`:

```typescript
// ── Modules View ──

const MODULES_NODE_TYPES = new Set<SyntaxType>([
  SyntaxType.FUNCTION,
  SyntaxType.METHOD,
]);

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
        gradientTargetColor: '#374151',
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npx jest __tests__/unit/graph-config.test.ts --no-coverage -t "createModulesViewConfig" 2>&1 | tail -20`
Expected: All createModulesViewConfig tests PASS

- [ ] **Step 5: Run full test suite**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npx jest __tests__/unit/graph-config.test.ts --no-coverage 2>&1 | tail -10`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add lib/analysis/graph-config.ts __tests__/unit/graph-config.test.ts
git commit -m "feat: add createModulesViewConfig factory

Factory builds a RepoGraphConfig that filters to FUNCTION/METHOD
nodes with CALLS-only edges. Node radius scales with outbound call
count, collide radius scales with inbound reference count. Edge
style includes gradient colors for directional rendering.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 3: Edge Gradient Rendering in RepoGraph

**Files:**
- Modify: `app/components/repo-graph/RepoGraph.tsx`

This task adds gradient edge rendering to the canvas draw loop. When an edge's style includes `gradientSourceColor` and `gradientTargetColor`, the renderer draws a linear gradient instead of a flat color. Backward-compatible — edges without gradient fields render as before.

- [ ] **Step 1: Update the edge drawing block in the `drawFrame` function**

In `app/components/repo-graph/RepoGraph.tsx`, find the edge drawing loop inside `drawFrame` (the block starting at approximately line 236 with `for (const e of simEdges)`). Replace the edge rendering code:

```typescript
      // Draw edges
      for (const e of simEdges) {
        const src = e.source as unknown as SimpleNode;
        const tgt = e.target as unknown as SimpleNode;
        if (src.x == null || src.y == null || tgt.x == null || tgt.y == null) continue;
        const eStyle = cfg.style.edge(e.data);
        c.beginPath();
        c.moveTo(src.x, src.y);
        c.lineTo(tgt.x, tgt.y);
        if (eStyle.gradientSourceColor && eStyle.gradientTargetColor) {
          const grad = c.createLinearGradient(src.x, src.y, tgt.x, tgt.y);
          grad.addColorStop(0, eStyle.gradientSourceColor);
          grad.addColorStop(1, eStyle.gradientTargetColor);
          c.strokeStyle = grad;
        } else {
          c.strokeStyle = eStyle.color;
        }
        c.lineWidth = eStyle.width;
        c.globalAlpha = eStyle.opacity;
        c.stroke();
        c.globalAlpha = 1.0;
      }
```

- [ ] **Step 2: Verify the build compiles**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npx tsc --noEmit 2>&1 | tail -10`
Expected: No errors (or only pre-existing ones)

- [ ] **Step 3: Commit**

```bash
git add app/components/repo-graph/RepoGraph.tsx
git commit -m "feat: support edge gradient rendering in RepoGraph

When EdgeStyle includes gradientSourceColor and gradientTargetColor,
the canvas draw loop renders a linear gradient from source to target
node position. Falls back to flat color for edges without gradient
fields.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 4: View Switching UI and Config Factory Support

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/components/repo-graph/RepoGraph.tsx`

This task adds a view dropdown to page.tsx and updates RepoGraph to accept a config factory (a function that receives edges and returns a config) in addition to a static config. This is needed because `createModulesViewConfig` requires the edges array to pre-compute outbound call counts.

- [ ] **Step 1: Update RepoGraph to accept config factory**

In `app/components/repo-graph/RepoGraph.tsx`, update the imports and props interface:

```typescript
import type { RepoGraphConfig } from '@/lib/analysis/graph-config';
import { DEFAULT_REPO_GRAPH_CONFIG } from '@/lib/analysis/graph-config';
import type { AnalysisResult, AnalysisNode, AnalysisEdge } from '@/lib/analysis/types';

// Add this type
type ConfigOrFactory = RepoGraphConfig | ((edges: AnalysisEdge[]) => RepoGraphConfig);

interface RepoGraphProps {
  repoPath: string;
  hideTestFiles: boolean;
  config?: ConfigOrFactory;
  onSearchNode?: (handler: (query: string) => boolean) => void;
}
```

- [ ] **Step 2: Add config resolution logic in RepoGraph**

Add a `useMemo` hook after the `analysisData` state declaration (after line ~46) to resolve the config:

```typescript
  const resolvedConfig = useMemo(() => {
    if (!analysisData) return config && typeof config !== 'function' ? config : DEFAULT_REPO_GRAPH_CONFIG;
    return typeof config === 'function' ? config(analysisData.edges) : (config ?? DEFAULT_REPO_GRAPH_CONFIG);
  }, [analysisData, config]);
```

Then replace all references to `config` within the component with `resolvedConfig`:
- In `configRef.current` update effect: `configRef.current = resolvedConfig;` and dependency `[resolvedConfig]`
- In `simEdges` useMemo: replace `config ?? DEFAULT_REPO_GRAPH_CONFIG` with `resolvedConfig` and dependency `[analysisData, resolvedConfig]`
- In `simNodes` useMemo: replace `config ?? DEFAULT_REPO_GRAPH_CONFIG` with `resolvedConfig` and dependency `[analysisData, simEdges, resolvedConfig]`

- [ ] **Step 3: Add view dropdown to page.tsx**

Update `app/page.tsx` imports:

```typescript
import { INTERNAL_PROCESSING_CONFIG } from '@/lib/analysis/graph-config';
import { createModulesViewConfig } from '@/lib/analysis/graph-config';
import type { AnalysisEdge } from '@/lib/analysis/types';
```

Add state and view map inside `HomePage`:

```typescript
  const [selectedView, setSelectedView] = useState<string>('internal');

  const VIEW_OPTIONS: Record<string, { label: string; config: RepoGraphConfig | ((edges: AnalysisEdge[]) => RepoGraphConfig) }> = {
    internal: { label: 'Internal Processing', config: INTERNAL_PROCESSING_CONFIG },
    modules: { label: 'Modules', config: createModulesViewConfig },
  };
```

- [ ] **Step 4: Add the dropdown element to the toolbar row**

In the `{/* Row 2: Tools & Filters */}` div, add the view dropdown after the "Hide test files" label:

```tsx
        <label className="flex items-center gap-1.5 text-gray-700">
          View
          <select
            value={selectedView}
            onChange={(e) => setSelectedView(e.target.value)}
            disabled={!repoPath}
            className="px-2 py-1 text-sm border border-gray-300 rounded bg-white disabled:bg-gray-100"
          >
            {Object.entries(VIEW_OPTIONS).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </label>
```

- [ ] **Step 5: Pass selected config to RepoGraph**

Update the `<RepoGraph>` element in page.tsx to use the selected view's config:

```tsx
          <RepoGraph
            repoPath={repoPath}
            hideTestFiles={hideTestFiles}
            config={VIEW_OPTIONS[selectedView].config}
            onSearchNode={handleRegisterSearch}
          />
```

- [ ] **Step 6: Verify build compiles**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npx tsc --noEmit 2>&1 | tail -10`
Expected: No errors

- [ ] **Step 7: Run all tests**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npm test --no-coverage 2>&1 | tail -20`
Expected: All tests PASS

- [ ] **Step 8: Run linter**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npm run lint 2>&1 | tail -10`
Expected: No errors

- [ ] **Step 9: Commit**

```bash
git add app/page.tsx app/components/repo-graph/RepoGraph.tsx
git commit -m "feat: add view switching dropdown with Modules view

Add a View dropdown to the toolbar that switches between Internal
Processing and Modules views. RepoGraph now accepts config factories
that receive the edges array for dynamic config resolution.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```
