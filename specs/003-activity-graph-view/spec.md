# Feature Specification: Activity Graph Visualization

**Feature Branch**: `003-activity-graph-view`  
**Created**: February 1, 2026  
**Status**: Draft  
**Input**: User description: "Force-directed activity graph visualization with d3-force, view toggle between heatmap and graph, file-type coloring, and pan/zoom support"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Activity Graph (Priority: P1)

A developer analyzes a repository and wants to see file activity as an interactive network graph where each file is a bubble sized by commit frequency, helping them quickly identify which files are being actively modified.

**Why this priority**: Delivers the core visualization value - the force-directed graph itself. Without this, there's no feature.

**Independent Test**: Can be fully tested by selecting a repository, choosing a time range, and verifying that an Activity Graph renders with bubbles representing files, sized proportionally to their commit counts in the selected timeframe.

**Acceptance Scenarios**:

1. **Given** a repository is selected and analyzed, **When** the user views the Activity Graph, **Then** files appear as bubbles with sizes proportional to commit counts
2. **Given** multiple files with different commit frequencies exist, **When** viewing the Activity Graph, **Then** files with more commits appear as larger bubbles
3. **Given** the Activity Graph is displayed, **When** the user observes the layout, **Then** bubbles are positioned using a force-directed layout that prevents overlap

---

### User Story 2 - Toggle Between Visualization Types (Priority: P2)

A developer wants to switch between the existing Heatmap (treemap) view and the new Activity Graph view to compare different perspectives on repository activity, using whichever visualization best suits their current analysis needs.

**Why this priority**: Provides flexibility and preserves existing functionality. Users can choose the view that works best for their mental model.

**Independent Test**: Can be fully tested by rendering both views and verifying a toggle control switches between them while maintaining selected repository and time range.

**Acceptance Scenarios**:

1. **Given** repository data is loaded, **When** the user clicks the "Activity Graph" toggle, **Then** the view switches from Heatmap to Activity Graph
2. **Given** the Activity Graph is displayed, **When** the user clicks the "Heatmap" toggle, **Then** the view switches back to the treemap visualization
3. **Given** a time range is selected, **When** toggling between views, **Then** both views reflect the same time range selection
4. **Given** a repository is selected, **When** toggling between views, **Then** the repository selection persists across both views

---

### User Story 3 - Distinguish File Types by Color (Priority: P3)

A developer wants to quickly identify Ruby and TypeScript React files in the Activity Graph by color (Ruby files in ruby red, .tsx files in light blue, test files and all others in gray) to understand which parts of the codebase are most active by technology.

**Why this priority**: Adds contextual information that helps developers understand patterns across different file types. Lower priority as the visualization is still useful without color differentiation.

**Independent Test**: Can be fully tested by analyzing a repository with .rb, .tsx, test, and other files, then verifying each appears in the correct color.

**Acceptance Scenarios**:

1. **Given** the Activity Graph displays files, **When** a .rb file is shown, **Then** it appears in ruby red color
2. **Given** the Activity Graph displays files, **When** a .tsx file is shown, **Then** it appears in light blue color
3. **Given** the Activity Graph displays files, **When** a test file is shown (e.g., .test.ts, .spec.js, or files in __tests__ directory), **Then** it appears in gray regardless of extension
4. **Given** the Activity Graph displays files, **When** any other file type is shown, **Then** it appears in gray

---

### User Story 4 - Pan and Zoom the Graph (Priority: P3)

A developer analyzing a large codebase wants to pan and zoom the Activity Graph to focus on specific areas of interest, especially when many files make the initial view crowded.

**Why this priority**: Enhances usability for larger repositories but not critical for initial value delivery. The graph is viewable without pan/zoom.

**Independent Test**: Can be fully tested by rendering an Activity Graph with multiple files and verifying mouse wheel zoom and drag-to-pan functionality.

**Acceptance Scenarios**:

