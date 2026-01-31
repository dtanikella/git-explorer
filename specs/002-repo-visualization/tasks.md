# Tasks: Interactive Repository Visualization

**Input**: Design documents from `/specs/002-repo-visualization/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- All paths relative to repository root

---

## Phase 1: Setup

**Purpose**: Install dependencies and create project structure

- [ ] T001 Install @visx dependencies: `npm install @visx/hierarchy @visx/zoom @visx/tooltip @visx/group @visx/scale`
- [ ] T002 [P] Create lib/types.ts with FileNode, FileTree, SizingStrategy, ColoringStrategy, API response types
- [ ] T003 [P] Create lib/colors.ts with extension-to-color mapping (12 colors per research.md)
- [ ] T004 [P] Create app/components/ directory structure

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST complete before user story implementation

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Tests for Foundational (TDD - write tests FIRST, verify they FAIL)

- [ ] T005a Write failing test for buildTree() in __tests__/lib/file-tree.test.ts - verify tree structure, node properties, recursive scanning
- [ ] T006a [P] Write failing test for sizing strategies in __tests__/lib/sizing.test.ts - verify fileSizeStrategy returns node.size, uniformStrategy returns 1
- [ ] T007a [P] Write failing test for coloring strategies in __tests__/lib/coloring.test.ts - verify extensionColorStrategy maps extensions to correct colors
- [ ] T008a Write failing integration test for API route in __tests__/api/file-tree.test.ts - verify POST returns FileTree JSON, handles errors

### Implementation for Foundational

- [ ] T005 Implement lib/file-tree.ts with buildTree() function for recursive filesystem scanning (including symlink following, permission skip)
- [ ] T006 [P] Implement lib/strategies/sizing.ts with fileSizeStrategy and uniformStrategy
- [ ] T007 [P] Implement lib/strategies/coloring.ts with extensionColorStrategy
- [ ] T008 Implement app/api/file-tree/route.ts POST handler per contracts/file-tree-api.md
- [ ] T009 Add path validation in API route: empty path, path not found, not a directory, permission denied

**Checkpoint**: Foundation ready - user story implementation can begin

---

## Phase 3: User Story 1 - View Repository Structure (Priority: P1) 🎯 MVP

**Goal**: User enters repo path, sees circle-packing visualization with colored/sized circles

**Independent Test**: Enter a valid repo path → visualization renders with correct hierarchy, colors, sizes

### Tests for User Story 1 (TDD - write tests FIRST, verify they FAIL)

- [ ] T010a [US1] Write failing component test in __tests__/components/CirclePackingChart.test.tsx - verify renders correct number of circles, applies colors, accepts strategy props

### Implementation for User Story 1

- [ ] T010 [US1] Create app/components/CircleNode.tsx - individual circle SVG component with fill color prop (SVG element per FR-010)
- [ ] T011 [US1] Create app/components/CirclePackingChart.tsx - Pack layout using @visx/hierarchy with sizingStrategy and coloringStrategy props
- [ ] T012 [US1] Create app/components/RepoVisualization.tsx - container that receives FileTree and renders CirclePackingChart
- [ ] T013 [US1] Update app/page.tsx - add state for fileTree, loading, error; fetch from /api/file-tree on submit
- [ ] T014 [US1] Style folder circles as semi-transparent containers (FR-012) in CircleNode.tsx
- [ ] T015 [US1] Make visualization responsive to container size using @visx/responsive or CSS

**Checkpoint**: User Story 1 complete - visualization renders with path input

---

## Phase 4: User Story 2 - Explore via Hover (Priority: P1)

**Goal**: User hovers over circle, tooltip shows file/folder details

**Independent Test**: Hover over any circle → tooltip displays name, path, size, extension (or child count for folders)

### Tests for User Story 2 (TDD - write tests FIRST, verify they FAIL)

- [ ] T016a [US2] Write failing component test for tooltip behavior - verify tooltip appears on hover, shows correct content for files vs folders, disappears on mouse leave

### Implementation for User Story 2

- [ ] T016 [US2] Create app/components/Tooltip.tsx using @visx/tooltip TooltipWithBounds
- [ ] T017 [US2] Add useTooltip hook to RepoVisualization.tsx for tooltip state management
- [ ] T018 [US2] Add onMouseEnter/onMouseLeave handlers to CircleNode.tsx that call showTooltip/hideTooltip
- [ ] T019 [US2] Display different tooltip content for files vs folders (size+extension vs child count)
- [ ] T020 [US2] Position tooltip at cursor with TooltipWithBounds for viewport-aware placement

**Checkpoint**: User Story 2 complete - hover shows file/folder details

---

## Phase 5: User Story 3 - Navigate via Pan and Zoom (Priority: P1)

**Goal**: User can zoom in/out and pan across large visualizations

**Independent Test**: Load large repo → scroll to zoom, drag to pan, double-click to reset

### Tests for User Story 3 (TDD - write tests FIRST, verify they FAIL)

- [ ] T021a [US3] Write failing component test for zoom/pan behavior - verify zoom transform applies on wheel, pan on drag, reset on double-click

### Implementation for User Story 3

- [ ] T021 [US3] Wrap CirclePackingChart with @visx/zoom Zoom component in RepoVisualization.tsx
- [ ] T022 [US3] Configure zoom: scaleXMin=0.1, scaleXMax=10, initial transform centered
- [ ] T023 [US3] Add transparent rect overlay for capturing wheel/drag/double-click events
- [ ] T024 [US3] Implement zoom on scroll wheel via zoom.handleWheel
- [ ] T025 [US3] Implement pan on drag via zoom.dragStart/dragMove/dragEnd
- [ ] T026 [US3] Implement reset-to-fit on double-click via zoom.reset()
- [ ] T027 [US3] Wire click handler (no-op) to each CircleNode for future drill-down (FR-024)

**Checkpoint**: User Story 3 complete - pan/zoom navigation works

---

## Phase 6: User Story 4 - Handle Invalid Input (Priority: P2)

**Goal**: Invalid paths show clear, actionable error messages

**Independent Test**: Enter invalid paths → appropriate error messages display

### Tests for User Story 4 (TDD - write tests FIRST, verify they FAIL)

- [ ] T028a [US4] Write failing component test in __tests__/components/PathInput.test.tsx - verify empty path shows error, displays API error messages, shows loading state

### Implementation for User Story 4

- [ ] T028 [US4] Create app/components/PathInput.tsx with text input, submit button, and error display
- [ ] T029 [US4] Add client-side validation: empty path check before API call
- [ ] T030 [US4] Display API error messages (PATH_NOT_FOUND, NOT_A_DIRECTORY, PERMISSION_DENIED) in PathInput
- [ ] T031 [US4] Add loading state indicator during API call
- [ ] T032 [US4] Handle empty repository case: display "Repository is empty" message

**Checkpoint**: User Story 4 complete - error handling works

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final improvements across all user stories

- [ ] T033 [P] Add CSS transitions for smooth zoom/pan (60fps target per SC-006)
- [ ] T034 [P] Verify extension color palette covers all 10+ file types per FR-019
- [ ] T035 Run quickstart.md validation - test full flow with a real repository
- [ ] T036 [P] Add aria-labels to circles for accessibility
- [ ] T037 Code cleanup: remove console.logs, add comments to complex sections

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies - start immediately
- **Phase 2 (Foundational)**: Depends on T001 (visx installed) - BLOCKS all user stories
- **Phase 3-6 (User Stories)**: All depend on Phase 2 completion
  - US1, US2, US3 are all P1 priority - implement in order (US1 → US2 → US3)
  - US4 is P2 priority - can be done after US1 for MVP
- **Phase 7 (Polish)**: After all user stories complete

### User Story Dependencies

- **User Story 1**: Depends on Foundational - core visualization
- **User Story 2**: Depends on US1 (needs CircleNode to add hover handlers)
- **User Story 3**: Depends on US1 (needs visualization to wrap with zoom)
- **User Story 4**: Depends on Foundational API route - can parallel with US1

### Parallel Opportunities per Phase

**Phase 1**:
```
T002 lib/types.ts
T003 lib/colors.ts        } All parallel
T004 app/components/
```

**Phase 2**:
```
T006 lib/strategies/sizing.ts   } Parallel
T007 lib/strategies/coloring.ts }
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Enter path → see visualization
5. Demo/deploy MVP

