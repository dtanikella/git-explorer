# Contract: ForceGraphChart Component

**Version**: 2.0.0 (Network Graph) | **File**: `app/components/ForceGraphChart.tsx`

## Component: `ForceGraphChart`

Renders an interactive force-directed network graph visualization with nodes and links.

### Props Interface

```typescript
interface ForceGraphChartProps {
  /**
   * Graph data containing nodes and links
   */
  data: GraphData;

  /**
   * Chart width in pixels
   */
  width: number;

  /**
   * Chart height in pixels
   */
  height: number;

  /**
   * Optional callback when a file node is clicked
   */
  onNodeClick?: (node: GraphNode) => void;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}
```

### Props

**data** (`GraphData`)
- **Required**: Yes
- **Description**: Contains complete graph structure with nodes array and links array
- **Constraints**: 
  - `nodes` must have at least 1 element for non-empty state
  - All link `source`/`target` must reference valid node `id`s
  - Empty nodes array triggers "No Data to Display" fallback UI

**width** (`number`)
- **Required**: Yes
- **Description**: SVG viewport width in pixels
- **Constraints**: Positive integer, typically 800-1200px
- **Used for**: SVG dimensions, force center position (width/2)

**height** (`number`)
- **Required**: Yes
- **Description**: SVG viewport height in pixels
- **Constraints**: Positive integer, typically 600-800px
- **Used for**: SVG dimensions, force center position (height/2)

**onNodeClick** (`(node: GraphNode) => void`)
- **Required**: No (optional)
- **Description**: Callback fired when user clicks a node circle
- **Receives**: The clicked GraphNode object with all properties
- **Use cases**: Show file details modal, navigate to file view, etc.

### Rendering Behavior

**Initial Render**:
1. Transform GraphData to D3 simulation format
2. Initialize force simulation with nodes and links
3. Register continuous tick callback to update positions
4. Render SVG with link `<line>` elements and node `<circle>` elements
5. Attach drag handlers to nodes

**Continuous Updates**:
- On every simulation tick (up to 60fps via `requestAnimationFrame` throttling):
  - Update link line positions (`x1`, `y1`, `x2`, `y2` from node coordinates)
  - Update node circle positions (`cx`, `cy` from node coordinates)
  - Update node labels positions (for circles with radius >15)

**Link Rendering**:
- Rendered as SVG `<line>` elements
- Positioned beneath node circles (render order: links first, then nodes)
- Stroke width mapped from `link.value` via D3 linear scale: [1, 5]px
- Stroke color: Light gray or theme-appropriate color
- No direct interaction (click/hover) on links

**Node Rendering**:
- Rendered as SVG `<circle>` elements
- Radius from `node.radius` property [8, 40]px
- Fill color from `node.color` (file type color)
- White stroke (border)
- Hover effect: Reduced opacity (80%)
- Labels shown for circles with radius >15 (truncated to 12 chars with ellipsis)

**Empty State**:
- When `data.nodes.length === 0`
- Renders fallback UI: gray box with icon and "No Data to Display" message
- Provides user guidance: "No files found in the selected repository and time range"

### Interactions

**Node Dragging**:
1. **Mouse down**: Set `node.fx = node.x`, `node.fy = node.y` (fix position)
2. **Mouse move**: Update `node.fx`, `node.fy` to cursor position
3. **Mouse up**: Clear `node.fx`, `node.fy` (unfix, resume forces)
4. **During drag**: Connected links update in real-time via tick callback

**Node Click**:
- Fires `onNodeClick(node)` callback if provided
- Default behavior: None (no-op if callback not provided)

**Pan & Zoom**:
- Implemented via D3 zoom behavior
- Zoom extent: 0.5x to 5.0x
- Applies transform to entire graph `<g>` wrapper
- Links and nodes zoom together (preserved relationships)

### Force Simulation Configuration

**Forces Applied**:
```typescript
simulation
  .force('link', d3.forceLink(links)
    .id(d => d.id)
    .distance(d => linkDistanceScale(d.value))  // 10-100px based on co-change frequency
  )
  .force('charge', d3.forceManyBody()
    .strength(-150)  // Repulsion between nodes
  )
  .force('center', d3.forceCenter(width / 2, height / 2))
  .force('collide', d3.forceCollide()
    .radius(d => d.radius + 2)  // Prevent node overlap
  )
```

