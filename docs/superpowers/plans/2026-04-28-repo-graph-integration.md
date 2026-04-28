# RepoGraph Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a new `RepoGraph` component that fetches from `/api/repo-analysis`, renders all nodes and edges with uniform styling and constant forces, and replace `TsGraph` usage in page.tsx.

**Architecture:** New standalone `RepoGraph.tsx` component in `app/components/repo-graph/`. It fetches `AnalysisResult` from the existing `/api/repo-analysis` endpoint, converts it to flat `SimpleNode[]` + `SimpleEdge[]` via an inline adapter, and renders via a D3 canvas force simulation with constant parameters. Page.tsx swaps the import.

**Tech Stack:** Next.js, React, D3.js, TypeScript, Jest + React Testing Library

**Spec:** `docs/superpowers/specs/2026-04-28-repo-graph-integration-design.md`

---

### Task 1: Create RepoGraph component with data fetching

**Files:**
- Create: `app/components/repo-graph/RepoGraph.tsx`
- Test: `__tests__/components/RepoGraph.test.tsx`

- [ ] **Step 1: Write failing tests for data fetching**

Create `__tests__/components/RepoGraph.test.tsx`:

```tsx
import React from 'react';
import { render, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('d3', () => {
  const chainable = (): any => {
    const obj: Record<string, any> = {};
    const methods = [
      'append', 'style', 'attr', 'call', 'on', 'remove',
      'selectAll', 'join', 'data', 'html', 'text', 'transition', 'duration',
    ];
    methods.forEach((m) => {
      obj[m] = jest.fn(() => obj);
    });
    return obj;
  };

  const simMethods = (): any => {
    let tickHandler: (() => void) | null = null;
    const obj: Record<string, any> = {};
    ['force', 'alpha', 'alphaTarget', 'restart', 'stop'].forEach((m) => {
      obj[m] = jest.fn(() => obj);
    });
    obj.on = jest.fn((event: string, handler: () => void) => {
      if (event === 'tick') tickHandler = handler;
      return obj;
    });
    obj._fireTick = () => { if (tickHandler) tickHandler(); };
    return obj;
  };

  const linkForce = (): any => {
    const obj: Record<string, any> = {};
    ['id', 'distance', 'strength'].forEach((m) => { obj[m] = jest.fn(() => obj); });
    return obj;
  };

  const zoomBehavior = (): any => {
    const obj: Record<string, any> = {};
    obj.scaleExtent = jest.fn(() => obj);
    obj.on = jest.fn(() => obj);
    return obj;
  };

  let lastSim: any = null;

  return {
    select: jest.fn(() => chainable()),
    forceSimulation: jest.fn((nodes: any[]) => {
      if (nodes) nodes.forEach((n: any, i: number) => { n.x = 100 + i * 50; n.y = 100 + i * 50; });
      lastSim = simMethods();
      return lastSim;
    }),
    forceLink: jest.fn(() => linkForce()),
    forceManyBody: jest.fn(() => ({ strength: jest.fn().mockReturnThis() })),
    forceCollide: jest.fn(() => ({ radius: jest.fn().mockReturnThis() })),
    forceCenter: jest.fn(),
    zoom: jest.fn(() => zoomBehavior()),
    zoomIdentity: { k: 1, x: 0, y: 0, translate: jest.fn().mockReturnThis(), scale: jest.fn().mockReturnThis() },
    __getLastSim: () => lastSim,
  };
});

const mockCtx = {
  clearRect: jest.fn(),
  beginPath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  arc: jest.fn(),
  fill: jest.fn(),
  stroke: jest.fn(),
  save: jest.fn(),
  restore: jest.fn(),
  setTransform: jest.fn(),
  globalAlpha: 1,
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
};

beforeAll(() => {
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockCtx as any);
  global.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  }));
});

import RepoGraph from '@/app/components/repo-graph/RepoGraph';

const mockFetch = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, data: { nodes: [], edges: [], metadata: { repoPath: '/r', language: 'typescript', nodeCount: 0, edgeCount: 0, analysisDurationMs: 10, missingNodeTypes: [], missingEdgeKinds: [] } } }),
  });
  global.fetch = mockFetch;
});

describe('RepoGraph — data fetching', () => {
  it('fetches from /api/repo-analysis with hideTestFiles=true', async () => {
    render(<RepoGraph repoPath="/some/repo" hideTestFiles={true} />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/repo-analysis', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ repoPath: '/some/repo', hideTestFiles: true }),
      }));
    });

    await act(async () => {});
  });

  it('fetches from /api/repo-analysis with hideTestFiles=false', async () => {
    render(<RepoGraph repoPath="/some/repo" hideTestFiles={false} />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/repo-analysis', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ repoPath: '/some/repo', hideTestFiles: false }),
      }));
    });

    await act(async () => {});
  });

  it('does not fetch when repoPath is empty', () => {
    render(<RepoGraph repoPath="" hideTestFiles={true} />);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('shows loading state while fetching', () => {
    mockFetch.mockReturnValue(new Promise(() => {})); // never resolves
    const { getByText } = render(<RepoGraph repoPath="/repo" hideTestFiles={true} />);
    expect(getByText('Analyzing repository...')).toBeInTheDocument();
  });

  it('shows error state on failure', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: false, error: 'Analysis failed' }),
    });

    const { getByText } = render(<RepoGraph repoPath="/repo" hideTestFiles={true} />);
    await waitFor(() => expect(getByText('Analysis failed')).toBeInTheDocument());
    await act(async () => {});
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/components/RepoGraph.test.tsx --no-cache`
Expected: FAIL — `Cannot find module '@/app/components/repo-graph/RepoGraph'`

