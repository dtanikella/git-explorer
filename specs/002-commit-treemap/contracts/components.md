# Component Contracts: Git Treemap Visualization

**Feature**: 002-commit-treemap  
**Date**: January 31, 2026

This document defines the props interfaces and behavior contracts for all React components in the treemap feature.

---

## 1. RepositorySelector

**Purpose**: Allow users to input repository path and trigger analysis

**Location**: `app/components/RepositorySelector.tsx`

### Props

```typescript
interface RepositorySelectorProps {
  /** Callback when user submits a repository path */
  onRepositorySelected: (repoPath: string) => void;
  
  /** Whether analysis is currently in progress */
  isLoading: boolean;
  
  /** Error message from validation or analysis (displayed below input) */
  error?: string;
  
  /** Currently selected repository path (for display) */
  currentPath?: string;
}
```

### Behavior

**Interactions**:
1. User clicks "Select Repository Directory" button
2. Browser opens directory picker dialog
3. User selects a directory
4. Component calls `onRepositorySelected(directoryName)`
5. Component displays selected directory name

**States**:
- **Idle**: Button enabled ("Select Repository Directory")
- **Selecting**: Button disabled ("Selecting...")
- **Error**: Button enabled, error message displayed below in red
- **Success**: Button enabled, selected directory displayed below in green

**Validation** (client-side, lightweight):
- Path must not be empty
- Path should start with `/` (Unix) or drive letter (Windows)

**Accessibility**:
- Input has `aria-label="Repository path"`
- Error message has `role="alert"`
- Button disabled state announced by screen reader

### Example Usage

```tsx
<RepositorySelector
  onRepositorySelected={handleRepoSelect}
  isLoading={isAnalyzing}
  error={analysisError}
  currentPath={selectedRepo}
/>
```

### Tests

- ✅ Renders text input and button
- ✅ Calls `onRepositorySelected` when button clicked
- ✅ Calls `onRepositorySelected` when Enter pressed in input
- ✅ Disables input and button when `isLoading` is true
- ✅ Displays error message when `error` prop provided
- ✅ Shows current path when `currentPath` provided
- ✅ Does not call callback when input is empty

---

## 2. TreemapChart

**Purpose**: Render the visx treemap visualization with colors

**Location**: `app/components/TreemapChart.tsx`

### Props

```typescript
interface TreemapChartProps {
  /** Tree data from git analysis API */
  data: TreeNode;
  
  /** Width of the visualization in pixels */
  width: number;
  
  /** Height of the visualization in pixels */
  height: number;
  
  /** Optional callback when user clicks a node (future: drill-down) */
  onNodeClick?: (node: TreeNode) => void;
}
```

### Behavior

**Rendering**:
1. Use visx `<Treemap>` with `data` prop
2. Set `size={[width, height]}`
3. Render each node as `<rect>` with `fill={node.color || '#ccc'}`
4. Add `<text>` labels for nodes with sufficient space (width/height > 30px)

**Interaction** (P4 - deferred):
- Hover: Show tooltip with file details (not implemented in MVP)
- Click: Trigger `onNodeClick` (not implemented in MVP)

**Edge Cases**:
- Empty data (no children): Display message "No data to display"
- Single file: Render as full-size rectangle
- Very small rectangles (<10px): Skip label rendering

**Accessibility**:
- SVG has `role="img"` and `aria-label="Treemap visualization of repository commit activity"`
- Each rect has `aria-label` with file name and commit count

### Example Usage

```tsx
<TreemapChart
  data={treeData}
  width={1200}
  height={800}
  onNodeClick={(node) => console.log('Clicked:', node.path)}
/>
```

### Tests

- ✅ Renders SVG with correct width and height
- ✅ Renders rectangles for each node in tree
- ✅ Applies colors from node.color property
- ✅ Displays labels for sufficiently large rectangles
- ✅ Handles empty data gracefully
- ✅ Calls onNodeClick when node is clicked
- ✅ Has appropriate ARIA attributes

---

## 3. LoadingState

**Purpose**: Display loading indicator during git analysis

**Location**: `app/components/LoadingState.tsx`

### Props

```typescript
interface LoadingStateProps {
  /** Optional message to display below spinner */
  message?: string;
}
```

### Behavior

**Display**:
- Centered spinner (CSS animation or `@visx/loading` if available)
- Default message: "Analyzing repository..."
- Optional custom message via prop

**Styling**:
- Flexbox centered vertically and horizontally
- Spinner: 48px circle, animated rotation
- Message: Gray text, 16px, below spinner

