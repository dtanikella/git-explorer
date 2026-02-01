# Data Model: Git Repository Commit Activity Treemap

**Feature**: 002-commit-treemap  
**Phase**: 1 (Design)  
**Date**: January 31, 2026

## Overview

This document defines the core data entities and their relationships for the git treemap feature. All entities are TypeScript interfaces representing runtime data structures (no database persistence required).

## Entity Definitions

### 1. Repository Input

**Purpose**: Represents the user's repository selection and analysis parameters.

```typescript
interface RepositoryInput {
  /** Absolute path to the git repository on the server's file system */
  repoPath: string;
  
  /** Time range for commit analysis (initially hardcoded to '2w') */
  timeRange: TimeRangePreset;
}

type TimeRangePreset = '2w' | '1m' | '3m' | '6m' | '1y';
```

**Validation Rules**:
- `repoPath` must be absolute path, must exist, must contain `.git` folder
- `timeRange` initially supports only '2w' (MVP), other options added in P2 enhancement

**Relationships**: Input to API route, validated server-side

---

### 2. Time Range Configuration

**Purpose**: Calculates date boundaries and midpoint for commit filtering and color calculations.

```typescript
interface TimeRangeConfig {
  /** Start date of the analysis window */
  startDate: Date;
  
  /** End date of the analysis window (typically now) */
  endDate: Date;
  
  /** Midpoint of the time range (used to calculate "last half" for colors) */
  midpoint: Date;
  
  /** Human-readable label */
  label: string;
  
  /** Preset identifier */
  preset: TimeRangePreset;
}
```

**Calculation Logic**:
```typescript
function createTimeRangeConfig(preset: TimeRangePreset): TimeRangeConfig {
  const endDate = new Date();
  const startDate = new Date();
  
  switch (preset) {
    case '2w': startDate.setDate(endDate.getDate() - 14); break;
    case '1m': startDate.setMonth(endDate.getMonth() - 1); break;
    case '3m': startDate.setMonth(endDate.getMonth() - 3); break;
    case '6m': startDate.setMonth(endDate.getMonth() - 6); break;
    case '1y': startDate.setFullYear(endDate.getFullYear() - 1); break;
  }
  
  const midpoint = new Date((startDate.getTime() + endDate.getTime()) / 2);
  
  return {
    startDate,
    endDate,
    midpoint,
    label: PRESET_LABELS[preset],
    preset
  };
}
```

**Relationships**: Created from `RepositoryInput`, used by git analyzer

---

### 3. Commit Record

**Purpose**: Represents a single commit from git log, used during parsing.

```typescript
interface CommitRecord {
  /** Commit SHA hash (unique identifier) */
  sha: string;
  
  /** Commit timestamp */
  date: Date;
  
  /** List of files changed in this commit */
  files: string[];
}
```

**Source**: Parsed from `simple-git` log output

**Usage**: Intermediate structure during analysis; not exposed to client

---

### 4. File Commit Data

**Purpose**: Aggregated commit statistics for a single file.

```typescript
interface FileCommitData {
  /** Relative path from repository root (e.g., "src/components/Button.tsx") */
  filePath: string;
  
  /** Total unique commits touching this file in the entire time range */
  totalCommitCount: number;
  
  /** Unique commits in the "recent period" (last half of time range) */
  recentCommitCount: number;
  
  /** Normalized frequency score [0, 1] for color calculation */
  frequencyScore: number;
}
```

**Calculation**:
```typescript
// After grouping commits by file
const totalCommitCount = uniqueCommitSHAs.size;
const recentCommitCount = uniqueCommitSHAs.filter(sha => 
  commitDateBySHA[sha] >= timeRange.midpoint
).size;

// Normalized across all files
const maxRecentCount = Math.max(...allFiles.map(f => f.recentCommitCount));
const frequencyScore = maxRecentCount > 0 ? recentCommitCount / maxRecentCount : 0;
```

**Relationships**: 
- One per file in repository (before filtering)
- Top 500 by `totalCommitCount` selected for visualization
- Used to build `TreeNode` hierarchy

---

### 5. Tree Node

**Purpose**: Hierarchical data structure for treemap visualization (matches visx/d3 format).

```typescript
interface TreeNode {
  /** Node name (folder name or file name, not full path) */
  name: string;
  
  /** Full path from repository root */
  path: string;
  
  /** 
   * Numeric value for treemap sizing:
   * - For files: totalCommitCount
   * - For folders: sum of all descendant values
   */
  value: number;
  
  /** Child nodes (folders/files); undefined for leaf files */
  children?: TreeNode[];
  
  /** Whether this node represents a file (true) or folder (false) */
  isFile: boolean;
  
  /** Color value (hex string) - only for files, calculated from frequencyScore */
  color?: string;
  
  /** Original commit data - only for files */
  fileData?: FileCommitData;
}
```

