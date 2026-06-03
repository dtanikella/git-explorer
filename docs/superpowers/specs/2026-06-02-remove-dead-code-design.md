# Remove Dead Code — Keep Only RepoGraph + Analysis Pipeline

**Date:** 2026-06-02
**Issue:** #28
**Branch:** `cleanup/remove-dead-code`

## Summary

Strip all legacy visualization code (git co-change analysis, tree-sitter parsing, stats treemap, tab sidebar) from the codebase. The app retains only the SCIP-based RepoGraph visualization and its supporting analysis pipeline.

## Approach

Top-down: simplify `page.tsx` first (remove dead imports, state, and UI), then bulk-delete all orphaned files, then clean up tests. Single commit.

## page.tsx Simplification

### Remove

- **Imports:** TabSidebar, GraphToolbar, StatsToolbar, StatsTreemap, TabId, INTERNAL_PROCESSING_CONFIG
- **State:** `activeTab`, `selectedView`, `topN`, `searchQuery`, `searchNotFound`, `searchHandlerRef`, `highlightedNodeId`
- **Callbacks:** `handleSearch`, `handleRegisterSearch`, `handleNodeSelect`
- **Effects:** highlight-clear timeout effect
- **Constants:** `VIEW_OPTIONS`

### Keep

- `repoPath` + `hideTestFiles` state
- `analysisData` / `loading` / `error` state + fetch `useEffect` calling `/api/repo-analysis`
- `handleRepositorySelect`
- `RepositorySelector` and `RepoGraph` components

### Config

Pass `createModulesViewConfig` directly as the RepoGraph `config` prop (imported from `@/lib/analysis/graph-config`).

### Layout

Simple column: RepositorySelector on top, RepoGraph filling remaining space. Inline toggle for `hideTestFiles`.

## Files & Directories to Delete

### Components

| Path | Contents |
|------|----------|
| `app/components/ts-graph/` | TsGraph.tsx |
| `app/components/stats/` | StatsToolbar, StatsTreemap, treemap-utils |
| `app/components/graph/GraphToolbar.tsx` | GraphToolbar (remove `graph/` dir if empty) |
| `app/components/TabSidebar.tsx` | Tab sidebar |

### API Routes

| Path | Contents |
|------|----------|
| `app/api/git-analysis/` | Git co-change analysis endpoint |
| `app/api/ts-analysis/` | Tree-sitter analysis endpoint |

### Services

| Path | Contents |
|------|----------|
| `app/services/git-controller.ts` | Git analysis controller |

### Libraries

| Path | Contents |
|------|----------|
| `lib/git/` | analyzer, client-analyzer, tree-builder, types |
| `lib/tree-sitter/` | language, node, parser, query, tree, types |
| `lib/ts/` | analyzer, default-rules, force-rules, types |
| `lib/utils/date-helpers.ts` | Date helpers (remove `utils/` dir if empty) |

### Tests

| Path | Reason |
|------|--------|
| `__tests__/components/StatsTreemap.test.tsx` | Tests deleted component |
| `__tests__/components/TabSidebar.test.tsx` | Tests deleted component |
| `__tests__/components/TsGraph.test.tsx` | Tests deleted component |
| `__tests__/components/ViewToggle.test.tsx` | Tests removed UI feature |
| `__tests__/unit/git-analyzer.test.ts` | Tests deleted module |
| `__tests__/unit/tree-builder.test.ts` | Tests deleted module |
| `__tests__/unit/treemap-utils.test.ts` | Tests deleted module |
| `__tests__/unit/ts-analyzer.test.ts` | Tests deleted module |
| `__tests__/unit/ts-types.test.ts` | Tests deleted module |
| `__tests__/unit/force-rules.test.ts` | Tests deleted module |
| `__tests__/unit/tree-sitter-language.test.ts` | Tests deleted module |
| `__tests__/unit/tree-sitter-node.test.ts` | Tests deleted module |
| `__tests__/unit/tree-sitter-parser.test.ts` | Tests deleted module |
| `__tests__/unit/tree-sitter-query.test.ts` | Tests deleted module |
| `__tests__/unit/tree-sitter-types.test.ts` | Tests deleted module |
| `__tests__/integration/git-analysis-api.test.ts` | Tests deleted endpoint |
| `__tests__/integration/ts-analysis-api.test.ts` | Tests deleted endpoint |
| `__tests__/integration/tree-sitter.integration.test.ts` | Tests deleted module |
| `__tests__/integration/view-switching.test.tsx` | Tests removed tab/view UI |
| `__tests__/page.test.tsx` | References deleted components (verify, may need updating instead) |

## What Stays (Unchanged)

- `app/components/repo-graph/RepoGraph.tsx`
- `app/components/RepositorySelector.tsx`
- `app/api/repo-analysis/`
- `app/api/browse-directory/`
- `app/services/analysis/`
- `lib/analysis/`
- `lib/scip/`
- `lib/sentry/`
- All tests for the above retained modules

## Verification

1. `npm run build` passes
2. `npm test` passes (remaining tests)
3. Grep confirms no stale imports of deleted modules

## Commit

Single commit: `Remove dead code — keep only RepoGraph + analysis pipeline`
Message body: `Closes #28`
