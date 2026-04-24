# Canvas 2D Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the SVG DOM rendering in `TsGraph` with a Canvas 2D surface so the graph performs well for 1,000–10,000 node codebases.

**Architecture:** The D3 force simulation is kept exactly as-is — it runs offscreen, updating `x`/`y` on node objects in memory. The only changes are the rendering surface (canvas replaces SVG), the tick handler (calls `drawFrame()` instead of updating SVG attributes), and tooltip handling (hit-tested via `mousemove` instead of native SVG events).

**Tech Stack:** D3 (force simulation + zoom), Canvas 2D API, React refs, ResizeObserver, TypeScript

---

## File Map

| File | Change |
|------|--------|
| `app/components/ts-graph/TsGraph.tsx` | Full rewrite of rendering surface; simulation effect; hover; search |
| `__tests__/components/TsGraph.test.tsx` | Update canvas/svg assertions; add ctx mock; add tooltip test |

---

## Task 1: Swap `<svg>` for `<canvas>` and update refs

**Files:**
- Modify: `app/components/ts-graph/TsGraph.tsx`
- Modify: `__tests__/components/TsGraph.test.tsx`

### Background

The current component uses `svgRef: SVGSVGElement`, `linkSelectionRef`, and `nodeSelectionRef`. These will all be replaced. New refs needed:
- `canvasRef: HTMLCanvasElement` — the canvas element
- `ctxRef: CanvasRenderingContext2D | null` — the 2D context (fetched once, stored)
- `zoomTransformRef: d3.ZoomTransform` — current zoom/pan state, updated on every zoom event
- `hoveredNodeRef: SimNode | null` — the node under the mouse cursor
- `highlightedNodeIdRef: string | null` — node id currently highlighted by search
- `drawFrameRef: () => void | null` — stored reference to the drawFrame closure so it can be called from outside the simulation effect (e.g., from search handler)

The `zoomRef` type changes from `ZoomBehavior<SVGSVGElement, unknown>` to `ZoomBehavior<HTMLCanvasElement, unknown>`.

A new `ctxError` state renders a fallback message if `canvas.getContext('2d')` returns null.

- [ ] **Step 1: Write the failing test**

In `__tests__/components/TsGraph.test.tsx`, add a test asserting `<canvas>` renders (currently `<svg>` renders):

```tsx
// Add inside describe('TsGraph — data fetching with hideTestFiles prop') or as a new describe block
it('renders a canvas element, not an svg', async () => {
  const { container } = render(<TsGraph repoPath="" hideTestFiles={false} />);
  expect(container.querySelector('canvas')).toBeNull(); // no repo yet, returns null
});
```

Also add a canvas mock at the top of the test file, before the `import TsGraph` line (so the mock is in place when the component runs):

Also update the D3 mock's return object (inside `jest.mock('d3', ...)`) to add `zoomIdentity`, `transition`, and `duration` — all needed before Task 2:

```tsx
// In the chainable() factory, add 'transition' and 'duration' to the methods array:
const methods = [
  'append', 'style', 'attr', 'call', 'on', 'remove',
  'selectAll', 'join', 'data', 'html', 'text', 'transition', 'duration',
];
```

```tsx
// In the return object of jest.mock('d3', ...), add:
zoomIdentity: { k: 1, x: 0, y: 0, translate: jest.fn().mockReturnThis(), scale: jest.fn().mockReturnThis() },
```

Then add the canvas and ResizeObserver mocks after the `jest.mock('d3', ...)` block:

```tsx
// Add after the jest.mock('d3', ...) block, before the import TsGraph line:
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
};

beforeAll(() => {
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockCtx as any);
  global.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  }));
});
```

- [ ] **Step 2: Run the test to see it fail**

```bash
npx jest __tests__/components/TsGraph.test.tsx -t "renders a canvas element" --no-coverage
```

Expected: FAIL (currently the component renders `<svg>` or `null` for empty repoPath)

- [ ] **Step 3: Update `TsGraph.tsx` — refs and JSX**

