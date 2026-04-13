# TsGraph Sigma.js/Graphology Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace D3 force-directed rendering in `TsGraph.tsx` with Sigma.js (WebGL) + Graphology, and remove the ForcePanel and all force/style rule infrastructure.

**Architecture:** Graphology holds the graph model with node/edge visual attributes set per kind. `forceAtlas2.assign()` runs synchronously (200 iterations) before Sigma mounts. Sigma handles WebGL rendering, zoom/pan, and drag via `@sigma/plugin-drag-nodes`. No user-facing controls remain.

**Tech Stack:** `sigma`, `graphology`, `graphology-layout-forceatlas2`, `@sigma/plugin-drag-nodes`, React 19, Next.js, Jest + `@testing-library/react`

---

## File Map

| File | Action |
|---|---|
| `app/components/ts-graph/ForcePanel.tsx` | Delete |
| `lib/ts/force-rules.ts` | Delete |
| `lib/ts/default-rules.ts` | Delete |
| `lib/ts/types.ts` | Modify — remove `NodeForceRule`, `EdgeForceRule`, `ResolvedNodeForces`, `ResolvedNodeStyle`, `ResolvedEdgeForces`, `ResolvedEdgeStyle` |
| `app/components/ts-graph/TsGraph.tsx` | Full rewrite — Sigma/Graphology |
| `__tests__/components/TsGraph.test.tsx` | Full rewrite — new mocks and tests |
| `package.json` | Add 4 new packages |

---

## Task 1: Install new dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install packages**

```bash
source ~/.nvm/nvm.sh && nvm use 20 && npm install sigma graphology graphology-layout-forceatlas2 @sigma/plugin-drag-nodes
```

Expected output: 4 packages added, no peer dependency warnings.

- [ ] **Step 2: Verify installations**

```bash
source ~/.nvm/nvm.sh && nvm use 20 && node -e "require('sigma'); require('graphology'); require('graphology-layout-forceatlas2'); require('@sigma/plugin-drag-nodes'); console.log('ok')"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add sigma, graphology, graphology-layout-forceatlas2, @sigma/plugin-drag-nodes"
```

---

## Task 2: Write failing tests for new TsGraph

**Files:**
- Modify: `__tests__/components/TsGraph.test.tsx`

Write the new test file in full. These tests will initially fail (TsGraph.tsx still has the old implementation).

- [ ] **Step 1: Replace test file contents**

Write `__tests__/components/TsGraph.test.tsx`:

```tsx
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// ── Sigma mock ────────────────────────────────────────────────────────────────
const mockSigmaOn = jest.fn();
const mockSigmaKill = jest.fn();
const mockSigmaGraphToViewport = jest.fn(() => ({ x: 100, y: 200 }));
const MockSigma = jest.fn().mockImplementation(() => ({
  on: mockSigmaOn,
  kill: mockSigmaKill,
  graphToViewport: mockSigmaGraphToViewport,
}));
jest.mock('sigma', () => ({ __esModule: true, default: MockSigma }));

// ── DragNodePlugin mock ───────────────────────────────────────────────────────
const mockDragKill = jest.fn();
jest.mock('@sigma/plugin-drag-nodes', () => ({
  DragNodePlugin: jest.fn().mockImplementation(() => ({ kill: mockDragKill })),
}));

// ── Graphology mock ───────────────────────────────────────────────────────────
const mockAddNode = jest.fn();
const mockAddEdge = jest.fn();
const mockHasEdge = jest.fn(() => false);
const mockGetNodeAttributes = jest.fn(() => ({ label: 'testNode', x: 0, y: 0 }));
const MockGraph = jest.fn().mockImplementation(() => ({
  addNode: mockAddNode,
  addEdge: mockAddEdge,
  hasEdge: mockHasEdge,
  getNodeAttributes: mockGetNodeAttributes,
  order: 2,
}));
jest.mock('graphology', () => ({ __esModule: true, default: MockGraph }));

// ── ForceAtlas2 mock ──────────────────────────────────────────────────────────
const mockFA2Assign = jest.fn();
jest.mock('graphology-layout-forceatlas2', () => ({
  __esModule: true,
  default: { assign: mockFA2Assign },
}));

import TsGraph from '@/app/components/ts-graph/TsGraph';

const mockFetch = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, data: { nodes: [], edges: [] } }),
  });
  global.fetch = mockFetch;
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const FUNCTION_NODE = (id: string, name: string) => ({
  id,
  kind: 'FUNCTION' as const,
  name,
  parent: null,
  children: [],
  siblings: [],
  params: [],
  returnType: null,
});

const CALL_EDGE = (id: string, source: string, target: string) => ({
  id,
  type: 'call' as const,
  source,
  target,
  callScope: 'same-file' as const,
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TsGraph — Sigma migration', () => {
  it('T023: renders loading state while fetch is pending', () => {
    let resolvePromise!: (v: unknown) => void;
    mockFetch.mockReturnValueOnce(new Promise((res) => { resolvePromise = res; }));

    render(<TsGraph repoPath="/some/repo" />);

    expect(screen.getByText(/analyzing typescript structure/i)).toBeInTheDocument();

    // resolve to avoid act() warning
    resolvePromise({ ok: true, json: async () => ({ success: true, data: { nodes: [], edges: [] } }) });
  });

  it('T024: sends hideTestFiles: true on mount', async () => {
    render(<TsGraph repoPath="/some/repo" />);

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/ts-analysis');
    expect(JSON.parse(options.body as string)).toMatchObject({
      repoPath: '/some/repo',
      hideTestFiles: true,
    });
  });

  it('T025: renders error message on API failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ success: false, error: 'Analysis failed' }),
    });

    render(<TsGraph repoPath="/some/repo" />);

    await waitFor(() =>
      expect(screen.getByText('Analysis failed')).toBeInTheDocument()
    );
  });

  it('T026: renders no-nodes message when graph has no nodes', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: { nodes: [], edges: [] } }),
    });

    render(<TsGraph repoPath="/some/repo" />);

    await waitFor(() =>
      expect(screen.getByText(/no typescript symbols found/i)).toBeInTheDocument()
    );
  });

  it('T027: mounts Sigma when graph data contains nodes', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          nodes: [FUNCTION_NODE('fn1', 'alpha'), FUNCTION_NODE('fn2', 'beta')],
          edges: [CALL_EDGE('e1', 'fn1', 'fn2')],
        },
      }),
    });

    render(<TsGraph repoPath="/some/repo" />);

    await waitFor(() => expect(MockSigma).toHaveBeenCalledTimes(1));
  });

  it('T028: kills Sigma and drag plugin on unmount', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          nodes: [FUNCTION_NODE('fn1', 'alpha'), FUNCTION_NODE('fn2', 'beta')],
          edges: [CALL_EDGE('e1', 'fn1', 'fn2')],
        },
      }),
    });

    const { unmount } = render(<TsGraph repoPath="/some/repo" />);

    await waitFor(() => expect(MockSigma).toHaveBeenCalledTimes(1));

    unmount();

    expect(mockSigmaKill).toHaveBeenCalledTimes(1);
    expect(mockDragKill).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
source ~/.nvm/nvm.sh && nvm use 20 && npx jest __tests__/components/TsGraph.test.tsx --no-coverage
```