**Link Distance Scaling**:
- D3 linear scale with inverted range
- Domain: [minCoChangeFrequency, maxCoChangeFrequency] from link values
- Range: [100, 10] (high frequency → short distance, low frequency → long distance)
- Clamp: true (handles outliers)

**Stroke Width Scaling**:
- D3 linear scale
- Domain: [minCoChangeFrequency, maxCoChangeFrequency] from link values
- Range: [1, 5] (pixel values)
- Clamp: true (handles outliers)

**Edge Cases**:
- All links same value: Use fixed middle values (3px width, 55px distance)
- No links: Skip link force and link rendering
- Single node: Renders at center, no forces needed

### State Management

**Internal State**:
- `nodes`: GraphNode[] - Updated on every tick for position changes
- `zoomTransform`: D3 ZoomTransform - Updated on zoom/pan interactions

**Refs**:
- `svgRef`: Reference to SVG element for D3 manipulation
- `simulationRef`: Reference to D3 force simulation instance
- `zoomRef`: Reference to D3 zoom behavior instance

**Effects**:
1. **Simulation Effect**: Initializes and runs force simulation when `data` changes
2. **Zoom Effect**: Attaches zoom behavior to SVG when mounted
3. **Cleanup**: Stops simulation on unmount to prevent memory leaks

### Accessibility

- **ARIA role**: `role="img"` on SVG element
- **ARIA label**: `aria-label="Activity graph visualization"`
- **Keyboard navigation**: Not currently supported (enhancement opportunity)
- **Screen reader**: Announces as image with label

### Performance Characteristics

**Target Performance**:
- Render 50 nodes + up to 1,225 links in <3 seconds
- Maintain 60fps during simulation updates
- Smooth dragging interactions with no lag

**Optimizations**:
- `requestAnimationFrame` throttling for tick updates
- Stop simulation when alpha < threshold (converged)
- Ref-based simulation to avoid re-initialization on unrelated updates

**Performance Considerations**:
- More links → slower simulation convergence
- Larger nodes → more collision detection work
- Complex link patterns → more force calculations per tick

### Testing Contract

Tests must cover:
1. ✅ Renders nodes and links from GraphData
2. ✅ Empty state UI when nodes array is empty
3. ✅ Node click handler invoked with correct node object
4. ✅ Drag interaction updates node positions
5. ✅ Link stroke width varies by value (visual encoding)
6. ✅ Node labels shown only for radius >15
7. ✅ Links rendered beneath nodes (z-order)
8. ✅ Handles single node edge case
9. ✅ Handles no links edge case

**Test Environment**: 
- Uses `NODE_ENV=test` to skip simulation execution
- Mocks D3 force simulation for unit tests
- Integration tests verify actual D3 behavior

### Dependencies

- `d3-force`: Force simulation, forces, and layouts
- `d3-scale`: Linear scales for visual encoding
- `d3-zoom`: Pan and zoom interactions
- `d3-selection`: SVG manipulation (implicit via D3 call)
- React hooks: `useState`, `useEffect`, `useRef`, `useMemo`
- Types from `lib/git/types.ts` and `lib/treemap/data-transformer.ts`

### Migration from v1.0.0

**Breaking Changes**:
- **Prop signature changed**: `data: TreeNode` → `data: GraphData`
- **Data structure**: No longer accepts hierarchical tree, requires flat nodes + links
- **Simulation behavior**: Continuous tick updates instead of pre-computed positions

**Migration Path**:
```typescript
// Old (v1.0.0)
<ForceGraphChart data={treeNode} width={800} height={600} />

// New (v2.0.0)
const graphData = transformTreeToGraphData(treeNode, commits);
<ForceGraphChart data={graphData} width={800} height={600} />
```

### Version History

**2.0.0** (2026-02-01)
- Network graph with links support
- Changed data prop from TreeNode to GraphData
- Continuous tick-based simulation
- Link distance and stroke width visual encoding
- Real-time dragging of connected nodes

**1.0.0** (Previous)
- Independent bubbles without links
- TreeNode hierarchical data structure
- Pre-computed layout positions