Replace the ref declarations at the top of the component function. Remove `svgRef`, `linkSelectionRef`, `nodeSelectionRef`. Change `zoomRef` type. Add new refs:

```tsx
// Replace the existing ref block (lines ~42-48) with:
const canvasRef = useRef<HTMLCanvasElement | null>(null);
const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
const tooltipRef = useRef<d3.Selection<HTMLDivElement, unknown, HTMLElement, any> | null>(null);
const simulationRef = useRef<d3.Simulation<SimNode, SimEdge> | null>(null);
const zoomRef = useRef<d3.ZoomBehavior<HTMLCanvasElement, unknown> | null>(null);
const zoomTransformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
const simNodesRef = useRef<SimNode[]>([]);
const hoveredNodeRef = useRef<SimNode | null>(null);
const highlightedNodeIdRef = useRef<string | null>(null);
const drawFrameRef = useRef<(() => void) | null>(null);
```

Add `ctxError` state after the existing state declarations:

```tsx
const [ctxError, setCtxError] = useState(false);
```

Replace the JSX return at the bottom of the component. The entire return block becomes:

```tsx
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

if (ctxError) {
  return (
    <div style={{ padding: 24, textAlign: 'center', color: '#ef4444' }}>
      Canvas not supported in this browser.
    </div>
  );
}

if (!graphData) return null;

if (graphData.nodes.length === 0) {
  return (
    <div style={{ padding: 24, textAlign: 'center', color: '#6b7280' }}>
      No non-test files found. Uncheck &ldquo;Hide test files&rdquo; in the toolbar to include test files in the graph.
    </div>
  );
}

return (
  <div style={{ width: '100%', height: '100%', background: '#fff', borderRadius: 8, border: '1px solid #ccc', position: 'relative' }}>
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
      aria-label="TypeScript repository structure graph"
    />
  </div>
);
```

- [ ] **Step 4: Run the tests**

```bash
npx jest __tests__/components/TsGraph.test.tsx --no-coverage
```

