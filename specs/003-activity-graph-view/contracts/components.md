# Component Contracts

**Date**: 2026-02-01  
**Feature**: Activity Graph Visualization

## ViewToggle

**Purpose**: Radio button control for switching between Heatmap and Activity Graph views.

**Location**: `app/components/ViewToggle.tsx`

### Props Interface

```typescript
type ViewMode = 'heatmap' | 'activity-graph';

interface ViewToggleProps {
  /**
   * Currently selected view mode
   */
  selected: ViewMode;
  
  /**
   * Callback fired when user selects a different view
   * @param mode - The newly selected view mode
   */
  onViewChange: (mode: ViewMode) => void;
  
  /**
   * Whether the toggle is disabled (e.g., during loading)
   * @default false
   */
  disabled?: boolean;
}
```

### Usage Example

```typescript
<ViewToggle
  selected={viewMode}
  onViewChange={setViewMode}
  disabled={isLoading}
/>
```

### Behavior Specifications

- **Accessibility**: Uses radio button semantics with proper ARIA labels
- **Keyboard Navigation**: Tab to focus, Arrow keys to navigate between options
- **Visual State**: Selected option has blue background (consistent with DateRangeSelector)
- **Layout**: Two-column grid layout, responsive
- **Disabled State**: Grayed out and non-interactive when `disabled=true`

### Testing Contract

```typescript
describe('ViewToggle', () => {
  it('renders both view options', () => {
    render(<ViewToggle selected="heatmap" onViewChange={jest.fn()} />);
    expect(screen.getByText('Heatmap')).toBeInTheDocument();
    expect(screen.getByText('Activity Graph')).toBeInTheDocument();
  });
  
  it('calls onViewChange when option clicked', () => {
    const onChange = jest.fn();
    render(<ViewToggle selected="heatmap" onViewChange={onChange} />);
    fireEvent.click(screen.getByText('Activity Graph'));
    expect(onChange).toHaveBeenCalledWith('activity-graph');
  });
  
  it('marks selected option visually', () => {
    const { container } = render(
      <ViewToggle selected="heatmap" onViewChange={jest.fn()} />
    );
    const heatmapLabel = screen.getByText('Heatmap').closest('label');
    expect(heatmapLabel).toHaveClass('selected');
  });
  
  it('disables interaction when disabled prop is true', () => {
    render(<ViewToggle selected="heatmap" onViewChange={jest.fn()} disabled />);
    const inputs = screen.getAllByRole('radio');
    inputs.forEach(input => expect(input).toBeDisabled());
  });
});
```

---

## ForceGraphChart

**Purpose**: Force-directed graph visualization component displaying files as bubbles.

**Location**: `app/components/ForceGraphChart.tsx`

### Props Interface

```typescript
import { TreeNode } from '@/lib/git/types';
import { SimulationNodeDatum } from 'd3-force';

export interface GraphNode extends SimulationNodeDatum {
  id: string;
  filePath: string;
  fileName: string;
  commitCount: number;
  radius: number;
  color: string;
}

interface ForceGraphChartProps {
  /**
   * Hierarchical tree data from git-analysis API
   * (same structure as TreemapChart)
   */
  data: TreeNode;
  
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
   * @param node - The clicked graph node
   */
  onNodeClick?: (node: GraphNode) => void;
}
```

### Usage Example

```typescript
<ForceGraphChart
  data={treeData}
  width={chartWidth}
  height={chartHeight}
  onNodeClick={(node) => console.log('Clicked:', node.filePath)}
/>
```

### Behavior Specifications

#### Rendering
- Transforms TreeNode to GraphNode[] internally
- Renders SVG with width/height from props
- Displays nodes as `<circle>` elements
- Displays file names as `<text>` elements (when bubble radius > 15px)
- Shows "No data to display" message when no files available

#### Force Simulation
- Initializes d3.forceSimulation on mount
- Applies collision, center, and charge forces
- Runs warmup of 200 ticks before displaying
- Stops when alpha < 0.001
- Cleans up simulation on unmount

#### Pan & Zoom
- Applies d3.zoom to SVG element
- Scale extent: [0.5, 5.0]
- Zoom on mouse wheel
- Pan on drag (empty space)
- Double-click to reset transform

#### Performance
- Uses refs for simulation (not state) to avoid re-renders during ticks
- Direct DOM manipulation for position updates during simulation
- Memoizes node transformations
- Stops simulation when component unmounts

### Testing Contract