- [ ] **Step 3: Write the RepoGraph component**

Create `app/components/repo-graph/RepoGraph.tsx`:

```tsx
'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import type { AnalysisResult } from '@/lib/analysis/types';

interface RepoGraphProps {
  repoPath: string;
  hideTestFiles: boolean;
  onSearchNode?: (handler: (query: string) => boolean) => void;
}

interface SimpleNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
}

interface SimpleEdge extends d3.SimulationLinkDatum<SimpleNode> {
  source: string;
  target: string;
}

const NODE_RADIUS = 6;
const NODE_COLOR = '#999999';
const EDGE_COLOR = '#999999';
const EDGE_WIDTH = 1;
const EDGE_OPACITY = 0.6;
const HIGHLIGHT_COLOR = '#facc15';

export default function RepoGraph({ repoPath, hideTestFiles, onSearchNode }: RepoGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const tooltipRef = useRef<d3.Selection<HTMLDivElement, unknown, HTMLElement, any> | null>(null);
  const simulationRef = useRef<d3.Simulation<SimpleNode, SimpleEdge> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<HTMLCanvasElement, unknown> | null>(null);
  const zoomTransformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
  const simNodesRef = useRef<SimpleNode[]>([]);
  const hoveredNodeRef = useRef<SimpleNode | null>(null);
  const highlightedNodeIdRef = useRef<string | null>(null);
  const drawFrameRef = useRef<(() => void) | null>(null);

  const [analysisData, setAnalysisData] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ctxError, setCtxError] = useState(false);

  // Tooltip lifecycle — mount/unmount only
  useEffect(() => {
    const tip = d3
      .select('body')
      .append('div')
      .style('position', 'absolute')
      .style('visibility', 'hidden')
      .style('pointer-events', 'none')
      .style('background', '#1f2937')
      .style('color', '#f9fafb')
      .style('padding', '6px 10px')
      .style('border-radius', '4px')
      .style('font-size', '12px')
      .style('z-index', '1000');
    tooltipRef.current = tip;
    return () => {
      tip.remove();
      tooltipRef.current = null;
    };
  }, []);

  // Fetch data from /api/repo-analysis
  useEffect(() => {
    if (!repoPath) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch('/api/repo-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoPath, hideTestFiles }),
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((result) => {
        if (result.success) {
          setAnalysisData(result.data);
        } else {
          setError(result.error || 'Analysis failed');
        }
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setError(err.message || 'Network error');
        setLoading(false);
      });

    return () => controller.abort();
  }, [repoPath, hideTestFiles]);

  // Adapter: AnalysisResult → SimpleNode[] + SimpleEdge[]
  const simNodes: SimpleNode[] = useMemo(() => {
    if (!analysisData) return [];
    return analysisData.nodes.map((n) => ({
      id: n.scipSymbol,
      name: n.name,
    }));
  }, [analysisData]);

  const simEdges: SimpleEdge[] = useMemo(() => {
    if (!analysisData) return [];
    const nodeIds = new Set(simNodes.map((n) => n.id));
    return analysisData.edges
      .filter((e) => nodeIds.has(e.fromSymbol) && nodeIds.has(e.toSymbol))
      .map((e) => ({
        source: e.fromSymbol,
        target: e.toSymbol,
      }));
  }, [analysisData, simNodes]);

  useEffect(() => { simNodesRef.current = simNodes; }, [simNodes]);

  // Mouse handlers
  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const t = zoomTransformRef.current;

    const mx = (event.clientX - rect.left - t.x) / t.k;
    const my = (event.clientY - rect.top - t.y) / t.k;

    const nodes = simNodesRef.current;
    let found: SimpleNode | null = null;
    for (const n of nodes) {
      if (n.x == null || n.y == null) continue;
      const dx = mx - n.x;
      const dy = my - n.y;
      if (Math.sqrt(dx * dx + dy * dy) <= NODE_RADIUS) {
        found = n;
        break;
      }
    }

    if (found !== hoveredNodeRef.current) {
      hoveredNodeRef.current = found;
      if (found && tooltipRef.current) {
        tooltipRef.current
          .style('visibility', 'visible')
          .html(found.name);
      } else if (tooltipRef.current) {
        tooltipRef.current.style('visibility', 'hidden');
      }
    }

    if (found && tooltipRef.current) {
      tooltipRef.current
        .style('top', event.pageY - 10 + 'px')
        .style('left', event.pageX + 10 + 'px');
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    hoveredNodeRef.current = null;
    if (tooltipRef.current) {
      tooltipRef.current.style('visibility', 'hidden');
    }
  }, []);

  // Force simulation + canvas rendering
  useEffect(() => {
    if (!canvasRef.current || simNodes.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setCtxError(true);
      return;
    }
    ctxRef.current = ctx;

    canvas.width = canvas.offsetWidth || 800;
    canvas.height = canvas.offsetHeight || 600;
    const width = canvas.width;
    const height = canvas.height;

    function drawFrame() {
      const c = ctxRef.current;
      const cv = canvasRef.current;
      if (!c || !cv) return;
      const t = zoomTransformRef.current;

      c.clearRect(0, 0, cv.width, cv.height);
      c.save();
      c.setTransform(t.k, 0, 0, t.k, t.x, t.y);

      // Draw edges
      for (const e of simEdges) {
        const src = e.source as unknown as SimpleNode;
        const tgt = e.target as unknown as SimpleNode;
        if (src.x == null || src.y == null || tgt.x == null || tgt.y == null) continue;
        c.beginPath();
        c.moveTo(src.x, src.y);
        c.lineTo(tgt.x, tgt.y);
        c.strokeStyle = EDGE_COLOR;
        c.lineWidth = EDGE_WIDTH;
        c.globalAlpha = EDGE_OPACITY;
        c.stroke();
        c.globalAlpha = 1.0;
      }

      // Draw nodes
      for (const n of simNodes) {
        if (n.x == null || n.y == null) continue;
        c.beginPath();
        c.arc(n.x, n.y, NODE_RADIUS, 0, 2 * Math.PI);
        c.fillStyle = NODE_COLOR;
        c.fill();
        c.strokeStyle = '#fff';
        c.lineWidth = 1;
        c.stroke();
        if (highlightedNodeIdRef.current === n.id) {
          c.beginPath();
          c.arc(n.x, n.y, NODE_RADIUS + 2, 0, 2 * Math.PI);
          c.strokeStyle = HIGHLIGHT_COLOR;
          c.lineWidth = 4;
          c.stroke();
        }
      }

      c.restore();
    }

    drawFrameRef.current = drawFrame;

    const simulation = d3
      .forceSimulation<SimpleNode>(simNodes)
      .force(
        'link',
        d3
          .forceLink<SimpleNode, SimpleEdge>(simEdges)
          .id((d) => d.id)
          .distance(80)
          .strength(0.5)
      )
      .force('charge', d3.forceManyBody<SimpleNode>().strength(-150))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide<SimpleNode>().radius(NODE_RADIUS + 3));

    simulationRef.current = simulation;
    simulation.on('tick', drawFrame);

    const zoomBehavior = d3
      .zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.1, 8])
      .on('zoom', (event) => {
        zoomTransformRef.current = event.transform;
        drawFrame();
      });
    zoomRef.current = zoomBehavior;
    d3.select(canvas as any).call(zoomBehavior as any);

    const resizeObserver = new ResizeObserver(() => {
      if (!canvasRef.current) return;
      canvasRef.current.width = canvasRef.current.offsetWidth || 800;
      canvasRef.current.height = canvasRef.current.offsetHeight || 600;
      drawFrame();
    });
    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }

    return () => {
      simulation.stop();
      zoomRef.current = null;
      drawFrameRef.current = null;
      resizeObserver.disconnect();
    };
  }, [simNodes, simEdges]);

  // Search handler
  const handleSearchNode = useCallback((query: string): boolean => {
    const lowerQ = query.toLowerCase();
    const match =
      simNodesRef.current.find((n) => n.name.toLowerCase() === lowerQ) ??
      simNodesRef.current.find((n) => n.name.toLowerCase().includes(lowerQ));

    if (!match || match.x == null || match.y == null) return false;
    if (!canvasRef.current || !zoomRef.current) return false;

    const canvas = canvasRef.current;
    const w = canvas.offsetWidth || 800;
    const h = canvas.offsetHeight || 600;
    const scale = 2;
    const transform = d3.zoomIdentity
      .translate(w / 2 - match.x * scale, h / 2 - match.y * scale)
      .scale(scale);

    d3.select(canvas as any)
      .transition()
      .duration(500)
      .call((zoomRef.current as any).transform, transform);

    highlightedNodeIdRef.current = match.id;
    drawFrameRef.current?.();

    setTimeout(() => {
      highlightedNodeIdRef.current = null;
      drawFrameRef.current?.();
    }, 1500);

    return true;
  }, []);

  useEffect(() => {
    if (onSearchNode) {
      onSearchNode(handleSearchNode);
    }
  }, [onSearchNode, handleSearchNode]);

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>
        Analyzing repository...
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

  if (ctxError) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#ef4444' }}>
        Canvas not supported in this browser.
      </div>
    );
  }

  if (!analysisData) return null;

  return (
    <div style={{ width: '100%', height: '100%', background: '#fff', borderRadius: 8, border: '1px solid #ccc', position: 'relative' }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
        aria-label="Repository structure graph"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/components/RepoGraph.test.tsx --no-cache`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add app/components/repo-graph/RepoGraph.tsx __tests__/components/RepoGraph.test.tsx