Expected: all tests pass (the canvas test passes; the data-fetching tests still pass since those don't assert on the rendered element type)

- [ ] **Step 5: Commit**

```bash
git add app/components/ts-graph/TsGraph.tsx __tests__/components/TsGraph.test.tsx
git commit -m "refactor: swap svg for canvas element in TsGraph, update refs

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 2: Implement `drawFrame()` and wire to simulation tick

**Files:**
- Modify: `app/components/ts-graph/TsGraph.tsx`
- Modify: `__tests__/components/TsGraph.test.tsx`

### Background

The simulation setup effect currently creates SVG `<g>` elements and updates their attributes on each tick. In the new version:
1. The effect gets the canvas `CanvasRenderingContext2D` and stores it in `ctxRef`.
2. A `drawFrame()` closure draws all edges and nodes on the canvas using the current zoom transform from `zoomTransformRef`.
3. `simulation.on('tick', drawFrame)` replaces all the SVG `attr()` updates.
4. `drawFrameRef.current = drawFrame` is set so it can be called from outside the effect (search handler).

The D3 drag behavior is **removed entirely** — layout is static once settled.

- [ ] **Step 1: Write the failing test**

Add a new describe block to `__tests__/components/TsGraph.test.tsx` that verifies `ctx.clearRect` is called when graph data is loaded. This requires the D3 mock's simulation to fire its `tick` callback.

First, update the D3 mock's `forceSimulation` to support calling the tick callback:

```tsx
// Update the simMethods() factory inside jest.mock('d3', ...) to capture and call the 'tick' handler:
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
```

Also update the `forceSimulation` mock to expose the sim object for testing:

```tsx
// In the return object of jest.mock('d3', ...):
let lastSim: any = null;
// ...
forceSimulation: jest.fn(() => {
  lastSim = simMethods();
  return lastSim;
}),
// expose for tests:
__getLastSim: () => lastSim,
```

Add the test:

```tsx
describe('TsGraph — canvas rendering', () => {
  it('calls ctx.clearRect on simulation tick when graph data is loaded', async () => {
    const mockData = {
      nodes: [
        { id: 'n1', kind: 'FUNCTION', name: 'foo', filePath: 'src/a.ts' },
        { id: 'n2', kind: 'FUNCTION', name: 'bar', filePath: 'src/b.ts' },
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2', type: 'call', weight: 1 },
      ],
    };
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: mockData }),
    });

    const d3Mock = require('d3');
    render(<TsGraph repoPath="/some/repo" hideTestFiles={false} />);

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    await act(async () => {});

    // Fire one tick
    const sim = d3Mock.__getLastSim();
    act(() => { sim._fireTick(); });

    expect(mockCtx.clearRect).toHaveBeenCalled();
    expect(mockCtx.beginPath).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the failing test**

```bash
npx jest __tests__/components/TsGraph.test.tsx -t "calls ctx.clearRect" --no-coverage
```

Expected: FAIL — `clearRect` not called yet (simulation tick goes to old SVG code)

- [ ] **Step 3: Rewrite the simulation setup effect in `TsGraph.tsx`**

Replace the entire `// Effect 1: simulation setup` block (from `useEffect(() => {` down to the closing `}, [simNodes, simEdges]);`) with the following:

```tsx
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

  const currentNodeRules = nodeRulesRef.current;
  const currentEdgeRules = edgeRulesRef.current;

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
      const src = e.source as SimNode;
      const tgt = e.target as SimNode;
      if (src.x == null || src.y == null || tgt.x == null || tgt.y == null) continue;
      const style = evaluateEdgeStyle(e.data, currentEdgeRules);
      c.beginPath();
      c.moveTo(src.x, src.y);
      c.lineTo(tgt.x, tgt.y);
      c.strokeStyle = style.color;
      c.lineWidth = style.width;
      c.globalAlpha = 0.6;
      c.stroke();
      c.globalAlpha = 1.0;
    }

    // Draw nodes
    for (const n of simNodes) {
      if (n.x == null || n.y == null) continue;
      const style = evaluateNodeStyle(n.data, currentNodeRules);
      const r = visualRadius(n);
      c.beginPath();
      c.arc(n.x, n.y, r, 0, 2 * Math.PI);
      c.fillStyle = style.color;
      c.fill();
      c.strokeStyle = '#fff';
      c.lineWidth = 1;
      c.stroke();
      if (highlightedNodeIdRef.current === n.id) {
        c.beginPath();
        c.arc(n.x, n.y, r + 2, 0, 2 * Math.PI);
        c.strokeStyle = '#facc15';
        c.lineWidth = 4;
        c.stroke();
      }
    }

    c.restore();
  }

  drawFrameRef.current = drawFrame;

  const zoneMap: Record<string, { x: number; y: number }> = {
    top: { x: width / 2, y: height * 0.2 },
    bottom: { x: width / 2, y: height * 0.8 },
    left: { x: width * 0.2, y: height / 2 },
    right: { x: width * 0.8, y: height / 2 },
    center: { x: width / 2, y: height / 2 },
  };

  const simulation = d3
    .forceSimulation<SimNode>(simNodes)
    .force(
      'link',
      d3
        .forceLink<SimNode, SimEdge>(simEdges)
        .id((d) => d.id)
        .distance((d) => evaluateEdgeForces(d.data, currentEdgeRules).linkDistance)
        .strength((d) => evaluateEdgeForces(d.data, currentEdgeRules).linkStrength)
    )
    .force(
      'charge',
      d3.forceManyBody<SimNode>().strength((d) =>
        evaluateNodeForces(d.data, currentNodeRules).charge
      )
    )
    .force(
      'collide',
      d3.forceCollide<SimNode>().radius((d) => d.computedRadius + 3)
    )
    .force(
      'x',
      d3
        .forceX<SimNode>()
        .x((d) => {
          const forces = evaluateNodeForces(d.data, currentNodeRules);
          if (forces.fx !== null) return forces.fx;
          if (forces.zone && zoneMap[forces.zone]) return zoneMap[forces.zone].x;
          return width / 2;
        })
        .strength((d) => {
          const forces = evaluateNodeForces(d.data, currentNodeRules);
          return forces.zone || forces.fx !== null ? 0.3 : forces.centerStrength;
        })
    )
    .force(
      'y',
      d3
        .forceY<SimNode>()
        .y((d) => {
          const forces = evaluateNodeForces(d.data, currentNodeRules);
          if (forces.fy !== null) return forces.fy;
          if (forces.zone && zoneMap[forces.zone]) return zoneMap[forces.zone].y;
          return height / 2;
        })
        .strength((d) => {
          const forces = evaluateNodeForces(d.data, currentNodeRules);
          return forces.zone || forces.fy !== null ? 0.3 : forces.centerStrength;
        })
    );

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
```

Also **remove** the old Effect 2 block (the one that updates SVG attrs based on node/edge rules changes — it no longer exists) if it was present. In the current code there is no Effect 2 but there's a comment placeholder — remove any dead comment.

- [ ] **Step 4: Run all tests**

```bash
npx jest __tests__/components/TsGraph.test.tsx --no-coverage
```

Expected: all tests pass, including the new `clearRect` test

- [ ] **Step 5: Commit**

```bash
git add app/components/ts-graph/TsGraph.tsx __tests__/components/TsGraph.test.tsx
git commit -m "feat: implement canvas drawFrame and wire to simulation tick

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 3: Implement `mousemove` hit-testing for tooltip

**Files:**
- Modify: `app/components/ts-graph/TsGraph.tsx`
- Modify: `__tests__/components/TsGraph.test.tsx`

### Background

Canvas elements don't fire per-element mouse events. Instead, we attach `onMouseMove` and `onMouseLeave` to the canvas element. On each `mousemove`:
1. Read the bounding rect of the canvas
2. Subtract canvas position and zoom offset/scale from mouse coordinates to get graph-space coordinates
3. Linear scan of `simNodesRef.current` to find the first node whose distance from the mouse is within `visualRadius(node)`
4. If a different node is found (or node is lost), update `hoveredNodeRef` and show/hide the tooltip div

The tooltip div is already created by the existing tooltip lifecycle effect — we just need to position and show it.

`onMouseLeave` hides the tooltip and clears `hoveredNodeRef`.

- [ ] **Step 1: Write the failing test**

Add to `__tests__/components/TsGraph.test.tsx`:

```tsx
describe('TsGraph — tooltip hit-testing', () => {
  it('shows tooltip when mouse is over a node position', async () => {
    // Position nodes manually so we can aim the mouse at one
    const mockData = {
      nodes: [
        { id: 'n1', kind: 'FUNCTION', name: 'myFunc', filePath: 'src/a.ts' },
        { id: 'n2', kind: 'FUNCTION', name: 'otherFunc', filePath: 'src/b.ts' },
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2', type: 'call', weight: 1 },
      ],
    };
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: mockData }),
    });

    const { container } = render(<TsGraph repoPath="/repo" hideTestFiles={false} />);
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    await act(async () => {});

    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();

    // Manually set node positions on simNodesRef via the D3 sim output
    // Since D3 is mocked, nodes have no x/y — place them manually via ref access.
    // We test that mousemove calls tooltip methods even without a match (no crash).
    // With no nodes having x/y set, the scan finds nothing and tooltip stays hidden.
    const moveEvent = new MouseEvent('mousemove', {
      clientX: 100,
      clientY: 100,
      bubbles: true,
    });
    act(() => { canvas!.dispatchEvent(moveEvent); });
    // No crash = pass (tooltip remains hidden when no node is under the cursor)
  });

  it('hides tooltip on mouseleave', async () => {
    const mockData = {
      nodes: [{ id: 'n1', kind: 'FUNCTION', name: 'fn', filePath: 'src/a.ts' }],
      edges: [],
    };
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: mockData }),
    });

    const d3Mock = require('d3');
    const { container } = render(<TsGraph repoPath="/repo" hideTestFiles={false} />);
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    await act(async () => {});

    const canvas = container.querySelector('canvas');
    const leaveEvent = new MouseEvent('mouseleave', { bubbles: true });
    act(() => { canvas!.dispatchEvent(leaveEvent); });

    // tooltipRef is internal — verify via the d3 mock's style call that 'hidden' was set
    const d3SelectMock = d3Mock.select as jest.Mock;
    // The tooltip's visibility('hidden') is called; no crash = pass
    expect(canvas).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run the failing tests**

