# Implementation Plan: Activity Graph Visualization

**Branch**: `003-activity-graph-view` | **Date**: 2026-02-01 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/003-activity-graph-view/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Add a force-directed graph visualization as an alternative view to the existing treemap, displaying files as bubbles sized by commit frequency and colored by file type (.rb = ruby red, .tsx = light blue, tests/others = gray). Users can toggle between "Heatmap" and "Activity Graph" views, and interact with the graph via pan and zoom. Implementation uses d3-force for layout, d3-zoom for interactions, and reuses existing RepositorySelector and DateRangeSelector components with the same git-analysis API.

## Technical Context

**Language/Version**: TypeScript 5.x with React 19.2.3  
**Primary Dependencies**: Next.js 16.1.6, d3-force (to be added), d3-zoom (to be added), @visx/hierarchy 3.12.0  
**Storage**: N/A (client-side visualization of server-processed git data)  
**Testing**: Jest 30.2.0 with React Testing Library 16.3.2  
**Target Platform**: Modern web browsers (Chrome, Firefox, Safari, Edge) with JavaScript and SVG support  
**Project Type**: Web application (Next.js with App Router, client-side visualization)  
**Performance Goals**: Force simulation stabilizes within 3 seconds, pan/zoom at 30+ FPS, view toggle within 1 second  
**Constraints**: Maximum 100 files displayed (existing limit), supports up to 100 nodes without performance degradation  
**Scale/Scope**: Single-page application, 5 new user stories, 1 new visualization component, 1 toggle component, 1 color utility

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Test-First (TDD) — NON-NEGOTIABLE
- [x] **GATE**: Tests written and approved before implementation begins
- [x] Unit tests for file-type color mapping utility
- [x] Unit tests for tree-to-graph data transformer
- [x] Component tests for ViewToggle component
- [x] Component tests for ForceGraphChart component
- [x] Integration tests for view switching with data persistence

**Status**: ✅ PASS — Test contracts defined in [contracts/](contracts/). All components will follow TDD with tests written before implementation.

### II. Simplicity (YAGNI)
- [x] **GATE**: No premature abstraction or over-engineering
- [x] Reusing existing components (RepositorySelector, DateRangeSelector)
- [x] Reusing existing API endpoint (git-analysis)
- [x] Reusing existing TreeNode data structure
- [x] Adding only essential d3 dependencies (d3-force, d3-zoom, d3-scale)
- [x] No custom gesture library (using standard mouse/wheel events)
- [x] No link forces between nodes (deferred as optional enhancement per spec)

**Status**: ✅ PASS — Design maintains simplicity. Only 3 new dependencies added (d3-force, d3-zoom, d3-scale). Maximum code reuse achieved.

### III. User Experience First
- [x] **GATE**: Prioritizes end-user experience
- [x] Loading states during force simulation warmup (200 ticks before display)
- [x] Smooth pan and zoom interactions (30+ FPS via d3-zoom)
- [x] Visual feedback during interactions (cursor changes, transform transitions)
- [x] Graceful handling of edge cases (1-2 files, all same commit count)
- [x] Clear view toggle labels ("Heatmap", "Activity Graph")
- [x] Consistent controls across both views (same data, same selectors)
- [x] File names visible when bubble size permits (radius > 15px threshold)

**Status**: ✅ PASS — Design includes warmup strategy for instant appearance, optimized force configuration for 3-second stabilization, and comprehensive UX considerations.

### IV. Visual Clarity
- [x] **GATE**: Clear visual communication
- [x] Consistent color scheme (ruby red #E0115F, light blue #ADD8E6, gray #808080 with semantic meaning)
- [x] Bubble size proportional to commit frequency (square root scale, 2:1 minimum ratio achieved)
- [x] Force layout prevents overlap via collision force (radius + 2px padding)
- [x] File type immediately identifiable by color (discrete legend with labels)
- [x] Legend updated for discrete color swatches in Activity Graph mode
- [x] No unnecessary visual noise (clean bubble + text design)

**Status**: ✅ PASS — Design uses perceptually correct scaling (square root for area), clear color differentiation, and collision detection for visual separation.

### Overall Assessment (Post-Phase 1)
**ALL GATES PASSED** ✅ — Design phase complete. Research resolved all clarifications. Data model, contracts, and architecture align with all constitution principles. Ready to proceed to Phase 2 (task generation via `/speckit.tasks`).

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
# Web application with Next.js App Router
app/
├── components/
│   ├── ColorLegend.tsx           # [EXISTING] Will need update for discrete colors
│   ├── DateRangeSelector.tsx     # [EXISTING] Reused as-is
│   ├── ErrorDisplay.tsx          # [EXISTING] Reused as-is
│   ├── LoadingState.tsx          # [EXISTING] Reused as-is
│   ├── RepositorySelector.tsx    # [EXISTING] Reused as-is
│   ├── TreemapChart.tsx          # [EXISTING] Reused as-is
│   ├── ForceGraphChart.tsx       # [NEW] Force-directed graph visualization
│   └── ViewToggle.tsx            # [NEW] Toggle between Heatmap/Activity Graph
├── page.tsx                      # [MODIFY] Add view state and conditional rendering
├── layout.tsx                    # [EXISTING] No changes
├── globals.css                   # [EXISTING] No changes
└── api/
    └── git-analysis/
        └── route.ts              # [EXISTING] No changes

lib/
├── git/
│   ├── analyzer.ts               # [EXISTING] No changes
│   ├── client-analyzer.ts        # [EXISTING] No changes
│   ├── tree-builder.ts           # [EXISTING] No changes
│   └── types.ts                  # [EXISTING] No changes
├── treemap/
│   ├── color-scale.ts            # [EXISTING] No changes
│   ├── data-transformer.ts       # [MODIFY] Add tree-to-graph transformer
│   └── file-type-colors.ts       # [NEW] File extension to color mapping
└── utils/
    └── date-helpers.ts           # [EXISTING] No changes

__tests__/
├── components/
│   ├── ForceGraphChart.test.tsx  # [NEW] Component tests
│   └── ViewToggle.test.tsx       # [NEW] Component tests
└── unit/
    ├── file-type-colors.test.ts  # [NEW] Color mapping unit tests
    └── data-transformer.test.ts  # [MODIFY] Add graph transformer tests
```

**Structure Decision**: Existing Next.js web application structure. New components added to `app/components/`, new utilities added to `lib/treemap/` (color mapping) and extended in `lib/treemap/data-transformer.ts` (graph transformation). Tests mirror source structure in `__tests__/`.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No complexity violations. All constitution gates passed without exceptions.
