# Data Model: Co-Change Network Visualization

**Feature**: 004-cochange-network | **Date**: 2026-02-01

## Entity Definitions

### GraphNode

Represents a file in the force-directed network graph.

**Attributes**:
- `id` (string): Unique identifier, set to file path for consistency
- `filePath` (string): Full file path from repository root
- `fileName` (string): Display name (last segment of path, e.g., "Component.tsx")
- `commitCount` (number): Total number of commits modifying this file in time range
- `radius` (number): Calculated circle radius in pixels, range [8, 40]
- `color` (string): Hex color code based on file type extension
- `x` (number, optional): X-coordinate position, mutated by D3 simulation
- `y` (number, optional): Y-coordinate position, mutated by D3 simulation  
- `vx` (number, optional): X-velocity, added by D3 force simulation
- `vy` (number, optional): Y-velocity, added by D3 force simulation
- `fx` (number, optional): Fixed X-position during drag, set/cleared by drag handlers
- `fy` (number, optional): Fixed Y-position during drag, set/cleared by drag handlers

**Validation Rules**:
- `id` and `filePath` must be non-empty strings
- `commitCount` must be positive integer
- `radius` must be within [8, 40] range
- `color` must be valid hex color format

**State Transitions**:
- Created: Initial state when transformed from TreeNode, has all required fields
- Simulating: D3 adds `x`, `y`, `vx`, `vy` during force simulation tick updates
- Dragging: User interaction sets `fx`, `fy` to fix position
- Released: `fx`, `fy` cleared, node subject to forces again

**Relationships**:
- Source of zero or more GraphLink connections
- Target of zero or more GraphLink connections

---

### GraphLink

Represents a co-change relationship between two files.

**Attributes**:
- `source` (string | GraphNode): Source node identifier or object reference
- `target` (string | GraphNode): Target node identifier or object reference
- `value` (number): Co-occurrence frequency (number of commits where both files modified)
- `index` (number, optional): Link index in array, added by D3

**Validation Rules**:
- `source` and `target` must reference valid GraphNode ids
- `source` and `target` must be different (no self-loops)
- `value` must be positive integer (≥1, only create link if files co-occurred)
- Link pair must be unique (no duplicate source-target combinations)

**State Transitions**:
- Created: Initial state from co-occurrence calculation, has `{source, target, value}`
- Bound: D3 replaces string ids with object references during simulation initialization
- Simulating: D3 may add computed properties for link force calculations

**Relationships**:
- Connects exactly two GraphNode entities (source and target)
- Bidirectional: AB link represents both A→B and B→A relationships

---

### CommitRecord

Represents a single git commit (existing type, no changes).

**Attributes**:
- `sha` (string): Commit SHA hash
- `date` (Date): Commit timestamp
- `files` (string[]): Array of file paths modified in this commit

**Usage in Feature**:
- Input to co-occurrence calculation utility
- Included in API response for Phase 3 integration
- Filtered to only include files in top 50 set before processing

---

### GraphData

Container for complete graph visualization data.

**Attributes**:
- `nodes` (GraphNode[]): Array of file nodes to render
- `links` (GraphLink[]): Array of co-change connections between nodes

**Validation Rules**:
- `nodes` array must contain at least 1 node
- All link `source` and `target` values must reference valid node `id`s
- No orphaned links (links referencing non-existent nodes)

**Derivation**:
- Phase 1: Hardcoded example data matching Observable structure
- Phase 3: Generated from TreeNode + CommitRecord[] via transformation utilities

---

## Data Flows

### Phase 1: Example Data Flow
```
HardcodedData → GraphData → ForceGraphChart → D3 Simulation → SVG Render
```

### Phase 3: Production Data Flow
```
User Input (repo path, time range)
  ↓
API: /api/git-analysis
  ↓ (fetch git commits)
Git Repository
  ↓ (simple-git analysis)
CommitRecord[] + TreeNode
  ↓ (server response)
Client: page.tsx
  ↓ (transformTreeToGraph)
GraphNode[] (top 50 files)
  ↓ (calculateCoOccurrence)
GraphLink[] (co-change pairs)
  ↓ (combine)
GraphData {nodes, links}
  ↓ (pass as prop)
ForceGraphChart
  ↓ (D3 force simulation)
Interactive Network Visualization
```

### Co-Occurrence Calculation Flow
```
CommitRecord[] + Set<fileIds>
  ↓
For each commit:
  Filter files to only top 50
  Generate all file pairs (i, j where i < j)
  Increment count in Map<pairKey, count>
  ↓
Map<"fileA::fileB", frequency>
  ↓
Transform to GraphLink[]
  {source: "fileA", target: "fileB", value: frequency}
```

## Type Definitions

```typescript
// lib/treemap/data-transformer.ts (extend existing)
import { SimulationNodeDatum, SimulationLinkDatum } from 'd3-force';

export interface GraphNode extends SimulationNodeDatum {
  id: string;
  filePath: string;
  fileName: string;
  commitCount: number;
  radius: number;
  color: string;
  // x, y, vx, vy, fx, fy inherited from SimulationNodeDatum
}

export interface GraphLink extends SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
  value: number;
  // index inherited from SimulationLinkDatum
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

// lib/utils/data-helpers.ts (new file)
export interface CoOccurrenceResult {
  nodes: GraphNode[];
  links: GraphLink[];
}
```

## Invariants

1. **Link Validity**: Every link's `source` and `target` must reference an existing node `id`
2. **No Duplicates**: No two links can have the same `source`-`target` pair (order-independent)
3. **Positive Values**: All `value` (co-occurrence) counts must be ≥1
4. **Bidirectionality**: Links represent symmetric relationships (AB link implies BA)
5. **Node Uniqueness**: Each node `id` must be unique within `nodes` array
6. **Top 50 Limit**: Maximum 50 nodes in production data
7. **Link Boundaries**: With 50 nodes, maximum 1,225 possible links (50 choose 2)

## Edge Case Handling

| Scenario | Behavior |
|----------|----------|
| No co-occurrences | `links` array is empty, nodes render without connections |
| Single node | `nodes` array length 1, `links` array empty |
| All files same co-change frequency | All links render with same stroke width (middle of range: 3px) and same distance (55px) |
| File modified alone (no co-changes) | Node appears in `nodes`, no links with that node as source/target |
| Co-occurred once | Link renders with minimum stroke width (1px) and maximum distance (100px) |
| Very high co-occurrence (outlier) | Scale `.clamp(true)` caps at maximum stroke width (5px) and minimum distance (10px) |