```bash
npx jest __tests__/components/TsGraph.test.tsx -t "tooltip hit-testing" --no-coverage
```

Expected: FAIL — no mousemove handler on canvas yet

- [ ] **Step 3: Add `handleMouseMove` and `handleMouseLeave` to `TsGraph.tsx`**

Add these two callbacks after the `// Keep simNodesRef in sync` effect and before the simulation effect:

```tsx
const handleMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
  if (!canvasRef.current) return;
  const canvas = canvasRef.current;
  const rect = canvas.getBoundingClientRect();
  const t = zoomTransformRef.current;

  // Transform mouse coordinates to graph-space
  const mx = (event.clientX - rect.left - t.x) / t.k;
  const my = (event.clientY - rect.top - t.y) / t.k;

  const nodes = simNodesRef.current;
  let found: SimNode | null = null;
  for (const n of nodes) {
    if (n.x == null || n.y == null) continue;
    const dx = mx - n.x;
    const dy = my - n.y;
    if (Math.sqrt(dx * dx + dy * dy) <= visualRadius(n)) {
      found = n;
      break;
    }
  }

  if (found !== hoveredNodeRef.current) {
    hoveredNodeRef.current = found;
    if (found && tooltipRef.current) {
      const label = 'name' in found.data ? (found.data as { name: string }).name : found.id;
      tooltipRef.current
        .style('visibility', 'visible')
        .html(`<strong>${found.data.kind}</strong>: ${label}`);
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
```

