# TypeScript Repository Graph — Design Spec

**Date:** 2026-04-07

## Overview

A new full-width force-directed graph visualization that maps the structure of a TypeScript repository. Nodes represent structural entities (folders, files, functions, classes, interfaces, imports). Edges represent inter-file relationships (imports, exports) and intra-file relationships (function calls). A right sidebar panel exposes a predicate-based rule system for controlling both physics and visual style conditionally, per node/edge kind and properties.

---

## Architecture

```
app/components/ts-graph/
  TsGraph.tsx          ← mounts D3 simulation, owns rule state, renders graph + sidebar
  ForcePanel.tsx       ← right sidebar: rule list with toggles, sliders, color inputs

app/api/ts-analysis/
  route.ts             ← POST /api/ts-analysis, validates repo path, calls analyzer

lib/ts/
  analyzer.ts          ← TypeScript Compiler API walker → TsGraphData
  types.ts             ← TsNode, TsEdge, ForceRule, Param types
  force-rules.ts       ← rule evaluator: given a node/edge + ruleset, returns merged force + style values
  default-rules.ts     ← baseline ruleset shipped with the component
```

`TsGraph` is added as a new section in `app/page.tsx`, below the existing `CirclePackingGraph`, following the same pattern as `ForceDirectedGraph` and `CirclePackingGraph`.

---

## Types

### Shared Helpers

```ts
interface Param {
  name: string
  type: string
}
```

### Node Base

```ts
interface TsNodeBase {
  id: string
  kind: NodeKind
  parent: string | null   // parent node id
  children: string[]      // child node ids
  siblings: string[]      // sibling node ids (excludes self; derivable from parent but stored for fast rule access)
}
```

### Node Kinds

```ts
type TsNode =
  | FolderNode
  | FileNode
  | FunctionNode
  | ClassNode
  | InterfaceNode
  | ImportNode

interface FolderNode extends TsNodeBase {
  kind: 'FOLDER'
  name: string
  path: string            // absolute path
  depth: number           // 0 = repo root
}

interface FileNode extends TsNodeBase {
  kind: 'FILE'
  name: string
  path: string            // absolute path
  fileType: 'ts' | 'tsx'
}

interface FunctionNode extends TsNodeBase {
  kind: 'FUNCTION'
  name: string
  params: Param[]
  returnType: string | null
}

interface ClassNode extends TsNodeBase {
  kind: 'CLASS'
  name: string
  extends: string | null  // base class name
  implements: string[]
  decorators: string[]
  constructorParams: Param[]
}

interface InterfaceNode extends TsNodeBase {
  kind: 'INTERFACE'
  name: string
  isExported: boolean
  propertyCount: number
  methodCount: number
  extends: string[]
}

interface ImportNode extends TsNodeBase {
  kind: 'IMPORT'
  name: string
  source: 'local' | 'package'  // local = in-project file, package = npm dependency
}
```

**Tree semantics per kind:**

| Kind | parent | children |
|------|--------|----------|
| FOLDER | parent FOLDER (null at root) | sub-FOLDERs + FILEs |
| FILE | containing FOLDER | FUNCTIONs, CLASSes, INTERFACEs declared in it |
| FUNCTION | containing FILE (or CLASS if method) | nested functions |
| CLASS | containing FILE | methods + properties |
| INTERFACE | containing FILE | property/method signatures |
| IMPORT | containing FOLDER if local, null if package | named exports (if tracked) |

Note: An in-project file appears as both a `FileNode` (source perspective) and an `ImportNode` (dependency perspective). These are separate nodes with separate IDs.

### Edge Base

```ts
interface TsEdgeBase {
  id: string
  type: 'import' | 'export' | 'call'
  source: string    // source node id
  target: string    // target node id
}
```

### Edge Kinds

```ts
type TsEdge = ImportEdge | ExportEdge | CallEdge

interface ImportEdge extends TsEdgeBase {
  type: 'import'
  // source: FileNode id → target: ImportNode id
  // inter-file
}

interface ExportEdge extends TsEdgeBase {
  type: 'export'
  isReexport: boolean
  // source: FileNode id → target: FunctionNode | ClassNode | InterfaceNode | FileNode id
  // inter-file
  // isReexport=true: barrel/re-export (FILE → FILE)
  // isReexport=false: declaration export (FILE → FUNCTION | CLASS | INTERFACE)
}

interface CallEdge extends TsEdgeBase {
  type: 'call'
  // source: FunctionNode id → target: FunctionNode | ImportNode id
  // intra-file
}
```

### Graph Data

