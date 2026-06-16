# Highlight Selection

## Overview

Persistent node selection system for the force-directed graph with expansion controls in a right sidebar. Replaces the existing transient highlight mechanism (yellow ring + auto-timeout) with a full selection model that supports multi-select, expansion by relationship, and opacity-based focus.

This mechanism is designed for reuse — it will serve as the foundation for future codebase navigation features.

---

## Requirements

### Core Selection
- Clicking a node toggles it in/out of the selection (no modifier keys needed for multi-select)
- Selection is persistent until the user explicitly deselects (clicking the same node again, or "Clear all")
- Dragging (mouse moves >3px between mousedown and mouseup) is treated as a pan, not a click — pan behavior is unchanged from current implementation
- Nodes are not draggable; drag always pans the canvas

### Opacity & Visual Treatment
- **Selected nodes:** Full opacity + dashed blue selection ring
- **Expanded nodes** (from sidebar): Full opacity, no ring
- **All other nodes:** 30% opacity
- **Edges with ≥1 endpoint in the active set:** Full opacity — even if the other endpoint is dimmed
- **All other edges:** 15% opacity
- **No selection active:** Everything renders at normal opacity (no dimming applied)

### Right Sidebar
- ~250px fixed width, appears on first selection, collapses when selection is empty
- Graph canvas resizes to accommodate the sidebar (not an overlay)
- **Header:** "Selection" title + "Clear all" action
- **Selected nodes section:** Lists each root-selected node with name and truncated file path
- **Expansion groups:** Three groups — Same File, Callers, Callees
  - Each group has a toggle switch (on/off) and individual checkboxes when enabled
  - Group toggle ON: all candidate nodes enabled by default; user can uncheck individuals
  - Group toggle OFF: collapses the list, removes all group members from the active set
  - Candidates are computed from all selected nodes combined (unified list)
  - Subtle file-path attribution shows which selected node each candidate relates to
- **Hover on any filename** in the sidebar shows the full file path in a tooltip

### Expansion Logic
- **Same File:** All nodes that share a file path with any selected node
- **Callers:** All nodes that have an edge pointing TO any selected node
- **Callees:** All nodes that any selected node has an edge pointing TO
- Architecture supports filtering by any `EdgeKind`, but initially only `CALLS` edges are used for callers/callees
- Architecture supports including all nodes (not just currently visible), but initially only nodes visible in the current graph view are shown as candidates

### Zoom-to-Fit
- When the active set changes (expansion toggled, individual node toggled), compute the bounding box of all active nodes
- Animate a 250ms steady zoom transition to fit them with padding
- Do not zoom if all active nodes are already visible in the current viewport

### Replace Existing Highlight System
- **Search (toolbar):** Finds the node → selects it → opens sidebar → zooms to it
- **Cross-tab navigation (StatsTreemap click):** Switches to graph tab → selects the node → opens sidebar → zooms to it
- Remove old highlight code: `highlightedNodeId` state in `page.tsx`, `highlightedNodeIdRef` in `RepoGraph.tsx`, yellow ring drawing, 5s/6s auto-timeouts
- Strategy: build new selection system first, prove it works, then remove old highlight code

---

## Acceptance Criteria

- [ ] Clicking a node selects it (dashed blue ring, full opacity) and opens the sidebar
- [ ] Clicking a selected node deselects it; sidebar collapses if no selection remains
- [ ] Multiple nodes can be selected without modifier keys
- [ ] Dragging/panning does not trigger selection (3px movement threshold)
- [ ] Non-selected/non-expanded nodes dim to 30% opacity when selection is active
- [ ] Edges with at least one active endpoint remain at full opacity; all others dim to 15%
- [ ] Sidebar shows selected nodes with name and file path (hover for full path)
- [ ] "Same File" expansion toggle works: shows candidates, individual checkboxes, group toggle
- [ ] "Callers" expansion toggle works with CALLS edges
- [ ] "Callees" expansion toggle works with CALLS edges
- [ ] Group toggle ON enables all candidates by default
- [ ] Individual checkboxes can be unchecked/re-checked within an enabled group
- [ ] Group toggle OFF removes all group members from active set
- [ ] Zoom-to-fit animates (250ms) when active set changes, only if needed
- [ ] Search uses the new selection system (persistent, opens sidebar)
- [ ] Cross-tab navigation from StatsTreemap uses the new selection system
- [ ] Old highlight mechanism (yellow ring, timeouts) is fully removed
- [ ] "Clear all" deselects everything and collapses the sidebar

