# Implementation Plan: Git Repository Commit Activity Treemap
**Input**: Feature specification from `/specs/002-commit-treemap/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Build an interactive treemap visualization showing commit frequency for the top 500 most-changed files in a git repository. Users select a local repository via browser directory picker, and the system analyzes the last 2 weeks of commit history (initially hardcoded, with date range selection as an enhancement). The treemap uses size to represent total commit count and a color gradient (dark green → light gray) to indicate commit frequency in the recent period (last half of the time window), preserving the repository's folder hierarchy.

**Technical Approach**: Next.js web application running locally (`npm run dev`) with server-side git analysis via `simple-git` library. Client uses File System Access API for directory selection, server processes git log with `--name-only` and date filtering, filters to top 500 files, builds hierarchical tree structure, and renders treemap using `@visx/hierarchy` (React wrapper around d3-hierarchy).

## Technical Context

**Language/Version**: TypeScript 5 / Node.js (Next.js 16.1.6, React 19.2.3)  
**Primary Dependencies**: `simple-git` (git operations), `@visx/hierarchy` (treemap), `@visx/scale` (color scales), `@visx/tooltip` (deferred - P4)  
**Storage**: N/A (stateless, analyzes repositories on-demand)  
**Testing**: Jest 29.7.0 + React Testing Library (already configured)  
**Target Platform**: Local development server (Next.js dev mode, user runs `npm run dev`)  
**Project Type**: Web application (Next.js App Router with client + server components)  
**Performance Goals**: Analysis completes in <10 seconds for repos with 10,000 files; treemap updates in <5 seconds when changing date ranges  
**Constraints**: File System Access API requires modern browsers (Chrome 86+, Edge 86+, Safari 15.2+, Firefox 111+); simple-git requires git binary installed; server must have file system access to repositories  
**Scale/Scope**: MVP with 6 user stories (4 for initial release, 2 deferred); ~5-8 React components; 2-3 API routes; top 500 files displayed

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principle I: Test-First (TDD) — NON-NEGOTIABLE

**Status**: ✅ **PASS - Commitment to TDD**

- **Plan**: Tests will be written before implementation for all user stories
- **Coverage areas**:
  - Unit tests for git log parsing and data transformation (commit counting, filtering top 500, hierarchy building)
  - Unit tests for color gradient calculations (frequency scoring, scale mapping)
  - Component tests for UI elements (repository selector, treemap rendering, date range selector)
  - Integration tests for API routes (git analysis endpoint, error handling)
- **Test-first workflow**: Each task in tasks.md will include "Write test" as prerequisite to "Implement"
- **Jest + RTL**: Already configured in project, ready for TDD

### Principle II: Simplicity (YAGNI)

**Status**: ✅ **PASS**

- **Minimal scope**: MVP hardcodes 2-week range; date selection is deferred enhancement (P2)
- **Dependencies justified**:
  - `simple-git`: Essential for git operations (no simpler alternative for server-side git)
  - `@visx/hierarchy`: Already installed, wraps d3-hierarchy (no additional dependency)
- **No premature abstraction**: Direct implementation without repository patterns or complex state management
- **Deferred complexity**: Tooltips (P4), custom date ranges (future), performance optimization (as-needed)

### Principle III: User Experience First

**Status**: ✅ **PASS**

- **Intuitive interaction**: Browser directory picker is native OS UI (familiar to users)
- **Responsive feedback**: Loading states during git analysis (FR-013), empty states for no data (FR-014)
- **Error handling**: Clear messages for all failure scenarios (P3: User Story 5)
- **Performance**: 10-second target for 10k files; 5-second updates for date changes
- **Progressive enhancement**: MVP works without tooltips; date filtering is enhancement over hardcoded default

### Principle IV: Visual Clarity

**Status**: ✅ **PASS**

- **Story at a glance**: Dark green = hot files (recent frequent changes), light gray = cold files
- **Progressive disclosure**: Treemap shows hierarchy; tooltips (P4) provide drill-down details
- **Consistent visual language**: Color gradient has single meaning (recent commit frequency)
- **Reduced noise**: Top 500 files only; hierarchy preserves context without overwhelming display

### Gate Evaluation

✅ **ALL GATES PASSED** - Ready for Phase 0 research

No violations of constitution principles. All dependencies justified, TDD workflow planned, UX prioritized, visual clarity achieved through sequential color scale.

---

## Phase 0: Research Complete ✅

**Output**: [research.md](research.md)

**Decisions Made**:
1. ✅ Repository input via browser directory picker (File System Access API) for intuitive folder selection
2. ✅ simple-git with single `git.log()` call + `--name-only` for efficiency
3. ✅ Recursive path splitting with Map-based tree construction
4. ✅ d3 scaleLinear with RGB interpolation (dark green → light gray)
5. ✅ Next.js POST endpoint with structured error handling

**All NEEDS CLARIFICATION items resolved**. Proceeding to Phase 1.

---

## Phase 1: Design Complete ✅

**Outputs**:
- ✅ [data-model.md](data-model.md) - 7 entities defined with TypeScript interfaces
- ✅ [contracts/api-git-analysis.md](contracts/api-git-analysis.md) - API contract with request/response schemas
- ✅ [contracts/components.md](contracts/components.md) - 5 component prop interfaces
- ✅ [quickstart.md](quickstart.md) - Developer setup and TDD workflow guide
- ✅ Agent context updated (Copilot instructions)

**Design Artifacts Summary**:

| Artifact | Purpose | Key Content |
|----------|---------|-------------|
| data-model.md | Entity definitions | 7 TypeScript interfaces, data flow diagram, validation rules |
| contracts/api-git-analysis.md | API contract | Request/response schemas, error codes, usage examples |
| contracts/components.md | Component contracts | 5 component prop interfaces, behavior specs, state management |
| quickstart.md | Developer guide | Setup steps, TDD workflow, debugging tips, architecture decisions |

---

## Constitution Re-Check (Post-Phase 1)

*Required after Phase 1 design artifacts are complete*

### Principle I: Test-First (TDD) — NON-NEGOTIABLE

**Status**: ✅ **PASS - TDD Embedded in Design**

- **Test structure defined**: `__tests__/unit/`, `__tests__/integration/`, `__tests__/components/`
- **Quickstart includes TDD workflow**: Red-Green-Refactor cycle with examples
- **Component contracts specify tests**: Each component contract lists required test cases
- **API contract specifies tests**: 8 test scenarios defined for git-analysis endpoint
- **Data model includes testing strategy**: Test files mapped to each entity

**Verification**: All design artifacts explicitly reference test-first approach.

### Principle II: Simplicity (YAGNI)

**Status**: ✅ **PASS - Complexity Avoided**

**Design simplifications**:
- ✅ Removed File System Access API (simpler text input)
- ✅ No state management library (React useState sufficient)
- ✅ No caching layer (measure first, optimize if needed)
- ✅ No Web Workers (defer until performance issues arise)
- ✅ Single API endpoint (not separate validation/analysis routes)
- ✅ Direct tree building (no complex Map structures)

**Deferred features per YAGNI**:
- Date range selector (P2) - hardcoded 2 weeks in MVP
- Hover tooltips (P4) - not required for core value
- Custom date ranges (future) - presets sufficient
- Performance optimizations (as-needed) - measure first

**Dependencies justified**:
- simple-git: Essential for git operations (49KB, industry standard)
- @visx/hierarchy: Already installed (0KB added)
- d3-scale: Already transitive dep via visx (0KB added)

**Verification**: No unnecessary abstraction or premature optimization in design.

### Principle III: User Experience First

**Status**: ✅ **PASS - UX Prioritized**

**Design elements supporting UX**:
- ✅ **Intuitive input**: Browser directory picker (native OS UI, familiar pattern)
- ✅ **Responsive feedback**: LoadingState component specified
- ✅ **Clear errors**: 5 error scenarios with user-friendly messages
- ✅ **Empty states**: EmptyState component for no data
- ✅ **Performance targets**: <10s analysis, <5s updates (in contracts)
- ✅ **Graceful degradation**: Error handling in User Story 5

**Component contracts include UX details**:
- Accessibility attributes (ARIA labels, roles)
- Loading states (disabled inputs during analysis)
- Error display (red text, role="alert")
- Success feedback (green text showing current path)

**Verification**: Every component contract specifies states, interactions, and accessibility.

### Principle IV: Visual Clarity

**Status**: ✅ **PASS - Clear Visual Design**

**Design supports clarity**:
- ✅ **Color scale meaning**: Dark green = hot (recent frequent), light gray = cold (low frequency)
- ✅ **Single dimension**: Sequential scale (not confusing diverging scale)
- ✅ **Size encoding**: Rectangle size = commit count (proportional, intuitive)
- ✅ **Hierarchy preserved**: Folder structure visible (context maintained)
- ✅ **Top 500 limit**: Reduces visual clutter
- ✅ **Progressive disclosure**: Tooltips deferred (P4) - basic viz shows story at glance

**Color scale specifics**:
- Light gray: `#E5E5E5` (neutral, accessible)
- Dark green: `#006400` (high contrast, not red/green colorblind issue)
- Linear interpolation: Smooth, predictable gradient

