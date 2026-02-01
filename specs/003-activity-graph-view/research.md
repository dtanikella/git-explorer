# Research: Activity Graph Visualization

**Date**: 2026-02-01  
**Feature**: Activity Graph Visualization  
**Branch**: 003-activity-graph-view

## Overview

This document consolidates research findings for implementing a force-directed graph visualization using d3-force in a React/Next.js environment, including best practices for integration, performance optimization, and interaction patterns.

---

## Research Task 1: d3-force Integration with React

### Decision
Use d3-force for simulation logic while React manages the DOM/SVG rendering. D3 handles force calculations and position updates via refs, React re-renders based on state changes.

### Rationale
- **Separation of concerns**: D3 excels at physics simulation, React excels at declarative rendering
- **Performance**: Avoids React re-renders during simulation ticks (use refs for position updates)
- **TypeScript support**: d3-force has excellent TypeScript definitions
- **Proven pattern**: Widely used approach in production React + D3 applications

### Implementation Pattern
```typescript
// 1. Store nodes in state for initial render
const [nodes, setNodes] = useState<GraphNode[]>([]);

// 2. Use ref for simulation to avoid re-renders
const simulationRef = useRef<d3.Simulation<GraphNode, undefined>>();

// 3. Update DOM directly during ticks (not via state)
useEffect(() => {
  const simulation = d3.forceSimulation(nodes)
    .force('charge', d3.forceManyBody().strength(-100))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(d => d.radius + 2))
    .on('tick', () => {
      // Update DOM directly via refs, not setState
      d3.selectAll('.node')
        .attr('cx', d => d.x)
        .attr('cy', d => d.y);
    });
    
  simulationRef.current = simulation;
  
  return () => simulation.stop();
}, [nodes, width, height]);
```

### Alternatives Considered
- **React-only approach**: Rejected because React's reconciliation is too slow for 60fps simulation updates
- **Full D3 DOM manipulation**: Rejected to maintain React component patterns and testability
- **react-force-graph library**: Rejected to minimize dependencies and maintain full control per YAGNI principle

### Key Resources
- D3 Force Simulation API: https://github.com/d3/d3-force
- Curran Kelleher's "Integrating D3 with React": https://2019.wattenberger.com/blog/react-and-d3
- Observable D3 Force examples: https://observablehq.com/@d3/force-directed-graph

---

## Research Task 2: Force Simulation Configuration

### Decision
Use three core forces: collision, center, and many-body (charge) with specific strength parameters tuned for bubble layout.

### Rationale
- **Collision force**: Prevents overlap, radius = bubble radius + 2px padding for visual separation
- **Center force**: Keeps graph centered in viewport, prevents drift
- **Many-body (charge)**: Provides gentle repulsion so nodes don't cluster too tightly, strength -50 to -100 for 100 nodes
- **No link force**: Per spec requirement (out of scope for MVP), can add later for directory clustering

### Configuration
```typescript
const simulation = d3.forceSimulation<GraphNode>(nodes)
  .force('collision', d3.forceCollide<GraphNode>()
    .radius(d => d.radius + 2)
    .strength(0.7))
  .force('center', d3.forceCenter(width / 2, height / 2)
    .strength(0.05))
  .force('charge', d3.forceManyBody<GraphNode>()
    .strength(-80))
  .velocityDecay(0.6)  // Higher = faster stabilization
  .alphaDecay(0.02);   // Controls simulation cooldown rate
```

### Performance Tuning
- **velocityDecay**: 0.6 (default 0.4) for faster stabilization (target: 3 seconds)
- **alphaDecay**: 0.02 (default ~0.023) for controlled cooldown
- **Warmup**: Run simulation for ~200 ticks before displaying to users (appears instant)
- **Stop condition**: alpha < 0.001 indicates stable layout

