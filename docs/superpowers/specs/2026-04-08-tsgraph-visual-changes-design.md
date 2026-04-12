# TsGraph Visual Changes Design

**Date:** 2026-04-08
**Branch:** 005-ts-graph

## Overview

Five visual and structural changes to the TsGraph force-directed visualization:

1. Folders colored light gray
2. Folder-to-folder and folder-to-file hierarchy edges
3. Test files (and their children) styled light gray and very small
4. Local imports connected to the actual resolved FileNode (Option B: keep ImportNode, add ImportNode→FileNode edge)
5. Regular files styled gray, larger than test files

---

## 1. Node Styling

| Node | Color | Radius |
|---|---|---|
| FOLDER | `#d1d5db` (light gray) | 12 |
| FILE — regular (TS/TSX) | `#9ca3af` (gray) | 8 |
| FILE — test | `#e5e7eb` (lighter gray) | 3 |
| Children of test files (FUNCTION/CLASS/INTERFACE) | `#e5e7eb` | 2 |

Test file detection pattern: path contains `.test.ts`, `.test.tsx`, `.spec.ts`, `.spec.tsx`, or path segment `__tests__`.

To propagate test-file status to child nodes (functions/classes/interfaces declared within a test file), add `inTestFile?: boolean` to `TsNodeBase`. The analyzer sets this flag on all child nodes when it processes a test source file.

---

## 2. Hierarchy Edges (new `contains` type)

The `parent` field already exists on every node but no graph edges are emitted for these relationships. Add a `contains` edge type and emit it during analysis.

**Edges to emit:**
- `folder A → folder B` when folder B's parent is folder A
- `folder → file` when file's parent is that folder

**Style:** width `0.5`, color `#e5e7eb` (very light gray). No force strength changes needed — these edges should be visually structural but not pull strongly.

**New types:**
```ts
export interface ContainsEdge extends TsEdgeBase {
  type: 'contains';
}
// TsEdge = ImportEdge | ExportEdge | CallEdge | ContainsEdge
```

---

## 3. Import Resolution — Option B

**Current behavior:** `FileA → ImportNode:"./utils"`
**After change:** `FileA → ImportNode:"./utils" → resolved FileNode:"lib/utils.ts"`

Only applies to local imports (specifier starts with `.` or `/`) that resolve to a file within the repo. Package imports (`react`, `d3`, etc.) remain as-is.

**Implementation:** Collect all local imports in a deferred list during the first pass (same pattern as `pendingReexports`). After all FileNodes exist, resolve each specifier with `ts.resolveModuleName`. If the resolved file is in the repo and its FileNode exists in `nodeMap`, emit an `import` edge from `ImportNode → FileNode`.

---

## 4. Files Changed

| File | Change |
|---|---|
| `lib/ts/types.ts` | Add `inTestFile?: boolean` to `TsNodeBase`; add `ContainsEdge`; update `TsEdge` union |
| `lib/ts/analyzer.ts` | Mark test file children with `inTestFile: true`; emit `contains` edges; deferred local import resolution |
| `lib/ts/default-rules.ts` | New node/edge styles as above; add `contains` edge rule |
| `lib/ts/force-rules.ts` | Handle `contains` edge type in evaluators |

---

## 5. Out of Scope

- No changes to `TsGraph.tsx` rendering (no new SVG element types needed)
- No changes to `ForcePanel.tsx`
- No changes to the API route
- No dashed/dotted line styles (requires SVG `stroke-dasharray` — deferred)