```typescript
describe('ForceGraphChart', () => {
  it('renders SVG with correct dimensions', () => {
    const data = createMockTreeNode();
    render(<ForceGraphChart data={data} width={800} height={600} />);
    const svg = screen.getByRole('img', { hidden: true });
    expect(svg).toHaveAttribute('width', '800');
    expect(svg).toHaveAttribute('height', '600');
  });
  
  it('displays file nodes as circles', () => {
    const data = createMockTreeNode();
    const { container } = render(
      <ForceGraphChart data={data} width={800} height={600} />
    );
    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBeGreaterThan(0);
  });
  
  it('applies correct colors based on file type', () => {
    const data = createMockTreeNodeWithFileTypes();
    const { container } = render(
      <ForceGraphChart data={data} width={800} height={600} />
    );
    const rbCircle = container.querySelector('[data-filepath*=".rb"]');
    expect(rbCircle).toHaveAttribute('fill', '#E0115F');
  });
  
  it('sizes bubbles proportionally to commit count', () => {
    const data = createMockTreeNodeWithVaryingCommits();
    const { container } = render(
      <ForceGraphChart data={data} width={800} height={600} />
    );
    const circles = container.querySelectorAll('circle');
    const radii = Array.from(circles).map(c => parseFloat(c.getAttribute('r')!));
    expect(Math.max(...radii) / Math.min(...radii)).toBeGreaterThanOrEqual(2);
  });
  
  it('shows "No data" message when tree is empty', () => {
    const emptyData = { name: 'root', path: '', value: 0, isFile: false };
    render(<ForceGraphChart data={emptyData} width={800} height={600} />);
    expect(screen.getByText(/no data/i)).toBeInTheDocument();
  });
  
  it('calls onNodeClick when circle is clicked', () => {
    const onNodeClick = jest.fn();
    const data = createMockTreeNode();
    const { container } = render(
      <ForceGraphChart 
        data={data} 
        width={800} 
        height={600} 
        onNodeClick={onNodeClick}
      />
    );
    const circle = container.querySelector('circle')!;
    fireEvent.click(circle);
    expect(onNodeClick).toHaveBeenCalled();
  });
});
```

---

## ColorLegend (Extended)

**Purpose**: Display color legend, either gradient (Heatmap) or discrete swatches (Activity Graph).

**Location**: `app/components/ColorLegend.tsx` (existing, to be extended)

### Extended Props Interface

```typescript
interface ColorLegendProps {
  /**
   * Legend display mode
   * - 'gradient': Show gradient from light to dark (for Heatmap)
   * - 'discrete': Show discrete color swatches (for Activity Graph)
   */
  mode: 'gradient' | 'discrete';
  
  /**
   * For discrete mode: array of color definitions
   * For gradient mode: not used (uses hardcoded gradient)
   */
  colors?: Array<{
    label: string;
    color: string;
  }>;
}
```

### Usage Example

```typescript
// For Heatmap
<ColorLegend mode="gradient" />

// For Activity Graph
<ColorLegend 
  mode="discrete"
  colors={[
    { label: 'Ruby files (.rb)', color: '#E0115F' },
    { label: 'TypeScript React (.tsx)', color: '#ADD8E6' },
    { label: 'Test files & others', color: '#808080' }
  ]}
/>
```

### Behavior Specifications

- **Gradient Mode**: Displays horizontal gradient bar with "Less active" and "More active" labels
- **Discrete Mode**: Displays color swatches with labels in a vertical list
- **Responsive**: Maintains legibility at all viewport sizes
- **Accessibility**: Color swatches have proper ARIA labels

### Testing Contract

```typescript
describe('ColorLegend', () => {
  it('renders gradient in gradient mode', () => {
    render(<ColorLegend mode="gradient" />);
    expect(screen.getByText('Less active')).toBeInTheDocument();
    expect(screen.getByText('More active')).toBeInTheDocument();
  });
  
  it('renders discrete swatches in discrete mode', () => {
    const colors = [
      { label: 'Ruby files (.rb)', color: '#E0115F' },
      { label: 'TypeScript React (.tsx)', color: '#ADD8E6' }
    ];
    render(<ColorLegend mode="discrete" colors={colors} />);
    expect(screen.getByText('Ruby files (.rb)')).toBeInTheDocument();
    expect(screen.getByText('TypeScript React (.tsx)')).toBeInTheDocument();
  });
});
```

---

## Page Component (Modified)

**Purpose**: Main page orchestrates view toggle and conditional rendering.

**Location**: `app/page.tsx` (existing, to be modified)

### New State

```typescript
const [viewMode, setViewMode] = useState<ViewMode>('heatmap');
```

### New Component Composition

```tsx
<div className="analysis-results">
  <ViewToggle
    selected={viewMode}
    onViewChange={setViewMode}
    disabled={isLoading}
  />
  
  <DateRangeSelector
    selected={timeRange}
    onRangeChange={handleRangeChange}
    disabled={isLoading}
  />
  
  {viewMode === 'heatmap' ? (
    <>
      <TreemapChart data={treeData} width={w} height={h} />
      <ColorLegend mode="gradient" />
    </>
  ) : (
    <>
      <ForceGraphChart data={treeData} width={w} height={h} />
      <ColorLegend 
        mode="discrete"
        colors={[
          { label: 'Ruby files (.rb)', color: '#E0115F' },
          { label: 'TypeScript React (.tsx)', color: '#ADD8E6' },
          { label: 'Test files & others', color: '#808080' }
        ]}
      />
    </>
  )}
</div>
```

### Behavior Specifications

- View mode persists during repository/time range changes
- Both visualizations share same data source (treeData)
- Loading state disables view toggle
- Error state clears on view toggle (both views attempt to render)

### Testing Contract

```typescript
describe('Page with View Toggle', () => {
  it('renders Heatmap by default', () => {
    render(<HomePage />);
    expect(screen.getByTestId('treemap-chart')).toBeInTheDocument();
  });
  
  it('switches to Activity Graph when toggled', async () => {
    render(<HomePage />);
    fireEvent.click(screen.getByText('Activity Graph'));
    await waitFor(() => {
      expect(screen.getByTestId('force-graph-chart')).toBeInTheDocument();
    });
  });
  
  it('maintains repository selection across view toggle', () => {
    render(<HomePage />);
    // Select repository
    // Toggle view
    // Verify same repository displayed in both views
  });
  
  it('maintains time range selection across view toggle', () => {
    render(<HomePage />);
    // Select time range
    // Toggle view
    // Verify same time range displayed in both views
  });
});
```
