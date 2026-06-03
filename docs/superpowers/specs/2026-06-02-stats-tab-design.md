# Stats Tab Design Spec

**Issue:** #27  
**Date:** 2026-06-02  
**Status:** Approved

## Summary

Add a vertical tab sidebar to the app with two views: "Graph" (existing force-directed visualization) and "Stats" (new interactive treemap). Each tab has its own toolbar. Clicking a treemap node navigates to and highlights it in the force graph.

## Layout

```
┌──────────────────────────────────────┐
│ RepositorySelector (top bar)         │
├────┬─────────────────────────────────┤
│    │ [Toolbar — per-tab controls]    │
│ G  ├─────────────────────────────────┤
│ r  │                                 │
│ a  │  Content area                   │
│ p  │  (Force graph OR Treemap)       │
│ h  │                                 │
│    │                                 │
│ ── │                                 │
│ S  │                                 │
│ t  │                                 │
│ a  │                                 │
│ t  │                                 │
│ s  │                                 │
└────┴─────────────────────────────────┘
```

- **Sidebar:** ~40px wide, dark gray background, vertical icon buttons
- **Active indicator:** Left accent border + lighter background on active tab
- **Icons:** Simple inline SVGs (no external icon library)
- **Default tab:** Graph

## Components

### New Files

| File | Purpose |
|------|---------|
| `app/components/TabSidebar.tsx` | Vertical sidebar with Graph/Stats tab icons |
| `app/components/stats/StatsTreemap.tsx` | D3 treemap visualization |
| `app/components/stats/StatsToolbar.tsx` | Stats-specific toolbar (top N dropdown, hide test files) |

### Modified Files

| File | Changes |
|------|---------|
| `app/page.tsx` | Lift analysis data fetch to page level; manage activeTab, topN, highlightedNodeId state; render TabSidebar + per-tab toolbar + content |
| `app/components/repo-graph/RepoGraph.tsx` | Accept `analysisData` as prop instead of fetching internally; accept optional `highlightedNodeId` prop for cross-tab navigation |

## Data Flow

1. `page.tsx` calls `POST /api/repo-analysis` when `repoPath` or `hideTestFiles` changes
2. `AnalysisResult` stored in page-level state — shared by both tabs
3. Tab switching is instant (no re-fetch)
4. Both Graph and Stats tabs receive `analysisData` as a prop

## Treemap Specification

### Size (Rectangle Area)

`node.referencedAt.length` — number of times the node is called by other symbols.

### Color (Red→White Gradient)

`node.outboundRefs.length` — normalized across visible nodes:
- Most outbound refs = deep red (many dependencies)
- Fewest outbound refs = white (leaf node)
- Scale: `d3.interpolateReds` with linear normalization

### Label

Each rectangle displays:
```
{name}
{filePath}
↗ {referencedAt.length}  ↘ {outboundRefs.length}
```

### Hierarchy

Flat (no directory nesting). Each rectangle = one `AnalysisNode`.

### Filtering

- **Top N dropdown:** Options are 10, 20, 50. Nodes sorted by `referencedAt.length` descending, take top N.
- **Hide test files:** Respects the same toggle as the Graph tab (filters `inTestFile === true` nodes before sorting/slicing).

## Cross-Tab Interaction

1. User clicks a rectangle in the treemap
2. `onNodeSelect(scipSymbol)` callback fires
3. `page.tsx` sets `highlightedNodeId = scipSymbol` and switches to Graph tab
4. `RepoGraph` receives updated `highlightedNodeId` prop
5. RepoGraph zooms to that node and applies highlight ring (reusing existing highlight logic from search)
6. Highlight auto-clears after 1.5s (existing behavior)

## StatsTreemap Technical Details

- **Renderer:** SVG-based (not canvas) — easier interactivity and text labels
- **Tiling:** `d3.treemapSquarify`
- **Responsive:** Uses `ResizeObserver` to fill available container space
- **Tooltip:** On hover, shows full node details (name, file, inbound count, outbound count, syntax type)
- **Animation:** Smooth transitions when top N changes (d3 transition on rect positions/sizes)

## StatsToolbar

- Same styling as existing toolbar row (`bg-gray-50 border border-gray-200 rounded-md text-sm`)
- Controls:
  - "Hide test files" checkbox (synced with Graph tab via shared state)
  - "Show top" dropdown: 10 / 20 / 50

## RepoGraph Refactoring

Current state: `RepoGraph.tsx` fetches data internally via `useEffect`.

New contract:
```typescript
interface RepoGraphProps {
  repoPath: string;
  hideTestFiles: boolean;
  config?: ConfigOrFactory;
  onSearchNode?: (handler: (query: string) => boolean) => void;
  analysisData: AnalysisResult | null;  // NEW: passed from parent
  loading: boolean;                      // NEW: loading state from parent
  error: string | null;                  // NEW: error state from parent
  highlightedNodeId?: string | null;     // NEW: cross-tab highlight
}
```

The internal fetch `useEffect` and `loading`/`error`/`analysisData` state are removed — all provided by parent.

## Testing Strategy

- Unit test: treemap data computation (sorting, filtering, color normalization)
- Component test: StatsTreemap renders correct number of rectangles for given data
- Integration: clicking treemap node triggers callback with correct scipSymbol
- Existing RepoGraph tests updated to pass `analysisData` as prop

## Out of Scope

- Directory-nested treemap hierarchy
- Treemap for edge data
- Persistent tab state across page reloads
- New API endpoints