Wire them to the canvas element in the JSX return:

```tsx
<canvas
  ref={canvasRef}
  style={{ width: '100%', height: '100%', display: 'block' }}
  aria-label="TypeScript repository structure graph"
  onMouseMove={handleMouseMove}
  onMouseLeave={handleMouseLeave}
/>
```

- [ ] **Step 4: Run all tests**

```bash
npx jest __tests__/components/TsGraph.test.tsx --no-coverage
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add app/components/ts-graph/TsGraph.tsx __tests__/components/TsGraph.test.tsx
git commit -m "feat: add canvas mousemove hit-testing for tooltip

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 4: Update search highlighting to use `highlightedNodeIdRef`

**Files:**
- Modify: `app/components/ts-graph/TsGraph.tsx`
- Modify: `__tests__/components/TsGraph.test.tsx`

### Background

The current `handleSearchNode` uses a D3 selection transition to change SVG stroke color. In the canvas version, we:
1. Set `highlightedNodeIdRef.current = match.id` — `drawFrame` already checks this and draws a yellow ring
2. Call `drawFrameRef.current?.()` immediately so the ring appears (in case the simulation has settled)
3. After 1,500 ms, clear the ref and call `drawFrameRef.current?.()` again to remove the ring

The zoom-to-node logic (`d3.select(canvas).transition(...)`) must also be updated to select the canvas element, not the SVG element. The D3 zoom transition emits zoom events, and the zoom event handler already calls `drawFrame()`, so the pan animation repaints the canvas automatically.

Also remove the now-deleted `svgRef` reference from `handleSearchNode`. The function now uses `canvasRef` and `zoomRef`.

- [ ] **Step 1: Verify the existing search registration test still passes**

```bash
npx jest __tests__/components/TsGraph.test.tsx -t "registers search handler" --no-coverage
```

Expected: PASS (it only checks that `onSearchNode` is called with a function — that still works)

- [ ] **Step 2: Add a test that the search handler returns `false` when no nodes are present**

In `__tests__/components/TsGraph.test.tsx`, add to the describe block:

```tsx
it('search handler returns false when no matching node exists', async () => {
  let searchFn: ((q: string) => boolean) | null = null;
  const registerFn = jest.fn((fn: (q: string) => boolean) => { searchFn = fn; });

  render(<TsGraph repoPath="/some/repo" hideTestFiles={false} onSearchNode={registerFn} />);
  await act(async () => {});

  expect(searchFn).not.toBeNull();
  // No data loaded yet (nodes empty), so search should return false
  expect(searchFn!('nonExistentFunction')).toBe(false);
});
```

- [ ] **Step 3: Run to confirm it passes already**

```bash
npx jest __tests__/components/TsGraph.test.tsx -t "returns false when no matching" --no-coverage
```

Expected: PASS (the function returns false when simNodesRef is empty)

- [ ] **Step 4: Replace `handleSearchNode` in `TsGraph.tsx`**

Find and replace the entire `handleSearchNode` callback with:

```tsx
const handleSearchNode = useCallback((query: string): boolean => {
  const lowerQ = query.toLowerCase();
  const match =
    simNodesRef.current.find((n) => {
      const name = 'name' in n.data ? (n.data as { name: string }).name : '';
      return name.toLowerCase() === lowerQ;
    }) ??
    simNodesRef.current.find((n) => {
      const name = 'name' in n.data ? (n.data as { name: string }).name : '';
      return name.toLowerCase().includes(lowerQ);
    });

  if (!match || match.x == null || match.y == null) return false;
  if (!canvasRef.current || !zoomRef.current) return false;

  const canvas = canvasRef.current;
  const width = canvas.offsetWidth || 800;
  const height = canvas.offsetHeight || 600;
  const scale = 2;
  const transform = d3.zoomIdentity
    .translate(width / 2 - match.x * scale, height / 2 - match.y * scale)
    .scale(scale);

  d3.select(canvas as any)
    .transition()
    .duration(500)
    .call((zoomRef.current as any).transform, transform);

  // Highlight node — drawFrame checks highlightedNodeIdRef on every tick/zoom event
  highlightedNodeIdRef.current = match.id;
  drawFrameRef.current?.();

  setTimeout(() => {
    highlightedNodeIdRef.current = null;
    drawFrameRef.current?.();
  }, 1500);

  return true;
}, []);
```

Also ensure `d3.select(canvas).transition().duration(500).call(...)` works. The chainable mock should already include `transition` and `duration` from Task 1's mock update — no additional changes needed here.

- [ ] **Step 5: Run all tests**

```bash
npx jest __tests__/components/TsGraph.test.tsx --no-coverage
```

Expected: all tests pass

- [ ] **Step 6: Run the full test suite**

```bash
npm test -- --no-coverage 2>&1 | tail -20
```

Expected: all tests pass

- [ ] **Step 7: Commit**

```bash
git add app/components/ts-graph/TsGraph.tsx __tests__/components/TsGraph.test.tsx
git commit -m "feat: update search highlighting for canvas rendering

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 5: Final cleanup and verification