**Constraints**:
- `children` is `undefined` for files (`isFile: true`), empty array `[]` for empty folders
- `value` for folders is always computed as sum of children (cannot be set directly)
- `color` only present on file nodes, calculated from `fileData.frequencyScore`

**Relationships**: 
- Root node represents repository root
- Tree structure preserves folder hierarchy
- Leaf nodes (files) contain `fileData` reference
- Passed directly to visx `<Treemap>` component

---

### 6. Treemap Layout Rectangle

**Purpose**: Visual rendering data calculated by visx/d3 layout algorithm (not manually constructed).

```typescript
interface TreemapRectangle {
  /** Node data from TreeNode */
  data: TreeNode;
  
  /** X coordinate (pixels) */
  x: number;
  
  /** Y coordinate (pixels) */
  y: number;
  
  /** Width (pixels) */
  width: number;
  
  /** Height (pixels) */
  height: number;
  
  /** Depth in tree (0 = root) */
  depth: number;
}
```

**Source**: Generated by visx `treemap()` layout function

**Usage**: Rendered as SVG `<rect>` elements with fill color from `data.color`

---

### 7. API Response

**Purpose**: Structured response from git analysis API route.

```typescript
interface GitAnalysisResponse {
  /** Whether the analysis succeeded */
  success: boolean;
  
  /** Tree data for visualization (only if success) */
  data?: TreeNode;
  
  /** Error message (only if !success) */
  error?: string;
  
  /** Analysis metadata */
  metadata?: {
    /** Total files analyzed before filtering */
    totalFilesAnalyzed: number;
    
    /** Number of files in the visualization (≤500) */
    filesDisplayed: number;
    
    /** Time range configuration used */
    timeRange: TimeRangeConfig;
    
    /** Analysis duration in milliseconds */
    analysisDurationMs: number;
  };
}
```

**Success Response Example**:
```json
{
  "success": true,
  "data": {
    "name": "root",
    "path": "",
    "value": 1523,
    "isFile": false,
    "children": [ /* ... */ ]
  },
  "metadata": {
    "totalFilesAnalyzed": 847,
    "filesDisplayed": 500,
    "timeRange": { /* ... */ },
    "analysisDurationMs": 2341
  }
}
```

**Error Response Example**:
```json
{
  "success": false,
  "error": "The selected folder is not a git repository"
}
```

---

## Data Flow

```
1. User Input
   RepositoryInput { repoPath, timeRange }
   ↓

2. Server: Time Range Setup
   TimeRangeConfig { startDate, endDate, midpoint }
   ↓

3. Server: Git Log Parsing
   CommitRecord[] → Map<filePath, Set<commitSHA>>
   ↓

4. Server: Aggregation
   FileCommitData[] (all files with commit counts)
   ↓

5. Server: Filtering
   FileCommitData[] (top 500 by totalCommitCount)
   ↓

6. Server: Hierarchy Building
   TreeNode (root with nested children)
   ↓

7. Server: Color Calculation
   TreeNode with color values on file nodes
   ↓

8. API Response
   GitAnalysisResponse → sent to client
   ↓

9. Client: Visualization
   visx Treemap → TreemapRectangle[] → SVG rendering
```

## Type Exports

All types defined in `lib/git/types.ts` for shared access between server and client:

```typescript
// lib/git/types.ts
export type {
  RepositoryInput,
  TimeRangePreset,
  TimeRangeConfig,
  CommitRecord,
  FileCommitData,
  TreeNode,
  TreemapRectangle,
  GitAnalysisResponse,
};
```

## Validation & Constraints

| Entity | Constraint | Validation Location |
|--------|-----------|-------------------|
| RepositoryInput | `repoPath` must exist | API route (server-side) |
| RepositoryInput | `repoPath` must contain `.git` | API route (server-side) |
| TimeRangeConfig | `startDate < endDate` | Date helper (server-side) |
| FileCommitData | `totalCommitCount >= recentCommitCount` | Git analyzer (server-side) |
| FileCommitData | `frequencyScore` in [0, 1] | Color scale (server-side) |
| TreeNode | Files have no children | Tree builder (server-side) |
| TreeNode | Folder values = sum of children | Tree builder (server-side) |

## Testing Strategy

Per TDD principle, all entities have corresponding test files:

- `__tests__/unit/types.test.ts` - Type guards, validation helpers
- `__tests__/unit/time-range-config.test.ts` - Date calculations
- `__tests__/unit/file-commit-data.test.ts` - Aggregation logic
- `__tests__/unit/tree-node.test.ts` - Hierarchy building, value aggregation
- `__tests__/integration/git-analysis-api.test.ts` - Full data flow with mock repo
