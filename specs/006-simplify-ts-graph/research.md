# Research: Simplify TS Graph Edges & Hide Test Files

**Date**: 2026-04-08
**Feature**: [spec.md](spec.md)

## Research Questions & Findings

### R1: How are `contains` edges currently structured?

**Context**: The spec requires keeping only file→parent-folder and folder→parent-folder structural edges. We need to verify that the analyzer already emits these as distinct `contains` edges.

**Finding**: In `lib/ts/analyzer.ts` (5th pass, lines ~590–605), contains edges are emitted for:
- `FOLDER → child-FOLDER` (folder→folder)
- `FOLDER → FILE` (folder→file)

The edge direction is **parent→child** (source=folder, target=file/folder). The spec describes the edges as **child→parent** conceptually, but the data model stores them parent→child. This is a display concern, not a data model change. The existing `contains` edges already represent exactly the two structural relationships we need.

**Decision**: Keep the existing `contains` edge emission unchanged. Edge filtering will retain only `contains` edges (which are already file→folder and folder→folder) and `call` edges. Import and export edges are removed.
**Alternatives considered**: Introducing a new edge type (e.g., `structural`); rejected because `contains` already maps 1:1 to the needed relationships.

---

### R2: How to cap structural edge length at 100px in D3?

**Context**: FR-001 and FR-002 require structural edges to have a "maximum visual length of 100 pixels."

**Finding**: D3 force simulation uses `linkDistance` to set the *resting* (target) distance for edges — it does not enforce a hard max. Nodes can drift beyond this distance if other forces (charge, collision) push them apart. However, setting a short `linkDistance` (e.g., 60-80) with moderate `linkStrength` (0.5-0.8) will keep structural edges short. The existing `contains-edges` rule already uses `linkDistance: 60, linkStrength: 0.2`.

To more strongly enforce short edges, we can:
1. Increase `linkStrength` to 0.6-0.8 for structural edges (stronger pull = shorter resting distance)
2. Set `linkDistance: 80` or `100` as the desired length

A hard 100px cap would require clamping positions in the tick handler, but this conflicts with force simulation physics and causes jitter. The standard D3 approach is to use `linkDistance` + `linkStrength` to approximate the desired max length. With fewer total edges (import/export removed), structural edges will naturally stay closer to their target distance.

**Decision**: Set structural edge rules to `{ linkDistance: 100, linkStrength: 0.6 }`. This approximates a 100px max without requiring tick-level clamping. The reduced edge count will also help edges stay near their resting length.
**Alternatives considered**: Tick-handler position clamping; rejected due to jitter and non-standard D3 usage.

---

### R3: How does the toggle trigger server re-analysis?

**Context**: The "Hide test files" toggle must trigger a new API call with `hideTestFiles` parameter.

**Finding**: In `TsGraph.tsx`, the data-fetching effect (line ~80) depends on `repoPath`:
```tsx
useEffect(() => {
  fetch('/api/ts-analysis', {
    method: 'POST',
    body: JSON.stringify({ repoPath }),
  })
  ...
}, [repoPath]);
```

To trigger re-analysis on toggle change:
1. Add `hideTestFiles` state (default: `true`) in TsGraph
2. Include `hideTestFiles` in the fetch body
3. Add `hideTestFiles` to the effect's dependency array

When the user toggles, the state changes, the effect re-runs, and a new API call is made with the updated parameter. The API route passes it to the analyzer, which skips test files during the first pass if `true`.

**Decision**: Add `hideTestFiles` as a boolean query parameter in the API body, propagated to `analyzeTypeScriptRepo(repoPath, { hideTestFiles })`. The fetch effect depends on `[repoPath, hideTestFiles]`.
**Alternatives considered**: Client-side filtering (filter out test nodes after receiving them); rejected because spec FR-009 requires excluding them from processing entirely.

---

### R4: Where to filter edge types?

**Context**: We need to remove import and export edges. Should we filter in the analyzer (don't emit them) or in the frontend (don't render them)?

**Finding**: The analyzer currently builds import/export edges as part of its analysis logic. Some import edges are used to resolve cross-file references (e.g., resolving local import specifiers to FileNodes for call edge resolution). Removing import edge *emission* from the analyzer could be done without breaking call resolution since the `pendingLocalImports` array is processed independently.

However, the simplest approach is: **stop emitting import/export edges entirely in the analyzer**. The analyzer already tracks import relationships in `pendingLocalImports` and `pendingReexports` for call resolution purposes — these internal data structures don't need to produce edges in the output.

**Decision**: Remove import and export edges at the analyzer level. The analyzer still creates ImportNode objects and resolves local imports (needed for cross-file call tracking), but does not emit `import` or `export` typed edges into the output. Contains and call edges remain.
**Alternatives considered**: Client-side filtering via edge rules (set `enabled: false`); viable but leaves unused data on the wire. Analyzer-level removal is cleaner per YAGNI.

---

### R5: How to handle empty folders when test files are hidden?

**Context**: FR-012 requires removing folders that contain only test files when test files are hidden.

**Finding**: The `ensureFolderChain` function creates folder nodes eagerly as files are encountered. If we skip test files in the first pass, some folders may be created speculatively (e.g., `__tests__` folder created because a parent chain triggers before we know all its children are test files). 

The cleanest approach: after the main analysis passes complete, do a post-processing sweep that removes folder nodes with zero children (after test file pruning has removed their child nodes). This is simpler than trying to track folder child counts during analysis.

**Decision**: Add a post-processing step after test file filtering: iterate folder nodes and remove any that have zero children remaining. Also remove their contains edges. Repeat until stable (cascading: removing `__tests__` folder may leave its parent folder empty too).
**Alternatives considered**: Tracking folder child counts during analysis; rejected as more complex and fragile.

---

### R6: What about nodes other than test files — import nodes, class nodes, interface nodes?

**Context**: Currently, import/export edges connect to ImportNode objects. If we stop emitting import edges, should ImportNodes still exist in the graph?

**Finding**: ImportNodes are currently visualized as small circles (local imports: gray, package imports: blue). With all import/export edges removed, these nodes become disconnected — no edges connect to them. Disconnected nodes in a force simulation drift randomly and add clutter.

**Decision**: Remove ImportNode creation entirely from the output when their edges are removed. The analyzer still uses import information internally for call resolution, but ImportNodes are not added to the `nodes` array. This removes a full node category from the graph.
**Alternatives considered**: Keeping ImportNodes as disconnected dots; rejected because disconnected nodes add noise and serve no visualization purpose without their edges.

## Summary of Decisions

| # | Decision | Impact |
|---|----------|--------|
| R1 | Keep `contains` edge structure unchanged | Zero changes to edge emission logic for structural edges |
| R2 | `linkDistance: 100, linkStrength: 0.6` for structural edges | Update `default-rules.ts` contains-edges rule |
| R3 | `hideTestFiles` boolean in API body, deploys to effect deps | Modify route.ts, TsGraph.tsx, analyzer.ts signature |
| R4 | Stop emitting import/export edges at analyzer level | Remove edge pushes for import/export in analyzer.ts |
| R5 | Post-processing sweep removes empty folders | New cleanup pass at end of analyzer.ts |
| R6 | Stop emitting ImportNodes to output | Don't push ImportNodes to `nodes` array |