### Recommended Full Implementation Order

1. **Setup** (T001-T004) → visx installed, types defined
2. **Foundational** (T005-T009) → API works, strategies ready
3. **US1** (T010-T015) → Visualization renders
4. **US4** (T028-T032) → Proper input/error handling (improves UX)
5. **US2** (T016-T020) → Hover tooltips (discoverability)
6. **US3** (T021-T027) → Pan/zoom (navigation)
7. **Polish** (T033-T037) → Final touches

---

## Summary

| Metric | Count |
|--------|-------|
| Total Tasks | 45 |
| Setup Tasks | 4 |
| Foundational Tasks | 9 (4 tests + 5 impl) |
| User Story 1 Tasks | 7 (1 test + 6 impl) |
| User Story 2 Tasks | 6 (1 test + 5 impl) |
| User Story 3 Tasks | 8 (1 test + 7 impl) |
| User Story 4 Tasks | 6 (1 test + 5 impl) |
| Polish Tasks | 5 |
| Test Tasks | 8 |
| Parallel Tasks | 13 |

**MVP Scope**: Phases 1-3 (19 tasks including 5 tests) delivers core visualization with path input

**TDD Compliance**: All phases now have tests positioned BEFORE implementation per Constitution Principle I

**Independent Test Criteria**:
- US1: Visualization renders with hierarchy, colors, sizes
- US2: Tooltips appear with correct file/folder details
- US3: Zoom/pan/reset all work smoothly
- US4: Error messages display for all invalid input cases
