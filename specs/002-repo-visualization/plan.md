# Implementation Plan: Interactive Repository Visualization

**Branch**: `002-repo-visualization` | **Date**: January 31, 2026 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-repo-visualization/spec.md`

## Summary

Build an interactive circle-packing visualization for local git repositories. Users enter an absolute path to a repository, and the system renders a navigable SVG diagram where folders are parent circles containing child circles (files/subfolders). The visualization supports pluggable sizing and coloring strategies, hover tooltips, and pan/zoom navigation. Implementation uses @visx/hierarchy for React-native circle packing and @visx/zoom for pan/zoom interactions.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)  
**Framework**: Next.js 16.x (App Router)  
**Primary Dependencies**: @visx/hierarchy (circle packing), @visx/zoom (pan/zoom), @visx/tooltip (hover), React 19.x  
**Styling**: Tailwind CSS 4.x  
**Storage**: N/A (reads filesystem on-demand, no persistence)  
**Testing**: Jest 30.x + React Testing Library 16.x (already configured)  
**Target Platform**: Modern browsers (Chrome, Firefox, Safari, Edge) with SVG + ES6+ support  
**Project Type**: Web application (Next.js monorepo)  
**Performance Goals**: 60fps pan/zoom, <5s initial render for repos under 5,000 files, <100ms tooltip appearance  
**Constraints**: Render full tree (no lazy loading), SVG-based for crisp zoom, filesystem access via API route  
**Scale/Scope**: Repositories up to 5,000 files for v1; larger repos may have degraded performance (acceptable)

### Performance Architecture (NFR Compliance)

The spec defines non-functional requirements (NFR-001 through NFR-005) for render performance. This section documents the technical approach to satisfy each:

| NFR | Requirement | Technical Approach |
|-----|-------------|-------------------|
| **NFR-001** | Hierarchy computations cached | `useMemo` wrapping `hierarchy().sum().sort()` with `[data, sizingStrategy]` dependencies |
| **NFR-002** | Stable event handler references | `useCallback` for all handlers passed to child components |
| **NFR-003** | Pre-computed colors | `useMemo` building `Map<path, color>` once per data load |
| **NFR-004** | Skip unchanged element re-renders | `React.memo` wrapper on `CircleNode` component |
| **NFR-005** | 60fps rendering architecture | Combined effect of NFR-001 through NFR-004 |

**Implementation Files**:
- `app/components/CirclePackingChart.tsx` — hierarchy caching (NFR-001), color map (NFR-003), stable handlers (NFR-002)
- `app/components/CircleNode.tsx` — memoized component (NFR-004)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| **I. Test-First (TDD)** | ✅ PASS | Plan includes test strategy: unit tests for data transformation (file tree building, sizing/coloring strategies), component tests for visualization, integration tests for API route |
| **II. Simplicity (YAGNI)** | ✅ PASS | Minimal scope: no git integration, no click drill-down UI, no strategy switcher UI. Using established library (@visx) rather than raw D3 to reduce complexity |
| **III. User Experience First** | ✅ PASS | Hover tooltips for discovery, pan/zoom for navigation, clear error messages for invalid paths, responsive visualization. **Performance NFRs ensure smooth 60fps interactions.** |
| **IV. Visual Clarity** | ✅ PASS | Circle packing provides story-at-a-glance (folder structure), color by file type for instant pattern recognition, semi-transparent folders for hierarchy clarity |

**Gate Status**: ✅ All principles satisfied — proceed to Phase 0

---

## Constitution Re-Check (Post-Design)

*Re-evaluated after Phase 1 design artifacts completed.*

| Principle | Status | Post-Design Notes |
|-----------|--------|-------------------|
| **I. Test-First (TDD)** | ✅ PASS | Test files defined in project structure, test strategy documented in research.md |
| **II. Simplicity (YAGNI)** | ✅ PASS | Data model has minimal fields, extensible via `metadata` without over-engineering |
| **III. User Experience First** | ✅ PASS | API provides clear error codes with user-friendly messages per contracts |
| **IV. Visual Clarity** | ✅ PASS | Color palette documented in research.md with rationale for distinctiveness |

**Post-Design Gate Status**: ✅ All principles still satisfied — ready for `/speckit.tasks`

---

## Project Structure

### Documentation (this feature)

```text
specs/002-repo-visualization/
├── plan.md              # This file
├── research.md          # Phase 0 output - library research, patterns
├── data-model.md        # Phase 1 output - FileNode, strategies
├── quickstart.md        # Phase 1 output - getting started guide
├── contracts/           # Phase 1 output - API route schema
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
app/
├── page.tsx                          # Main page with path input + visualization
├── layout.tsx                        # Root layout (existing)
├── globals.css                       # Global styles (existing)
├── api/
│   └── file-tree/
│       └── route.ts                  # API route: scan filesystem, return tree JSON
└── components/
    ├── PathInput.tsx                 # Text input with validation + submit
    ├── RepoVisualization.tsx         # Main visualization container (zoom wrapper)
    ├── CirclePackingChart.tsx        # Circle packing SVG using @visx/hierarchy
    ├── CircleNode.tsx                # Individual circle component with hover
    └── Tooltip.tsx                   # Hover tooltip component

