# Feature Specification: Simplify TS Graph Edges & Hide Test Files

**Feature Branch**: `006-simplify-ts-graph`
**Created**: 2026-04-08
**Status**: Draft
**Input**: User description: "Simplify TS graph edges: only file-to-parent-folder, folder-to-parent-folder, and function-to-function call edges. Add a hide-test-files toggle that excludes test files from processing by default."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Simplified Edge View (Priority: P1)

A developer opens the TS graph for a repository. Instead of seeing a dense web of import, export, contains, and call edges, they see only three kinds of connections:

1. Files linked to their immediate parent folder (short, gray)
2. Folders linked to their parent folder (short, gray)
3. Functions linked to other functions they call (call edges, styled as today)

All other edge types (import edges, export edges, and non-structural contains edges between files/functions) are removed from the graph, dramatically reducing visual noise and making the codebase structure and call relationships immediately readable.

**Why this priority**: This is the core request — reducing edge clutter is the primary goal of the feature and delivers immediate readability improvements.

**Independent Test**: Load any medium-sized TypeScript repository in the TS graph view. Verify only the three permitted edge categories appear; no import, export, or other edge types are visible.

**Acceptance Scenarios**:

1. **Given** a repository is loaded in the TS graph, **When** the graph renders, **Then** only file→parent-folder, folder→parent-folder, and function→function call edges are displayed.
2. **Given** a repository with deeply nested folders, **When** the graph renders, **Then** each folder node connects to its immediate parent folder with a short gray edge (capped at 100px visual length).
3. **Given** a file contains multiple functions that call each other, **When** the graph renders, **Then** function-to-function call edges appear with their existing styling (same-file, cross-file, external distinctions preserved).
4. **Given** a repository with many cross-file imports, **When** the graph renders, **Then** no import or export edges appear in the visualization.

---

### User Story 2 — Hide Test Files by Default (Priority: P1)

A developer opens the TS graph. Test files (files matching common test patterns such as `.test.ts`, `.test.tsx`, `.spec.ts`, `.spec.tsx`, or files inside `__tests__` directories) are excluded from the analysis entirely — they are not processed, not sent to the client, and do not appear in the graph. This keeps the graph focused on production code.

**Why this priority**: Test files add significant noise to the graph without contributing to understanding production code structure. Hiding them by default immediately improves signal-to-noise ratio.

**Independent Test**: Load a repository that contains test files. Verify that no test file nodes, no child nodes of test files, and no edges involving test files appear in the graph.

**Acceptance Scenarios**:

1. **Given** a repository with test files, **When** the TS graph loads with the default settings, **Then** test files and their children (functions, classes, interfaces within test files) are completely absent from the graph.
2. **Given** the "Hide test files" toggle is on (default state), **When** the analysis runs, **Then** test files are excluded during processing — they are never parsed or included in the graph data sent to the browser.
3. **Given** a folder contains only test files, **When** test files are hidden, **Then** that folder node is also excluded (it has no non-test children to display).

---

### User Story 3 — Toggle Test Files On (Priority: P2)

A developer wants to see test files in the graph temporarily. They uncheck the "Hide test files" toggle at the top of the TS graph view. The system re-runs the analysis with test files included and the graph re-renders showing all files, including test files and their associated nodes and edges.

**Why this priority**: Provides flexibility for developers who occasionally need to visualize test file relationships, but is secondary since the default (hidden) covers the primary use case.

**Independent Test**: Toggle "Hide test files" off, verify the graph re-renders including test file nodes and their children. Toggle it back on, verify they disappear again.

**Acceptance Scenarios**:

1. **Given** the TS graph is displayed with test files hidden, **When** the user unchecks the "Hide test files" toggle, **Then** the system re-analyzes the repository with test files included and the graph updates to show test file nodes and their associated edges.
2. **Given** the TS graph is showing test files, **When** the user checks the "Hide test files" toggle, **Then** the system re-analyzes without test files and the graph updates to remove them.