Expected: 6 failures. Tests T023–T025 may fail because TsGraph still renders the old panel structure. T026–T028 fail because the old TsGraph doesn't render "No TypeScript symbols found" and doesn't call Sigma.

- [ ] **Step 3: Commit failing tests**

```bash
git add __tests__/components/TsGraph.test.tsx
git commit -m "test: replace TsGraph tests for Sigma migration (failing)"
```

---

## Task 3: Delete dead files and strip dead types

**Files:**
- Delete: `app/components/ts-graph/ForcePanel.tsx`
- Delete: `lib/ts/force-rules.ts`
- Delete: `lib/ts/default-rules.ts`
- Modify: `lib/ts/types.ts`

Do not commit yet — TsGraph.tsx is still broken until Task 4.

- [ ] **Step 1: Delete the three files**

```bash
rm app/components/ts-graph/ForcePanel.tsx
rm lib/ts/force-rules.ts
rm lib/ts/default-rules.ts
```

- [ ] **Step 2: Strip dead types from `lib/ts/types.ts`**

Remove everything from line 113 to the end of the file (the `NodeForceRule`, `EdgeForceRule`, `ResolvedNodeForces`, `ResolvedNodeStyle`, `ResolvedEdgeForces`, `ResolvedEdgeStyle` interfaces). The file should end after the `TsGraphData` interface:

```ts
// --- Graph Data ---

export interface TsGraphData {
  nodes: TsNode[];
  edges: TsEdge[];
}
```

Verify the file ends there with no trailing rule interfaces.

---

## Task 4: Rewrite TsGraph.tsx

**Files:**
- Modify: `app/components/ts-graph/TsGraph.tsx`

- [ ] **Step 1: Replace TsGraph.tsx in full**

Write `app/components/ts-graph/TsGraph.tsx`:

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import Graph from 'graphology';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import Sigma from 'sigma';
import { DragNodePlugin } from '@sigma/plugin-drag-nodes';
import { TsGraphData } from '@/lib/ts/types';

interface TsGraphProps {
  repoPath: string;
}

const SYMBOL_KINDS = new Set(['FUNCTION', 'CLASS', 'INTERFACE']);

const NODE_COLORS: Record<string, string> = {
  FUNCTION: '#3b82f6',
  CLASS: '#8b5cf6',
  INTERFACE: '#10b981',
};

const NODE_SIZES: Record<string, number> = {
  FUNCTION: 6,
  CLASS: 10,
  INTERFACE: 8,
};

const EDGE_COLORS: Record<string, string> = {
  call: '#fcd34d',
  uses: '#f9a8d4',
};

const EDGE_SIZES: Record<string, number> = {
  call: 1.5,
  uses: 1,
};

