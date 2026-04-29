# SCIP Symbol Deduplication Design

## Problem

The repo-graph visualization displays a star pattern where all edges appear to converge on the center. Investigation revealed three data-integrity bugs in the SCIP symbol pipeline that produce a corrupt graph:

1. **Local SCIP symbol collisions** — Local symbols like `local 3` are only unique within a single SCIP document (file), but are used as global keys in `nodeMap`. When multiple files contain `local 3`, they collide — the last write wins, and all edges targeting `local 3` across the entire codebase resolve to one node. Observed: nodes sharing `id: 'local 3'` with degree 3,986.

2. **Empty `scipSymbol` fallback** — When Tree-sitter finds a declaration but SCIP has no matching definition at the same position, `scipSymbol` defaults to `''`. Edges originating from these nodes get `fromSymbol: ''`, and all such edges collapse onto whichever node has `id: ''` in the graph. Observed: a `get` node with degree 26,413 (26% of all edges).

3. **Debug logging cleanup** — Temporary `console.table`/`console.log` calls were added to RepoGraph during investigation and need to be removed.

## Approach

Fix at extraction time (Approach A). The bugs originate in `node-extractor.ts` and `edge-extractor.ts`, so that's where the fix belongs. A shared `qualifySymbol` helper ensures consistency across both extractors.

## Design

### New file: `app/services/analysis/ts/symbol-utils.ts`

A single exported function:

```ts
export function qualifySymbol(filePath: string, symbol: string): string | null
```

Behavior:
- **Empty or missing symbol** → returns `null` (signals: skip this node/edge)
- **Local symbol** (starts with `local `) → returns `${filePath}#${symbol}` (globally unique)
- **Global symbol** → returns `symbol` unchanged (already unique)

### Changes to `node-extractor.ts`

In both extraction loops (regular declarations and arrow functions):

1. Get the raw symbol: `const rawSymbol = scipDef?.symbol ?? '';`
2. Qualify it: `const scipSymbol = qualifySymbol(filePath, rawSymbol);`
3. If `null`, skip the node: `if (scipSymbol === null) continue;`
4. Use the qualified symbol for `node.scipSymbol` and `nodeMap.set(scipSymbol, node)`

This eliminates empty-symbol nodes and makes local symbols globally unique in the `nodeMap`.

### Changes to `edge-extractor.ts`

In the occurrence loop:

1. Qualify `occ.symbol` for target lookup: `const qualifiedTarget = qualifySymbol(filePath, occ.symbol);`
   - Local symbols in SCIP always reference definitions in the same file, so qualifying with the current `filePath` is correct.
   - Global symbols pass through unchanged and match global keys in `nodeMap`.
2. Skip if `qualifiedTarget` is `null`: `if (qualifiedTarget === null) continue;`
3. Use `qualifiedTarget` for `nodeMap.get()`, `toSymbol`, and `outboundRefs[].scipSymbol`.
4. `fromSymbol` comes from `sourceNode?.scipSymbol`, which is already qualified from node extraction.
5. Skip edges where `fromSymbol` is empty/falsy (source node had no SCIP match and was dropped).

The dedup key (`${filePath}:${fromSymbol}|${qualifiedTarget}|${kind}`) uses qualified symbols, so dedup correctness is preserved.

### Changes to `RepoGraph.tsx`

Remove the debug logging block that was added during investigation (the `console.table`, `console.log` for total counts, and degree histogram).

### Downstream impact

The `scipSymbol` field flows through:
- `nodeMap` key (node-extractor) — now uses qualified symbols
- `edge.fromSymbol` / `edge.toSymbol` (edge-extractor) — now uses qualified symbols
- `node.referencedAt[].scipSymbol` / `node.outboundRefs[].scipSymbol` — now uses qualified symbols
- `SimpleNode.id` in RepoGraph — derived from `node.scipSymbol`, works unchanged
- `candidateIds` set in RepoGraph — derived from `node.scipSymbol`, works unchanged
- D3 `forceLink().id()` — matches on `SimpleNode.id`, works unchanged

All consumers compare these values against each other (never parse the symbol string), so the format change is transparent.

### What is NOT changed

- No dedup guard added to `RepoGraph.tsx` — fixing upstream is sufficient.
- No changes to `graph-config.ts`, `graph-assembler.ts`, or any other files.
- No changes to the SCIP indexer or reader.

## Testing

### New tests for `symbol-utils.ts`

- `qualifySymbol` returns `null` for empty string
- `qualifySymbol` returns `null` for undefined/missing input
- `qualifySymbol` qualifies `local N` symbols with file path
- `qualifySymbol` passes through global symbols unchanged

### Updated tests for `node-extractor.test.ts`

- Nodes with no SCIP match are excluded from output
- Nodes with local SCIP symbols have qualified `scipSymbol`
- `nodeMap` keys match qualified `scipSymbol` values

### Updated tests for `edge-extractor.test.ts`

- Edges with empty `fromSymbol` are excluded
- Edges targeting local symbols use qualified form in `toSymbol`
- `referencedAt` and `outboundRefs` use qualified symbols

## Expected outcome

After this fix:
- Node count will decrease (empty-symbol nodes dropped)
- Edge count will decrease significantly (false edges from collisions eliminated)
- Degree distribution will normalize (no more 26k or 3k degree hubs)
- The graph will display actual code relationships with nodes connected to their relevant neighbors
