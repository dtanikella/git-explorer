# Tasks: Activity Graph Visualization

**Input**: Design documents from `/specs/003-activity-graph-view/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/  
**Feature Branch**: `003-activity-graph-view`

**Tests**: Following TDD (Constitution Principle I), all tests written FIRST before implementation.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4, US5)
- All paths use Next.js App Router structure

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install dependencies and prepare environment

- [x] T001 Install d3-force, d3-zoom, d3-scale packages via npm
- [x] T002 Install TypeScript type definitions @types/d3-force, @types/d3-zoom, @types/d3-scale
- [x] T003 Verify installation and run npm list to confirm d3 packages installed

**Checkpoint**: Dependencies installed, project ready for implementation

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core utilities that all user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Tests for Foundational (TDD - Write FIRST)

- [x] T004 [P] Write unit tests for getFileTypeColor() in __tests__/unit/file-type-colors.test.ts
- [x] T005 [P] Write unit tests for transformTreeToGraph() in __tests__/unit/data-transformer.test.ts

### Implementation for Foundational

- [x] T006 Implement getFileTypeColor() function in lib/treemap/file-type-colors.ts
- [x] T007 Export FILE_TYPE_COLORS and TEST_PATTERNS constants in lib/treemap/file-type-colors.ts
- [x] T008 Implement transformTreeToGraph() function in lib/treemap/data-transformer.ts
- [x] T009 Export GraphNode interface in lib/treemap/data-transformer.ts

**Checkpoint**: Utilities tested and working - user story implementation can now begin in parallel

---

## Phase 3: User Story 5 - Reuse Existing Controls (Priority: P1) 🎯 MVP Foundation

**Goal**: Enable view toggle UI so users can switch between Heatmap and Activity Graph

**Independent Test**: User can click toggle, state changes, conditional rendering works (even if Activity Graph shows placeholder initially)

### Tests for User Story 5 (TDD - Write FIRST)

- [x] T010 [P] [US5] Write component tests for ViewToggle in __tests__/components/ViewToggle.test.tsx
- [ ] T011 [P] [US5] Write integration tests for view switching in __tests__/integration/view-switching.test.tsx

### Implementation for User Story 5

- [x] T012 [US5] Create ViewToggle component in app/components/ViewToggle.tsx
- [x] T013 [US5] Add viewMode state to page component in app/page.tsx
- [x] T014 [US5] Add ViewToggle to page layout in app/page.tsx
- [x] T015 [US5] Implement conditional rendering for TreemapChart vs placeholder in app/page.tsx
- [ ] T016 [US5] Verify existing controls (RepositorySelector, DateRangeSelector) work with view toggle

**Checkpoint**: View toggle functional, both views share same repository/date controls

---

## Phase 4: User Story 1 - View Activity Graph (Priority: P1) 🎯 MVP Core

**Goal**: Render force-directed graph with bubbles sized by commit frequency

**Independent Test**: Select repository and time range, Activity Graph displays bubbles with correct sizes and positions

### Tests for User Story 1 (TDD - Write FIRST)

- [x] T017 [P] [US1] Write component tests for ForceGraphChart rendering in __tests__/components/ForceGraphChart.test.tsx
- [x] T018 [P] [US1] Write tests for force simulation initialization in __tests__/components/ForceGraphChart.test.tsx
- [x] T019 [P] [US1] Write tests for bubble sizing in __tests__/components/ForceGraphChart.test.tsx

### Implementation for User Story 1

- [x] T020 [US1] Create ForceGraphChart component skeleton in app/components/ForceGraphChart.tsx
- [x] T021 [US1] Implement data transformation from TreeNode to GraphNode array in ForceGraphChart
- [x] T022 [US1] Implement radius scaling using d3.scaleSqrt in ForceGraphChart
- [x] T023 [US1] Initialize d3.forceSimulation with collision, center, and charge forces in ForceGraphChart
- [x] T024 [US1] Implement 200-tick warmup before displaying nodes in ForceGraphChart
- [x] T025 [US1] Render SVG with circles for each file node in ForceGraphChart
- [x] T026 [US1] Set circle radius based on commitCount in ForceGraphChart
- [x] T027 [US1] Implement simulation tick handler with alpha threshold stop in ForceGraphChart
- [x] T028 [US1] Handle empty data case with "No data" message in ForceGraphChart
- [x] T029 [US1] Replace placeholder with ForceGraphChart in app/page.tsx conditional rendering
- [x] T029a [US1] Set ForceGraphChart dimensions to match TreemapChart viewport size in app/page.tsx

**Checkpoint**: Activity Graph displays files as bubbles with correct sizing and force layout

---

## Phase 5: User Story 3 - Distinguish File Types by Color (Priority: P3)

**Goal**: Color bubbles by file type (ruby red for .rb, light blue for .tsx, gray for tests/others)

**Independent Test**: Analyze repository with mixed file types, verify colors match specification

### Tests for User Story 3 (TDD - Write FIRST)

- [x] T030 [P] [US3] Write tests for .rb file coloring in __tests__/components/ForceGraphChart.test.tsx
- [x] T031 [P] [US3] Write tests for .tsx file coloring in __tests__/components/ForceGraphChart.test.tsx
- [x] T032 [P] [US3] Write tests for test file detection and coloring in __tests__/components/ForceGraphChart.test.tsx

### Implementation for User Story 3

- [x] T033 [US3] Apply getFileTypeColor() to each node during transformation in ForceGraphChart
- [x] T034 [US3] Set circle fill attribute using node.color in ForceGraphChart SVG rendering
- [x] T035 [US3] Update ColorLegend to accept mode prop in app/components/ColorLegend.tsx
- [x] T036 [US3] Implement discrete color swatches rendering in ColorLegend component
- [x] T037 [US3] Pass mode="discrete" and color definitions to ColorLegend in app/page.tsx when Activity Graph selected
- [x] T038 [US3] Write component tests for ColorLegend discrete mode in __tests__/components/ColorLegend.test.tsx

**Checkpoint**: Files colored by type, legend shows discrete color meanings

---

## Phase 6: User Story 4 - Pan and Zoom the Graph (Priority: P3)

**Goal**: Enable pan and zoom interactions using d3-zoom

**Independent Test**: Mouse wheel zooms, drag pans, double-click resets position

### Tests for User Story 4 (TDD - Write FIRST)

- [x] T039 [P] [US4] Write tests for zoom behavior initialization in __tests__/components/ForceGraphChart.test.tsx
- [x] T040 [P] [US4] Write tests for zoom scale extent limits in __tests__/components/ForceGraphChart.test.tsx
- [x] T041 [P] [US4] Write tests for reset zoom functionality in __tests__/components/ForceGraphChart.test.tsx

### Implementation for User Story 4

- [x] T042 [US4] Create SVG ref and zoom behavior ref in ForceGraphChart
- [x] T043 [US4] Initialize d3.zoom with scaleExtent [0.5, 5.0] in ForceGraphChart
- [x] T044 [US4] Attach zoom behavior to SVG element in ForceGraphChart useEffect
- [x] T045 [US4] Apply zoom transform to graph container group on zoom events in ForceGraphChart
- [x] T046 [US4] Implement double-click reset handler in ForceGraphChart
- [x] T047 [US4] Add cursor style changes for visual feedback in ForceGraphChart
- [x] T048 [US4] Clean up zoom behavior on component unmount in ForceGraphChart

**Checkpoint**: Pan and zoom fully functional, smooth interactions at 30+ FPS

---

## Phase 7: User Story 2 - Toggle Between Visualization Types (Priority: P2)

**Goal**: Ensure seamless switching between views with data persistence

**Independent Test**: Toggle between views multiple times, verify data consistency

### Tests for User Story 2 (TDD - Write FIRST)

- [x] T049 [P] [US2] Write tests for view toggle state persistence in __tests__/integration/view-switching.test.tsx
- [x] T050 [P] [US2] Write tests for data sharing between views in __tests__/integration/view-switching.test.tsx
- [x] T051 [P] [US2] Write tests for control state persistence across toggle in __tests__/integration/view-switching.test.tsx

### Implementation for User Story 2

- [x] T052 [US2] Verify treeData is shared between TreemapChart and ForceGraphChart in app/page.tsx
- [x] T053 [US2] Verify repository selection updates both views in app/page.tsx
- [x] T054 [US2] Verify time range selection updates both views in app/page.tsx
- [x] T055 [US2] Add loading state handling for Activity Graph in app/page.tsx
- [x] T056 [US2] Verify ViewToggle disabled during loading in app/page.tsx

**Checkpoint**: Both views fully integrated, data and controls synchronized

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Enhancements and refinements across all user stories

- [x] T057 [P] Add file name text labels to bubbles in ForceGraphChart (show when radius > 15px)
- [x] T058 [P] Implement text truncation with ellipsis for long filenames in ForceGraphChart
- [x] T059 [P] Add ARIA labels for accessibility in ViewToggle component
- [x] T060 [P] Add ARIA labels for accessibility in ForceGraphChart
- [x] T061 Optimize force simulation parameters for faster stabilization in ForceGraphChart
- [x] T062 Add edge case handling for 1-2 files in ForceGraphChart
- [x] T063 Add edge case handling for all files same commit count in ForceGraphChart
- [x] T064 Add responsive sizing updates on window resize in app/page.tsx
- [x] T065 Performance testing with 100 files to verify 2-second render target
- [x] T066 Verify all acceptance scenarios from spec.md
- [x] T067 Run full test suite with npm test
- [x] T068 Run quickstart.md validation steps
- [x] T069 Update README.md with Activity Graph feature documentation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - start immediately
- **Foundational (Phase 2)**: Depends on Setup - BLOCKS all user stories
- **User Story 5 (Phase 3)**: Depends on Foundational - MVP foundation (toggle UI)
- **User Story 1 (Phase 4)**: Depends on Foundational + US5 - MVP core (graph rendering)
- **User Story 3 (Phase 5)**: Depends on US1 - adds coloring to existing graph
- **User Story 4 (Phase 6)**: Depends on US1 - adds interactions to existing graph
- **User Story 2 (Phase 7)**: Depends on US1, US5 - validates integration
- **Polish (Phase 8)**: Depends on all user stories

### User Story Dependencies

```
Setup (Phase 1)
    ↓
