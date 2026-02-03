# Implementation Plan: Co-Change Network Visualization

**Branch**: `004-cochange-network` | **Date**: 2026-02-01 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/004-cochange-network/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Convert the activity graph from independent bubbles to a network visualization showing file co-change relationships through commit co-occurrence analysis. Implementation follows a three-phase approach: (1) Refactor ForceGraphChart component to match Observable's force-directed graph example with hardcoded data, implementing continuous tick-based simulation and interactive node dragging. (2) Build isolated co-occurrence calculation utility that analyzes commit records and generates file pair frequency data. (3) Integrate real git data by modifying the API to include commit records, connecting the utility to the visualization, reducing file limit to 50, and applying visual encodings (line thickness 1-5px, distance 10-100px) based on co-change frequency.

## Technical Context

**Language/Version**: TypeScript 5.x with Next.js 16.1.6 (React 19.2.3)
**Primary Dependencies**: D3.js (d3-force 3.0.0, d3-scale 4.0.2, d3-zoom 3.0.0, d3-selection via imports), simple-git 3.30.0 for git operations
**Storage**: N/A (no persistent storage, data computed on-demand from git repository)
**Testing**: Jest 30.2.0 with @testing-library/react 16.3.2, ts-jest 29.4.6 for TypeScript support
**Target Platform**: Web browser (Next.js server-side + client-side React components)
**Project Type**: Web application with Next.js App Router (app/ directory structure)
**Performance Goals**: Render 50 nodes with links in <3 seconds, maintain 60fps during node dragging interactions
**Constraints**: Top 50 files only (reduced from 100), commit data must fit in HTTP response, force simulation must stabilize within reasonable time
**Scale/Scope**: Single repository analysis, typical repos with hundreds to thousands of files/commits, display limited to top 50 active files

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principle I: Test-First (TDD) — NON-NEGOTIABLE
- ✅ **PASS**: All three phases include test-first requirements in spec acceptance scenarios
- **Evidence**: User Story 1 requires testing graph rendering with example data, User Story 2 requires unit testing co-occurrence utility with sample data, User Story 3 requires integration testing with real repository data
- **Action**: Each phase begins with test creation before implementation

### Principle II: Simplicity (YAGNI)
- ✅ **PASS**: Feature follows incremental approach, building only what's needed per phase
- **Evidence**: Phase 1 uses hardcoded example data (no premature data integration), Phase 2 builds standalone utility (no coupling to visualization), Phase 3 connects only when both parts proven
- **Out of scope**: Properly limits feature to co-change links only (no directory structure, AST parsing, filtering UI, animations)

### Principle III: User Experience First
- ✅ **PASS**: Maintains existing UX flow (repository selection → analyze → visualization)
- **Evidence**: FR-004 explicitly requires preserving user navigation flow during Phase 1, SC-004 sets performance target <3 seconds, SC-005 ensures interactive dragging works smoothly
- **Risk mitigation**: Phased approach prevents breaking existing functionality

### Principle IV: Visual Clarity
- ✅ **PASS**: Visual encoding requirements are explicit and measurable
- **Evidence**: FR-003 defines line thickness range (1-5px), FR-012 defines distance range (10-100px), FR-003 specifies rendering order (links beneath nodes for hierarchy)
- **Progressive disclosure**: Shows network relationships at-a-glance through line thickness/distance, users can drag to explore

**Gate Decision**: ✅ **PROCEED TO PHASE 0** - All principles satisfied, no violations to track

---

## Phase 0: Research Complete ✅

**Output**: [research.md](research.md)

**Key Decisions Documented**:
1. D3 force-directed graph pattern: Continuous tick-based updates with React integration
2. Co-occurrence algorithm: Map-based pair counting with O(C × F²) complexity
3. Visual encoding scales: Linear scales for stroke width [1, 5]px and distance [100, 10]px

**All NEEDS CLARIFICATION items resolved** - No unknowns remain for implementation.

---

## Phase 1: Design & Contracts Complete ✅

**Outputs**:
- [data-model.md](data-model.md) - Entity definitions for GraphNode, GraphLink, GraphData
- [contracts/co-occurrence-utility.md](contracts/co-occurrence-utility.md) - Co-occurrence calculation API
- [contracts/force-graph-component.md](contracts/force-graph-component.md) - ForceGraphChart component v2.0.0 API
- [quickstart.md](quickstart.md) - Developer onboarding guide
- Agent context updated with D3.js, force simulation, and graph visualization technologies

**Constitution Re-Check (Post-Design)**:

