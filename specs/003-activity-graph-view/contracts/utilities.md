# Utility Contracts

**Date**: 2026-02-01  
**Feature**: Activity Graph Visualization

## getFileTypeColor

**Purpose**: Map file path to color based on extension and test file patterns.

**Location**: `lib/treemap/file-type-colors.ts`

### Function Signature

```typescript
/**
 * Determines the color for a file based on its path and extension.
 * 
 * Priority order:
 * 1. Test files (any path matching test patterns) → gray
 * 2. .rb files → ruby red
 * 3. .tsx files → light blue
 * 4. All other files → gray
 * 
 * @param filePath - Full file path from repository root
 * @returns Hex color code
 * 
 * @example
 * getFileTypeColor('app/models/user.rb') // '#E0115F'
 * getFileTypeColor('components/Button.tsx') // '#ADD8E6'
 * getFileTypeColor('Button.test.tsx') // '#808080' (test takes precedence)
 * getFileTypeColor('src/utils/helper.ts') // '#808080'
 */
export function getFileTypeColor(filePath: string): string;
```

### Return Values

| File Type | Color | Hex Code |
|-----------|-------|----------|
| Ruby files (.rb) | Ruby red | `#E0115F` |
| TypeScript React (.tsx) | Light blue | `#ADD8E6` |
| Test files (any pattern) | Gray | `#808080` |
| All others | Gray | `#808080` |

### Test Detection Patterns

Test files are identified by matching any of these regex patterns:

```typescript
const TEST_PATTERNS = [
  /\/__tests__\//,  // Files in __tests__ directory
  /\/tests?\//,     // Files in test/ or tests/ directory
  /\.test\./,       // Files with .test. in name (e.g., .test.ts, .test.tsx)
  /\.spec\./        // Files with .spec. in name (e.g., .spec.js)
];
```

### Edge Cases

| Input | Expected Output | Reason |
|-------|----------------|--------|
| `'app.rb'` | `#E0115F` | Ruby file |
| `'App.tsx'` | `#ADD8E6` | TSX file |
| `'App.test.tsx'` | `#808080` | Test takes precedence over .tsx |
| `'__tests__/helper.rb'` | `#808080` | Test takes precedence over .rb |
| `'test-utils.ts'` | `#808080` | "test" in name but not a pattern match, defaults to gray |
| `'lib/test/setup.ts'` | `#808080` | In test/ directory |
| `'README.md'` | `#808080` | Default to gray |
| `''` | `#808080` | Empty path defaults to gray |

### Testing Contract

```typescript
describe('getFileTypeColor', () => {
  describe('Ruby files', () => {
    it('returns ruby red for .rb files', () => {
      expect(getFileTypeColor('app/models/user.rb')).toBe('#E0115F');
      expect(getFileTypeColor('lib/helper.rb')).toBe('#E0115F');
      expect(getFileTypeColor('script.rb')).toBe('#E0115F');
    });
  });
  
  describe('TypeScript React files', () => {
    it('returns light blue for .tsx files', () => {
      expect(getFileTypeColor('components/Button.tsx')).toBe('#ADD8E6');
      expect(getFileTypeColor('App.tsx')).toBe('#ADD8E6');
    });
  });
  
  describe('Test files', () => {
    it('returns gray for files in __tests__ directory', () => {
      expect(getFileTypeColor('__tests__/helper.ts')).toBe('#808080');
      expect(getFileTypeColor('src/__tests__/utils.tsx')).toBe('#808080');
    });
    
    it('returns gray for files in test/tests directory', () => {
      expect(getFileTypeColor('test/unit.ts')).toBe('#808080');
      expect(getFileTypeColor('tests/integration.ts')).toBe('#808080');
    });
    
    it('returns gray for .test. pattern files', () => {
      expect(getFileTypeColor('Button.test.tsx')).toBe('#808080');
      expect(getFileTypeColor('utils.test.ts')).toBe('#808080');
    });
    
    it('returns gray for .spec. pattern files', () => {
      expect(getFileTypeColor('api.spec.js')).toBe('#808080');
      expect(getFileTypeColor('component.spec.tsx')).toBe('#808080');
    });
    
    it('prioritizes test pattern over extension', () => {
      expect(getFileTypeColor('User.test.rb')).toBe('#808080');
      expect(getFileTypeColor('Component.test.tsx')).toBe('#808080');
      expect(getFileTypeColor('__tests__/model.rb')).toBe('#808080');
    });
  });
  
  describe('Other files', () => {
    it('returns gray for non-rb, non-tsx files', () => {
      expect(getFileTypeColor('README.md')).toBe('#808080');
      expect(getFileTypeColor('package.json')).toBe('#808080');
      expect(getFileTypeColor('src/utils.ts')).toBe('#808080');
    });
    
    it('handles empty path', () => {
      expect(getFileTypeColor('')).toBe('#808080');
    });
  });
});
```

