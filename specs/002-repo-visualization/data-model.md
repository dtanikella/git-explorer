# Data Model: Interactive Repository Visualization

**Feature**: 002-repo-visualization  
**Date**: January 31, 2026

---

## Core Entities

### FileNode

Represents a file or folder in the repository tree.

```typescript
interface FileNode {
  /** Absolute path to the file or folder */
  path: string;
  
  /** Name of the file or folder (basename) */
  name: string;
  
  /** Type discriminator */
  type: 'file' | 'folder';
  
  /** Size in bytes. For files: actual size. For folders: sum of children sizes */
  size: number;
  
  /** File extension including dot (e.g., ".ts"). Empty string for folders */
  extension: string;
  
  /** Child nodes. Only present for folders */
  children?: FileNode[];
  
  /** Extensible metadata bucket for future properties (git stats, etc.) */
  metadata: Record<string, unknown>;
}
```

**Validation Rules**:
- `path` must be an absolute path
- `name` must not be empty
- `size` must be >= 0
- `extension` must start with `.` for files, or be empty string
- `children` must be present and non-empty for `type: 'folder'` (except empty folders)

---

### FileTree

The root node of the repository structure. Identical to `FileNode` but always has `type: 'folder'`.

```typescript
type FileTree = FileNode & { type: 'folder'; children: FileNode[] };
```

---

### SizingStrategy

A function that determines the numeric value used for circle radius calculation.

```typescript
type SizingStrategy = (node: FileNode) => number;
```

**Built-in Strategies**:

| Strategy | Description | Implementation |
|----------|-------------|----------------|
| `fileSizeStrategy` | Size by file bytes (default) | `(node) => node.size` |
| `uniformStrategy` | All circles same size | `(node) => 1` |

**Future Strategies** (out of scope v1):
- `commitCountStrategy`: `(node) => node.metadata.commitCount as number`
- `changeFrequencyStrategy`: `(node) => node.metadata.changeFrequency as number`

---

### ColoringStrategy

A function that determines the fill color for a circle.

```typescript
type ColoringStrategy = (node: FileNode) => string;
```

**Built-in Strategies**:

| Strategy | Description | Implementation |
|----------|-------------|----------------|
| `extensionColorStrategy` | Color by file extension (default) | Maps `.ts` → blue, etc. |
| `typeColorStrategy` | Color by file vs folder | Files → blue, folders → gray |

**Future Strategies** (out of scope v1):
- `railsConceptStrategy`: Color by folder name (models/ → red, controllers/ → green)
- `heatmapStrategy`: Gradient based on `metadata.changeFrequency`

---

## API Types

### Request: Scan Repository

```typescript
interface ScanRequest {
  /** Absolute path to the repository root */
  path: string;
}
```

### Response: File Tree (Success)

```typescript
interface ScanSuccessResponse {
  success: true;
  data: FileTree;
  stats: {
    totalFiles: number;
    totalFolders: number;
    totalSize: number;
  };
}
```

### Response: Error

```typescript
interface ScanErrorResponse {
  success: false;
  error: {
    code: 'PATH_NOT_FOUND' | 'NOT_A_DIRECTORY' | 'PERMISSION_DENIED' | 'EMPTY_PATH';
    message: string;
  };
}
```

---

## Visualization Data

After processing by `@visx/hierarchy`, nodes have additional computed properties:

```typescript
interface PackedNode {
  /** Original FileNode data */
  data: FileNode;
  
  /** Computed x position (center) */
  x: number;
  
  /** Computed y position (center) */
  y: number;
  
  /** Computed radius */
  r: number;
  
  /** Depth in tree (0 = root) */
  depth: number;
  
  /** Parent node reference */
  parent: PackedNode | null;
  
  /** Child nodes */
  children?: PackedNode[];
}
```

---

## State Management

### Visualization State (React component state)

```typescript
interface VisualizationState {
  /** Current file tree data */
  fileTree: FileTree | null;
  
  /** Loading state */
  isLoading: boolean;
  
  /** Error message if any */
  error: string | null;
  
  /** Currently hovered node (for tooltip) */
  hoveredNode: FileNode | null;
  
  /** Tooltip position */
  tooltipPosition: { x: number; y: number } | null;
}
```

### Zoom State (managed by @visx/zoom)

```typescript
// Provided by useZoom() hook
interface ZoomState {
  transformMatrix: TransformMatrix;
  // zoom.toString() → "matrix(...)" for SVG transform
}
```

---

## Relationships

```
FileTree (root)
    │
    ├── FileNode (folder)
    │       ├── FileNode (file)
    │       ├── FileNode (file)
    │       └── FileNode (folder)
    │               └── FileNode (file)
    │
    └── FileNode (file)

SizingStrategy  ──(applies to)──▶  FileNode  ──(produces)──▶  number (for radius)
ColoringStrategy ──(applies to)──▶  FileNode  ──(produces)──▶  string (hex color)
```

---

## Invariants

1. Every `FileNode` with `type: 'folder'` MUST have a `children` array (may be empty)
2. Every `FileNode` with `type: 'file'` MUST NOT have a `children` property
3. The root `FileTree` MUST have `type: 'folder'`
4. All `path` values MUST be unique within a tree
5. `metadata` MUST be a valid object (never null/undefined)