```ts
interface TsGraphData {
  nodes: TsNode[]
  edges: TsEdge[]
}
```

---

## Force Rule System

Rules control both D3 simulation physics and visual style, evaluated per node/edge. First matching rule wins per property.

```ts
interface NodeForceRule {
  id: string
  label: string                        // shown in the UI panel
  enabled: boolean
  match: (node: TsNode) => boolean
  forces?: {
    charge?: number                    // forceManyBody strength (negative = repel, positive = attract)
    collideRadius?: number             // forceCollide radius
    centerStrength?: number            // forceCenter strength
    fx?: number | null                 // pin x position (null = unpin)
    fy?: number | null                 // pin y position (null = unpin)
    zone?: 'top' | 'bottom' | 'left' | 'right' | 'center'  // forceX/Y target zone
  }
  style?: {
    color?: string
    radius?: number
  }
}

interface EdgeForceRule {
  id: string
  label: string
  enabled: boolean
  match: (edge: TsEdge) => boolean
  forces?: {
    linkStrength?: number              // forceLink strength
    linkDistance?: number             // forceLink distance
  }
  style?: {
    color?: string
    width?: number
  }
}
```

### D3 Force Mapping

| D3 Force | Rule property | Behavior |
|---|---|---|
| `forceManyBody` | `charge` | node's gravitational pull/push on all others |
| `forceCollide` | `collideRadius` | minimum separation distance |
| `forceCenter` | `centerStrength` | pull toward canvas center |
| `forceX` / `forceY` | `zone`, `fx`, `fy` | positional anchoring |
| `forceLink` | `linkStrength`, `linkDistance` | spring behavior of edges |

All D3 forces accept per-node/edge accessor functions. The rule evaluator is called inside these accessors, returning the merged value for each node/edge by evaluating rules top-down and taking the first defined value per property.

### Rule Evaluator (`force-rules.ts`)

```ts
function evaluateNodeForces(node: TsNode, rules: NodeForceRule[]): ResolvedNodeForces
function evaluateNodeStyle(node: TsNode, rules: NodeForceRule[]): ResolvedNodeStyle
function evaluateEdgeForces(edge: TsEdge, rules: EdgeForceRule[]): ResolvedEdgeForces
function evaluateEdgeStyle(edge: TsEdge, rules: EdgeForceRule[]): ResolvedEdgeStyle
```

---

## UI Panel (Right Sidebar)

`ForcePanel.tsx` renders alongside the graph in `TsGraph.tsx`. The graph takes remaining width; the panel has a fixed width.

**Panel contents:**
- List of `NodeForceRule` and `EdgeForceRule` entries, each showing:
  - Toggle (enabled/disabled)
  - Label
  - Numeric inputs for each `forces` property defined on the rule
  - Color swatch + picker for `style.color`
  - Numeric input for `style.radius` or `style.width`
- Baseline rules from `default-rules.ts` are always present
- Rule state is held in `TsGraph` React state and passed down to both the D3 simulation and `ForcePanel`

---

## Analyzer (`lib/ts/analyzer.ts`)

Uses the TypeScript Compiler API (`ts.createProgram`) to walk all `.ts` and `.tsx` files in the target repo. For each file:

- Emits a `FileNode` and a `FolderNode` for its directory (deduped)
- Walks AST to emit `FunctionNode`, `ClassNode`, `InterfaceNode` for top-level declarations
- Emits `ImportNode` for each import source (deduped by specifier)
- Emits `ImportEdge` for each import statement
- Emits `ExportEdge` for each export declaration and re-export
- Emits `CallEdge` for each function call expression where the callee is declared in the same file (intra-file only; cross-file calls are represented by ImportEdges)
- Populates `parent`, `children`, `siblings` on all nodes after the full walk

Returns `TsGraphData`.

---

## API Endpoint (`app/api/ts-analysis/route.ts`)

```
POST /api/ts-analysis
Body: { repoPath: string }
Response: { success: true, data: TsGraphData } | { success: false, error: string }
```

Validates that `repoPath` exists and contains a `tsconfig.json`. Calls `analyzer.ts`. Returns graph data.

---

## Page Integration

`TsGraph` is added to `app/page.tsx` as a new section below `CirclePackingGraph`, rendered when `graphData` is available. It makes its own `POST /api/ts-analysis` call using the same `repoPath`.

---

## Out of Scope

- Type-checking or semantic analysis beyond what the Compiler API's AST provides
- Tracking method-level calls within classes
- Supporting non-TypeScript files (`.js`, `.jsx`)
- Persisting rule configurations across sessions