**Verification**: Data model and contracts specify visual encoding clearly.

### Final Constitution Verdict

✅ **ALL PRINCIPLES UPHELD POST-DESIGN**

**Summary**:
- Test-First: Embedded throughout design artifacts
- Simplicity: Unnecessary complexity avoided, deferred features documented
- UX First: Feedback, errors, accessibility prioritized in contracts
- Visual Clarity: Color scale meaningful, hierarchy preserved, clutter reduced

**No violations introduced during design phase. Ready for Phase 2 (Tasks).**

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
app/
├── page.tsx                    # Main page with repository selector + treemap
├── layout.tsx                  # Existing root layout
├── globals.css                 # Existing global styles
├── api/
│   └── git-analysis/
│       └── route.ts           # POST endpoint: analyze repo + return tree data
└── components/
    ├── RepositorySelector.tsx  # File System Access API integration + validation
    ├── TreemapChart.tsx        # Visx treemap visualization wrapper
    ├── DateRangeSelector.tsx   # Time range preset selector (P2 - deferred)
    └── LoadingState.tsx        # Loading indicator during analysis

lib/
├── git/
│   ├── analyzer.ts            # simple-git wrapper: log parsing, commit counting
│   ├── tree-builder.ts        # Build hierarchical tree from flat file list
│   └── types.ts               # TypeScript interfaces (FileCommitData, TreeNode)
├── treemap/
│   ├── color-scale.ts         # Color gradient logic (dark green → light gray)
│   └── data-transformer.ts    # Transform git data to visx treemap format
└── utils/
    └── date-helpers.ts        # Date range calculations (2 weeks, midpoint, etc.)

__tests__/
├── unit/
│   ├── git-analyzer.test.ts   # Test commit counting, filtering top 500
│   ├── tree-builder.test.ts   # Test hierarchy construction, aggregation
│   ├── color-scale.test.ts    # Test frequency scoring, gradient mapping
│   └── date-helpers.test.ts   # Test date range calculations
├── integration/
│   └── git-analysis-api.test.ts  # Test API route with mock repo
└── components/
    ├── RepositorySelector.test.tsx
    ├── TreemapChart.test.tsx
    └── DateRangeSelector.test.tsx

public/
└── [existing static assets]
```

**Structure Decision**: Next.js App Router structure (web application). Components split by responsibility: data fetching (API route), visualization (components), business logic (lib). Tests mirror source structure with unit/integration/component separation per TDD principle.

## Complexity Tracking

> **No violations - this section is empty per constitution compliance**

All constitution principles passed. No complexity exceptions required.