git commit -m "feat: add RepoGraph component with repo-analysis endpoint (#21)"
```

---

### Task 2: Add canvas rendering and search tests

**Files:**
- Modify: `__tests__/components/RepoGraph.test.tsx`

- [ ] **Step 1: Add canvas rendering and search tests**

Append to `__tests__/components/RepoGraph.test.tsx`:

```tsx
describe('RepoGraph — canvas rendering', () => {
  it('calls ctx.clearRect on simulation tick when data is loaded', async () => {
    const mockData = {
      nodes: [
        { scipSymbol: 's1', name: 'foo', syntaxType: 'FUNCTION', filePath: 'a.ts', startLine: 1, startCol: 0, isAsync: false, isExported: true, params: [], returnTypeText: null, isDefinition: true, inTestFile: false, referencedAt: [], outboundRefs: [] },
        { scipSymbol: 's2', name: 'bar', syntaxType: 'FUNCTION', filePath: 'b.ts', startLine: 1, startCol: 0, isAsync: false, isExported: true, params: [], returnTypeText: null, isDefinition: true, inTestFile: false, referencedAt: [], outboundRefs: [] },
      ],
      edges: [
        { kind: 'CALLS', fromFile: 'a.ts', fromName: 'foo', fromSymbol: 's1', toText: 'bar', toFile: 'b.ts', toName: 'bar', toSymbol: 's2', isExternal: false, edgePosition: { line: 2, col: 3 }, isOptionalChain: false, isAsync: false },
      ],
      metadata: { repoPath: '/r', language: 'typescript', nodeCount: 2, edgeCount: 1, analysisDurationMs: 10, missingNodeTypes: [], missingEdgeKinds: [] },
    };
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: mockData }),
    });

    const d3Mock = require('d3');
    render(<RepoGraph repoPath="/repo" hideTestFiles={true} />);

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    await act(async () => {});

    const sim = d3Mock.__getLastSim();
    act(() => { sim._fireTick(); });

    expect(mockCtx.clearRect).toHaveBeenCalled();
    expect(mockCtx.beginPath).toHaveBeenCalled();
  });
});

