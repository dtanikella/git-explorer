# Modules View Design

**Issue:** [#12 — General views](https://github.com/dtanikella/git-explorer/issues/12)
**Scope:** Modules view only. Data view deferred to a follow-up spec.
**Date:** 2026-05-19

## Purpose

Add a "Modules" view to git-explorer that visualizes **where data flows through** a TypeScript codebase by showing functions and methods as nodes connected by call edges. The view answers: which functions orchestrate the most logic (large radius) and which functions are called most frequently (more spacing)?

## Architecture

### Approach: Config-Only with Helper Functions

Uses the existing `mergeConfigs()` and builder pattern in `graph-config.ts` to create a `MODULES_VIEW_CONFIG` preset. No new pipeline stages, components, or API endpoints. The same `AnalysisResult` is reused — the view is purely a client-side config change.

### Components Changed

| File | Change |
|------|--------|
| `lib/analysis/graph-config.ts` | Add helper functions, `MODULES_VIEW_CONFIG` preset, extend `EdgeStyle` |
| `app/components/repo-graph/RepoGraph.tsx` | Support edge gradient rendering |
| `app/page.tsx` | Add view selector dropdown |
| `__tests__/unit/graph-config.test.ts` | Tests for new helpers and config |

## Node Filtering & Sizing

### Filter

Nodes included: `SyntaxType.FUNCTION` and `SyntaxType.METHOD` only, excluding nodes with no cross-file references (same filter pattern as `INTERNAL_PROCESSING_CONFIG`).

Edges included: `EdgeKind.CALLS` only, excluding external edges (calls to library/third-party code).

### Radius (Outbound Calls)

A node's radius is proportional to how many other functions/methods it calls — its **outbound call count**. This makes "orchestrator" functions that coordinate many sub-calls visually larger.

Computed via `countOutboundCalls(node, edges)`: count of CALLS edges where the node is the source.

### Collide Force (Inbound Calls)

A node's collision radius is proportional to how often it's called by other functions — its **inbound reference count**. This gives frequently-called utility functions more breathing room in the layout.

Computed via `countInboundCalls(node)`: `node.referencedAt.length`.

### Scaling

Both radius and collide use a configurable scaling function. Initial implementation uses **log scale** (`Math.log2(count + 1)`) as the default, with linear as an alternative. The scaling decision is deferred until real repository data can be analyzed to understand the actual distribution of call counts.

The scaling function is extracted as a parameter:

```typescript
type ScaleFn = (count: number) => number;

function scaledValue(
  count: number,
  min: number,
  max: number,
  scaleFn: ScaleFn
): number;
```

**Bounds:**
- Radius: min 4px, max 30px
- Collide radius: min 8px, max 40px

## Edge Rendering

### Gradient Direction

Edges render as a **color gradient from light gray (caller) to dark gray (callee)**. This visually communicates call direction without arrowheads.

- Source (caller) color: `#d1d5db` (light gray)
- Target (callee) color: `#374151` (dark gray)

### Implementation

The canvas draw loop uses `ctx.createLinearGradient(sourceX, sourceY, targetX, targetY)` with two color stops.

### EdgeStyle Extension

Add two optional fields to the `EdgeStyle` interface:

```typescript
interface EdgeStyle {
  color: string;
  width: number;
  opacity: number;
  gradientSourceColor?: string;  // NEW — caller side
  gradientTargetColor?: string;  // NEW — callee side
}
```

When `gradientSourceColor` and `gradientTargetColor` are both present, the render loop draws a gradient instead of a flat `color`. This is backward-compatible — existing configs that don't set these fields continue rendering flat.

### Edge Width

Uniform 1.5px. No variation by frequency for this view (avoids visual overload when combined with gradients + node sizing).

## View Switching UI

### Dropdown

A "View" `<select>` dropdown added to `page.tsx` next to the existing controls (repo selector, hide test files checkbox, search bar).

**Options:**
- "Internal Processing" — current `INTERNAL_PROCESSING_CONFIG` (default)
- "Modules" — new `MODULES_VIEW_CONFIG`

### Behavior

- Switching views passes the corresponding config to `RepoGraph` via its existing `config` prop
- No data re-fetch required — same `AnalysisResult`, different config applied client-side
- State: `selectedView` in `page.tsx`, defaulting to `"internal"`
- View name → config mapping is a simple object literal

## Helper Functions

All added to `graph-config.ts`:

### `countOutboundCalls(node: AnalysisNode, edges: AnalysisEdge[]): number`

Counts edges where `edge.fromSymbol === node.scipSymbol` and `edge.kind === EdgeKind.CALLS`.

### `countInboundCalls(node: AnalysisNode): number`

Returns `node.referencedAt.length`.

### `scaledValue(count: number, min: number, max: number, scaleFn?: ScaleFn): number`

Applies the scaling function to the count, then linearly maps the result to the `[min, max]` range. Default `scaleFn` is `Math.log2(count + 1)`.

## MODULES_VIEW_CONFIG

Built via `mergeConfigs(DEFAULT_REPO_GRAPH_CONFIG, overrides)`:

```typescript
export const MODULES_VIEW_CONFIG: RepoGraphConfig = mergeConfigs(
  DEFAULT_REPO_GRAPH_CONFIG,
  {
    filters: {
      node: (n) =>
        [SyntaxType.FUNCTION, SyntaxType.METHOD].includes(n.syntaxType) &&
        hasCrossFileRefs(n),
      edge: (e) =>
        e.kind === EdgeKind.CALLS && !e.isExternal,
    },
    style: {
      node: (node, degree) => ({
        ...defaultNodeStyle(node),
        radius: scaledValue(
          countOutboundCalls(node, /* edges from closure */),
          4, 30
        ),
      }),
      edge: (edge) => ({
        color: '#9ca3af',
        width: 1.5,
        opacity: 0.6,
        gradientSourceColor: '#d1d5db',
        gradientTargetColor: '#374151',
      }),
    },
    forces: {
      node: (node) => ({
        ...defaultNodeForces(),
        collideRadius: scaledValue(
          countInboundCalls(node),
          8, 40
        ),
      }),
    },
  }
);
```

Note: The edge list needed by `countOutboundCalls` will be available via closure or by extending the styler signature to accept edges as context. The exact mechanism depends on the current accessor function signatures in `graph-config.ts` — implementation should follow the existing pattern.

## Testing

### Unit Tests (in `graph-config.test.ts`)

**Helper functions:**
- `countOutboundCalls` — correct count with mixed edge kinds, zero case, multiple calls to same target
- `countInboundCalls` — correct count from referencedAt, zero case
- `scaledValue` — log vs linear scaling, clamping at min/max, zero count, custom scale function

**MODULES_VIEW_CONFIG:**
- Node filter includes FUNCTION and METHOD, excludes INTERFACE/CLASS/TYPE_ALIAS
- Node filter excludes nodes without cross-file refs
- Edge filter includes CALLS, excludes INSTANTIATES/IMPORTS/USES_TYPE
- Edge filter excludes external edges
- Node styler produces radius proportional to outbound calls
- Node forcer produces collide radius proportional to inbound calls
- Edge styler includes gradient colors

### Not Tested (Manual Verification)

- Canvas gradient rendering (visual)
- View dropdown interaction (trivial React state)

## Open Items

- **Scaling function (log vs linear):** Deferred until real data analysis. Implementation supports both; default is log. Easy to swap.
- **Data view:** Separate spec, separate implementation cycle.