Foundational (Phase 2)
    ↓
    ├─→ US5: View Toggle (Phase 3) ─→ US2: Toggle Integration (Phase 7)
    │                    ↓
    └─→ US1: Activity Graph (Phase 4) ─→ US3: Colors (Phase 5)
                         ↓                           ↓
                         └─→ US4: Pan/Zoom (Phase 6)─┘
                                          ↓
                                   Polish (Phase 8)
```

### Within Each User Story

1. **Tests FIRST** (TDD - Constitution Principle I)
2. Models/utilities before components
3. Component skeleton before features
4. Core features before polish
5. Integration before moving to next story

### Parallel Opportunities

**Phase 1 (Setup)**: All 3 tasks can run in sequence (npm install dependencies)

**Phase 2 (Foundational)**:
- T004 and T005 (test writing) in parallel
- T006 and T007 (file-type-colors.ts) in parallel
- T008 and T009 (data-transformer.ts) after tests pass

**Phase 3 (US5)**:
- T010 and T011 (test writing) in parallel
- T012 can start while tests are being written
- T013-T016 in sequence (page modifications)

**Phase 4 (US1)**:
- T017, T018, T019 (test writing) in parallel
- T020-T029 in sequence (component building)

**Phase 5 (US3)**:
- T030, T031, T032 (test writing) in parallel
- T033-T037 in sequence
- T038 in parallel with implementation

**Phase 6 (US4)**:
- T039, T040, T041 (test writing) in parallel
- T042-T048 in sequence (zoom implementation)

**Phase 7 (US2)**:
- T049, T050, T051 (test writing) in parallel
- T052-T056 in sequence (integration validation)

**Phase 8 (Polish)**:
- T057, T058, T059, T060 (UI enhancements) in parallel
- T061-T064 in parallel (refinements)
- T065-T069 in sequence (validation)

---

## Parallel Example: Foundational Phase

```bash
# Terminal 1: Write file-type-colors tests
npm test -- --watch file-type-colors.test.ts

