# Tasks: Co-Change Network Visualization

**Input**: Design documents from `/specs/004-cochange-network/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/  
**Feature Branch**: `004-cochange-network`

**Tests**: Following TDD (Constitution Principle I), all tests written FIRST before implementation.

**Organization**: Tasks grouped by user story for independent, phased implementation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- All paths use Next.js App Router structure (app/, lib/, __tests__/)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify dependencies - D3.js packages already installed from previous feature

- [x] T001 Verify d3-force, d3-zoom, d3-scale, d3-selection available via npm list
- [x] T002 Verify @types/d3-force, @types/d3-zoom, @types/d3-scale TypeScript types installed
- [x] T003 Review Observable force-directed graph example at https://observablehq.com/@d3/disjoint-force-directed-graph/2

**Checkpoint**: Dependencies confirmed, reference example understood

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: No foundational tasks - feature builds on existing infrastructure

**⚠️ Note**: This feature modifies existing components rather than creating new foundation. Proceed directly to User Story 1.

---

## Phase 3: User Story 1 - Refactor Visualization with Example Data (Priority: P1) 🎯 MVP Foundation

**Goal**: Display force-directed network graph matching Observable example with hardcoded data, enabling real-time node dragging with connected links updating smoothly

**Independent Test**: Enter any repository path, click "Analyze", verify Activity Graph shows network with nodes connected by visible lines, drag a node to confirm links move in real-time

### Tests for User Story 1 (TDD - Write FIRST)

- [x] T004 [P] [US1] Write test for GraphData structure with nodes and links arrays in __tests__/components/ForceGraphChart.test.tsx
- [x] T005 [P] [US1] Write test for rendering SVG line elements from links array in __tests__/components/ForceGraphChart.test.tsx
- [x] T006 [P] [US1] Write test for links rendered beneath circles (z-order) in __tests__/components/ForceGraphChart.test.tsx
- [x] T007 [P] [US1] Write test for continuous tick callback updating positions in __tests__/components/ForceGraphChart.test.tsx
- [x] T008 [P] [US1] Write test for drag handlers setting fx/fy during drag in __tests__/components/ForceGraphChart.test.tsx
- [x] T009 [P] [US1] Write test for forceLink with distance function in __tests__/components/ForceGraphChart.test.tsx

### Implementation for User Story 1

- [x] T010 [US1] Create hardcoded example GraphData in app/components/ForceGraphChart.tsx (matching Observable structure: nodes with id, links with source/target/value)
- [x] T011 [US1] Update ForceGraphChartProps interface to accept data: GraphData instead of data: TreeNode in app/components/ForceGraphChart.tsx
- [x] T012 [US1] Remove transformTreeToGraph call, use example data directly in app/components/ForceGraphChart.tsx
- [x] T013 [US1] Add forceLink to simulation configuration in app/components/ForceGraphChart.tsx with .id(d => d.id)
- [x] T014 [US1] Replace pre-computed layout with continuous simulation.on("tick", callback) pattern in app/components/ForceGraphChart.tsx
- [x] T015 [US1] Implement tick callback that updates state: setNodes([...nodes]) on each tick in app/components/ForceGraphChart.tsx
- [x] T016 [US1] Add requestAnimationFrame throttling to tick callback for 60fps limit in app/components/ForceGraphChart.tsx
- [x] T017 [US1] Render SVG <line> elements before <circle> elements in app/components/ForceGraphChart.tsx
- [x] T018 [US1] Set line x1/y1/x2/y2 from link.source.x/y and link.target.x/y in app/components/ForceGraphChart.tsx
- [x] T019 [US1] Update drag handlers: set node.fx/fy on dragstart, update during drag, clear on dragend in app/components/ForceGraphChart.tsx
- [x] T020 [US1] Remove maxTicks limit and alpha threshold stop from simulation in app/components/ForceGraphChart.tsx (let it run continuously)
- [x] T021 [US1] Test with example data: verify graph renders with connected nodes in browser at localhost:3000

**Checkpoint**: Network graph displays with example data, nodes draggable with links updating in real-time, regardless of actual repository input

---

## Phase 4: User Story 2 - Build Co-Occurrence Calculation Utility (Priority: P2)

**Goal**: Standalone utility function that analyzes commit records and returns file pair co-occurrence frequencies

**Independent Test**: Call calculateCoOccurrence with sample commits containing known file pairs, verify returned links have correct co-occurrence counts

### Tests for User Story 2 (TDD - Write FIRST)

- [ ] T022 [P] [US2] Write test for basic co-occurrence counting (files A and B in 5 commits) in __tests__/unit/data-helpers.test.ts
- [ ] T023 [P] [US2] Write test for no co-occurrence (files never together) in __tests__/unit/data-helpers.test.ts
- [ ] T024 [P] [US2] Write test for empty commits array returns empty links in __tests__/unit/data-helpers.test.ts
- [ ] T025 [P] [US2] Write test for single file per commit returns no links in __tests__/unit/data-helpers.test.ts
- [ ] T026 [P] [US2] Write test for filtering to fileIds set (excludes files not in set) in __tests__/unit/data-helpers.test.ts
- [ ] T027 [P] [US2] Write test for multiple relationships (A-B, A-C, B-C) in __tests__/unit/data-helpers.test.ts
- [ ] T028 [P] [US2] Write test for symmetric pair handling (AB === BA, only one link) in __tests__/unit/data-helpers.test.ts
- [ ] T029 [P] [US2] Write test for large commit with many files (pair generation) in __tests__/unit/data-helpers.test.ts

### Implementation for User Story 2

- [ ] T030 [US2] Create lib/utils/data-helpers.ts file
- [ ] T031 [US2] Define calculateCoOccurrence function signature in lib/utils/data-helpers.ts: (commits: CommitRecord[], fileIds: Set<string>) => GraphLink[]
- [ ] T032 [US2] Implement Map<string, number> for co-occurrence tracking in lib/utils/data-helpers.ts
- [ ] T033 [US2] Implement nested loop to generate all file pairs from commit.files in lib/utils/data-helpers.ts
- [ ] T034 [US2] Sort file paths before creating map key: [fileA, fileB].sort().join("::") in lib/utils/data-helpers.ts
- [ ] T035 [US2] Filter commit.files to only include files in fileIds set in lib/utils/data-helpers.ts
- [ ] T036 [US2] Increment counter in map for each pair occurrence in lib/utils/data-helpers.ts
- [ ] T037 [US2] Transform map entries to GraphLink[] with {source, target, value} structure in lib/utils/data-helpers.ts
- [ ] T038 [US2] Export calculateCoOccurrence function from lib/utils/data-helpers.ts
- [ ] T039 [US2] Add JSDoc comments to calculateCoOccurrence with examples and complexity notes in lib/utils/data-helpers.ts
- [ ] T040 [US2] Run unit tests: npm test -- data-helpers.test.ts to verify all test cases pass

**Checkpoint**: Co-occurrence utility fully tested and functional in isolation, ready for integration

---

## Phase 5: User Story 3 - Connect Real Repository Data to Graph (Priority: P3) 🎯 Complete Integration

**Goal**: Wire git data through co-occurrence utility to network visualization, displaying actual repository files with relationship links based on commit history

**Independent Test**: Analyze known repository, verify nodes match actual files, links match expected co-change patterns, visual encoding (thickness/distance) reflects relationship strength

### Tests for User Story 3 (TDD - Write FIRST)

- [ ] T041 [P] [US3] Write integration test for full data flow: API → transformer → graph in __tests__/integration/cochange-integration.test.ts
- [ ] T042 [P] [US3] Write test for commits included in API response in __tests__/integration/git-analysis-api.test.ts
- [ ] T043 [P] [US3] Write test for top 50 file limit in __tests__/integration/git-analysis-api.test.ts
- [ ] T044 [P] [US3] Write test for stroke width scale mapping in __tests__/components/ForceGraphChart.test.tsx
- [ ] T045 [P] [US3] Write test for link distance scale mapping (inverse) in __tests__/components/ForceGraphChart.test.tsx
- [ ] T046 [P] [US3] Write test for all links same value edge case (uniform thickness) in __tests__/components/ForceGraphChart.test.tsx

### Implementation for User Story 3

#### Step 1: API Modifications

- [ ] T047 [US3] Change TREEMAP_FILES_LIMIT from 100 to 50 in lib/git/analyzer.ts
- [ ] T048 [US3] Add commits array to API response in app/api/git-analysis/route.ts: { success, data, commits, metadata }
- [ ] T049 [US3] Map commits to include only sha, date, files before sending in app/api/git-analysis/route.ts
- [ ] T050 [US3] Update AnalysisResponse type to include commits?: CommitRecord[] in app/page.tsx

#### Step 2: Data Transformation

- [ ] T051 [P] [US3] Create transformToGraphData function in lib/treemap/data-transformer.ts: (tree: TreeNode, commits: CommitRecord[]) => GraphData
- [ ] T052 [US3] Call transformTreeToGraph to get nodes array in lib/treemap/data-transformer.ts
- [ ] T053 [US3] Extract fileIds Set from nodes array in lib/treemap/data-transformer.ts
- [ ] T054 [US3] Call calculateCoOccurrence(commits, fileIds) to get links array in lib/treemap/data-transformer.ts
- [ ] T055 [US3] Return {nodes, links} as GraphData in lib/treemap/data-transformer.ts
- [ ] T056 [US3] Export transformToGraphData function from lib/treemap/data-transformer.ts

#### Step 3: Visual Encoding Scales

- [ ] T057 [P] [US3] Calculate min/max co-occurrence frequency from links in app/components/ForceGraphChart.tsx
- [ ] T058 [P] [US3] Create strokeWidthScale: d3.scaleLinear().domain([min, max]).range([1, 5]).clamp(true) in app/components/ForceGraphChart.tsx
- [ ] T059 [P] [US3] Create linkDistanceScale: d3.scaleLinear().domain([min, max]).range([100, 10]).clamp(true) in app/components/ForceGraphChart.tsx
- [ ] T060 [US3] Handle edge case: if min === max, use fixed values (3px, 55px) in app/components/ForceGraphChart.tsx
- [ ] T061 [US3] Apply strokeWidth to line elements: strokeWidth={strokeWidthScale(link.value)} in app/components/ForceGraphChart.tsx
- [ ] T062 [US3] Apply distance to forceLink: .distance(d => linkDistanceScale(d.value)) in app/components/ForceGraphChart.tsx

#### Step 4: Component Integration

- [ ] T063 [US3] Remove hardcoded example GraphData from app/components/ForceGraphChart.tsx
- [ ] T064 [US3] Accept real GraphData via props in app/components/ForceGraphChart.tsx
- [ ] T065 [US3] In app/page.tsx, check if commits exist in API response
- [ ] T066 [US3] Call transformToGraphData(treeData, commits) in app/page.tsx when commits available
- [ ] T067 [US3] Fallback to empty GraphData if commits not available in app/page.tsx
- [ ] T068 [US3] Pass computed graphData to ForceGraphChart component in app/page.tsx

#### Step 5: Verification

- [ ] T069 [US3] Test with git-explorer repository: verify 50 nodes appear
- [ ] T070 [US3] Test with git-explorer repository: identify frequently co-changed files (e.g., plan.md + spec.md in specs/), verify thick connecting line
- [ ] T071 [US3] Test with git-explorer repository: identify rarely co-changed files, verify thin line or no connection
- [ ] T072 [US3] Change time range, verify graph updates with new co-change patterns
- [ ] T073 [US3] Test with different repository, verify correct files and relationships display

**Checkpoint**: Complete end-to-end integration - real repository data flows through co-occurrence calculation to network visualization with proper visual encoding

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Enhancements and edge case handling across all user stories

- [ ] T074 [P] Add stroke color for links (light gray or theme-appropriate) in app/components/ForceGraphChart.tsx
- [ ] T075 [P] Verify links render with stroke="#999" or similar neutral color in app/components/ForceGraphChart.tsx
- [ ] T076 [P] Handle empty links array gracefully (skip link rendering) in app/components/ForceGraphChart.tsx
- [ ] T077 [P] Handle single node edge case (no links possible) in app/components/ForceGraphChart.tsx
- [ ] T078 [P] Add loading state during force simulation initial warmup in app/components/ForceGraphChart.tsx
- [ ] T079 [P] Update ForceGraphChart tests to use new GraphData prop structure in __tests__/components/ForceGraphChart.test.tsx
- [ ] T080 Verify all acceptance scenarios from spec.md user stories
- [ ] T081 Performance test: measure render time for 50 nodes with links, verify <3 seconds
- [ ] T082 Performance test: verify smooth dragging at 60fps with browser DevTools Performance tab
- [ ] T083 Run full test suite: npm test
- [ ] T084 Run quickstart.md validation steps for all three phases
- [ ] T085 Update README.md to document co-change network visualization feature

---

## Implementation Strategy

### MVP Scope (Minimum Viable Product)

**User Story 1 only** provides the MVP:
- Network graph visualization working with example data
- Interactive node dragging with link updates
- Proves D3 force-directed graph integration in React component

This MVP validates the technical approach before data complexity is added.

### Incremental Delivery Order

1. **Phase 1-3 (User Story 1)**: Get visualization working with example data - immediately demonstrates value
2. **Phase 4 (User Story 2)**: Build and test co-occurrence utility in isolation - ensures data quality
3. **Phase 5 (User Story 3)**: Connect everything - complete feature with real data

Each phase is independently testable and delivers incremental value.

---

## Dependencies & Sequencing

### Phase Dependencies

```
Setup (Phase 1)
  ↓