---

## transformTreeToGraph

**Purpose**: Convert hierarchical TreeNode structure to flat array of GraphNode objects for force simulation.

**Location**: `lib/treemap/data-transformer.ts`

### Function Signature

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

/**
 * Transforms hierarchical TreeNode structure to flat array of file nodes
 * for force-directed graph visualization.
 * 
 * - Extracts only leaf nodes (files with fileData)
 * - Calculates bubble radius using square root scale
 * - Applies file type coloring
 * - Returns empty array if no files found
 * 
 * @param tree - Root TreeNode from git-analysis API
 * @returns Array of GraphNode objects ready for d3.forceSimulation
 * 
 * @example
 * const tree = await fetchGitAnalysis(repoPath, timeRange);
 * const nodes = transformTreeToGraph(tree);
 * const simulation = d3.forceSimulation(nodes);
 */
export function transformTreeToGraph(tree: TreeNode): GraphNode[];
```

### Transformation Logic

```typescript
// 1. Traverse tree to find all leaf nodes (files)
const files = extractLeafNodes(tree);

// 2. Determine min/max commit counts for scaling
const commitCounts = files.map(f => f.fileData.totalCommitCount);
const minCommits = Math.min(...commitCounts);
const maxCommits = Math.max(...commitCounts);

// 3. Create square root scale for bubble radius
const radiusScale = d3.scaleSqrt()
  .domain([minCommits, maxCommits])
  .range([8, 40]);