lib/
├── types.ts                          # FileNode, SizingStrategy, ColoringStrategy types
├── file-tree.ts                      # Filesystem scanning logic (server-side)
├── strategies/
│   ├── sizing.ts                     # Default sizing strategy (file size)
│   └── coloring.ts                   # Default coloring strategy (extension-based)
└── colors.ts                         # Extension → color mapping

__tests__/
├── lib/
│   ├── file-tree.test.ts             # Unit: tree building from mock filesystem
│   ├── sizing.test.ts                # Unit: sizing strategy functions
│   └── coloring.test.ts              # Unit: coloring strategy functions
├── api/
│   └── file-tree.test.ts             # Integration: API route
└── components/
    ├── PathInput.test.tsx            # Component: input validation
    └── CirclePackingChart.test.tsx   # Component: rendering with mock data
```

**Structure Decision**: Next.js App Router structure with `app/` for pages/routes and `lib/` for shared utilities. Components co-located in `app/components/`. Tests mirror source structure in `__tests__/`.

## Complexity Tracking

> No constitution violations requiring justification. Design follows YAGNI principles.

---

## Performance Optimization Research

### Problem Analysis

The current implementation exhibits render lag during pan/zoom and hover interactions due to cascading re-renders:

```
User interaction (hover/zoom/pan)
         ↓
Component state change
         ↓
CirclePackingChart re-renders
  → hierarchy() recalculated O(n log n)
  → 1000+ inline callbacks created
         ↓
Every CircleNode re-renders
  → coloringStrategy() called 1000+ times
```

### Solution: Memoization Strategy

**1. Hierarchy Caching (NFR-001)**
```tsx
const root = useMemo(
  () => hierarchy(data).sum(sizingStrategy).sort((a, b) => (b.value ?? 0) - (a.value ?? 0)),
  [data, sizingStrategy]
);
```

**2. Color Map Pre-computation (NFR-003)**
```tsx
const colorMap = useMemo(() => {
  const map = new Map<string, string>();
  const traverse = (node: FileNode) => {
    map.set(node.path, coloringStrategy(node));
    node.children?.forEach(traverse);
  };
  traverse(data);
  return map;
}, [data, coloringStrategy]);
```

**3. Stable Event Handlers (NFR-002)**
```tsx
const handleMouseEnter = useCallback((node: FileNode, e: React.MouseEvent) => {
  showTooltip?.({ tooltipData: node, tooltipLeft: e.clientX, tooltipTop: e.clientY });
}, [showTooltip]);

const handleMouseLeave = useCallback(() => {
  hideTooltip?.();
}, [hideTooltip]);
```

**4. CircleNode Memoization (NFR-004)**
```tsx
export const CircleNode = React.memo<CircleNodeProps>(({ node, fill, onMouseEnter, onMouseLeave, onClick }) => {
  // component body unchanged
});
```

### Expected Impact

| Metric | Before | After (Expected) |
|--------|--------|------------------|
| Hierarchy calc per interaction | O(n log n) | 0 (cached) |
| Color computations per interaction | O(n) | 0 (cached) |
| CircleNode re-renders per interaction | 1000+ | 1-2 (only changed) |
| Frame time (1000 nodes) | 25-40ms | <10ms |
---

## Phase 9: Test Infrastructure Fixes

**Purpose**: Fix Jest configuration conflicts, import path errors, linting issues, and test setup problems

**Independent Test**: All tests pass with `npm test` and no ESLint errors

### Implementation for Test Infrastructure Fixes

- [X] T048 Delete orphaned Jest configs - remove jest.api.config.js and jest.lib.config.js, keep only jest.config.js
- [X] T049 Fix import path in RepoVisualization test - change from '../RepoVisualization' to '../../app/components/RepoVisualization'
- [X] T050 Move global polyfills to jest.setup.js - relocate Request/Response polyfills from RepoVisualization.test.tsx
- [X] T051 Update ESLint config - allow CommonJS require() in Jest config files and any types in component files
- [X] T052 Remove unused test variables - delete unused input variables in PathInput.test.tsx

**Checkpoint**: Test infrastructure fixed - all tests pass without linting errors