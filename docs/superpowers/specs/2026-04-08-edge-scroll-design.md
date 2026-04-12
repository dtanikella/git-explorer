# Edge Differentiation & ForcePanel Scroll Design

**Date:** 2026-04-08
**Branch:** 005-ts-graph

## Overview

Two changes to the TsGraph visualization:

1. **ForcePanel scrollability** — fix the panel height so it is constrained to 600px (matching SVG height) and scrollable.
2. **Call edge differentiation** — distinguish three call edge variants (same-file, cross-file, external) with different colors and physics.

---

## 1. ForcePanel Scrollability

**Problem:** The outer container in `TsGraph.tsx` uses `minHeight: 600`, which allows it to expand with content. The ForcePanel's `height: '100%'` never resolves to a fixed value, so the panel grows beyond 600px instead of scrolling.

**Fix:** Change the outer container from `minHeight: 600` to `height: 600`. The ForcePanel's existing `height: '100%'` and `overflowY: 'auto'` then work correctly — the panel is exactly 600px tall and scrolls internally.

**Files changed:** `app/components/ts-graph/TsGraph.tsx`

---

## 2. Call Edge Differentiation

### 2a. Type Change

Add `callScope` to `CallEdge` in `lib/ts/types.ts`:

```ts
export interface CallEdge extends TsEdgeBase {
  type: 'call';
  callScope: 'same-file' | 'cross-file' | 'external';
}
```

### 2b. Analyzer Logic

When emitting a call edge, the analyzer sets `callScope` at creation time using this priority order:

1. If the target node is an `ImportNode` with `source === 'package'` → `'external'`
2. If the source function and target function share the same parent file node → `'same-file'`
3. Otherwise → `'cross-file'`

**Files changed:** `lib/ts/analyzer.ts`

### 2c. Default Rules

Replace the single `call-edges` rule with three rules. Also update the `import-package` node rule color to blue.

**Edge rules:**

| Rule ID | Match | Color | Distance | Strength |
|---|---|---|---|---|
| `call-same-file` | `e.type === 'call' && e.callScope === 'same-file'` | `#374151` (dark gray) | 30 | 1.0 |
| `call-cross-file` | `e.type === 'call' && e.callScope === 'cross-file'` | `#111827` (black) | 60 | 0.6 |
| `call-external` | `e.type === 'call' && e.callScope === 'external'` | `#3b82f6` (blue) | 100 | 0.3 |

**Node rule update:**

| Rule ID | Field | Old value | New value |
|---|---|---|---|
| `import-package` | `style.color` | `#64748b` | `#3b82f6` |

**Files changed:** `lib/ts/default-rules.ts`

---

## 3. Out of Scope

- No changes to `ForcePanel.tsx` (the panel UI renders rules generically)
- No changes to `TsGraph.tsx` simulation logic (rule evaluators handle the new match conditions)
- No changes to `force-rules.ts` (evaluators already handle `callScope` via the match function)
- External call targets remain as `ImportNode` (package-level), not individual symbol nodes
