# Tasks: Next.js Hello World Boilerplate

**Input**: Design documents from `/specs/001-nextjs-hello-world/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: Next.js App Router structure
- `app/` - Page components and layouts
- `__tests__/` - Test files
- Root - Configuration files

---

## Phase 1: Setup

**Purpose**: Initialize Next.js project with required tooling

- [x] T001 Initialize Next.js project with create-next-app (TypeScript, Tailwind, ESLint, App Router, npm)
- [x] T002 Install testing dependencies: jest, jest-environment-jsdom, @testing-library/react, @testing-library/jest-dom
- [x] T003 [P] Create jest.config.js with Next.js configuration
- [x] T004 [P] Create jest.setup.js with Testing Library imports

**Command for T001**:
```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --use-npm
```

**Command for T002**:
```bash
npm install --save-dev jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom
```

---

## Phase 2: Foundational (Test Infrastructure)

**Purpose**: Establish testing framework before any feature implementation (TDD requirement)

- [x] T005 Verify jest runs with empty test suite (npm run test passes)
- [x] T006 Add test script to package.json if not present

**Checkpoint**: Testing infrastructure ready - TDD workflow can begin

---

## Phase 3: User Story 1 - Install Dependencies (Priority: P1)

**Goal**: Developer can clone repo and install dependencies successfully

**Independent Test**: Run `npm install` in fresh clone, verify zero errors

### Implementation for User Story 1

> Note: This story is satisfied by T001-T002 (project initialization). No additional tasks needed.

**Checkpoint**: `npm install` works without errors

---

## Phase 4: User Story 2 - View Hello World Page (Priority: P1) - MVP

**Goal**: Homepage displays "Hello World" message with proper title

**Independent Test**: Navigate to localhost:3000, see "Hello World" text and "Git Explorer" title

### Tests for User Story 2 (TDD - Write First)

- [x] T007 [US2] Write test: Homepage renders "Hello World" text in __tests__/page.test.tsx
- [x] T008 [US2] Write test: Page has correct document title in __tests__/page.test.tsx

### Implementation for User Story 2

- [x] T009 [US2] Simplify app/page.tsx to display only "Hello World" message
- [x] T010 [US2] Update app/layout.tsx metadata to set title "Git Explorer"
- [x] T011 [US2] Clean up app/globals.css - keep only Tailwind directives
- [x] T012 [US2] Run tests and verify they pass (npm run test)

**Checkpoint**: Tests pass, "Hello World" visible at localhost:3000

---

## Phase 5: User Story 3 - Start Development Server (Priority: P1)

**Goal**: Developer can start server and access app at localhost:3000

**Independent Test**: Run `npm run dev`, open browser to localhost:3000, see working page

### Implementation for User Story 3

> Note: This story is satisfied by T001 (create-next-app provides dev script). Verification only.

- [x] T013 [US3] Verify npm run dev starts server without errors
- [x] T014 [US3] Verify localhost:3000 is accessible in browser
- [x] T015 [US3] Verify npm run build completes without errors
- [x] T016 [US3] Verify npm run start works after build

**Checkpoint**: All npm scripts work, app accessible at localhost:3000

---

## Phase 6: Polish and Documentation

**Purpose**: Final cleanup and README update

- [x] T017 [P] Update README.md with setup instructions (clone, install, run)
- [x] T018 [P] Remove any unused boilerplate files from create-next-app
- [x] T019 Verify all acceptance criteria from spec.md are met
- [x] T020 Run final test suite - all tests must pass

---

## Dependencies

```
T001 (init project)
  ├── T002 (install test deps)
  │     ├── T003 (jest config) [P]
  │     └── T004 (jest setup) [P]
  │           └── T005 (verify jest)
  │                 └── T006 (test script)
  │                       └── T007 (write test: Hello World)
  │                       └── T008 (write test: title) [P with T007]
  │                             └── T009 (implement page)
  │                             └── T010 (implement layout) [P with T009]
  │                             └── T011 (clean CSS) [P with T009]
  │                                   └── T012 (run tests)
  │                                         └── T013-T016 (verify scripts)
  │                                               └── T017-T020 (polish)
```

## Parallel Execution Opportunities

| Phase | Parallel Tasks | Why Parallelizable |
|-------|----------------|-------------------|
| Phase 1 | T003, T004 | Different files, no dependencies |
| Phase 4 Tests | T007, T008 | Same file but different test cases |
| Phase 4 Impl | T009, T010, T011 | Different files (page, layout, CSS) |
| Phase 6 | T017, T018 | Different files (README, cleanup) |

## Implementation Strategy

1. **MVP Scope**: Complete through Phase 4 for minimal working product
2. **TDD Compliance**: T007-T008 MUST be written and failing before T009-T011
3. **Incremental Delivery**: Each phase produces a working increment

## Summary

| Metric | Value |
|--------|-------|
| Total Tasks | 20 |
| Setup Phase | 4 tasks |
| Foundational | 2 tasks |
| User Story Tasks | 10 tasks |
| Polish Tasks | 4 tasks |
| Parallel Opportunities | 7 tasks |

**MVP**: Tasks T001-T012 (Hello World visible with passing tests)
**Full Feature**: Tasks T001-T020 (all scripts verified, docs updated)