Foundational (Phase 2) [N/A - no blocking tasks]
  ↓
├─ User Story 1 (Phase 3) ── CAN START IMMEDIATELY
├─ User Story 2 (Phase 4) ── CAN START IMMEDIATELY (independent utility)
└─ User Story 3 (Phase 5) ── REQUIRES: Phase 3 + Phase 4 complete
     ↓
   Polish (Phase 6)
```

### Parallel Execution Opportunities

**After Setup, these can run in parallel**:
- User Story 1 tasks (T004-T021): Visualization refactor team
- User Story 2 tasks (T022-T040): Data processing team

**After US1 + US2 complete**:
- User Story 3 tasks within each step can parallelize:
  - Step 1 API tasks (T047-T050): Backend team
  - Step 2 Transformer tasks (T051-T056): Data team
  - Step 3 Visual encoding tasks (T057-T062): Visualization team
  - All converge at Step 4 for integration

---

## Task Summary

- **Total Tasks**: 85
- **User Story 1 (P1)**: 18 tasks (T004-T021) - MVP foundation
- **User Story 2 (P2)**: 19 tasks (T022-T040) - Co-occurrence utility
- **User Story 3 (P3)**: 33 tasks (T041-T073) - Full integration
- **Polish & Validation**: 12 tasks (T074-T085)

**Estimated Completion**:
- User Story 1: 2-3 days (visualization refactor)
- User Story 2: 1-2 days (utility development)
- User Story 3: 3-4 days (integration + visual encoding)
- Polish: 1 day (edge cases + validation)

**Total**: ~7-10 days for complete feature

---

## Validation Checklist

Before marking feature complete, verify:

- ✅ All tests pass: `npm test`
- ✅ User Story 1 acceptance scenarios pass (example data graph works)
- ✅ User Story 2 acceptance scenarios pass (utility calculations correct)
- ✅ User Story 3 acceptance scenarios pass (real data flows correctly)
- ✅ Visual encoding correct: thicker lines for frequent co-changes, nodes closer together
- ✅ Performance targets met: <3 second render, 60fps dragging
- ✅ Edge cases handled: empty data, single node, uniform co-change frequencies
- ✅ Quickstart guide works: can run feature locally following instructions
- ✅ Constitution principles satisfied: TDD followed, simplicity maintained, UX preserved, visual clarity achieved