**Accessibility**:
- Container has `role="status"` and `aria-live="polite"`
- Spinner has `aria-label="Loading"`

### Example Usage

```tsx
{isLoading && <LoadingState message="Processing 5,234 commits..." />}
```

### Tests

- ✅ Renders spinner
- ✅ Displays default message when no message prop provided
- ✅ Displays custom message when provided
- ✅ Has appropriate ARIA attributes

---

## 4. DateRangeSelector (P2 - Enhancement, not MVP)

**Purpose**: Allow users to select time range presets

**Location**: `app/components/DateRangeSelector.tsx`

### Props

```typescript
interface DateRangeSelectorProps {
  /** Currently selected time range */
  selected: TimeRangePreset;
  
  /** Callback when user selects a new range */
  onRangeChange: (range: TimeRangePreset) => void;
  
  /** Whether selector should be disabled (during loading) */
  disabled?: boolean;
}
```

### Behavior

**Options**:
- Last 2 weeks (default)
- Last Month
- Last Quarter
- Last 6 Months
- Last Year

**UI Pattern**: Radio button group or segmented control

**Interaction**:
1. User clicks/taps a time range option
2. Component calls `onRangeChange(newRange)`
3. Parent re-fetches data with new range

**Accessibility**:
- Group has `role="radiogroup"` and `aria-label="Select time range"`
- Each option is a radio button with label

### Example Usage

```tsx
<DateRangeSelector
  selected={currentRange}
  onRangeChange={handleRangeChange}
  disabled={isLoading}
/>
```

### Tests

- ✅ Renders all 5 time range options
- ✅ Selected option is visually highlighted
- ✅ Calls onRangeChange when option clicked
- ✅ Disables all options when disabled prop is true
- ✅ Has appropriate ARIA attributes

---

## 5. EmptyState

**Purpose**: Display message when no commit data found

**Location**: `app/components/EmptyState.tsx` (or inline in page)

### Props

```typescript
interface EmptyStateProps {
  /** Reason for empty state */
  message: string;
}
```

### Behavior

**Display**:
- Centered message with icon (optional)
- Example: "No commits found in the selected time period."
- CTA: "Try selecting a different time range"

**Styling**:
- Flexbox centered
- Large gray text (20px)
- Optional illustration or icon

### Example Usage

```tsx
{isEmpty && <EmptyState message="No commits found in the selected time period." />}
```

### Tests

- ✅ Renders message prop
- ✅ Displays centered layout

---

## Component Hierarchy

```
Page (app/page.tsx)
├── RepositorySelector
│   └── [handles user input]
├── LoadingState (conditional)
│   └── [shown during analysis]
├── TreemapChart (conditional)
│   └── [visx Treemap with data]
└── EmptyState (conditional)
    └── [shown when no data]

(Future)
└── DateRangeSelector
    └── [P2 enhancement]
```

---

## State Management

**Pattern**: React `useState` at page level (no external state library per YAGNI)

```typescript
// app/page.tsx
'use client';

export default function HomePage() {
  const [repoPath, setRepoPath] = useState<string>('');
  const [treeData, setTreeData] = useState<TreeNode | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleRepoSelect = async (path: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/git-analysis', {
        method: 'POST',
        body: JSON.stringify({ repoPath: path, timeRange: '2w' }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        setTreeData(result.data);
        setRepoPath(path);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Failed to analyze repository');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <main>
      <RepositorySelector
        onRepositorySelected={handleRepoSelect}
        isLoading={isLoading}
        error={error}
        currentPath={repoPath}
      />
      
      {isLoading && <LoadingState />}
      
      {treeData && !isLoading && (
        <TreemapChart data={treeData} width={1200} height={800} />
      )}
      
      {!treeData && !isLoading && !error && (
        <EmptyState message="Select a repository to begin" />
      )}
    </main>
  );
}
```

---

## Testing Strategy

All components follow TDD:

1. **Write test** for component behavior
2. **Implement** component to pass test
3. **Refactor** if needed

Test files:
- `__tests__/components/RepositorySelector.test.tsx`
- `__tests__/components/TreemapChart.test.tsx`
- `__tests__/components/LoadingState.test.tsx`
- `__tests__/components/DateRangeSelector.test.tsx` (P2)
- `__tests__/components/EmptyState.test.tsx`

---

## Changes from Initial Design

**2026-01-31**: Initial component contracts
- Simplified RepositorySelector to text input (removed File System Access API)
- Deferred DateRangeSelector to P2 (not in MVP)
- Deferred tooltip hover interactions to P4
- All components use functional React with hooks (no class components)