### Principle I: Test-First (TDD) — NON-NEGOTIABLE
- ✅ **PASS**: All contracts include explicit testing requirements
- **Evidence**: Co-occurrence utility contract lists 8 required test cases, ForceGraphChart contract lists 9 required test cases, data model includes edge case testing table
- **Implementation requirement**: Tests must be written and failing before implementation code

### Principle II: Simplicity (YAGNI)
- ✅ **PASS**: Design maintains minimal scope, no premature abstraction
- **Evidence**: Co-occurrence utility is single-purpose function (not a class), no caching/memoization added prematurely, no server-side optimization until proven needed
- **Avoided complexity**: No abstract graph framework, no separate link filtering UI, no animation system

### Principle III: User Experience First
- ✅ **PASS**: Design preserves existing UX patterns and adds smooth interactions
- **Evidence**: Component contract specifies 60fps target, drag interactions update in real-time, empty state provides clear user guidance
- **Performance targets**: <3 second render, smooth dragging, graceful degradation for edge cases

### Principle IV: Visual Clarity
- ✅ **PASS**: Visual encoding rules are explicit and measurable
- **Evidence**: Stroke width range [1, 5]px documented, distance range [10, 100]px documented, rendering order specified (links beneath nodes), label truncation rules defined
- **Consistent patterns**: File type colors maintained from existing implementation, hover effects consistent with current design

**Final Gate Decision**: ✅ **PROCEED TO PHASE 2 TASKS** - Design complete, all principles satisfied

---

## Phase 2: Task Generation (Not in /speckit.plan scope)

Task breakdown is handled by the `/speckit.tasks` command, which creates `tasks.md` with:
- Granular implementation tasks organized by phase
- Test-first requirements for each task
- Dependencies and sequencing
- Acceptance criteria per task

**Next Command**: Run `/speckit.tasks` to generate detailed task breakdown for implementation.

---

## Summary

**Branch**: `004-cochange-network`
**Status**: Planning complete, ready for task generation

**Deliverables Created**:
- ✅ Implementation plan (this file)
- ✅ Technical research with decisions
- ✅ Data model with entity definitions
- ✅ API/component contracts
- ✅ Developer quickstart guide
- ✅ Agent context updated

**Constitution Compliance**: All principles satisfied, no violations

**Next Steps**:
1. Run `/speckit.tasks` to generate task breakdown
2. Begin Phase 1 implementation (visualization refactor with example data)
3. Follow TDD: Write failing tests before implementation code
4. Proceed through Phase 2 (co-occurrence utility) and Phase 3 (integration) sequentially

**Key Technical Decisions**:
- Continuous tick-based force simulation (Observable pattern)
- Map-based co-occurrence calculation with sorted pair keys
- Linear scales for visual encoding (stroke width and link distance)
- Three-phase implementation: visualization → utility → integration

## Project Structure

### Documentation (this feature)

```text
specs/004-cochange-network/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── README.md
│   ├── co-occurrence-utility.md
│   └── force-graph-component.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
# Next.js Web Application Structure
app/
├── components/
│   └── ForceGraphChart.tsx          # MODIFY: Refactor to network graph with links
├── page.tsx                          # MODIFY: Wire co-occurrence data to graph
└── api/
    └── git-analysis/
        └── route.ts                  # MODIFY: Include commits in API response

lib/
├── git/
│   ├── analyzer.ts                   # MODIFY: Reduce top files limit to 50
│   ├── types.ts                      # EXISTING: CommitRecord already defined
│   └── ...
├── treemap/
│   └── data-transformer.ts           # MODIFY: Add graph data transformation
└── utils/
    └── data-helpers.ts               # CREATE: Co-occurrence calculation utility

__tests__/
├── components/
│   └── ForceGraphChart.test.tsx      # MODIFY: Update tests for network graph
├── unit/
│   └── data-helpers.test.ts          # CREATE: Co-occurrence utility tests
└── integration/
    └── cochange-integration.test.ts  # CREATE: End-to-end integration tests
```

**Structure Decision**: Next.js App Router web application. Feature modifies existing ForceGraphChart component and supporting utilities rather than creating new top-level directories. Co-occurrence logic lives in `lib/utils/data-helpers.ts` as general-purpose utility. Tests follow existing structure: component tests in `__tests__/components/`, unit tests in `__tests__/unit/`, integration tests in `__tests__/integration/`.

## Complexity Tracking

> **No violations detected** - All constitution principles satisfied without compromise.

This feature maintains simplicity through phased implementation, follows TDD by requiring tests before code, preserves user experience by keeping existing navigation flow, and ensures visual clarity through explicit visual encoding requirements.
