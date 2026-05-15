# Integrate Graph View with `/api/repo-analysis` Endpoint

**Issue:** [#21](https://github.com/dtanikella/git-explorer/issues/21)
**Date:** 2026-04-28

## Problem

The current graph visualization (`TsGraph`) uses the old `/api/ts-analysis` endpoint and renders with conditional formatting (colored nodes by kind), client-side filtering (only symbol nodes), degree-based node sizing, and per-kind force rules. Issue #21 requires switching to the new `/api/repo-analysis` endpoint with a simplified, uniform rendering.

## Approach

Create a new standalone `RepoGraph` component that consumes `AnalysisResult` from the `/api/repo-analysis` endpoint. Keep the existing `TsGraph` and all its supporting code intact.

## Data Flow

```
page.tsx
  └─ <RepoGraph repoPath={...} hideTestFiles={true} onSearchNode={...} />
       └─ fetch POST /api/repo-analysis { repoPath, hideTestFiles: true }
            └─ returns { success, data: AnalysisResult }
       └─ adapter: AnalysisResult → SimpleNode[] + SimpleEdge[]
       └─ D3 force simulation (constant params) → canvas render
```

- `RepoGraph` replaces `TsGraph` in `page.tsx`.
- Props: `repoPath: string`, `hideTestFiles: boolean` (default `true`), `onSearchNode`.
- The adapter maps `AnalysisNode.scipSymbol` → node ID, `AnalysisEdge.fromSymbol`/`toSymbol` → edge source/target.
- All nodes are shown regardless of connectivity (no orphan filtering).

## Component: `app/components/repo-graph/RepoGraph.tsx`

Single file, approximately 200–250 lines.

### Internal Types

```typescript
interface SimpleNode extends d3.SimulationNodeDatum {
  id: string;       // AnalysisNode.scipSymbol
  name: string;     // AnalysisNode.name
}

interface SimpleEdge extends d3.SimulationLinkDatum<SimpleNode> {
  source: string;   // AnalysisEdge.fromSymbol
  target: string;   // AnalysisEdge.toSymbol
}
```

### Uniform Styling (No Rules Engine)

- All nodes: gray `#999`, radius `6px`, white `#fff` stroke (1px).
- All edges: gray `#999`, width `1px`, opacity `0.6`.
- No `NODE_COLORS`, `NODE_SIZES`, `EDGE_COLORS`, `EDGE_SIZES` maps.
- No imports from `force-rules.ts` or `default-rules.ts`.

### Constant Force Simulation

| Force | Parameter | Value |
|---|---|---|
| `forceLink` | distance | `80` |
| `forceLink` | strength | `0.5` |
| `forceManyBody` | charge | `-150` |
| `forceCenter` | x, y | canvas center |
| `forceCollide` | radius | `9` (6 + 3 padding) |

No zones, no per-node charge, no per-edge distance, no `fx`/`fy`.

### Canvas Rendering

Same pattern as TsGraph:
- `canvas.getContext('2d')` for drawing.
- `d3.zoom` for pan/zoom.
- `ResizeObserver` for responsive sizing.

### Tooltip

On hover, show the node's `name` from `AnalysisNode`. No kind/type label.

### Search

Same logic as TsGraph:
- Case-insensitive find by name.
- Zoom to matched node.
- Highlight with yellow ring (`#facc15`, 4px stroke) for 1.5 seconds.
- `onSearchNode` callback for registration.

## Page Integration

### `app/page.tsx` Changes

- Import `RepoGraph` from `./components/repo-graph/RepoGraph` instead of `TsGraph`.
- Replace `<TsGraph ... />` with `<RepoGraph ... />`.
- Props remain the same shape: `repoPath`, `hideTestFiles`, `onSearchNode`.
- `hideTestFiles` checkbox stays in the toolbar.

### Code Preserved (Not Deleted)

- `app/components/ts-graph/TsGraph.tsx`
- `lib/ts/force-rules.ts`
- `lib/ts/default-rules.ts`
- `lib/ts/types.ts`
- `app/api/ts-analysis/route.ts`

### No New Dependencies

Uses existing `d3` and types from `@/lib/analysis/types`.

## Acceptance Criteria Mapping

| Criterion | How Addressed |
|---|---|
| Use `/repo-analysis` endpoint | Fetch target changed |
| Default to hiding test files | `hideTestFiles` defaults to `true` in page.tsx checkbox |
| No conditional formatting | Uniform gray for all nodes and edges |
| No filtering | All nodes and edges rendered, no orphan removal |
| No node sizing / edge length regulation | Constant radius (6px), constant link distance (80) |
| No force rules | Constant charge/strength/distance, no rules engine |