---

### Edge Cases

- When a repository has no test files, the "Hide test files" toggle has no visible effect but remains available.
- When all files in the repository are test files and the toggle is on, the graph displays an empty state or a message indicating no non-test files were found.
- Folder-to-parent-folder edges terminate at the repository root; the root folder has no parent edge.
- Files at the repository root connect directly to the root folder node.
- If a function calls a function inside a test file and test files are hidden, that call edge is omitted along with the test file target.

## Requirements *(mandatory)*

### Functional Requirements

#### Edge Simplification

- **FR-001**: The graph MUST display edges connecting each file node to its immediate parent folder node, styled as short gray lines with a maximum visual length of 100 pixels.
- **FR-002**: The graph MUST display edges connecting each folder node to its immediate parent folder node, styled as short gray lines with a maximum visual length of 100 pixels.
- **FR-003**: The graph MUST display function-to-function call edges with their current styling and behavior (same-file, cross-file, and external call scope distinctions preserved).
- **FR-004**: The graph MUST NOT display import edges (edges of type `import`).
- **FR-005**: The graph MUST NOT display export edges (edges of type `export`).
- **FR-006**: The graph MUST NOT display any edges other than the three categories specified in FR-001 through FR-003.

#### Test File Toggle

- **FR-007**: The TS graph view MUST include a "Hide test files" toggle control positioned at the top of the graph view.
- **FR-008**: The "Hide test files" toggle MUST be enabled (on) by default.
- **FR-009**: When the toggle is enabled, the system MUST exclude test files from processing entirely — test files are not parsed, not analyzed, and not included in the graph data.
- **FR-010**: Test files are defined as files matching any of: `*.test.ts`, `*.test.tsx`, `*.spec.ts`, `*.spec.tsx`, or any file within a `__tests__` directory.
- **FR-011**: When test files are hidden, all child nodes (functions, classes, interfaces) of test files MUST also be excluded.
- **FR-012**: When test files are hidden, folders that contain only test files (and no other source files) MUST also be excluded.
- **FR-013**: When the user toggles the control off, the system MUST re-process the repository with test files included and update the graph.
- **FR-014**: When the user toggles the control on, the system MUST re-process the repository without test files and update the graph.

### Key Entities

- **Structural Edge (file→folder, folder→folder)**: A containment relationship connecting a node to its immediate parent in the directory hierarchy. Short, gray, max 100px.
- **Call Edge (function→function)**: A relationship indicating one function calls another. Retains existing styling by call scope.
- **Test File**: A TypeScript source file matching `.test.ts`, `.test.tsx`, `.spec.ts`, `.spec.tsx`, or located inside a `__tests__` directory.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The graph displays at most three categories of edges (file→parent-folder, folder→parent-folder, function→function calls) with zero import or export edges visible.
- **SC-002**: On initial load, the graph contains zero test file nodes and zero nodes that are children of test files.
- **SC-003**: Toggling "Hide test files" off causes test file nodes and their children to appear in the graph within a single re-render cycle.
- **SC-004**: Structural edges (file→folder, folder→folder) render at a maximum visual length of 100 pixels.
- **SC-005**: Users can identify the directory structure of the codebase from the graph within 10 seconds of loading.
- **SC-006**: The total number of visible edges decreases by at least 50% compared to the current graph for a typical repository.

## Assumptions

- The existing `contains` edge type in the analyzer covers both file→folder and folder→folder relationships; the simplification filters to only keep contains edges where source is a file/folder and target is a folder.
- The `call` edge type between functions is already correctly implemented and its styling needs no changes.
- The toggle triggers a new server-side analysis request (re-processing) rather than client-side filtering, since the goal is to avoid processing test files entirely.
- The `inTestFile` flag already exists on `TsNodeBase` and can be leveraged for identifying test-file children.
