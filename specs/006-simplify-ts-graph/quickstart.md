# Quickstart: Simplify TS Graph Edges & Hide Test Files

**Date**: 2026-04-08
**Feature**: [spec.md](spec.md)

## Overview

This feature makes two changes to the TypeScript graph visualization:

1. **Edge simplification**: Only three edge types remain — file→folder, folder→folder (structural), and function→function (calls). Import and export edges are removed entirely.
2. **Hide test files toggle**: A toggle at the top of the graph view (on by default) excludes test files from server-side analysis.

## Files to Change

| File | Change Summary |
|------|---------------|
| `lib/ts/analyzer.ts` | Add `hideTestFiles` option; skip test files when enabled; stop emitting import/export edges; stop emitting ImportNodes; add empty-folder pruning pass |
| `app/api/ts-analysis/route.ts` | Accept `hideTestFiles` from request body, pass to analyzer |
| `app/components/ts-graph/TsGraph.tsx` | Add `hideTestFiles` state + toggle UI; include in API call; add to effect deps |
| `lib/ts/default-rules.ts` | Update structural edge rule (`linkDistance: 100`, `linkStrength: 0.6`); remove import/export edge rules; remove import node rules |

## Implementation Order

### Step 1: Tests first (TDD — Constitution Principle I)

Write failing tests:
- **Unit**: `analyzeTypeScriptRepo()` with `hideTestFiles=true` returns zero test file nodes
- **Unit**: `analyzeTypeScriptRepo()` returns zero import/export edges
- **Unit**: `analyzeTypeScriptRepo()` returns only contains + call edges
- **Unit**: Empty folders are pruned when all children are test files
- **Integration**: `POST /api/ts-analysis` with `hideTestFiles=true` excludes test nodes
- **Integration**: `POST /api/ts-analysis` with `hideTestFiles=false` includes test nodes

### Step 2: Analyzer changes (`lib/ts/analyzer.ts`)

1. Add `options?: { hideTestFiles?: boolean }` parameter (default `true`)
2. In the first pass loop, skip source files matching `isTestFile()` when `hideTestFiles` is true
3. Stop pushing import edges to `edges[]` (remove `edges.push(importEdge)` calls)
4. Stop pushing export edges to `edges[]` (remove `edges.push({type:'export'...})` calls)
5. Stop pushing re-export edges (remove from `pendingReexports` processing)
6. Stop pushing ImportNodes to `nodes[]` (keep internal maps for call resolution)
7. Add post-processing: remove folders with zero children, cascade upward

### Step 3: API route changes (`app/api/ts-analysis/route.ts`)

1. Extract `hideTestFiles` from request body (default `true`)
2. Pass `{ hideTestFiles }` to `analyzeTypeScriptRepo()`

### Step 4: Frontend changes (`app/components/ts-graph/TsGraph.tsx`)

1. Add `const [hideTestFiles, setHideTestFiles] = useState(true)`
2. Include `hideTestFiles` in fetch body
3. Add `hideTestFiles` to effect dependency array
4. Render toggle checkbox above the graph SVG

### Step 5: Default rules update (`lib/ts/default-rules.ts`)

1. Update `contains-edges` rule: `linkDistance: 100`, `linkStrength: 0.6`
2. Remove `import-edges` rule
3. Remove `export-edges` rule
4. Remove `import-local` and `import-package` node rules

### Step 6: Verify all tests pass

Run `npm test` and confirm all new + existing tests pass.

## Development Commands

```bash
# Run tests in watch mode during development
npm run test:watch

# Run specific test file
npx jest __tests__/unit/ts-analyzer.test.ts

# Start dev server to test visually
npm run dev
```