// 4. Map to GraphNode objects
return files.map(file => ({
  id: file.path,
  filePath: file.path,
  fileName: file.name,
  commitCount: file.fileData.totalCommitCount,
  radius: radiusScale(file.fileData.totalCommitCount),
  color: getFileTypeColor(file.path)
}));
```

### Edge Cases

| Input | Expected Output | Notes |
|-------|----------------|-------|
| Tree with 0 files | `[]` | Empty array |
| Tree with 1 file | Array with 1 node, radius = 24px | Mid-point of [8, 40] range |
| All files same commit count | All nodes same radius = 24px | scaleSqrt handles domain collapse |
| Very large tree (>100 files) | Top 100 files only | TreeNode already limited by API |

### Return Value Guarantees

- All nodes have `radius` between 8 and 40 pixels
- All nodes have valid hex `color` string
- All nodes have non-empty `fileName` and `filePath`
- `commitCount` is always > 0 (API filters zero-commit files)
- Array is sorted by commitCount descending (optional, for consistent rendering)

### Testing Contract

```typescript
describe('transformTreeToGraph', () => {
  it('extracts only file nodes from tree', () => {
    const tree = createMockTreeNode({
      children: [
        { name: 'src', isFile: false, children: [
          { name: 'app.ts', isFile: true, fileData: { totalCommitCount: 10 } }
        ]},
        { name: 'README.md', isFile: true, fileData: { totalCommitCount: 5 } }
      ]
    });
    
    const nodes = transformTreeToGraph(tree);
    expect(nodes).toHaveLength(2);
    expect(nodes.every(n => n.fileName.includes('.'))).toBe(true);
  });
  
  it('preserves commit counts', () => {
    const tree = createMockTreeNode({
      children: [
        { name: 'a.ts', isFile: true, fileData: { totalCommitCount: 42 } }
      ]
    });
    
    const nodes = transformTreeToGraph(tree);
    expect(nodes[0].commitCount).toBe(42);
  });
  
  it('calculates radius using square root scale', () => {
    const tree = createMockTreeNode({
      children: [
        { name: 'low.ts', isFile: true, fileData: { totalCommitCount: 1 } },
        { name: 'high.ts', isFile: true, fileData: { totalCommitCount: 100 } }
      ]
    });
    
    const nodes = transformTreeToGraph(tree);
    expect(nodes[0].radius).toBe(8);   // Min
    expect(nodes[1].radius).toBe(40);  // Max
  });
  
  it('applies correct colors based on file type', () => {
    const tree = createMockTreeNode({
      children: [
        { name: 'model.rb', path: 'app/models/model.rb', isFile: true, fileData: { totalCommitCount: 10 } },
        { name: 'Button.tsx', path: 'components/Button.tsx', isFile: true, fileData: { totalCommitCount: 10 } },
        { name: 'util.ts', path: 'lib/util.ts', isFile: true, fileData: { totalCommitCount: 10 } }
      ]
    });
    
    const nodes = transformTreeToGraph(tree);
    expect(nodes.find(n => n.fileName === 'model.rb')?.color).toBe('#E0115F');
    expect(nodes.find(n => n.fileName === 'Button.tsx')?.color).toBe('#ADD8E6');
    expect(nodes.find(n => n.fileName === 'util.ts')?.color).toBe('#808080');
  });
  
  it('handles tree with no files', () => {
    const tree = createMockTreeNode({
      name: 'root',
      isFile: false,
      children: []
    });
    
    const nodes = transformTreeToGraph(tree);
    expect(nodes).toEqual([]);
  });
  
  it('handles tree with single file', () => {
    const tree = createMockTreeNode({
      children: [
        { name: 'solo.ts', isFile: true, fileData: { totalCommitCount: 50 } }
      ]
    });
    
    const nodes = transformTreeToGraph(tree);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].radius).toBe(24); // Mid-point of [8, 40]
  });
  
  it('handles all files with same commit count', () => {
    const tree = createMockTreeNode({
      children: [
        { name: 'a.ts', isFile: true, fileData: { totalCommitCount: 10 } },
        { name: 'b.ts', isFile: true, fileData: { totalCommitCount: 10 } },
        { name: 'c.ts', isFile: true, fileData: { totalCommitCount: 10 } }
      ]
    });
    
    const nodes = transformTreeToGraph(tree);
    expect(nodes.every(n => n.radius === 24)).toBe(true);
  });
});
```

---

## Type Exports

**Location**: `lib/treemap/data-transformer.ts`

### GraphNode Type

```typescript
import { SimulationNodeDatum } from 'd3-force';

/**
 * Represents a file node in the force-directed graph.
 * Extends d3-force's SimulationNodeDatum with application-specific properties.
 */
export interface GraphNode extends SimulationNodeDatum {
  /** Unique identifier (file path) */
  id: string;
  
  /** Full file path from repository root */
  filePath: string;
  
  /** Display name (last segment of path) */
  fileName: string;
  
  /** Number of commits in selected time range */
  commitCount: number;
  
  /** Calculated bubble radius in pixels [8, 40] */
  radius: number;
  
  /** Hex color based on file type */
  color: string;
  
  // The following are added by d3.forceSimulation:
  // x?: number;
  // y?: number;
  // vx?: number;
  // vy?: number;
  // fx?: number | null;
  // fy?: number | null;
}
```

---

## Constants

**Location**: `lib/treemap/file-type-colors.ts`

### Color Definitions

```typescript
/**
 * Color palette for file type visualization
 */
export const FILE_TYPE_COLORS = {
  RUBY: '#E0115F',      // Ruby red for .rb files
  TYPESCRIPT_REACT: '#ADD8E6',  // Light blue for .tsx files
  DEFAULT: '#808080'    // Gray for test files and others
} as const;

/**
 * Regex patterns for identifying test files
 */
export const TEST_PATTERNS = [
  /\/__tests__\//,
  /\/tests?\//,
  /\.test\./,
  /\.spec\./
] as const;
```

### Radius Constraints

```typescript
/**
 * Bubble radius bounds (in pixels)
 */
export const RADIUS_CONSTRAINTS = {
  MIN: 8,   // Minimum visible bubble size
  MAX: 40   // Maximum to prevent domination
} as const;
```
