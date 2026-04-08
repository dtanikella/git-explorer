# Data Model: Simplify TS Graph Edges & Hide Test Files

**Date**: 2026-04-08
**Feature**: [spec.md](spec.md)

## Entity Changes

This feature modifies the **behavior** of existing entities, not their structure. No new types are introduced.

### Existing Types (unchanged)

| Type | Location | Change |
|------|----------|--------|
| `TsNode` (union) | `lib/ts/types.ts` | No change |
| `TsEdge` (union) | `lib/ts/types.ts` | No change |
| `TsGraphData` | `lib/ts/types.ts` | No change |
| `ContainsEdge` | `lib/ts/types.ts` | No change |
| `CallEdge` | `lib/ts/types.ts` | No change |
| `ImportEdge` | `lib/ts/types.ts` | No change (type still exists, just not emitted) |
| `ExportEdge` | `lib/ts/types.ts` | No change (type still exists, just not emitted) |
| `ImportNode` | `lib/ts/types.ts` | No change (type still exists, just not emitted) |
| `NodeForceRule` | `lib/ts/types.ts` | No change |
| `EdgeForceRule` | `lib/ts/types.ts` | No change |

### New Interface: Analyzer Options

```typescript
// Added to lib/ts/analyzer.ts (not types.ts — internal to analyzer)
interface AnalyzerOptions {
  hideTestFiles?: boolean;  // default: true
}
```

This is a function parameter interface, not a data model entity. It controls analyzer behavior.

## Data Flow Changes

### Before (current)

```
TsGraph.tsx → POST /api/ts-analysis { repoPath }
           → analyzeTypeScriptRepo(repoPath)
           → returns { nodes: [Folder, File, Function, Class, Interface, Import], 
                        edges: [contains, import, export, call] }
```

### After (simplified)

```
TsGraph.tsx → POST /api/ts-analysis { repoPath, hideTestFiles }
           → analyzeTypeScriptRepo(repoPath, { hideTestFiles })
           → returns { nodes: [Folder, File, Function, Class, Interface],  // no ImportNode
                        edges: [contains, call] }                          // no import/export
```

When `hideTestFiles=true` (default), additionally:
- Files matching test patterns are skipped during parsing
- Their child nodes (functions, classes, interfaces) are never created
- Empty folders (those with only test file children) are pruned post-analysis
- Contains edges to pruned nodes are removed
- Call edges to/from test file functions are removed

## Edge Categories in Simplified Graph

| Edge Type | Source Node | Target Node | Kept? | Styling |
|-----------|-------------|-------------|-------|---------|
| `contains` | Folder | Folder | ✅ Yes | gray, `linkDistance: 100`, `linkStrength: 0.6` |
| `contains` | Folder | File | ✅ Yes | gray, `linkDistance: 100`, `linkStrength: 0.6` |
| `call` | Function | Function | ✅ Yes | existing scope-based colors |
| `import` | File | ImportNode | ❌ Removed | — |
| `import` | ImportNode | File | ❌ Removed | — |
| `export` | File | Function/Class/Interface | ❌ Removed | — |
| `export` | File | File (re-export) | ❌ Removed | — |

## Node Categories in Simplified Graph

| Node Kind | Kept? | Notes |
|-----------|-------|-------|
| `FOLDER` | ✅ Yes | Pruned if empty after test file removal |
| `FILE` | ✅ Yes | Test files excluded when `hideTestFiles=true` |
| `FUNCTION` | ✅ Yes | Children of test files excluded with their parent |
| `CLASS` | ✅ Yes | Children of test files excluded with their parent |
| `INTERFACE` | ✅ Yes | Children of test files excluded with their parent |
| `IMPORT` | ❌ Removed | No edges connect to them; omitted from output |

## State Changes in TsGraph.tsx

| State Variable | Type | Default | Purpose |
|----------------|------|---------|---------|
| `hideTestFiles` | `boolean` | `true` | Controls whether test files are excluded from analysis |

This state is included in the API request body and added to the fetch effect's dependency array, triggering re-analysis on toggle.
