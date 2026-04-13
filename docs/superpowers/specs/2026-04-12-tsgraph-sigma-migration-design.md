# TsGraph — Sigma.js / Graphology Migration Design

**Date:** 2026-04-12

## Overview

Replace the D3 force-directed rendering in `TsGraph.tsx` with Sigma.js (WebGL) and Graphology (graph model). Remove the `ForcePanel` and all force/style rule infrastructure. The result is a clean canvas with zoom/pan and drag interactions, no user-facing controls.

---

## 1. Deletions

| File | Action |
|---|---|
| `app/components/ts-graph/ForcePanel.tsx` | Delete |
| `lib/ts/force-rules.ts` | Delete |
| `lib/ts/default-rules.ts` | Delete |

From `lib/ts/types.ts`, remove:
- `NodeForceRule`, `EdgeForceRule` interfaces
- `ResolvedNodeForces`, `ResolvedNodeStyle`, `ResolvedEdgeForces`, `ResolvedEdgeStyle` interfaces

`TsNode`, `TsEdge`, `TsGraphData` and all node/edge type definitions remain untouched.

D3 stays in `package.json` — `ForceDirectedGraph.tsx` and `CirclePackingGraph.tsx` still use it.

---

## 2. New Dependencies

```
sigma
graphology
graphology-layout-forceatlas2
@sigma/plugin-drag-nodes
```

No React wrapper (`@react-sigma/core` is explicitly excluded).

---

## 3. TsGraph.tsx Architecture

The component is rewritten. Same data fetch, entirely new rendering.

**State:**
```ts
const [graphData, setGraphData] = useState<TsGraphData | null>(null);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
```

No rule state, no ref zoo. One `containerRef` for the Sigma mount target.

**Effect 1 — data fetch** (unchanged logic):
- POST `/api/ts-analysis` with `{ repoPath, hideTestFiles: true }` (hardcoded)
- Sets `graphData` on success

**Effect 2 — Sigma mount** (depends on `[graphData]`):
1. Build a Graphology `Graph` from `graphData` (see Section 4)
2. Run `forceAtlas2.assign(graph, { iterations: 200, settings: { gravity: 1, scalingRatio: 2, barnesHutOptimize: true } })`
3. `new Sigma(graph, containerRef.current, sigmaSettings)`
4. Attach drag plugin: `new DragNodePlugin({ sigma })`
5. Attach hover tooltip handlers via `sigma.on('enterNode', ...)` / `sigma.on('leaveNode', ...)`
6. Return cleanup: `dragPlugin.kill(); sigma.kill()`

**JSX:**
```tsx
<div ref={containerRef} style={{ width: '100%', height: 600, borderRadius: 8, border: '1px solid #ccc' }} />
```

No `<svg>`, no `ForcePanel`. Roughly 120 lines total.

---

## 4. Graph Construction & Visual Attributes

Only FUNCTION, CLASS, INTERFACE nodes are included (same `SYMBOL_KINDS` filter as today). Only edges where both endpoints are symbol nodes are included.

**Node attributes (Sigma reads `size` and `color` natively):**

| Kind | Color | Size |
|---|---|---|
| `FUNCTION` | `#3b82f6` | 6 |
| `CLASS` | `#8b5cf6` | 10 |
| `INTERFACE` | `#10b981` | 8 |

Node degree-based sizing from the current implementation is dropped — fixed sizes per kind. Can be revisited later.

Initial `x`/`y` assigned via `Math.random()` before ForceAtlas2 runs (layout overwrites these).

**Edge attributes:**

Only edges where both endpoints are symbol nodes survive the filter. In practice this means `call` (FUNCTION→FUNCTION) and `uses` (CLASS/INTERFACE→CLASS/INTERFACE). `import`, `contains`, and `export` edges are all filtered out because their endpoints include FILE, FOLDER, or IMPORT nodes.

| Type | Color | Size |
|---|---|---|
| `call` | `#fcd34d` | 1.5 |
| `uses` | `#f9a8d4` | 1 |

---

## 5. Layout

`forceAtlas2.assign(graph, { iterations: 200 })` runs synchronously before Sigma mounts.

Settings:
- `gravity: 1`
- `scalingRatio: 2`
- `barnesHutOptimize: true`

200 iterations produces a settled layout for typical repo sizes. No animation — the graph appears already laid out.

---

## 6. Interactions

**Zoom/pan:** Native to Sigma. Mouse wheel zooms, click-drag on canvas pans. No extra code.

**Node drag:** `@sigma/plugin-drag-nodes`. Nodes stay where dropped — no forces to pull them back.

**Hover tooltip:** A `position: absolute` `<div>` overlaid on the container. Shown/hidden via `sigma.on('enterNode')` / `sigma.on('leaveNode')`. Content: `KIND: name`. Positioned using `sigma.getNodeDisplayData(node).x/y` converted to screen coordinates via `sigma.graphToViewport()`.

---

## 7. Out of Scope

- Animated layout (ForceAtlas2 in web worker)
- Search / node highlight
- Configurable force or style rules
- Degree-based node sizing (dropped for now, hardcoded per kind)
- Label rendering (Sigma renders labels natively — can be enabled later via settings)