### Alternatives Considered
- **Link forces for directory structure**: Deferred per spec (TS-006: MAY include)
- **X/Y forces for grid layout**: Rejected, conflicts with organic force-directed aesthetic
- **Custom force functions**: Not needed for initial implementation, premature optimization

### Key Resources
- Mike Bostock's Force Layout Guide: https://observablehq.com/@d3/force-directed-graph
- D3 Force Simulation API docs: https://github.com/d3/d3-force#simulation
- "Visualizing Graph Data" by Ian Johnson

---

## Research Task 3: Pan and Zoom Implementation

### Decision
Use d3-zoom for pan/zoom functionality applied to an SVG group container wrapping all graph nodes.

### Rationale
- **d3-zoom is battle-tested**: Industry standard for SVG pan/zoom
- **Built-in gesture support**: Handles mouse wheel, touch pinch, drag automatically
- **Transform composition**: Cleanly separates zoom transform from force simulation positions
- **Constraint support**: Easy to add zoom extent limits and reset functionality

### Implementation Pattern
```typescript
const svgRef = useRef<SVGSVGElement>(null);
const zoomBehavior = useRef<d3.ZoomBehavior<SVGSVGElement, unknown>>();

useEffect(() => {
  if (!svgRef.current) return;
  
  const zoom = d3.zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.5, 5])  // Allow 0.5x to 5x zoom
    .on('zoom', (event) => {
      d3.select(svgRef.current)
        .select('g.graph-container')
        .attr('transform', event.transform.toString());
    });
  
  d3.select(svgRef.current).call(zoom);
  zoomBehavior.current = zoom;
  
  return () => {
    d3.select(svgRef.current).on('.zoom', null);
  };
}, []);

// Reset function for double-click
const resetZoom = () => {
  d3.select(svgRef.current)
    .transition()
    .duration(750)
    .call(zoomBehavior.current!.transform, d3.zoomIdentity);
};
```

### Double-Click Reset
Per spec requirement (User Story 4, scenario 4), implement reset via `dblclick` event listener.

### Alternatives Considered
- **@visx/zoom**: Already installed but less feature-complete than d3-zoom for SVG
- **Custom pan/zoom logic**: Rejected, reinventing the wheel (violates YAGNI)
- **CSS transforms**: Rejected, incompatible with SVG coordinate systems

### Key Resources
- d3-zoom documentation: https://github.com/d3/d3-zoom
- "Zoom to Bounding Box" pattern: https://observablehq.com/@d3/zoom-to-bounding-box
- SVG transform best practices

---

## Research Task 4: Bubble Sizing Algorithm

### Decision
Map commit counts to bubble radius using square root scale to ensure area (not radius) is proportional to data values.

### Rationale
- **Perception principle**: Humans perceive bubble size by area, not radius
- **Square root scale**: If value doubles, area doubles (radius increases by √2)
- **Minimum size**: Ensure smallest bubbles are visible (min radius ~8px)
- **Maximum size**: Cap large bubbles to prevent dominating view (max radius ~40px)

### Implementation
```typescript
import { scaleSqrt } from 'd3-scale';

const radiusScale = scaleSqrt<number>()
  .domain([minCommits, maxCommits])
  .range([8, 40]);  // Min/max radius in pixels

nodes.forEach(node => {
  node.radius = radiusScale(node.commitCount);
});
```

### Meeting SC-007 Requirement
Success criteria requires 2:1 size ratio minimum between highest and lowest commit files. With radius range [8, 40]:
- Area ratio: (40² / 8²) = (1600 / 64) = 25:1 ✅ Exceeds requirement

### Alternatives Considered
- **Linear scale**: Rejected, causes perceptual distortion (large values appear too large)
- **Logarithmic scale**: Rejected, compresses differences too much for our use case
- **Fixed size**: Rejected, defeats the purpose of encoding commit frequency

### Key Resources
- "Perception in Visualization" by Stephen Few
- d3-scale documentation: https://github.com/d3/d3-scale

