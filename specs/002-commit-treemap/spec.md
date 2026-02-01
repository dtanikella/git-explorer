# Feature Specification: Git Repository Commit Activity Treemap

**Feature Branch**: `002-commit-treemap`  
**Created**: January 31, 2026  
**Status**: Draft  
**Input**: User description: "Build an interactive treemap showing commit frequency for the top 500 most-changed files in a repository. Users select a local repository via browser directory picker and choose a time range to visualize when and where development activity occurred."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Repository Selection and Validation (Priority: P1)

A user wants to select a git repository from their local machine using an intuitive interface, with validation to ensure they've selected a valid repository before proceeding.

**Why this priority**: This is the entry point to the entire feature. Without repository selection, no analysis can occur. It's the foundational user interaction.

**Independent Test**: Can be fully tested by clicking the repository selection button, using the browser directory picker to select various folders (valid repos, non-repos, permission-restricted), and verifying appropriate validation feedback. Delivers value by providing a clear, error-free way to specify which repository to analyze.

**Acceptance Scenarios**:

1. **Given** a user opens the application, **When** the page loads, **Then** they see a button to select a repository
2. **Given** a user clicks the repository selection button, **When** the browser directory picker appears, **Then** they can navigate and select a folder
3. **Given** a user has selected a folder with a .git directory, **When** validation completes, **Then** the system confirms the repository is valid and ready for analysis
4. **Given** a user has selected a folder without a .git directory, **When** validation completes, **Then** an error message states "The selected folder is not a git repository"
5. **Given** a user has selected a folder without read permissions, **When** validation attempts to access it, **Then** an error message states "Cannot access the selected repository. Check permissions."

---

### User Story 2 - Basic Treemap Visualization (Priority: P1)

A developer wants to see a visual treemap of their repository showing the top 500 most-changed files from the last 2 weeks, with the hierarchy matching the repository's folder structure.

**Why this priority**: This is the core visualization feature. After repository selection, users need to see the treemap to gain insights. This establishes the fundamental value of the application.

**Independent Test**: Can be fully tested by selecting a valid repository and verifying that a treemap appears showing files from the last 2 weeks, with rectangle sizes proportional to commit counts, displaying the top 500 files, and preserving the folder hierarchy. Delivers immediate value in understanding recent repository activity patterns.

**Acceptance Scenarios**:

1. **Given** a user has selected a valid git repository, **When** the system analyzes commit history, **Then** it filters commits to the last 2 weeks from the current date
2. **Given** the system has analyzed commits, **When** building the treemap data, **Then** only the top 500 most-changed files are included
3. **Given** a treemap is displayed, **When** the user views it, **Then** each rectangle represents a file with size proportional to its commit count
4. **Given** a treemap is displayed, **When** the user views it, **Then** the hierarchy matches the repository's folder structure with nested folders and files
5. **Given** a repository has fewer than 500 files with commits, **When** the treemap is displayed, **Then** all files with commits are shown
6. **Given** files have identical commit counts, **When** selecting the top 500, **Then** files are sorted alphabetically as a tiebreaker

---

### User Story 3 - Activity Frequency Color Gradient (Priority: P2)

A developer wants to see at a glance which files have been most actively changed in the recent period, with darker green indicating more frequent changes and lighter gray indicating less frequent changes in the last half of the treemap's date range.

**Why this priority**: Adds visual distinction to help users quickly identify the hottest files (most recent, frequent activity). Enhances the basic treemap but the feature is still functional without color coding.

**Independent Test**: Can be tested by analyzing a repository with known commit patterns and verifying that files with many commits in the last week (second half of 2-week window) appear in dark green, while files with fewer recent commits appear in lighter shades toward gray. Works independently by adding a color encoding layer to the existing treemap.

**Acceptance Scenarios**:

1. **Given** a treemap is displayed, **When** calculating colors, **Then** the system counts commits in the last half of the date range (e.g., last 7 days for a 2-week window)
2. **Given** a file has the highest commit frequency in the last half of the date range, **When** the treemap renders, **Then** the file appears in dark green
3. **Given** a file has low commit frequency in the last half of the date range, **When** the treemap renders, **Then** the file appears in light gray
4. **Given** files have varying commit frequencies, **When** the treemap renders, **Then** colors form a gradient from dark green (highest frequency) to light gray (lowest frequency)
5. **Given** a file has zero commits in the last half but commits in the first half, **When** the treemap renders, **Then** the file appears in the lightest gray

---

### User Story 4 - Date Range Filter Selection (Priority: P2)

A user wants to analyze commit patterns across different time periods by selecting from preset time ranges (last 2 weeks, last month, last quarter, etc.), enabling them to identify trends at various time scales beyond the default 2-week view.

**Why this priority**: Adds flexibility to the visualization, allowing users to explore different temporal windows. The feature is valuable with the hardcoded 2-week default, but time range selection significantly expands its utility.

**Independent Test**: Can be tested by viewing the initial 2-week treemap, then selecting different preset time ranges (e.g., "Last Month", "Last Quarter") and verifying the treemap updates with commits filtered to the new date range. Works independently by adding filtering controls to the existing treemap.

**Acceptance Scenarios**:

1. **Given** a treemap is displayed with the default 2-week range, **When** the user views the interface, **Then** they see time range options: "Last 2 weeks", "Last Month", "Last Quarter", "Last 6 Months", "Last Year"
2. **Given** a user selects "Last Month", **When** the selection is made, **Then** the system analyzes commits from the last 30 days and updates the treemap
3. **Given** a user selects "Last Quarter", **When** the selection is made, **Then** the system analyzes commits from the last 90 days and the color gradient recalculates based on the new last-half period (last 45 days)
4. **Given** a treemap is displayed for one time range, **When** the user selects a different time range, **Then** the treemap updates within 5 seconds to reflect the new period's data
5. **Given** no commits exist in the selected time range, **When** analysis completes, **Then** the user sees a message "No commits found in the selected time period"

---

### User Story 5 - Graceful Error Handling (Priority: P3)

A user encounters errors during repository analysis (git command failures, permission issues, empty repositories, etc.) and receives clear, actionable error messages rather than crashes or hanging states.

**Why this priority**: Essential for production quality and user trust, but core functionality can be demonstrated without comprehensive error handling. Error scenarios are less common than successful flows.

**Independent Test**: Can be tested by intentionally triggering various error conditions (invalid repo paths, permission-restricted folders, repositories with no commits, git not installed) and verifying appropriate error messages with recovery options appear. Works independently as a defensive layer around the core functionality.

**Acceptance Scenarios**:

1. **Given** an error occurs during git analysis, **When** the error is encountered, **Then** the user sees a clear error message describing the problem
2. **Given** an error message is displayed, **When** the user views it, **Then** they see an option to select a different repository or retry
3. **Given** git is not installed on the system, **When** attempting analysis, **Then** an error states "Git is required. Please install git and try again."
4. **Given** the selected repository has no commits in any range, **When** analysis completes, **Then** a message states "This repository has no commit history."
5. **Given** the system encounters an unexpected error, **When** processing fails, **Then** a generic error message displays with a suggestion to check the browser console for details

---

### User Story 6 - Interactive Hover Tooltips (Priority: P4 - Deferred)

A user wants to hover over files and folders in the treemap to see detailed information (file name, exact commit count, commit frequency in recent period) without cluttering the visual display.

**Why this priority**: Enhances usability by providing detailed data on demand, but the treemap is fully functional without tooltips. Can be deferred to later iterations without impacting core value.

**Independent Test**: Can be tested by hovering over various rectangles in the treemap and verifying tooltips appear with accurate information. Works independently as a progressive enhancement layer over the existing visualization.

**Acceptance Scenarios**:

1. **Given** a treemap is displayed, **When** a user hovers over a file rectangle, **Then** a tooltip appears showing the file name and total commit count
2. **Given** a treemap is displayed, **When** a user hovers over a file rectangle, **Then** the tooltip shows commit count in the last half of the date range
3. **Given** a tooltip is displayed, **When** the user moves their cursor to a different rectangle, **Then** the tooltip updates to show the new element's information
4. **Given** a tooltip is displayed, **When** the user moves their cursor outside the treemap, **Then** the tooltip disappears
5. **Given** a treemap with nested folders, **When** a user hovers over a folder rectangle, **Then** the tooltip shows the folder name and aggregate commit count of all descendants

---

### Edge Cases

- What happens when a repository has fewer than 500 files? Display all files without filtering.
- What happens when files have identical commit counts? Sort alphabetically as tiebreaker to ensure deterministic top 500 selection.
- How does the system handle files that were renamed? Count commits under both old and new names as separate entries (git's --follow flag tracks renames but we treat them as distinct for simplicity).
- What happens when a file is deleted during the time window? Include it if it ranks in the top 500 by commit count (historical activity matters).
- How does the system handle merge commits? Count merge commits equally with regular commits - each unique commit SHA touching a file increments that file's count.
- What happens when the repository is extremely large (100k+ files)? Optimize by processing git log once and filtering to top 500 before building hierarchy.
- What happens when a user selects a time range with zero commits? Display an empty state message: "No commits found in the selected time period."
- How does the system handle repositories with very deep nesting (10+ levels)? Display the full hierarchy regardless of depth, as parent folders are necessary for context.
- What happens when a file has zero commits in the last half but commits in the first half? Color the file light gray (lowest frequency in recent period).
- What happens when a file has only 1-2 commits in the recent period? Use the same color scale - it will appear near the light gray end unless those few commits represent high frequency relative to other files.
- How is "frequency" calculated for the color gradient? Count commits in the last half of the time window, then normalize across all files to create the gradient (highest count = dark green, lowest = light gray).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow users to select a local repository using the browser's native directory picker (File System Access API)
- **FR-002**: System MUST validate that the selected directory contains a .git folder before proceeding with analysis
- **FR-003**: System MUST initially analyze commits from the last 2 weeks (hardcoded default)
- **FR-003a**: System MUST provide preset time range options: "Last 2 weeks" (default), "Last Month", "Last Quarter", "Last 6 Months", "Last Year"
- **FR-004**: System MUST analyze git commit history using the `simple-git` library to extract commit data filtered by the selected date range
- **FR-005**: System MUST count unique commit SHAs (including merge commits) for each file in the repository
- **FR-006**: System MUST filter files to show only the top 500 by total commit count
- **FR-007**: System MUST construct a hierarchical tree structure where parent directories aggregate commit counts from all child files
- **FR-008**: System MUST render a treemap visualization using @visx/hierarchy where rectangle size is proportional to commit count
- **FR-009**: System MUST color treemap rectangles using a sequential color scale (dark green → light gray) based on commit frequency in the last half of the time window, where dark green represents highest frequency and light gray represents lowest frequency
- **FR-010**: System SHOULD display tooltips on hover showing file name, total commit count, and commit count in the last half of the time window (deferred priority)
- **FR-011**: System MUST preserve the repository's folder hierarchy in the treemap visualization
- **FR-012**: System MUST handle errors gracefully with user-friendly messages for: non-git repositories, permission errors, missing git binary, and analysis failures
- **FR-013**: System MUST display a loading indicator while git analysis is in progress
- **FR-014**: System MUST display an empty state message when no commits exist in the selected time range
- **FR-015**: System MUST allow users to change the selected time range and update the treemap without re-selecting the repository

### Key Entities

- **Repository**: A local git repository selected by the user. Contains commit history and file structure. Attributes: path, validity status (is git repo?), file count.

- **Time Range**: A date range for filtering commits. Attributes: start date, end date, label (e.g., "Last Month"), midpoint (for calculating "last half" period used in color frequency calculation). Default: Last 2 weeks.

- **File Commit Data**: Commit activity data for a single file. Attributes: file path, total commit count (entire time range), recent commit count (last half of time range), frequency score (for color gradient calculation).

- **Tree Node**: A node in the hierarchical tree structure representing either a file or directory. Attributes: name, path, value (commit count or aggregate), children (for directories), parent reference, node type (file or directory).

- **Treemap Rectangle**: A visual element in the treemap. Attributes: position (x, y), dimensions (width, height), color (based on activity ratio), associated tree node.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can select a local git repository and see a treemap visualization within 10 seconds for repositories with up to 10,000 files
- **SC-002**: The treemap accurately displays the top 500 most-changed files with sizes proportional to their commit counts
- **SC-003**: Users can distinguish between files with high recent activity (dark green) vs low recent activity (light gray) at a glance
- **SC-004**: 90% of users successfully complete the flow (select repository → choose time range → view treemap) on their first attempt
- **SC-005**: The system correctly handles and displays user-friendly error messages for at least 5 common error scenarios (non-git repo, permissions, etc.)
- **SC-006**: Tooltips display accurate commit count information for 100% of files and folders in the treemap
- **SC-007**: Users can switch between different time ranges and see updated visualizations within 5 seconds

## Clarifications

### Session 2026-01-31

User provided direct clarification on user story organization and priorities:

- Q: How should user stories be organized and prioritized? → A: Reorganize into: (1) Repository selection with validation, (2) Basic treemap hardcoded to last 2 weeks, (3) Color gradient based on recent frequency, (4) Date range filtering, (5) Error handling, (6) Hover tooltips (deferred)

- Q: What color scheme should be used for the treemap? → A: Dark green (most frequent) to light gray gradient, based on frequency of changes in the last half of the date range (not the previous orange-gray-blue diverging scale)

- Q: Should the initial treemap have date range selection? → A: No, hardcode to "Last 2 weeks" initially. Add date filtering as a separate enhancement (User Story 4, P2 priority)

- Q: What priority should hover tooltips have? → A: Low priority (P4), can be deferred to later iterations

Applied clarifications:
- Reorganized 5 user stories into 6 stories with clearer progression: selection → basic viz → color → filtering → errors → tooltips
- Changed User Story 1 to focus purely on repository selection and validation (extracted from original combined story)
- Made User Story 2 the basic treemap with hardcoded 2-week range, establishing MVP functionality
- Updated User Story 3 from "temporal activity patterns" (first half vs second half) to "activity frequency" (recent frequency gradient)
- Repositioned date range selection as User Story 4 (P2) - an enhancement over the hardcoded default
- Split error handling into User Story 5 (P3) - separate from repository selection concerns
- Added User Story 6 (P4 - Deferred) for hover tooltips, clearly marked as optional
- Updated FR-009 to specify sequential color scale (dark green → light gray) based on commit frequency in last half of time window
- Updated File Commit Data entity to track "recent commit count" and "frequency score" instead of first/second half ratio
- Updated edge cases to reflect frequency-based coloring logic
- Added assumptions about hardcoded initial range and deferred tooltips

## Assumptions

- Users have modern browsers supporting the File System Access API (Chrome 86+, Edge 86+, Safari 15.2+, Firefox 111+)
- Users have Node.js and git installed on their local system (required for the Next.js server and git operations)
- The application runs as a Next.js web application with server-side git analysis (user can only analyze repositories accessible to the server)
- File renames are treated as separate files for simplicity (not tracking rename history with --follow)
- The "top 500" limit is sufficient for most use cases and provides reasonable performance
- Repository analysis happens server-side via Next.js API routes using simple-git
- The initial implementation uses a hardcoded 2-week time range, with date range selection added as an enhancement
- Color gradient (dark green to light gray) provides sufficient visual distinction without accessibility concerns
- Sequential color scale based on recent commit frequency is more intuitive than diverging scales for this use case
- Users understand that merge commits are counted the same as regular commits
- Standard sorting (alphabetical tiebreaker) is acceptable for files with equal commit counts
- Hover tooltips are deferred (P4 priority) and not required for initial release
- Performance optimization (processing large repos) is deferred to implementation phase