1. **Given** the Activity Graph is displayed, **When** the user scrolls the mouse wheel, **Then** the graph zooms in or out centered on the mouse position
2. **Given** the Activity Graph is displayed, **When** the user drags on empty space, **Then** the entire graph pans in the direction of the drag
3. **Given** the graph is zoomed in, **When** the user continues to zoom out, **Then** the graph returns to its original scale
4. **Given** the graph is panned, **When** the user double-clicks on empty space, **Then** the graph resets to the original centered position and zoom level

---

### User Story 5 - Reuse Existing Controls (Priority: P1)

A developer familiar with the existing Heatmap view wants to use the same repository selection and date range controls when viewing the Activity Graph, maintaining a consistent user experience.

**Why this priority**: Critical for integration with existing functionality. Without this, the feature doesn't connect to the existing data flow.

**Independent Test**: Can be fully tested by verifying that the RepositorySelector and DateRangeSelector components function identically when Activity Graph is selected.

**Acceptance Scenarios**:

1. **Given** Activity Graph view is selected, **When** the user selects a repository using the existing repository selector, **Then** the Activity Graph updates to show data from that repository
2. **Given** a repository is selected in Activity Graph view, **When** the user changes the date range using the existing date selector, **Then** the Activity Graph updates to reflect the new time period
3. **Given** the user switches from Heatmap to Activity Graph, **When** they observe the controls, **Then** the same repository path and date range remain selected

---

### Edge Cases

- What happens when a repository has only one or two files in the selected time range?
  - The Activity Graph should still render with one or two bubbles, appropriately sized. The force simulation should position them centered.

- How does the system handle files with zero commits in the time range?
  - Files with zero commits in the selected time range should not appear in the Activity Graph (consistent with current treemap behavior of showing top 100 files by commit count).

- What happens when all files have the same number of commits?
  - All bubbles should be the same size. The force-directed layout should still distribute them evenly.

- How does color coding handle files with multiple extensions (e.g., .test.tsx)?
  - Test files should be identified by test patterns (`.test.`, `.spec.`, `__tests__/`, etc.) and colored gray regardless of their language extension.

- What happens when a user zooms in extremely far or pans far from the original position?
  - The system should maintain interactive performance and allow users to reset to original position via double-click or a reset button.

- How does the graph handle very large file names that don't fit in bubbles?
  - File names should be truncated with ellipsis or only shown when bubbles are large enough, similar to the treemap implementation.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a toggle control with two options labeled "Heatmap" and "Activity Graph" to switch between visualization types