# Terminal 2: Write data-transformer tests  
npm test -- --watch data-transformer.test.ts

# After tests written and failing, implement in parallel:
# Terminal 1: Implement file-type-colors.ts
# Terminal 2: Implement data-transformer.ts
```

---

## Parallel Example: User Story 1

```bash
# Terminal 1: Write and watch component tests
npm test -- --watch ForceGraphChart.test.tsx

# Terminal 2: Implement ForceGraphChart component
# Edit app/components/ForceGraphChart.tsx

# Terminal 3: Run dev server to see visual progress
npm run dev
```

---

## MVP Scope Recommendation

**Minimum Viable Product (MVP)**: Phases 1-4 only

- ✅ Phase 1: Setup (dependencies installed)
- ✅ Phase 2: Foundational (utilities working)
- ✅ Phase 3: US5 - View Toggle (can switch views)
- ✅ Phase 4: US1 - Activity Graph (graph renders with bubbles)

This delivers:
- Working force-directed graph visualization
- Toggle between Heatmap and Activity Graph  
- Bubbles sized by commit frequency
- Basic force layout with collision detection

**Post-MVP Enhancements** (Phases 5-8):
- Phase 5: US3 - File type colors
- Phase 6: US4 - Pan and zoom
- Phase 7: US2 - Integration validation
- Phase 8: Polish and documentation

---

## Summary

- **Total Tasks**: 70
- **Setup Tasks**: 3
- **Foundational Tasks**: 6
- **User Story Tasks**: 50 (distributed across US1-US5)
- **Polish Tasks**: 10

**Task Distribution by User Story**:
- US5 (View Toggle - P1): 7 tasks
- US1 (Activity Graph - P1): 14 tasks  
- US3 (File Colors - P3): 9 tasks
- US4 (Pan/Zoom - P3): 10 tasks
- US2 (Integration - P2): 8 tasks
- Foundational (Blocking): 6 tasks
- Polish (Final): 10 tasks

**Estimated Parallel Windows**:
- Tests can be written in parallel within each phase
- US3, US4 partially parallelizable (different parts of ForceGraphChart)
- Polish tasks highly parallelizable

**Critical Path**: Setup → Foundational → US5 → US1 → (US3 + US4) → US2 → Polish

**TDD Compliance**: ✅ All 31 test tasks must be written and failing BEFORE implementation tasks