export default function TsGraph({ repoPath }: TsGraphProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [graphData, setGraphData] = useState<TsGraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ label: string; x: number; y: number } | null>(null);

  useEffect(() => {
    if (!repoPath) return;
    setLoading(true);
    setError(null);

    fetch('/api/ts-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoPath, hideTestFiles: true }),
    })
      .then((res) => res.json())
      .then((result) => {
        if (result.success) {
          setGraphData(result.data);
        } else {
          setError(result.error || 'Analysis failed');
        }
      })
      .catch((err) => {
        setError(err.message || 'Network error');
      })
      .finally(() => setLoading(false));
  }, [repoPath]);

  useEffect(() => {
    if (!containerRef.current || !graphData || graphData.nodes.length === 0) return;

    const symbolIds = new Set(
      graphData.nodes.filter((n) => SYMBOL_KINDS.has(n.kind)).map((n) => n.id)
    );

    const graph = new Graph({ type: 'directed' });

    for (const node of graphData.nodes) {
      if (!symbolIds.has(node.id)) continue;
      const name = 'name' in node ? (node as { name: string }).name : node.id;
      graph.addNode(node.id, {
        x: Math.random(),
        y: Math.random(),
        size: NODE_SIZES[node.kind] ?? 6,
        color: NODE_COLORS[node.kind] ?? '#999999',
        label: name,
      });
    }

    for (const edge of graphData.edges) {
      if (!symbolIds.has(edge.source) || !symbolIds.has(edge.target)) continue;
      if (edge.source === edge.target) continue;
      if (graph.hasEdge(edge.source, edge.target) || graph.hasEdge(edge.target, edge.source)) continue;
      graph.addEdge(edge.source, edge.target, {
        size: EDGE_SIZES[edge.type] ?? 1,
        color: EDGE_COLORS[edge.type] ?? '#cccccc',
      });
    }

    if (graph.order === 0) return;

    forceAtlas2.assign(graph, {
      iterations: 200,
      settings: { gravity: 1, scalingRatio: 2, barnesHutOptimize: true },
    });

    const sigma = new Sigma(graph, containerRef.current, {
      renderEdgeLabels: false,
      defaultNodeColor: '#999999',
      defaultEdgeColor: '#cccccc',
    });

    const dragPlugin = new DragNodePlugin({ sigma });

    sigma.on('enterNode', ({ node }: { node: string }) => {
      const attrs = graph.getNodeAttributes(node);
      const pos = sigma.graphToViewport({ x: attrs.x as number, y: attrs.y as number });
      setTooltip({ label: attrs.label as string, x: pos.x, y: pos.y });
    });

    sigma.on('leaveNode', () => setTooltip(null));

    return () => {
      dragPlugin.kill();
      sigma.kill();
    };
  }, [graphData]);

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>
        Analyzing TypeScript structure...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#ef4444' }}>
        {error}
      </div>
    );
  }

  if (!graphData) return null;

  if (graphData.nodes.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>
        No TypeScript symbols found.
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: 600, background: '#fff', borderRadius: 8, border: '1px solid #ccc' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {tooltip && (
        <div
          style={{
            position: 'absolute',
            left: tooltip.x + 10,
            top: tooltip.y - 10,
            background: '#1f2937',
            color: '#f9fafb',
            padding: '6px 10px',
            borderRadius: 4,
            fontSize: 12,
            pointerEvents: 'none',
            zIndex: 1000,
          }}
        >
          {tooltip.label}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run tests**

```bash
source ~/.nvm/nvm.sh && nvm use 20 && npx jest __tests__/components/TsGraph.test.tsx --no-coverage
```

Expected: 6 tests pass (T023–T028). If any fail, check mock shapes match what TsGraph.tsx actually calls (e.g. `Sigma` constructor args, `DragNodePlugin` constructor arg, `forceAtlas2.assign` call).

- [ ] **Step 3: Run full test suite**

```bash
source ~/.nvm/nvm.sh && nvm use 20 && npm test -- --no-coverage
```

Expected: all tests pass. If other test files import from `force-rules` or `default-rules`, fix their imports now.

- [ ] **Step 4: Commit everything**

```bash
git add app/components/ts-graph/TsGraph.tsx lib/ts/types.ts __tests__/components/TsGraph.test.tsx
git add -u app/components/ts-graph/ForcePanel.tsx lib/ts/force-rules.ts lib/ts/default-rules.ts
git commit -m "feat: migrate TsGraph from D3 to Sigma.js/Graphology, remove ForcePanel"
```

---

## Task 5: Verify build

- [ ] **Step 1: Run Next.js build**

```bash
source ~/.nvm/nvm.sh && nvm use 20 && npm run build
```

Expected: build succeeds with no TypeScript errors. If there are TS errors about missing types that used to be in `force-rules.ts` or `default-rules.ts`, trace the import and remove it.

- [ ] **Step 2: Commit if build required fixes**

Only commit if Step 1 required code changes. If the build was clean, no additional commit needed.

```bash
git add <any fixed files>
git commit -m "fix: resolve build errors after Sigma migration"
```
