# Feature Specification: Co-Change Network Visualization

**Feature Branch**: `004-cochange-network`  
**Created**: February 1, 2026  
**Status**: Draft  
**Input**: User description: "Convert the activity graph force layout to show co-change relationships between files with links representing commit co-occurrence frequency, encoded through line thickness and distance"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Refactor Visualization with Example Data (Priority: P1)

A developer enters a repository path and clicks "Analyze", and instead of the current bubble chart, they see a force-directed network graph matching the Observable example (https://observablehq.com/@d3/disjoint-force-directed-graph/2) rendered with hardcoded example data, demonstrating nodes connected by links in a network layout.

**Why this priority**: Establishes the new visualization foundation with a working reference implementation before adding data complexity. Proves the D3 force-directed graph with links works correctly in the React component.

**Independent Test**: Can be fully tested by entering any repository path, clicking "Analyze", and verifying the activity graph view displays a network graph with nodes and connecting lines matching the Observable example structure, regardless of the actual repository data.

**Acceptance Scenarios**:

1. **Given** user is on the repository selection page, **When** user enters a path and clicks "Analyze", **Then** they are taken to the visualization page showing a force-directed graph with example data
2. **Given** the visualization is displaying, **When** examining the graph structure, **Then** nodes are connected by visible link lines in a network pattern
3. **Given** the example graph is rendered, **When** user drags a node, **Then** connected links move with the node and update in real-time
4. **Given** the graph uses example data, **When** switching time ranges or repositories, **Then** the same example graph continues to display (data not yet connected)

---

### User Story 2 - Build Co-Occurrence Calculation Utility (Priority: P2)

The system includes a utility function that analyzes commit records and calculates which file pairs appear together in commits, returning a co-occurrence map with frequency counts for each file pair relationship.

**Why this priority**: Creates the data processing foundation needed to transform git commit data into the graph link structure, independent of the visualization layer.

**Independent Test**: Can be tested independently by passing sample commit data to the utility function and verifying it returns correct co-occurrence counts for file pairs that appear together in commits.

**Acceptance Scenarios**:

1. **Given** commit data with files A and B modified together in 5 commits, **When** utility processes the commits, **Then** the output includes a link between A and B with value=5
2. **Given** commit data with file C modified alone in 3 commits, **When** utility processes the commits, **Then** file C has no outgoing links in the output
3. **Given** files D and E modified together in 10 commits and D and F together in 2 commits, **When** utility processes commits, **Then** output includes both relationships with correct frequency values (10 and 2)
4. **Given** top 50 files filtered from larger dataset, **When** utility calculates co-occurrence, **Then** only relationships between those 50 files are included

---

### User Story 3 - Connect Real Repository Data to Graph (Priority: P3)

When a user analyzes a repository, the system fetches real git data, calculates file co-change relationships using the utility, and renders the force-directed graph with nodes representing actual repository files and links showing their commit co-occurrence patterns.

**Why this priority**: Completes the end-to-end integration, connecting user input → git analysis → co-occurrence calculation → graph visualization.

**Independent Test**: Can be tested by analyzing a known repository and verifying that displayed nodes correspond to actual repository files and link patterns match the repository's commit history co-change patterns.

**Acceptance Scenarios**:

1. **Given** user enters a valid repository path, **When** clicking "Analyze", **Then** the graph displays nodes representing actual files from that repository (not example data)
2. **Given** repository files A and B were committed together frequently, **When** viewing the graph, **Then** a thick connecting line appears between nodes A and B
3. **Given** repository files C and D were never committed together, **When** viewing the graph, **Then** no connecting line appears between nodes C and D
4. **Given** files with varying co-change frequencies, **When** viewing the graph, **Then** line thickness and node proximity vary according to relationship strength
5. **Given** user changes time range selection, **When** re-analyzing, **Then** the graph updates to reflect co-change patterns within the new time range

---

### Edge Cases

- What happens when two files were never committed together? (No link should render between them)
- What happens when all files have the same co-change frequency? (Links should all have uniform thickness)
- What happens when only one file exists in the dataset? (Single node, no links)
- What happens when files have co-changed once? (Link renders at minimum thickness)
- What happens when the time range contains no commits? (Empty graph with "no data" message)
- What happens during phase 1 (example data) when user changes repository or time range? (Same example graph continues to display)

## Clarifications

### Session 2026-02-01

- Q: How should implementation work be sequenced and what should each phase deliver independently? → A: Three-phase approach: (1) Refactor visualization to match Observable example using hardcoded data, testable by seeing graph render with example data regardless of repo input. (2) Build co-occurrence utility in isolation, testable with sample commit data returning correct file pair frequencies. (3) Wire up real git data to graph through utility, testable by verifying actual repository files and relationships display correctly.

## Requirements *(mandatory)*

### Functional Requirements

**Phase 1: Visualization Refactor**
- **FR-001**: System MUST render force-directed network graph matching Observable example structure with nodes and links
- **FR-002**: System MUST use continuous force simulation with tick-based updates to enable smooth real-time node dragging
- **FR-003**: System MUST render link lines beneath node circles to maintain visual hierarchy
- **FR-004**: System MUST display example/hardcoded graph data when user navigates to activity graph view (temporarily ignoring actual repository input)

**Phase 2: Data Processing**
- **FR-005**: System MUST provide utility function that calculates co-occurrence frequency between file pairs from commit records
- **FR-006**: Utility MUST analyze commits where multiple files appear together and count occurrences for each file pair
- **FR-007**: Utility MUST filter co-occurrence calculations to only include relationships between displayed files (top 50)
- **FR-008**: Utility MUST return data structure containing nodes array and links array with co-occurrence frequency values

**Phase 3: Integration**
- **FR-009**: System MUST limit analysis and display to the top 50 files by commit frequency (reduced from 100)
- **FR-010**: System MUST include commit data in the API response to enable co-occurrence calculation
- **FR-011**: System MUST encode co-change frequency visually through line stroke width, mapping higher frequencies to thicker lines (1px - 5px range)
- **FR-012**: System MUST use inverse distance scaling in force simulation, positioning frequently co-changed files closer together (10px minimum, 100px maximum)

### Key Entities

- **GraphNode**: File node with id, path, name, commit count, radius, color, and x/y position (unchanged from current implementation)
- **GraphLink**: Connection between two nodes with source file id, target file id, and co-change frequency value
- **CommitRecord**: Individual commit containing commit SHA, date, and array of file paths modified in that commit

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can identify file relationships by observing visible connecting lines between nodes in the activity graph view
- **SC-002**: Users can distinguish relationship strength by comparing line thickness, where thicker lines indicate more frequent co-changes
- **SC-003**: Graph layout positions frequently co-changed files closer together than infrequently co-changed files, with proximity correlating to co-change frequency
- **SC-004**: Activity graph renders 50 nodes with relationship links in under 3 seconds for typical repositories
- **SC-005**: Users can drag connected nodes and observe connected links update in real-time during interaction

## Assumptions *(mandatory)*

- Co-change frequency (files modified in the same commit) is a meaningful proxy for architectural coupling and file relationships
- Line thickness and node proximity are sufficient visual encodings for relationship strength without requiring additional UI elements (tooltips, legends)
- Top 50 files provide sufficient coverage of repository activity while maintaining performance
- Commit data is available and not excessively large (manageable to send to client)
- D3's force simulation with link forces will produce readable layouts without manual tuning for most repositories

## Out of Scope *(mandatory)*

- Creating links based on directory structure (only co-change relationships)
- Analyzing actual code dependencies through AST parsing or import statements
- Filtering or toggling link visibility by co-change threshold
- Showing commit details or file names on link hover
- Animated transitions between different time range selections
- Link color encoding for different relationship types
- Clustering or grouping by directory structure
- Search or filtering of displayed files
- Export or sharing of graph visualizations
