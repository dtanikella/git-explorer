# Layout Restructuring & Cleanup

## Problem

The app currently renders several unused visualization components (ForceDirectedGraph, CirclePackingGraph, FileOccurrenceTable) alongside the primary TsGraph. ForcePanel is a sidebar that clutters the TsGraph area. The layout doesn't maximize space for TsGraph, and the repo selector is conditionally hidden. The `lib/treemap/` library exists only to support the removed components.

## Approach

Remove all unused components and the treemap library. Restructure the page into three fixed rows — repo selector, tools/filters toolbar, and a full-bleed TsGraph — using a full-viewport flexbox layout.

## Deletions

### Components to delete
- `app/components/force-directed-graph.tsx`
- `app/components/circle-packing-graph.tsx`
- `app/components/FileOccurrenceTable.tsx`
- `app/components/FileOccurrenceTable.css`
- `app/components/ts-graph/ForcePanel.tsx`
- `app/components/df.csv`
- `app/components/flare-2.json`

### Library to delete
- `lib/treemap/color-scale.ts`
- `lib/treemap/data-transformer.ts`
- `lib/treemap/file-type-colors.ts`

### Tests to delete (or update)
- `__tests__/components/TreemapChart.test.tsx`
- `__tests__/unit/data-transformer.test.ts`
- `__tests__/unit/file-type-colors.test.ts`
- Any test imports referencing deleted components

### Libraries to keep
- `lib/git/` — git analysis
- `lib/sentry/` — error tracking
- `lib/ts/` — TypeScript graph types, rules, presets
- `lib/utils/` — date helpers

## New Page Layout

```
┌─────────────────────────────────────────────┐
│  Repository Path [input]  [Analyze] [Browse] │  ← always visible, fixed height
├─────────────────────────────────────────────┤
│  Tools & Filters:                            │  ← new toolbar row, fixed height
│  [Date Range ▾]  [☐ Hide test files]         │
│  [🔍 Search node...]                         │
├─────────────────────────────────────────────┤
│                                              │
│                 TsGraph                      │  ← flex-1, fills all remaining
│          (full width × remaining height)     │    viewport space
│                                              │
└─────────────────────────────────────────────┘
```

### Outer container
- `<main>` uses `h-screen flex flex-col` to fill the viewport.
- No `max-w-6xl` constraint — full width.

### Row 1: Repository Selector
- Always rendered (even with no repo selected).
- Fixed height, full width, minimal vertical padding.

### Row 2: Tools & Filters Toolbar
- A horizontal bar containing:
  - **DateRangeSelector** — the existing component, left-aligned.
  - **Hide test files** toggle — checkbox, migrated from ForcePanel.
  - **Search node** input — text field + search button, migrated from ForcePanel.
- Always rendered. Controls that depend on a repo being loaded are disabled when `repoPath` is empty.

### Row 3: TsGraph
- `flex-1` with `min-h-0` to fill all remaining vertical space.
- Full width (no max-width cap).
- Rendered always; shows empty/loading state when no repo is selected.
- TsGraph receives `hideTestFiles` and a `searchNode` callback as props (lifted from ForcePanel).

## State Changes in `page.tsx`

### Removed state
- `graphData` (CoChangeGraph) — no longer needed
- `windowSize` — no longer needed
- `fetchGraphData()` — no longer needed

### Kept state
- `repoPath` — drives repo selection
- `dateRange` — lives in toolbar, available for future use

### New state (lifted from ForcePanel)
- `hideTestFiles: boolean` — passed to TsGraph
- `searchQuery: string` — managed in toolbar, triggers `onSearchNode` on TsGraph

## TsGraph Changes

- Remove `ForcePanel` import and rendering from TsGraph.
- Accept new props: `hideTestFiles` (boolean, parent-owned) and `onSearchNode` (callback the parent can invoke to pan/zoom to a node).
- TsGraph already manages its own `hideTestFiles` state internally — this will be lifted to the parent so the toolbar toggle controls it.
- The SVG should size itself to fill its container (use `width="100%" height="100%"` or measure the container).

## Files Modified

1. **`app/page.tsx`** — complete rewrite of layout and state
2. **`app/components/ts-graph/TsGraph.tsx`** — remove ForcePanel, accept lifted props, fill container
