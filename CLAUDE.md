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

## Architecture

Git Explorer is a Next.js app that analyzes a local git repository and renders interactive visualizations of file co-change patterns.

**Request flow:**

1. `app/page.tsx` — main orchestrator. Holds state (`repoPath`, `graphData`, `dateRange`). Sends `POST /api/git-analysis` on user action or date range change.
2. `app/api/git-analysis/route.ts` — validates the path (must exist, must have `.git`), normalizes the time range preset, calls `analyzeRepository()`.
3. `app/services/git-controller.ts` — builds a `TimeRangeConfig`, calls `getCommits()` and `getCoChangeGraph()`, returns a `CoChangeGraph`.
4. `lib/git/analyzer.ts` — runs `git log --name-only --since=<date>` via simple-git, builds nodes (files) and links (co-commit pairs).
5. `lib/git/tree-builder.ts` — converts the flat file list into a nested `TreeNode` hierarchy for circle packing.

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
