# Data Model: Activity Graph Visualization

**Date**: 2026-02-01  
**Feature**: Activity Graph Visualization  
**Branch**: 003-activity-graph-view

## Core Entities

### GraphNode

Represents a single file in the force-directed graph visualization.

**Purpose**: Extends d3-force's SimulationNodeDatum to include file metadata and rendering properties.

**Attributes**:
- `id: string` — Unique identifier (file path), used as React key
- `filePath: string` — Full file path from repository root
- `fileName: string` — Display name (last segment of path)
- `commitCount: number` — Number of commits touching this file in selected time range
- `radius: number` — Calculated bubble radius in pixels (derived from commitCount)
- `color: string` — Hex color based on file type (#E0115F for .rb, #ADD8E6 for .tsx, #808080 for others)
- `x?: number` — X coordinate (managed by d3-force simulation)
- `y?: number` — Y coordinate (managed by d3-force simulation)
- `vx?: number` — X velocity (managed by d3-force simulation)
- `vy?: number` — Y velocity (managed by d3-force simulation)
- `fx?: number | null` — Fixed X position (for dragging, optional)
- `fy?: number | null` — Fixed Y position (for dragging, optional)

**Relationships**:
- Derived from `TreeNode` (existing) via `transformTreeToGraph()`
- One `GraphNode` per file in the repository (up to 100 files)
- No parent-child relationships (flat structure)

**Lifecycle**:
1. Created from TreeNode leaf nodes by data transformer
2. Passed to d3.forceSimulation which adds x, y, vx, vy properties
3. Updated on every simulation tick (position changes)
4. Re-created when repository or time range changes

---

### ViewMode

Enumeration representing the selected visualization type.

**Purpose**: Controls which visualization component is rendered in the main page.

**Values**:
- `'heatmap'` — Treemap visualization (existing)
- `'activity-graph'` — Force-directed graph visualization (new)

**Usage**:
```typescript
type ViewMode = 'heatmap' | 'activity-graph';

// In page state
const [viewMode, setViewMode] = useState<ViewMode>('heatmap');

// In conditional rendering
{viewMode === 'heatmap' ? <TreemapChart /> : <ForceGraphChart />}
```

**Persistence**: Stored in React state, resets to 'heatmap' on page reload

---

### ForceSimulation (d3-force managed)

The d3-force simulation state managing node physics.

**Purpose**: Calculates node positions based on configured forces, runs until layout stabilizes.

**Properties** (managed by d3-force):
- `nodes()` — Array of GraphNode objects
- `alpha()` — Current "heat" of simulation (1.0 = hot/moving, 0.0 = cold/stable)
- `alphaTarget()` — Target alpha value
- `alphaDecay()` — Rate at which alpha decreases each tick
- `velocityDecay()` — Friction coefficient

**Forces**:
- `collision` — forceCollide with radius = node.radius + 2px padding
- `center` — forceCenter at (width/2, height/2) with strength 0.05
- `charge` — forceManyBody with strength -80 (gentle repulsion)

**Lifecycle**:
1. Created in useEffect when nodes/dimensions change
2. Runs automatically via `requestAnimationFrame`
3. Fires 'tick' events for position updates
4. Stops when alpha < 0.001 or manually stopped
5. Cleaned up on component unmount

---

### ZoomTransform (d3-zoom managed)

Represents the current pan and zoom state of the graph.

**Purpose**: Encapsulates SVG transform (translate + scale) for interactive navigation.

**Properties** (managed by d3-zoom):
- `x: number` — Translation on X axis (in pixels)
- `y: number` — Translation on Y axis (in pixels)
- `k: number` — Scale factor (1.0 = no zoom, 2.0 = 200%, 0.5 = 50%)

**Constraints**:
- Scale extent: [0.5, 5.0] — Can zoom out to 50%, zoom in to 500%

**Operations**:
- `translate(x, y)` — Pan by offset
- `scale(k)` — Zoom to scale factor
- `toString()` — Returns CSS transform string for SVG

**Lifecycle**:
1. Initialized to identity transform (x=0, y=0, k=1) on mount
2. Updated by d3-zoom on wheel/drag/pinch events
3. Applied to graph container group via `transform` attribute
4. Reset to identity on double-click

---

## Supporting Types

### FileTypeColor

Type definition for color mapping result.

```typescript
type FileTypeColor = '#E0115F' | '#ADD8E6' | '#808080';
// Ruby red    | Light blue | Gray
```

---

### ViewToggleProps

Component props for the view toggle control.

```typescript
interface ViewToggleProps {
  selected: ViewMode;
  onViewChange: (mode: ViewMode) => void;
  disabled?: boolean;
}
```

---

### ForceGraphChartProps

Component props for the force-directed graph visualization.

```typescript
interface ForceGraphChartProps {
  data: TreeNode;           // Same as TreemapChart (reuse existing data)
  width: number;            // Viewport width in pixels
  height: number;           // Viewport height in pixels
  onNodeClick?: (node: GraphNode) => void;  // Optional interaction handler
}
```

---

### ColorLegendProps (Extended)

Extended props for conditional legend rendering.

```typescript
interface ColorLegendProps {
  mode: 'gradient' | 'discrete';
  colors?: Array<{
    label: string;
    color: string;
  }>;
}
```

---

## Data Flow

```
TreeNode (from API)
    ↓
transformTreeToGraph()
    ↓
GraphNode[] (flat array)
    ↓
d3.forceSimulation()
    ↓
GraphNode[] (with x, y positions)
    ↓
ForceGraphChart component
    ↓
SVG rendering (circles + text)
```

---

## State Management

### Page-level State (app/page.tsx)

```typescript
const [viewMode, setViewMode] = useState<ViewMode>('heatmap');
const [treeData, setTreeData] = useState<TreeNode | null>(null);
const [repoPath, setRepoPath] = useState<string>('');
const [timeRange, setTimeRange] = useState<TimeRangePreset>('1m');
```

**State Sharing**:
- `treeData` shared between TreemapChart and ForceGraphChart
- `repoPath` and `timeRange` persist across view toggle
- `viewMode` determines which visualization renders

### Component-level State (ForceGraphChart)

```typescript
const [nodes, setNodes] = useState<GraphNode[]>([]);
const simulationRef = useRef<d3.Simulation<GraphNode, undefined>>();
const svgRef = useRef<SVGSVGElement>(null);
```

**Derived State**:
- `nodes` derived from `props.data` via transformation
- Simulation and zoom behaviors stored in refs (not state)

---

## Validation Rules

### GraphNode Validation
- `commitCount` must be > 0 (files with 0 commits are not included)
- `radius` must be between 8 and 40 pixels
- `color` must be valid hex color (#RRGGBB format)
- `x` and `y` must be finite numbers (not NaN or Infinity)

### ViewMode Validation
- Must be one of: 'heatmap' | 'activity-graph'
- Default to 'heatmap' if invalid value provided

---

## Constraints

- Maximum 100 GraphNodes (inherited from existing TreeNode limit)
- Minimum bubble radius: 8px (ensures visibility)
- Maximum bubble radius: 40px (prevents domination)
- Force simulation stops at alpha < 0.001 (performance optimization)
- Zoom scale extent: [0.5, 5.0] (usability bounds)

---

## Future Extensions

*These are out of scope for current implementation but documented for future reference:*

- **Link forces**: Connect files in same directory with edges
- **Node dragging**: Allow manual repositioning with fx/fy properties
- **Clustering**: Group nodes by directory structure
- **Tooltips**: Show commit details on hover
- **Animation**: Smooth transitions when data updates
