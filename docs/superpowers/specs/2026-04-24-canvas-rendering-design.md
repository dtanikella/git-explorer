# Canvas 2D Rendering for TsGraph

## Problem

`TsGraph` currently renders the D3 force-directed graph using SVG DOM elements — one `<circle>` per node and one `<line>` per edge. For medium-to-large codebases (1,000–10,000 nodes), the cost of updating hundreds or thousands of DOM elements on every simulation tick causes frame drops and sluggish interaction. The fix is to replace the SVG rendering surface with a Canvas 2D context, keeping the D3 simulation completely intact.

## Scope

- Replace SVG rendering with Canvas 2D in `app/components/ts-graph/TsGraph.tsx`
- No changes to the simulation, force rules, node/edge types, or data pipeline
- No drag-to-reposition behavior (intentionally removed; collision force prevents overlap)
- Hover tooltips preserved via hit-testing
- Zoom/pan preserved via D3 zoom on the canvas element

## Architecture

The D3 force simulation runs entirely offscreen, updating `x`/`y` on `SimNode` objects in memory — this does not change. Only the rendering surface and the tick handler change.

```
SimNode[] + SimEdge[]
         │
         ▼
D3 ForceSimulation (unchanged)
         │ tick
         ▼
drawFrame(ctx, nodes, edges, zoomTransform)
         │
         ▼
<canvas> element  (replaces <svg>)
```

## Component Changes (`TsGraph.tsx`)

### Rendering surface

Replace `svgRef: SVGSVGElement` with `canvasRef: HTMLCanvasElement`. The canvas is sized to fill its container:

```tsx
<canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
```

In the simulation setup effect, read `canvas.offsetWidth` / `canvas.offsetHeight` and assign to `canvas.width` / `canvas.height` (device pixels). A `ResizeObserver` on the container element repeats this on resize and calls `drawFrame()`.

### Zoom & pan

D3 zoom attaches to the canvas element identically to how it attached to the SVG. The transform is stored in a `zoomTransformRef`. `drawFrame()` applies it via:

```ts
ctx.save();
ctx.setTransform(t.k, 0, 0, t.k, t.x, t.y);
// draw edges and nodes
ctx.restore();
```

The search-and-zoom-to-node logic is unchanged — it transitions the zoom transform. During the transition, D3 emits continuous `zoom` events; the zoom handler calls `drawFrame()` on each event, so the canvas repaints smoothly throughout the transition.

### Tick handler

Replace the SVG attribute updates with a `drawFrame()` call:

```ts
simulation.on('tick', drawFrame);
```

`drawFrame()`:
1. `ctx.clearRect(0, 0, canvas.width, canvas.height)`
2. Apply zoom transform (`ctx.save / ctx.setTransform`)
3. For each edge: `ctx.beginPath()` → `moveTo(source.x, source.y)` → `lineTo(target.x, target.y)` → set `strokeStyle` / `lineWidth` from `evaluateEdgeStyle()` → `ctx.stroke()`
4. For each node: `ctx.beginPath()` → `arc(x, y, visualRadius(d), 0, 2π)` → set `fillStyle` from `evaluateNodeStyle()` → `ctx.fill()` → optionally draw stroke for highlighted node
5. `ctx.restore()`

Colors come from the same `evaluateEdgeStyle` / `evaluateNodeStyle` calls as today. No style computation changes.

### Hover tooltips (hit-testing)

Canvas has no built-in per-element events. On `mousemove`:

1. Transform mouse coordinates to graph-space using the inverse of the current zoom transform
2. Linear scan through `simNodes`: find first node where `distance(mx, my, node.x, node.y) <= visualRadius(node)`
3. If a node is found (and differs from `hoveredNodeRef.current`), update the tooltip div and store the hovered node; otherwise hide tooltip

At 10,000 nodes, this scan completes in ~0.1 ms. A `hoveredNodeRef` prevents redundant tooltip DOM updates on frames where the hovered node hasn't changed.

### Node highlighting (search)

`highlightedNodeIdRef` replaces the previous D3 transition on SVG stroke. When a search match is found:
1. Set `highlightedNodeIdRef.current = match.id`
2. Call `drawFrame()` — the draw loop checks this ref and draws a yellow stroke ring on the matching node
3. After 1,500 ms, clear the ref and call `drawFrame()` again

### Removed

- `svgRef`, `linkSelectionRef`, `nodeSelectionRef` — replaced by `canvasRef` (the canvas element) and `ctxRef` (the `CanvasRenderingContext2D` obtained via `canvas.getContext('2d')`, stored so `drawFrame` can use it without re-fetching)
- D3 drag behavior — intentionally removed; nodes settle in a static layout
- SVG `<g>` grouping — canvas transform stack replaces this

## Resize Handling

A `ResizeObserver` attached to the canvas container's parent element calls a `handleResize()` function on any size change. `handleResize()`:
1. Reads new `offsetWidth` / `offsetHeight`
2. Assigns to `canvas.width` / `canvas.height`
3. Calls `drawFrame()` to repaint at the new dimensions

The observer is cleaned up in the effect's return function.

## Error Handling & Edge Cases

- Loading, error, and empty-graph states render a `<div>` overlay before the canvas is shown — unchanged
- If `canvas.getContext('2d')` returns null (rare, unsupported browser), fall back to rendering a plain error message div
- If `simNodes` is empty when the effect runs, skip simulation setup — unchanged behavior
- On graph data change (new repo or filter toggle), the simulation setup effect tears down the old simulation and re-creates it — unchanged

## Testing

Existing tests do not render to canvas directly (they mock D3). The structural changes are:
- Update any test that asserts on `<svg>` or `<circle>` elements to assert on `<canvas>` instead
- Add a test that confirms `mousemove` on the canvas fires the tooltip show/hide logic (mock `getBoundingClientRect` and `getContext`)
- No changes needed to simulation logic tests, API tests, or force-rules tests
