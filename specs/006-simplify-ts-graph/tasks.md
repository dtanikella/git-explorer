# Tasks: Simplify TS Graph Edges & Hide Test Files

**Input**: Design documents from `/specs/006-simplify-ts-graph/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Required per Constitution Principle I (TDD). Tests are written first and must fail before implementation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: No new project initialization needed — all changes fit within existing structure. This phase handles only test infrastructure setup.

- [ ] T001 Verify existing test suite passes by running `npm test`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: No foundational/blocking tasks — all existing infrastructure (types, analyzer, API route, D3 graph component, force rules) already exists. User stories can begin immediately after setup verification.

**Checkpoint**: Foundation ready — user story implementation can begin.

---

## Phase 3: User Story 1 — Simplified Edge View (Priority: P1) 🎯 MVP

**Goal**: Remove import and export edges from the graph output. Only contains (file→folder, folder→folder) and call (function→function) edges remain. Remove ImportNode from output. Update default rules to style structural edges with `linkDistance: 100, linkStrength: 0.6`.

**Independent Test**: Load any TypeScript repo in the TS graph. Verify only contains and call edges appear; zero import or export edges visible; zero ImportNode circles.

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T002 [P] [US1] Add unit test: analyzer returns zero import-type edges in `__tests__/unit/ts-analyzer.test.ts`
- [ ] T003 [P] [US1] Add unit test: analyzer returns zero export-type edges in `__tests__/unit/ts-analyzer.test.ts`
- [ ] T004 [P] [US1] Add unit test: analyzer returns zero IMPORT-kind nodes in `__tests__/unit/ts-analyzer.test.ts`
- [ ] T005 [P] [US1] Add unit test: analyzer returns only contains and call edge types in `__tests__/unit/ts-analyzer.test.ts`
- [ ] T005b [P] [US1] Add unit test: analyzer still returns call edges after edge simplification (FR-003 preservation) in `__tests__/unit/ts-analyzer.test.ts`

### Implementation for User Story 1

- [ ] T006 [US1] Remove import edge emission from first-pass loop in `lib/ts/analyzer.ts` (remove `edges.push(importEdge)` calls)
- [ ] T007 [US1] Remove export edge emission from first-pass loop in `lib/ts/analyzer.ts` (remove `edges.push({type:'export'...})` for functions, classes, interfaces)
- [ ] T008 [US1] Remove re-export edge emission from pending re-exports processing in `lib/ts/analyzer.ts`
- [ ] T009 [US1] Stop pushing ImportNode to `nodes[]` array in `lib/ts/analyzer.ts` (keep internal `importNodeMap` for call resolution)
- [ ] T010 [US1] Update `contains-edges` rule to `{ linkDistance: 100, linkStrength: 0.6 }`, remove `import-edges` and `export-edges` from `defaultEdgeRules`, and remove `import-local` and `import-package` from `defaultNodeRules` in `lib/ts/default-rules.ts`

**Checkpoint**: Graph now shows only structural (contains) and call edges. No import/export edges or ImportNodes. All T002–T005b tests pass.

---

## Phase 4: User Story 2 — Hide Test Files by Default (Priority: P1)

**Goal**: Add `hideTestFiles` option (default `true`) to the analyzer. When enabled, skip test files during parsing, exclude their child nodes, and prune empty folders. Plumb the option through the API route.

**Independent Test**: Call `analyzeTypeScriptRepo(repoPath, { hideTestFiles: true })` on a repo with test files. Verify zero test file nodes, zero test-child nodes, and zero empty-folder nodes in output.

### Tests for User Story 2

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T013 [P] [US2] Add unit test: analyzer with `hideTestFiles: true` returns zero FILE nodes matching test patterns in `__tests__/unit/ts-analyzer.test.ts`
- [ ] T014 [P] [US2] Add unit test: analyzer with `hideTestFiles: true` returns zero FUNCTION/CLASS/INTERFACE nodes with `inTestFile: true` in `__tests__/unit/ts-analyzer.test.ts`
- [ ] T015 [P] [US2] Add unit test: analyzer with `hideTestFiles: true` prunes folders containing only test files in `__tests__/unit/ts-analyzer.test.ts`
- [ ] T016 [P] [US2] Add unit test: analyzer with `hideTestFiles: false` includes test file nodes in `__tests__/unit/ts-analyzer.test.ts`
- [ ] T017 [P] [US2] Add integration test: `POST /api/ts-analysis` with `hideTestFiles: true` excludes test nodes in `__tests__/integration/ts-analysis-api.test.ts`
- [ ] T018 [P] [US2] Add integration test: `POST /api/ts-analysis` with `hideTestFiles: false` includes test nodes in `__tests__/integration/ts-analysis-api.test.ts`

### Implementation for User Story 2

- [ ] T019 [US2] Add `options?: { hideTestFiles?: boolean }` parameter to `analyzeTypeScriptRepo()` signature with default `true` in `lib/ts/analyzer.ts`
- [ ] T020 [US2] Add test-file skip logic in the first-pass source file loop: `if (hideTestFiles && isTestFile(filePath)) continue` in `lib/ts/analyzer.ts`
- [ ] T021 [US2] Add empty-folder pruning post-processing pass after all analysis passes in `lib/ts/analyzer.ts` — remove folders with zero children, cascade upward, remove orphaned contains edges
- [ ] T022 [US2] Extract `hideTestFiles` from request body (default `true`) and pass to `analyzeTypeScriptRepo()` in `app/api/ts-analysis/route.ts`

**Checkpoint**: Analyzer excludes test files by default. API route accepts and propagates `hideTestFiles` parameter. All T013–T018 tests pass.

---

## Phase 5: User Story 3 — Toggle Test Files On (Priority: P2)

**Goal**: Add a "Hide test files" toggle checkbox at the top of the TS graph view. Default: on. Toggling triggers server re-analysis with updated `hideTestFiles` parameter.

**Independent Test**: Load graph (test files hidden by default). Uncheck toggle → graph re-renders with test file nodes. Check toggle → test file nodes disappear.

### Tests for User Story 3

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T023 [P] [US3] Add component test: "Hide test files" checkbox renders and is checked by default in `__tests__/components/TsGraph.test.tsx`
- [ ] T024 [P] [US3] Add component test: unchecking toggle triggers a new fetch with `hideTestFiles: false` in request body in `__tests__/components/TsGraph.test.tsx`
- [ ] T025 [P] [US3] Add component test: re-checking toggle triggers a new fetch with `hideTestFiles: true` in request body in `__tests__/components/TsGraph.test.tsx`

### Implementation for User Story 3

- [ ] T026 [US3] Add `hideTestFiles` state (`useState(true)`) to TsGraph component in `app/components/ts-graph/TsGraph.tsx`
- [ ] T027 [US3] Include `hideTestFiles` in the fetch request body in the data-fetching effect in `app/components/ts-graph/TsGraph.tsx`
- [ ] T028 [US3] Add `hideTestFiles` to the effect dependency array so toggle change triggers re-fetch in `app/components/ts-graph/TsGraph.tsx`
- [ ] T029 [US3] Render "Hide test files" checkbox toggle above the graph SVG in `app/components/ts-graph/TsGraph.tsx`

**Checkpoint**: Toggle is visible, defaults to checked. Unchecking triggers re-analysis; test files appear. Checking hides them again. All T023–T025 tests pass.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup

- [ ] T030 [P] Remove `file-test` and `test-children` node rules from `defaultNodeRules` in `lib/ts/default-rules.ts` (test file nodes no longer emitted by default; rules are dead code)
- [ ] T031 [US2] Add empty-state handling in `app/components/ts-graph/TsGraph.tsx`: when analyzer returns zero nodes with `hideTestFiles: true`, display a message indicating no non-test files were found
- [ ] T032 Run full test suite with `npm test` and verify all tests pass
- [ ] T033 Run quickstart.md validation: start dev server with `npm run dev`, load a TypeScript repo, verify simplified edges and toggle behavior

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: N/A — no foundational tasks
- **User Story 1 (Phase 3)**: Depends on Phase 1. Core edge simplification.
- **User Story 2 (Phase 4)**: Depends on Phase 1 and Phase 3. Must follow US1 since both modify `lib/ts/analyzer.ts`.
- **User Story 3 (Phase 5)**: Depends on Phase 4 (needs API route to accept `hideTestFiles`).
- **Polish (Phase 6)**: Depends on all user stories complete.

### User Story Dependencies

- **User Story 1 (P1)**: Independent — modifies edge/node emission and default rules
- **User Story 2 (P1)**: Depends on US1 — both modify `lib/ts/analyzer.ts`; US1 edge emission changes must land first
- **User Story 3 (P2)**: Depends on US2 — needs the API route to accept `hideTestFiles` before the frontend can send it

### Within Each User Story

- Tests MUST be written and FAIL before implementation (Constitution Principle I)
- Analyzer changes before API route changes
- API route changes before frontend changes
- Core implementation before rule cleanup

### Parallel Opportunities

Within US1:
- T002, T003, T004, T005, T005b (all test tasks) can run in parallel
- T010 consolidates all `default-rules.ts` changes into one task (not parallelizable with itself)
- T010 can run in parallel with T006–T009 (different files)

Within US2:
- T013–T018 (all test tasks) can run in parallel
- T019–T021 (analyzer changes) are sequential
- T022 (route change) depends on T019

US1 and US2 CANNOT run in parallel — both modify `lib/ts/analyzer.ts`. Execute US1 first (edge emission changes), then US2 (file filtering + API param).

---

## Parallel Example: User Story 1

```text
# Write all tests in parallel:
T002: unit test — zero import edges
T003: unit test — zero export edges
T004: unit test — zero IMPORT nodes
T005: unit test — only contains + call edges
T005b: unit test — call edges preserved (FR-003)

