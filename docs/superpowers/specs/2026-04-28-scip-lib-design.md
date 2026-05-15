# SCIP Library Design Spec

**Issue:** [#16 — Introduce SCIP lib](https://github.com/dtanikella/git-explorer/issues/16)
**Date:** 2026-04-28
**Branch:** `organize-data-model`

## Problem

Git Explorer's TypeScript analyzer (`lib/ts/analyzer.ts`, ~44KB) manually walks the TS compiler API to extract code structure. This is complex, hard to maintain, and misses some cross-file relationships. SCIP (Source Code Intelligence Protocol) by Sourcegraph provides a standardized, language-agnostic code index with richer symbol and relationship data.

## Goal

Introduce a standalone SCIP library module that can:

1. Run `scip-typescript index` as a subprocess to produce an `index.scip` file
2. Cache the index in the target repo, keyed by git HEAD SHA
3. Read and deserialize the SCIP protobuf binary into JavaScript objects

This is a **standalone lib only** — no integration with the existing analyzer or visualization pipeline.

## Approach

Use `@sourcegraph/scip-typescript` (indexer CLI) and `@sourcegraph/scip-bindings` (pre-generated protobuf types + decoder) as npm dependencies. This gives us type-safe protobuf decoding with minimal setup.

## Module Structure

```
lib/scip/
├── types.ts          # Re-exports SCIP protobuf types + our wrapper types
├── reader.ts         # Reads index.scip, deserializes via scip-bindings
├── cache.ts          # Manages .git-explorer/ cache dir, HEAD SHA staleness check
└── ts/
    └── indexer.ts    # Spawns scip-typescript index, produces index.scip
```

The shared layer (`types.ts`, `reader.ts`, `cache.ts`) is language-agnostic — it works with any `index.scip` regardless of which SCIP indexer produced it. Language-specific indexers live in subdirectories (e.g., `ts/`, and later `go/`, `py/`, etc.).

## Dependencies

| Package | Purpose | Type |
|---|---|---|
| `@sourcegraph/scip-typescript` | CLI indexer for TypeScript | `dependencies` |
| `@sourcegraph/scip-bindings` | Protobuf types + decoder for `index.scip` | `dependencies` |

## Public API

### `lib/scip/ts/indexer.ts`

```ts
indexTypeScriptRepo(repoPath: string, options?: IndexOptions): Promise<IndexResult>
```

- Checks cache via `getCachedIndex()`
- If cache miss: resolves `scip-typescript` binary via `require.resolve`, runs `scip-typescript index --output <repoPath>/.git-explorer/index.scip` with `cwd: repoPath`
- Uses `execFile` (not `exec`) — no shell injection risk
- Updates cache metadata after indexing
- Returns `{ indexPath, fromCache }`

### `lib/scip/reader.ts`

```ts
readScipIndex(indexPath: string): Promise<ScipIndex>
```

- Reads binary `index.scip` file
- Decodes via the `Index.decode()` method from `@sourcegraph/scip-bindings` (exact import path to be verified during implementation against the installed package's exports)
- Returns the decoded protobuf `Index` object

### `lib/scip/cache.ts`

```ts
getCachedIndex(repoPath: string): Promise<CacheResult | null>
saveCachedIndex(repoPath: string, indexPath: string): Promise<void>
isCacheValid(repoPath: string): Promise<boolean>
```

- Cache location: `<targetRepo>/.git-explorer/`
- Cache key: `git rev-parse HEAD` SHA
- Metadata stored in `<targetRepo>/.git-explorer/cache-meta.json`:
  ```json
  { "headSha": "abc123...", "indexedAt": "2026-04-28T..." }
  ```

## Cache Strategy

```
<target-repo>/
└── .git-explorer/
    ├── index.scip      # SCIP index binary
    └── cache-meta.json # { "headSha": "...", "indexedAt": "..." }
```

**Cache flow:**

1. `indexer.ts` calls `getCachedIndex(repoPath)` before running the indexer
2. `cache.ts` reads `cache-meta.json`, compares `headSha` against current `git rev-parse HEAD`
3. SHA matches → return cached `index.scip` path (skip indexing)
4. SHA differs or no cache → return `null`, indexer runs subprocess
5. After indexing, `saveCachedIndex()` writes `index.scip` + updates `cache-meta.json`

**Important:** The cache key is strictly the HEAD commit SHA. Uncommitted/unstaged working tree changes do NOT trigger re-indexing. The index reflects the state of the last commit.

## Types

`lib/scip/types.ts` re-exports relevant types from `@sourcegraph/scip-bindings` so consumers don't need to depend on the bindings package directly:

```ts
// Re-exports from @sourcegraph/scip-bindings
export type { Index as ScipIndex } from '@sourcegraph/scip-bindings';
export type { Document as ScipDocument } from '@sourcegraph/scip-bindings';
export type { SymbolInformation as ScipSymbol } from '@sourcegraph/scip-bindings';
export type { Occurrence as ScipOccurrence } from '@sourcegraph/scip-bindings';

// Our wrapper types
export interface IndexResult {
  indexPath: string;
  fromCache: boolean;
}

export interface CacheResult {
  indexPath: string;
  headSha: string;
  indexedAt: string;
}

export interface IndexOptions {
  forceReindex?: boolean;  // Skip cache check
  timeout?: number;        // Kill subprocess after N ms (default: 60s)
}
```

## Error Handling

| Error Class | When Thrown | Recovery |
|---|---|---|
| `ScipIndexError` | `scip-typescript index` fails (non-zero exit, stderr) | Propagate to caller with exit code + stderr |
| `ScipReadError` | `index.scip` can't be read or decoded (corrupt, missing) | Propagate to caller |
| `ScipCacheError` | Cache operations fail (permissions, disk) | Non-fatal; fall back to re-indexing |

## Testing

- **Unit tests for `cache.ts`** — mock `fs` and `simple-git` to test SHA comparison, cache-meta read/write, invalidation logic
- **Unit tests for `reader.ts`** — use a small fixture `index.scip` file (generated once from a tiny TS project) to test deserialization
- **Integration test for `indexer.ts`** — run `scip-typescript index` on a minimal fixture project (`__tests__/fixtures/scip-test-project/` with 2 TS files + tsconfig.json) to verify end-to-end: indexing → caching → cache hit on re-read
- All test files use `.test.ts` extension (no JSX needed for backend lib)

## Out of Scope

- Integration with existing `lib/ts/analyzer.ts` or visualization components
- Transformation of SCIP data into `TsGraphData` types
- Browser/client-side usage
- Auto-modifying the target repo's `.gitignore`