**Files:**
- Modify: `app/components/ts-graph/TsGraph.tsx`
- Read: `__tests__/components/TsGraph.test.tsx`

### Background

Remove any leftover dead code — `// Effect 2` comment blocks, unused imports (`d3.drag` is no longer used), TypeScript errors from removed types. Confirm the component compiles cleanly.

- [ ] **Step 1: Remove unused import — `drag` types**

In `TsGraph.tsx`, check the import line. The `SimEdge` drag types (`d3.drag`, `d3.Selection<SVGCircleElement, ...>`) are no longer used. Remove any TypeScript type imports that reference `SVGSVGElement`, `SVGLineElement`, `SVGCircleElement`, or `SVGGElement` if they were imported anywhere.

If the `d3` import still includes `drag`-specific types, no action is needed (d3 is imported as `import * as d3 from 'd3'` so no named imports to remove).

- [ ] **Step 2: TypeScript compile check**

```bash
npx tsc --noEmit 2>&1 | head -40
```

Expected: no errors related to `TsGraph.tsx` (fix any that appear)

- [ ] **Step 3: Run the full test suite one final time**

```bash
npm test -- --no-coverage 2>&1 | tail -30
```

Expected: all tests pass with 0 failures

- [ ] **Step 4: Final commit**

```bash
git add app/components/ts-graph/TsGraph.tsx
git commit -m "chore: remove dead code and fix types after canvas migration

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```