---

## Technical Design

### Architecture: React Context Provider

Selection state is managed via a `SelectionContext` with a provider and `useSelection()` hook. Both `RepoGraph` and `SelectionSidebar` consume the context independently.

### New Files

```
app/
├── contexts/
│   └── SelectionContext.tsx        # context, provider, hook, all selection logic
├── components/
│   └── selection/
│       └── SelectionSidebar.tsx    # sidebar UI component
```

### Modified Files

```
app/
├── components/
│   └── repo-graph/
│       └── RepoGraph.tsx           # consume context, click handler, opacity rendering
├── page.tsx                        # wrap with provider, remove old highlight state
```

### Data Model

```typescript
interface SelectionState {
  selectedNodeIds: Set<string>;       // root selections (user-clicked)
  expandedNodeIds: Set<string>;       // derived from expansion groups
  expansions: Map<string, ExpansionGroup>;
}

interface ExpansionGroup {
  type: 'same-file' | 'callers' | 'callees';
  sourceNodeId: string;               // which selected node spawned this
  candidateIds: string[];             // all possible nodes in this group
  enabledIds: Set<string>;            // which are toggled on
}
// Expansion group key format: `${sourceNodeId}:${type}` (e.g., "scip://login:callers")

interface SelectionContextValue {
  state: SelectionState;
  toggleNode(id: string): void;
  clearSelection(): void;
  toggleExpansionGroup(sourceNodeId: string, type: ExpansionGroup['type']): void;
  toggleExpandedNode(groupKey: string, nodeId: string): void;
  activeNodeIds: Set<string>;         // selected ∪ expanded (used for rendering)
  hasSelection: boolean;
}
```

### Data Flow

1. `page.tsx` wraps the graph area with `<SelectionProvider analysisData={...} edges={...}>`
2. `RepoGraph` calls `useSelection()` → reads `activeNodeIds` and `selectedNodeIds` for opacity rendering, calls `toggleNode()` on click
3. `SelectionSidebar` calls `useSelection()` → reads full state for sidebar UI, calls expansion actions
4. Provider computes `activeNodeIds` as the union of `selectedNodeIds` and all `enabledIds` across expansion groups
5. Provider computes expansion candidates from `analysisData` and `edges` when selected nodes change

### Rendering Changes in RepoGraph

- **Click handler:** On `mouseup`, if movement from `mousedown` < 3px, hit-test nodes and call `toggleNode(id)` if a node was under the cursor
- **Draw loop:** Check each node/edge against `activeNodeIds` and `selectedNodeIds` to determine opacity and ring rendering
- **Zoom-to-fit:** `useEffect` watching `activeNodeIds` — computes bounding box, checks viewport visibility, animates if needed (250ms)

### Search & Cross-Tab Migration

- Search handler calls `toggleNode()` instead of setting `highlightedNodeIdRef`
- `handleNodeSelect` in `page.tsx` calls into context instead of setting `highlightedNodeId` state
- After migration is verified, remove: `highlightedNodeId`, `highlightedNodeIdRef`, `HIGHLIGHT_COLOR`, yellow ring drawing code, all associated timeouts

---

## Design Details

### Sidebar Visual Spec
- Width: ~250px fixed
- Appears/disappears based on selection (not always visible)
- Canvas resizes to accommodate (flexbox layout)
- Font size: 12px body, 10px labels
- File paths truncated to filename with full-path hover tooltip
- Group toggles styled as small switch toggles
- Individual items have checkboxes
- "Clear all" in header as subtle text link

### Future Extensibility
- `ExpansionGroup.type` can be extended with new relationship types
- `EdgeKind` filter can be parameterized per expansion type
- Candidate computation can be switched to include non-visible nodes
- Selection mechanism can be triggered programmatically for future navigation features