describe('RepoGraph — search', () => {
  it('registers search handler when onSearchNode is provided', () => {
    const registerFn = jest.fn();
    render(<RepoGraph repoPath="/repo" hideTestFiles={true} onSearchNode={registerFn} />);
    expect(registerFn).toHaveBeenCalledWith(expect.any(Function));
  });

  it('search handler returns false when no matching node exists', async () => {
    let searchFn: ((q: string) => boolean) | null = null;
    const registerFn = jest.fn((fn: (q: string) => boolean) => { searchFn = fn; });

    render(<RepoGraph repoPath="/repo" hideTestFiles={true} onSearchNode={registerFn} />);
    await act(async () => {});

    expect(searchFn).not.toBeNull();
    expect(searchFn!('nonExistent')).toBe(false);
  });
});

describe('RepoGraph — tooltip', () => {
  it('does not crash on mousemove over canvas', async () => {
    const mockData = {
      nodes: [
        { scipSymbol: 's1', name: 'foo', syntaxType: 'FUNCTION', filePath: 'a.ts', startLine: 1, startCol: 0, isAsync: false, isExported: true, params: [], returnTypeText: null, isDefinition: true, inTestFile: false, referencedAt: [], outboundRefs: [] },
      ],
      edges: [],
      metadata: { repoPath: '/r', language: 'typescript', nodeCount: 1, edgeCount: 0, analysisDurationMs: 10, missingNodeTypes: [], missingEdgeKinds: [] },
    };
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: mockData }),
    });

    const { container } = render(<RepoGraph repoPath="/repo" hideTestFiles={true} />);
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    await act(async () => {});

    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();

    const moveEvent = new MouseEvent('mousemove', { clientX: 100, clientY: 100, bubbles: true });
    act(() => { canvas!.dispatchEvent(moveEvent); });
    // No crash = pass
  });

  it('does not crash on mouseleave', async () => {
    const mockData = {
      nodes: [
        { scipSymbol: 's1', name: 'foo', syntaxType: 'FUNCTION', filePath: 'a.ts', startLine: 1, startCol: 0, isAsync: false, isExported: true, params: [], returnTypeText: null, isDefinition: true, inTestFile: false, referencedAt: [], outboundRefs: [] },
      ],
      edges: [],
      metadata: { repoPath: '/r', language: 'typescript', nodeCount: 1, edgeCount: 0, analysisDurationMs: 10, missingNodeTypes: [], missingEdgeKinds: [] },
    };
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: mockData }),
    });

    const { container } = render(<RepoGraph repoPath="/repo" hideTestFiles={true} />);
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    await act(async () => {});

    const canvas = container.querySelector('canvas');
    const leaveEvent = new MouseEvent('mouseleave', { bubbles: true });
    act(() => { canvas!.dispatchEvent(leaveEvent); });
    // No crash = pass
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npx jest __tests__/components/RepoGraph.test.tsx --no-cache`
Expected: All 11 tests PASS

- [ ] **Step 3: Commit**

```bash
git add __tests__/components/RepoGraph.test.tsx
git commit -m "test: add canvas rendering, search, and tooltip tests for RepoGraph (#21)"
```

---

### Task 3: Wire RepoGraph into page.tsx

**Files:**
- Modify: `app/page.tsx` (lines 4-5, 81-85)

- [ ] **Step 1: Update the import and JSX in page.tsx**

In `app/page.tsx`, change line 5:

```typescript
// Before
import TsGraph from './components/ts-graph/TsGraph';

// After
import RepoGraph from './components/repo-graph/RepoGraph';
```

Then change lines 81-85:

```tsx
// Before
          <TsGraph
            repoPath={repoPath}
            hideTestFiles={hideTestFiles}
            onSearchNode={handleRegisterSearch}
          />

// After
          <RepoGraph
            repoPath={repoPath}
            hideTestFiles={hideTestFiles}
            onSearchNode={handleRegisterSearch}
          />
```

Also update the comment on line 78 from `TsGraph` to `RepoGraph`:

```tsx
// Before
      {/* Row 3: TsGraph — fills all remaining space */}

// After
      {/* Row 3: RepoGraph — fills all remaining space */}
```

- [ ] **Step 2: Run all tests to verify nothing is broken**

Run: `npx jest --no-cache`
Expected: All tests PASS. The existing `TsGraph.test.tsx` tests should still pass since `TsGraph.tsx` is unchanged.

- [ ] **Step 3: Run the build to verify TypeScript compilation**

Run: `npm run build`
Expected: Build succeeds with no type errors.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat: wire RepoGraph into page.tsx, replacing TsGraph (#21)"
```
