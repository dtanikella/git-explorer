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

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| **I. Test-First (TDD)** | ✅ PASS | Plan includes test strategy: unit tests for data transformation (file tree building, sizing/coloring strategies), component tests for visualization, integration tests for API route |
| **II. Simplicity (YAGNI)** | ✅ PASS | Minimal scope: no git integration, no click drill-down UI, no strategy switcher UI. Using established library (@visx) rather than raw D3 to reduce complexity |
| **III. User Experience First** | ✅ PASS | Hover tooltips for discovery, pan/zoom for navigation, clear error messages for invalid paths, responsive visualization |
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
