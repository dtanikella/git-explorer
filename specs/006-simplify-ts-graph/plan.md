# Implementation Plan: Simplify TS Graph Edges & Hide Test Files

**Branch**: `006-simplify-ts-graph` | **Date**: 2026-04-08 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/006-simplify-ts-graph/spec.md`

## Summary

Reduce the TS graph from showing all edge types (import, export, call, contains) to only three: file→parent-folder, folder→parent-folder (both short gray structural edges), and function→function call edges (unchanged). This requires filtering edges in the analyzer and updating the default edge rules. Additionally, add a "Hide test files" toggle (on by default) that excludes test files from server-side analysis entirely.

## Technical Context

**Language/Version**: TypeScript 5.x, Next.js 16.1.6, React 19.2.3
**Primary Dependencies**: D3.js 7 (visualization), TypeScript compiler API (analysis), simple-git
**Storage**: N/A (ephemeral server-side analysis, no persistence)
**Testing**: Jest + @testing-library/react
**Target Platform**: Web browser (Next.js app, SSR + client-side D3)
**Project Type**: Web application (Next.js full-stack)
**Performance Goals**: Graph renders at 60fps; analysis completes in <5s for typical repos
**Constraints**: Structural edges must cap at 100px visual length; toggle must trigger server-side re-analysis (not just client filtering)
**Scale/Scope**: Typical repos up to ~1000 files; graph node/edge counts proportional to file count

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Test-First (TDD) | ✅ PASS | Existing test files cover `analyzer.ts`, `force-rules.ts`, `default-rules`, integration. New tests for: edge filtering, `hideTestFiles` parameter, toggle re-analysis. |
| II. Simplicity (YAGNI) | ✅ PASS | Feature removes complexity (fewer edge types) and adds one toggle. No new abstractions needed. |
| III. User Experience First | ✅ PASS | Core goal is reducing visual noise. Toggle provides clear control. Loading state already exists for re-analysis. |
| IV. Visual Clarity | ✅ PASS | Directly serves this principle — removes import/export edge clutter, focuses on structural hierarchy and call relationships. |

**Gate result**: PASS — proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/006-simplify-ts-graph/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
lib/ts/
├── analyzer.ts          # MODIFY: add hideTestFiles param, filter edges
├── types.ts             # No changes needed (types already sufficient)
├── default-rules.ts     # MODIFY: update edge rules to only structural + call
├── force-rules.ts       # No changes needed (evaluation logic unchanged)

app/
├── api/ts-analysis/
│   └── route.ts         # MODIFY: accept hideTestFiles param from request body
├── components/ts-graph/
│   ├── TsGraph.tsx      # MODIFY: add toggle state, pass hideTestFiles to API
│   └── ForcePanel.tsx   # No changes needed

__tests__/
├── unit/
│   └── ts-analyzer.test.ts  # MODIFY: add tests for edge filtering & test file exclusion
├── integration/
│   └── ts-analysis-api.test.ts  # MODIFY: add tests for hideTestFiles param
```

**Structure Decision**: All changes fit within the existing Next.js web app structure. No new directories or modules needed. The changes are scoped to 4 source files and 2 test files.

## Complexity Tracking

No constitution violations. No justifications required.
