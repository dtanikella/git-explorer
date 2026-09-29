# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Dev server (requires Node 20 via nvm)
npm run dev

# Build
npm run build

# Run all tests
npm test

# Run a single test file
npx jest __tests__/path/to/file.test.ts

# Watch mode
npm run test:watch

# Lint
npm run lint
```

All scripts source `~/.nvm/nvm.sh` and switch to Node 20 automatically.

**Requires difftastic >= 0.71.0** (binary named `difft`) on PATH for the diff view feature.
Install with `brew install difftastic` or `cargo install difftastic`.

## Architecture

Git Explorer is a Next.js app that analyzes a local git repository and renders interactive visualizations of code symbols, areas, and relationships.

**Request flow:**

1. `app/page.tsx` — main orchestrator. Holds state (`repoPath`, `activeTab`, selection). Calls `useSelectionState()` once per tab (graph and diff) for per-tab selection persistence.
2. `app/api/git-analysis/route.ts` — validates the path (must exist, must have `.git`), normalizes the time range preset, calls `analyzeRepository()`.
3. `app/services/git-controller.ts` — builds a `TimeRangeConfig`, calls `getCommits()` and `getCoChangeGraph()`, returns a `CoChangeGraph`.
4. `lib/git/analyzer.ts` — runs `git log --name-only --since=<date>` via simple-git, builds nodes (files) and links (co-commit pairs).
5. `lib/git/tree-builder.ts` — converts the flat file list into a nested `TreeNode` hierarchy for circle packing.

**Selection system** (`app/contexts/SelectionContext.tsx` + `app/components/selection/`):

- `useSelectionState(config)` — a hook that creates selection state + actions for one tab (Graph or Diff). Called once per tab in `page.tsx` so state survives tab switches.
- `SelectionProvider` — thin wrapper that takes a `value` prop (from `useSelectionState`) and provides it via context.
- `SelectionState` has: `explicitNodeIds`, `selectedAreaIds`, `excludedNodeIds`, `lockedNodeIds`, `lockedAreaIds`, `rowExpansions`, `focusKey`, `expansions`. `selectedNodeIds` is derived: explicit + (area members \ excluded). `expansions` (same-file, callers, callees) is derived by `computeExpansionGroups` from the whole-selection toggles plus per-row expansions, which are keyed by source (`n:` node, `a:` area, `h:` folder or file path); `focusKey` scopes the bottom group to one row.
- Every node, area, folder and file row has a funnel that focuses it; the expansion group then applies to that row alone. Reset and Clear remove all per-row expansions.
- `SearchSelectSidebar` — shared sidebar composes `SelectionToolbar`, `SelectionTree`, `ExpansionGroups`, `SelectionStats`.
- Supports tri-state area checkboxes, per-node exclusion inside checked areas, padlocks, shift-range selection, and copy-as-path#symbol.
- Diff tab seeds locks from changed nodes via `seedNodeIds`.
- `lib/selection/` — pure functions for candidate computation, tree building, stats, and format.

**Areas** (`lib/areas/types.ts`, `lib/areas/containment.ts`):`

- `Area` has `id`, `name`, `type`, `contains[]`, `parent`, `children[]`, `color`.
- `getDescendantIds()` / `getAncestorIds()` for hierarchy traversal.
- Area membership rolls up: checking an area selects all descendant members.
- Nodes can belong to several unrelated areas.

**Key types** (`lib/git/types.ts`):

- `CoChangeGraph` — top-level response: `{ nodes, links, packingData? }`
- `CoChangeNode` — `{ id, filename, radius }` where `radius` = commit count
- `CoChangeLink` — `{ source, target, value }` where `value` = co-occurrence count
- `TimeRangePreset` — `'2w' | '1m' | '3m' | '6m' | '1y'`
- `CommitRecord` — `{ sha, date, files[] }`

**Visualizations** (all in `app/components/`):

- `ForceDirectedGraph.tsx` — D3 force-directed network. Nodes = files, edges = co-change frequency. Draggable, zoomable, with hover tooltips.
- `CirclePackingGraph.tsx` — D3 circle packing of directory hierarchy. Click to zoom in/out.
- `FileOccurrenceTable.tsx` — sortable table of files by commit count. Tries to load `/components/df.csv`; falls back to graph data.

**Time range midpoint:** `lib/utils/date-helpers.ts` computes a midpoint date used to classify commits as "recent" vs. "total" within the analysis window.

**Color scale:** `lib/treemap/color-scale.ts` maps a 0–1 frequency score to a gray→green gradient.

**Browser fallback:** `lib/git/client-analyzer.ts` uses isomorphic-git + File System Access API as an alternative to the server-side simple-git path. Currently MVP only.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