# Then implement analyzer changes sequentially:
T006 → T007 → T008 → T009

# In parallel with analyzer changes, update default-rules (single task):
T010: update contains-edges rule + remove import/export rules
```

---

## Parallel Example: User Story 2

```text
# Write all tests in parallel:
T013: unit — zero test FILE nodes when hidden
T014: unit — zero test children when hidden
T015: unit — empty folders pruned
T016: unit — test files included when not hidden
T017: integration — API hideTestFiles=true
T018: integration — API hideTestFiles=false

# Then implement sequentially:
T019 → T020 → T021 → T022
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup verification
2. Complete Phase 3: User Story 1 (simplified edges)
3. **STOP and VALIDATE**: Graph shows only contains + call edges
4. This alone delivers significant visual noise reduction

### Incremental Delivery

1. Setup → US1 (edge simplification) → Validate (MVP!)
2. Add US2 (hide test files in analyzer) → Validate
3. Add US3 (toggle UI) → Validate
4. Polish → Final validation
5. Each story adds value without breaking previous stories

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [US1/US2/US3] label maps task to specific user story
- Total task count: 32
- US1 tasks: 9 (T002–T005b, T006–T010)
- US2 tasks: 10 (T013–T022)
- US3 tasks: 7 (T023–T029)
- Setup: 1 (T001)
- Polish: 4 (T030–T033)
- All tasks follow checklist format: `- [ ] [TaskID] [P?] [Story?] Description with file path`
- US3 tasks: 4 (T023–T026)
- Setup: 1 (T001)
- Polish: 3 (T027–T029)
- All tasks follow checklist format: `- [ ] [TaskID] [P?] [Story?] Description with file path`