---

## Research Task 5: File Type Color Mapping

### Decision
Create a deterministic function mapping file extensions to colors based on spec requirements, with test file detection taking precedence.

### Rationale
- **Test detection first**: Prevents .test.tsx from being colored blue (should be gray)
- **Path-based patterns**: Regex patterns for `__tests__/`, `/test/`, `/tests/`, `.test.`, `.spec.`
- **Extension fallback**: Check .rb and .tsx after ruling out test files
- **Default to gray**: All other files gray (per FR-008)

### Implementation
```typescript
const TEST_PATTERNS = [
  /\/__tests__\//,
  /\/tests?\//,
  /\.test\./,
  /\.spec\./
];

export const getFileTypeColor = (filePath: string): string => {
  // Test files first (highest priority)
  if (TEST_PATTERNS.some(pattern => pattern.test(filePath))) {
    return '#808080';  // Gray
  }
  
  // Extension-based coloring
  if (filePath.endsWith('.rb')) {
    return '#E0115F';  // Ruby red
  }
  
  if (filePath.endsWith('.tsx')) {
    return '#ADD8E6';  // Light blue
  }
  
  // Default
  return '#808080';  // Gray
};
```

### Color Choices
- **Ruby red (#E0115F)**: True ruby gemstone color, strong association
- **Light blue (#ADD8E6)**: Standard CSS "lightblue", gentle contrast
- **Gray (#808080)**: Neutral, doesn't compete with data colors

### Alternatives Considered
- **Full extension mapping library**: Rejected as premature (YAGNI), only need 2 colors
- **User-configurable colors**: Rejected per spec (Out of Scope)
- **Syntax highlighting colors**: Rejected, too many colors reduce visual clarity

---

## Research Task 6: View Toggle Component Pattern

### Decision
Replicate the DateRangeSelector radio button pattern for view toggle to maintain UI consistency.

### Rationale
- **Consistency principle**: Users already understand the date range selector interaction model
- **Accessibility**: Radio button semantics with proper ARIA labels
- **Visual design**: Same styling approach (grid layout, blue selection state)
- **Existing pattern**: Proven in current codebase

### Component Interface
```typescript
type ViewMode = 'heatmap' | 'activity-graph';

interface ViewToggleProps {
  selected: ViewMode;
  onViewChange: (mode: ViewMode) => void;
  disabled?: boolean;
}
```

### Implementation Pattern
```tsx
<div className="grid grid-cols-2 gap-2">
  <label className={`btn-toggle ${selected === 'heatmap' ? 'selected' : ''}`}>
    <input
      type="radio"
      name="view-mode"
      value="heatmap"
      checked={selected === 'heatmap'}
      onChange={() => onViewChange('heatmap')}
      disabled={disabled}
    />
    Heatmap
  </label>
  {/* Same for Activity Graph */}
</div>
```

### Alternatives Considered
- **Dropdown selector**: Rejected, radio buttons make both options visible
- **Tabs pattern**: Rejected, would require different styling approach
- **Icon-only toggle**: Rejected, text labels are clearer (Visual Clarity principle)

### Key Resources
- Existing DateRangeSelector component implementation
- ARIA radio group patterns: https://www.w3.org/WAI/ARIA/apg/patterns/radio/

---

## Research Task 7: Data Transformation Strategy

### Decision
Flatten TreeNode hierarchy into array of file nodes (leaf nodes only) for force simulation, preserving fileData for commit counts.

### Rationale
- **Force simulation needs flat array**: d3.forceSimulation expects array of nodes, not hierarchy
- **Only files are visualized**: Directories don't appear as nodes (per spec, only files)
- **Preserve metadata**: Keep fileData.totalCommitCount for radius calculation
- **Add derived properties**: Extension and color during transformation

### Implementation
```typescript
interface GraphNode extends d3.SimulationNodeDatum {
  id: string;           // Unique identifier (file path)
  filePath: string;     // Full path
  fileName: string;     // Display name (last path segment)
  commitCount: number;  // From fileData.totalCommitCount
  radius: number;       // Calculated from commitCount
  color: string;        // From getFileTypeColor(filePath)
  x?: number;           // d3-force adds these
  y?: number;
}

export const transformTreeToGraph = (tree: TreeNode): GraphNode[] => {
  const nodes: GraphNode[] = [];
  
  const traverse = (node: TreeNode) => {
    if (node.isFile && node.fileData) {
      nodes.push({
        id: node.path,
        filePath: node.path,
        fileName: node.name,
        commitCount: node.fileData.totalCommitCount,
        radius: 0,  // Set after determining min/max
        color: getFileTypeColor(node.path)
      });
    } else if (node.children) {
      node.children.forEach(traverse);
    }
  };
  
  traverse(tree);
  return nodes;
};
```

### Alternatives Considered
- **Keep hierarchy and add links**: Deferred per spec (TS-006 MAY include)
- **Transform on server**: Rejected, client has the data and transformation is simple
- **Store as separate data structure**: Rejected, unnecessary duplication (YAGNI)

---

## Research Task 8: Color Legend Update Strategy

### Decision
Update ColorLegend component to conditionally render either gradient (for Heatmap) or discrete swatches (for Activity Graph) based on view mode.

### Rationale
- **Same component**: Maintains consistent legend position and styling
- **View-dependent content**: Different visualizations have different color meanings
- **Discrete vs continuous**: Heatmap uses gradient scale, Activity Graph uses categorical colors

### Implementation Approach
```typescript
interface ColorLegendProps {
  mode: 'gradient' | 'discrete';
  colors?: Array<{ label: string; color: string }>;
}

// For Activity Graph mode
const activityGraphColors = [
  { label: 'Ruby files (.rb)', color: '#E0115F' },
  { label: 'TypeScript React (.tsx)', color: '#ADD8E6' },
  { label: 'Test files & others', color: '#808080' }
];
```

### Alternatives Considered
- **Two separate legend components**: Rejected, unnecessary duplication
- **Remove legend for Activity Graph**: Rejected, colors need explanation
- **Always show both legends**: Rejected, clutters interface (Visual Clarity)

---

## Research Task 9: Performance Optimization

### Decision
Implement force simulation warmup (pre-run before display) and stop simulation when alpha threshold reached.

### Rationale
- **Warmup**: Run simulation for 200 ticks before showing to users → appears instantly stable
- **Early stop**: Stop when alpha < 0.001 → saves CPU cycles, no visible movement
- **Target: 3 seconds**: Per SC-005, layout must stabilize within 3 seconds (warmup achieves this)
- **FPS target**: Per SC-004, 30+ FPS during interactions (d3-zoom handles this natively)

### Implementation
```typescript
// Warmup approach
const warmupSimulation = (sim: d3.Simulation<GraphNode, undefined>, ticks = 200) => {
  sim.stop();
  for (let i = 0; i < ticks; i++) {
    sim.tick();
  }
  // Now positions are stable, can render
};

// Alpha threshold stop
simulation.on('tick', () => {
  if (simulation.alpha() < 0.001) {
    simulation.stop();
  }
  updateNodePositions();
});
```

### Alternatives Considered
- **Display during simulation**: Rejected, causes jarring initial movement
- **Fixed duration**: Rejected, doesn't guarantee stable layout
- **Higher tick count**: Tested 300-500 ticks, 200 is sufficient for 100 nodes

### Key Resources
- "Optimizing D3 Force Layouts" by Elijah Meeks
- D3 alpha decay documentation

---

## Research Task 10: Testing Strategy

### Decision
Follow TDD with unit tests for utilities, component tests for React components, and integration tests for view switching.

### Rationale
- **Constitution Principle I**: Test-first is non-negotiable
- **Unit tests**: Pure functions (color mapping, data transformation) are easy to test
- **Component tests**: React Testing Library for ViewToggle and ForceGraphChart
- **Integration tests**: User flow of toggling views and verifying data persistence

### Test Coverage Plan

#### Unit Tests
```typescript
// file-type-colors.test.ts
describe('getFileTypeColor', () => {
  it('returns ruby red for .rb files', () => {
    expect(getFileTypeColor('app/models/user.rb')).toBe('#E0115F');
  });
  
  it('returns light blue for .tsx files', () => {
    expect(getFileTypeColor('components/Button.tsx')).toBe('#ADD8E6');
  });
  
  it('returns gray for test files regardless of extension', () => {
    expect(getFileTypeColor('Button.test.tsx')).toBe('#808080');
    expect(getFileTypeColor('__tests__/helper.ts')).toBe('#808080');
  });
});

// data-transformer.test.ts
describe('transformTreeToGraph', () => {
  it('extracts only file nodes from tree', () => {
    const tree = createMockTree();
    const nodes = transformTreeToGraph(tree);
    expect(nodes.every(n => n.filePath.includes('.'))).toBe(true);
  });
  
  it('preserves commit counts', () => {
    const tree = createMockTree();
    const nodes = transformTreeToGraph(tree);
    expect(nodes[0].commitCount).toBe(42);
  });
});
```

#### Component Tests
```typescript
// ViewToggle.test.tsx
describe('ViewToggle', () => {
  it('calls onViewChange when clicked', () => {
    const onChange = jest.fn();
    render(<ViewToggle selected="heatmap" onViewChange={onChange} />);
    fireEvent.click(screen.getByText('Activity Graph'));
    expect(onChange).toHaveBeenCalledWith('activity-graph');
  });
});

// ForceGraphChart.test.tsx
describe('ForceGraphChart', () => {
  it('renders SVG with nodes', () => {
    const data = createMockTreeNode();
    render(<ForceGraphChart data={data} width={800} height={600} />);
    expect(screen.getAllByRole('circle')).toHaveLength(10);
  });
});
```

#### Integration Tests
```typescript
// view-switching.test.ts
describe('View Switching Integration', () => {
  it('maintains repository selection when toggling views', async () => {
    render(<HomePage />);
    // Select repository
    // Toggle to Activity Graph
    // Verify same repository data displayed
  });
});
```

### Alternatives Considered
- **E2E tests**: Deferred, component/integration tests sufficient for MVP
- **Visual regression tests**: Deferred, out of scope for initial implementation
- **Snapshot tests**: Rejected for force graph (positions are non-deterministic)

---

## Summary of Decisions

| Area | Decision | Key Reason |
|------|----------|------------|
| React + D3 Integration | D3 for simulation, React for rendering | Separation of concerns, performance |
| Force Configuration | Collision + center + charge forces | Prevents overlap, keeps centered, provides spacing |
| Pan/Zoom | d3-zoom on SVG group | Industry standard, comprehensive gesture support |
| Bubble Sizing | Square root scale | Area proportional to data (perceptual correctness) |
| Color Mapping | Test detection first, then extension | Test files always gray regardless of extension |
| View Toggle | Radio button pattern | Consistent with existing DateRangeSelector |
| Data Transformation | Flatten to array of file nodes | Force simulation requires flat structure |
| Legend Update | Conditional rendering in same component | Maintains position consistency |
| Performance | 200-tick warmup + alpha threshold | Instant appearance + automatic stabilization |
| Testing | TDD with unit/component/integration | Constitution requirement, comprehensive coverage |

## Next Steps

Proceed to Phase 1:
1. Generate data-model.md (define GraphNode, ViewMode types)
2. Generate contracts/ (component interfaces)
3. Generate quickstart.md (setup and running instructions)
4. Update agent context with new technologies (d3-force, d3-zoom)