- **FR-002**: System MUST render an Activity Graph using d3-force library with force-directed layout algorithm that prevents node overlap
- **FR-003**: System MUST display each file as a circular bubble (node) in the Activity Graph
- **FR-004**: System MUST size each bubble proportionally to the number of commits to that file within the selected time range
- **FR-005**: System MUST color .rb files in ruby red (#E0115F or similar ruby red color)
- **FR-006**: System MUST color .tsx files in light blue (#ADD8E6 or similar light blue color)
- **FR-007**: System MUST color all test files in gray (#808080 or similar gray color), where test files are identified by patterns including `.test.`, `.spec.`, paths containing `__tests__/`, `test/`, or `tests/`
- **FR-008**: System MUST color all files not matching .rb, .tsx, or test patterns in gray
- **FR-009**: System MUST implement pan functionality allowing users to drag the graph canvas to reposition the view
- **FR-010**: System MUST implement zoom functionality allowing users to zoom in/out using mouse wheel or pinch gestures
- **FR-011**: System MUST use the existing RepositorySelector component for repository selection in Activity Graph view
- **FR-012**: System MUST use the existing DateRangeSelector component for time range selection in Activity Graph view
- **FR-013**: System MUST maintain the selected repository and time range when toggling between Heatmap and Activity Graph views
- **FR-014**: System MUST update the Activity Graph when the user selects a different repository
- **FR-015**: System MUST update the Activity Graph when the user changes the date range
- **FR-016**: System MUST use the same data source and API endpoint (git-analysis) for both Heatmap and Activity Graph views
- **FR-017**: System MUST display file names as labels on or near bubbles when space permits (similar to treemap text display logic)
- **FR-018**: System MUST provide visual feedback when users interact with the graph (dragging, zooming)
- **FR-019**: System MUST prevent bubbles from overlapping using collision detection in the force simulation
- **FR-020**: System MUST center and fit the graph within the available viewport on initial render

### Technical Specifications

*Note: User explicitly requested these technical details be included in the spec*

- **TS-001**: Implementation MUST use d3-force library for force-directed graph layout
- **TS-002**: Implementation MUST use d3-zoom for pan and zoom functionality
- **TS-003**: Implementation SHOULD use d3-drag for node dragging interactions (optional enhancement)
- **TS-004**: Force simulation MUST include collision force to prevent bubble overlap
- **TS-005**: Force simulation SHOULD include center force to keep graph centered
- **TS-006**: Force simulation MAY include link forces for directory-based clustering (optional enhancement)

### Key Entities

- **FileNode**: Represents a single file in the repository with attributes including file path, commit count, file extension, and whether it is a test file. Used to render individual bubbles in the Activity Graph.
- **ViewMode**: Enumeration representing the selected visualization type, either "Heatmap" (treemap) or "Activity Graph" (force-directed graph). Determines which visualization component renders.
- **ForceSimulation**: The d3-force simulation state managing node positions, velocities, and forces. Runs continuously to animate node movements until reaching equilibrium.
- **ZoomTransform**: Represents the current pan and zoom state of the graph, including scale factor and translation offset. Applied to the graph container to transform the view.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can switch between Heatmap and Activity Graph views within 1 second (click response time)
- **SC-002**: Activity Graph renders and displays file bubbles within 2 seconds for repositories with up to 100 files
- **SC-003**: Users can identify file types by color at a glance without reading labels (visual scan time under 3 seconds for 20+ files)
- **SC-004**: Pan and zoom interactions respond smoothly at 30+ frames per second during user input
- **SC-005**: Graph layout stabilizes (nodes stop moving) within 3 seconds of initial render
- **SC-006**: 100% of files in the analyzed time range are represented as bubbles in the Activity Graph
- **SC-007**: Bubble sizes accurately reflect commit frequency with a minimum 2:1 size ratio between highest and lowest commit count files
- **SC-008**: Users can pan and zoom to any area of the graph without performance degradation
- **SC-009**: All test files are correctly identified and colored gray regardless of their language extension
- **SC-010**: The visualization maintains the same data filtering (top 100 files) as the existing Heatmap view for consistency

## Assumptions

- The existing git-analysis API endpoint will continue to return TreeNode data structure compatible with both visualization types
- Repository analysis will continue to limit results to top 100 files by commit count
- Users have modern browsers with JavaScript and SVG support
- The d3-force library is compatible with the current React and Next.js versions
- Bubble collision detection will prevent complete overlap while allowing some visual density
- File type detection based on extension patterns is sufficient (no need for content-based analysis)
- Test file patterns (`.test.`, `.spec.`, `__tests__/`) cover the majority of test file naming conventions
- Pan and zoom gestures will use standard web interactions (mouse wheel, drag) without custom gesture requirements
- The Activity Graph will use the same color legend area, but with discrete color swatches instead of a gradient
- Existing responsive sizing logic can be reused for the Activity Graph component

## Dependencies

- d3-force library must be installed as a new dependency
- d3-zoom library must be installed as a new dependency (or use existing @visx/zoom if compatible)
- Existing components (RepositorySelector, DateRangeSelector, LoadingState, ErrorDisplay) must remain unchanged
- Existing git-analysis API endpoint must continue to function without modifications
- Existing TreeNode data structure must be used for both visualizations

## Out of Scope

- Dragging individual nodes to reposition them manually
- Creating links/edges between related files (e.g., files in same directory)
- Customizable color schemes or user-defined file type colors
- Filtering or searching within the graph view
- Tooltips showing detailed commit information on hover
- Animation between layout changes when data updates
- Export functionality for graph as image
- Alternative force layout algorithms or layout customization
- Node clustering by directory hierarchy
- Displaying more than 100 files (maintaining current limit)
- Historical playback showing how the graph changes over time
- Integration with other visualization types beyond Heatmap and Activity Graph
