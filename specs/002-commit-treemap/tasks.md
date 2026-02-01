```markdown
# Tasks: Git Repository Commit Activity Treemap

**Input**: Design documents from `/specs/002-commit-treemap/`
**Prerequisites**: plan.md ✅, spec.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: Tests are REQUIRED per constitution Principle I (TDD). All implementation tasks must be preceded by test tasks that fail before code is written.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, dependencies, and TypeScript interfaces

- [x] T001 Install required dependencies: `simple-git` via npm in package.json
- [x] T002 [P] Create TypeScript types file with all interfaces in lib/git/types.ts (RepositoryInput, TimeRangePreset, TimeRangeConfig, CommitRecord, FileCommitData, TreeNode)
- [x] T003 [P] Create date helper utilities in lib/utils/date-helpers.ts (createTimeRangeConfig function for all presets)
- [x] T004 [P] Create color scale utility in lib/treemap/color-scale.ts (dark green #006400 → light gray #E5E5E5 gradient based on frequencyScore)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core git analysis logic that MUST be complete before any user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Tests for Foundational (TDD: Write FIRST, ensure FAIL)

- [x] T005-TEST [P] Write unit tests for git log parser in __tests__/unit/git-analyzer.test.ts (test date filtering, --name-only parsing, empty repo handling)
- [x] T006-TEST [P] Write unit tests for commit counter in __tests__/unit/git-analyzer.test.ts (test unique SHA counting, recent vs total counts, midpoint calculation)
- [x] T007-TEST [P] Write unit tests for file filtering in __tests__/unit/git-analyzer.test.ts (test top 500 selection, alphabetical tiebreaker, <500 files case)
- [x] T008-TEST [P] Write unit tests for frequency score calculator in __tests__/unit/git-analyzer.test.ts (test normalization, max=0 edge case, score range 0-1)
- [x] T009-TEST [P] Write unit tests for tree builder in __tests__/unit/tree-builder.test.ts (test hierarchy construction, value aggregation, deep nesting)
- [x] T010-TEST [P] Write unit tests for color application in __tests__/unit/data-transformer.test.ts (test color mapping from frequencyScore, file nodes only)

### Implementation for Foundational

- [x] T005 Implement git log parser in lib/git/analyzer.ts (use simple-git to extract commits with --name-only, filter by date range, return CommitRecord[])
- [x] T006 Implement commit counter in lib/git/analyzer.ts (countCommitsByFile function: count unique SHAs per file, calculate totalCommitCount and recentCommitCount)
- [x] T007 Implement file filtering in lib/git/analyzer.ts (filterTopFiles function: sort by totalCommitCount, take top 500, alphabetical tiebreaker)
- [x] T008 Implement frequency score calculator in lib/git/analyzer.ts (calculateFrequencyScores function: normalize recentCommitCount across all files to 0-1 range)
- [x] T009 Implement tree builder in lib/git/tree-builder.ts (buildTreeFromFiles function: recursive path splitting, Map-based construction, aggregate parent values)
- [x] T010 Implement data transformer in lib/treemap/data-transformer.ts (applyColors function: apply color from frequencyScore to each TreeNode)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Repository Selection and Validation (Priority: P1) 🎯 MVP

**Goal**: Users can select a repository via browser directory picker and receive validation feedback

**Independent Test**: Click directory picker button, select various folders (valid repo, non-repo folder, permission-restricted) and verify appropriate feedback messages

### Tests for User Story 1 (TDD: Write FIRST, ensure FAIL)

- [x] T011-TEST [US1] Write component tests for RepositorySelector in __tests__/components/RepositorySelector.test.tsx (test directory picker trigger, validation feedback, loading states)
- [x] T012-TEST [US1] Write component tests for LoadingState in __tests__/components/LoadingState.test.tsx (test spinner render, custom message prop)
- [x] T013-TEST [US1] Write integration tests for API endpoint in __tests__/integration/git-analysis-api.test.ts (test request parsing, validation responses, error codes)

### Implementation for User Story 1

- [x] T011 [P] [US1] Create RepositorySelector component in app/components/RepositorySelector.tsx (browser directory picker button using File System Access API, props: onRepositorySelected, isLoading, error, currentPath)
- [x] T012 [P] [US1] Create LoadingState component in app/components/LoadingState.tsx (centered spinner with message prop, default "Analyzing repository...")
- [x] T013 [US1] Implement client-side git analysis in lib/git/client-analyzer.ts (use isomorphic-git with File System Access API adapter)
- [x] T014 [US1] Integrate client-side analysis into app/page.tsx (call analyzeClientRepository with directory handle, display results)
- [ ] T015 [US1] Add error handling for unsupported browsers in app/components/RepositorySelector.tsx (fallback message for browsers without File System Access API)

**Checkpoint**: User Story 1 complete - users can input repo path and see validation feedback

---

## Phase 4: User Story 2 - Basic Treemap Visualization (Priority: P1) 🎯 MVP

**Goal**: Display treemap showing top 500 files from last 2 weeks with sizes proportional to commit counts

**Independent Test**: Select a valid repository and verify treemap appears with rectangles representing files, sizes proportional to commit counts, folder hierarchy preserved

### Tests for User Story 2 (TDD: Write FIRST, ensure FAIL)

- [x] T017-TEST [US2] Write integration tests for git analysis pipeline in __tests__/integration/git-analysis-api.test.ts (test end-to-end: request → TreeNode response, metadata validation)
- [x] T018-TEST [US2] Write component tests for TreemapChart in __tests__/components/TreemapChart.test.tsx (test SVG render, rect elements, visx integration, empty data handling)

### Implementation for User Story 2

- [x] T017 [US2] Wire up git analysis pipeline in app/api/git-analysis/route.ts (call analyzer → tree-builder → data-transformer, return TreeNode with metadata)
- [x] T018 [US2] Create TreemapChart component in app/components/TreemapChart.tsx (use @visx/hierarchy Treemap, props: data, width, height)
- [x] T019 [US2] Implement rectangle rendering in app/components/TreemapChart.tsx (render <rect> for each node, fill with node.color or #ccc, size from visx layout)
- [x] T020 [US2] Implement label rendering in app/components/TreemapChart.tsx (add <text> labels for nodes with width/height > 30px, display node.name)
- [x] T021 [US2] Add empty state handling in app/components/TreemapChart.tsx (display "No data to display" when data has no children)
- [x] T022 [US2] Add accessibility attributes in app/components/TreemapChart.tsx (role="img", aria-label on SVG, aria-label on each rect with file name and count)
- [x] T023 [US2] Integrate TreemapChart into app/page.tsx (store analysis result in state, render TreemapChart with responsive width/height after successful API call)

**Checkpoint**: User Story 2 complete - users can see treemap visualization of their repository

---

## Phase 5: User Story 3 - Activity Frequency Color Gradient (Priority: P2)

**Goal**: Color rectangles based on recent commit frequency (dark green = high frequency, light gray = low frequency)

**Independent Test**: Analyze a repo with varied commit patterns and verify files with many recent commits appear dark green, files with few recent commits appear light gray

### Implementation for User Story 3

- [x] T024 [US3] Verify color scale application in lib/treemap/data-transformer.ts (ensure frequencyScore correctly maps to color gradient from #006400 to #E5E5E5)
- [x] T025 [US3] Update TreemapChart rendering to use node.color in app/components/TreemapChart.tsx (ensure rect fill comes from node.color property for files)
- [x] T026 [US3] Add color legend component in app/components/ColorLegend.tsx (display gradient bar with "Most active" and "Least active" labels)
- [x] T027 [US3] Integrate ColorLegend into app/page.tsx (display below or beside TreemapChart when data is loaded)

**Checkpoint**: User Story 3 complete - users can visually distinguish hot vs cold files at a glance

---

## Phase 6: User Story 4 - Date Range Filter Selection (Priority: P2)

**Goal**: Users can select different time range presets to analyze different periods

**Independent Test**: View default 2-week treemap, select "Last Month" or "Last Quarter", verify treemap updates with new data

### Implementation for User Story 4

- [x] T028 [US4] Create DateRangeSelector component in app/components/DateRangeSelector.tsx (radio buttons for 5 presets: 2w, 1m, 3m, 6m, 1y; props: selected, onRangeChange, disabled)
- [x] T029 [US4] Integrate DateRangeSelector into app/page.tsx (state for selectedRange, pass to API call, disable during loading)
- [x] T030 [US4] Update API call in app/page.tsx to include timeRange parameter (send selectedRange in request body)
- [x] T031 [US4] Add re-analysis logic in app/page.tsx (when range changes, trigger new API call without re-entering repo path)

**Checkpoint**: User Story 4 complete - users can explore different time windows

---

## Phase 7: User Story 5 - Graceful Error Handling (Priority: P3)

**Goal**: Clear, actionable error messages for all failure scenarios

**Independent Test**: Trigger various error conditions (invalid paths, permission issues, empty repos) and verify user-friendly messages with recovery options

### Implementation for User Story 5

- [x] T032 [US5] Create ErrorDisplay component in app/components/ErrorDisplay.tsx (display error message, retry button, select different repo button)
- [x] T033 [US5] Add "no commits in range" handling in app/api/git-analysis/route.ts (return empty tree with metadata indicating 0 files)
- [x] T034 [US5] Add empty state for no commits in app/page.tsx (display "No commits found in the selected time period" message)
- [x] T035 [US5] Integrate ErrorDisplay into app/page.tsx (replace inline error text, provide retry and reset actions)
- [x] T036 [US5] Add git binary detection in app/api/git-analysis/route.ts (catch simple-git error for missing git, return specific error message)

**Checkpoint**: User Story 5 complete - users receive clear feedback for all error scenarios

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T037 [P] Add responsive sizing logic in app/page.tsx (calculate treemap width/height from window size, add resize listener)
- [ ] T038 [P] Style components with Tailwind CSS in app/globals.css and components (consistent spacing, colors, typography)
- [ ] T039 [P] Add metadata display in app/page.tsx (show totalFilesAnalyzed, filesDisplayed, analysisDurationMs after analysis)
- [ ] T040 Run quickstart.md validation (verify all setup steps work, update if needed)
- [ ] T041 Update README.md with feature documentation (add usage instructions for treemap feature)

---

## Deferred: User Story 6 - Interactive Hover Tooltips (Priority: P4)

**Goal**: Hover over files/folders to see detailed information

**Status**: Deferred per spec.md - not included in initial release

When implementing later:
- Add @visx/tooltip dependency
- Create Tooltip component
- Add hover handlers to TreemapChart rectangles
- Display file name, total commits, recent commits on hover

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - User Story 1 (P1) → User Story 2 (P1) must be sequential (US2 needs API from US1)
  - User Story 3 (P2) depends on US2 (needs TreemapChart)
  - User Story 4 (P2) depends on US2 (needs working treemap)
  - User Story 5 (P3) can be worked in parallel with US3/US4
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Depends on User Story 1 (needs API endpoint structure)
- **User Story 3 (P2)**: Depends on User Story 2 (needs TreemapChart component)
- **User Story 4 (P2)**: Depends on User Story 2 (needs working visualization)
- **User Story 5 (P3)**: Can start after User Story 1 (enhances error handling)

### Within Each User Story

- Core implementation before integration
- API changes before UI changes
- Story complete before moving to next priority

### Parallel Opportunities

**Phase 1 (Setup)**:
```bash
# All can run in parallel after T001
T002 (types) | T003 (date-helpers) | T004 (color-scale)
```

**Phase 3 (User Story 1)**:
```bash
# T011 and T012 can run in parallel
T011 (RepositorySelector) | T012 (LoadingState)
# Then sequential
T013 → T014 → T015 → T016
```

**Phase 4 (User Story 2)**:
```bash
# T018-T022 can run in parallel after T017
T017 → (T018 | T019 | T020 | T021 | T022) → T023
```

**Phase 5-7 (User Stories 3-5)**:
```bash
# US3 and US4 can run in parallel with US5
(US3: T024 → T025 → T026 → T027) | (US5: T032 → T033 → T034 → T035 → T036)
(US4: T028 → T029 → T030 → T031)
```

**Phase 8 (Polish)**:
```bash
# All polish tasks can run in parallel
T037 | T038 | T039
# Then sequential
T040 → T041
```

---

## Implementation Strategy

### MVP Scope (Recommended First Delivery)

**Minimum Viable Product**: User Stories 1 + 2 (both P1)
- Users can input repository path
- Users can see treemap of last 2 weeks
- Delivers core value: visualize commit activity

**Tasks for MVP**: T001-T023 (23 tasks)

### Incremental Delivery

1. **MVP**: Phase 1-4 (User Stories 1+2) - Core treemap functionality
2. **Enhancement 1**: Phase 5 (User Story 3) - Color gradient
3. **Enhancement 2**: Phase 6 (User Story 4) - Date range selection
4. **Enhancement 3**: Phase 7 (User Story 5) - Error handling polish
5. **Polish**: Phase 8 - Final touches

---

## Summary

| Phase | User Story | Priority | Tasks | Parallel Opportunities |
|-------|-----------|----------|-------|------------------------|
| 1 | Setup | - | T001-T004 | T002, T003, T004 |
| 2 | Foundational | - | T005-T010 | None (sequential) |
| 3 | US1: Repository Selection | P1 | T011-T016 | T011, T012 |
| 4 | US2: Basic Treemap | P1 | T017-T023 | T018-T022 |
| 5 | US3: Color Gradient | P2 | T024-T027 | None |
| 6 | US4: Date Range | P2 | T028-T031 | None |
| 7 | US5: Error Handling | P3 | T032-T036 | None |
| 8 | Polish | - | T037-T041 | T037, T038, T039 |

**Total Tasks**: 52 (41 implementation + 11 test tasks)
**MVP Tasks (US1+US2)**: 31 (23 implementation + 8 test tasks)
**Parallel Opportunities**: 20 tasks marked with [P] (includes test tasks)
**TDD Workflow**: All test tasks must be completed and FAILING before implementation tasks begin
```
