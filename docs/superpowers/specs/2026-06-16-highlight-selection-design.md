# Highlight Selection Design

**Date:** 2026-06-16
**Issue:** #11

## Overview

Persistent node selection system for the force-directed graph with expansion controls in a right sidebar. Replaces the existing transient highlight mechanism (yellow ring + auto-timeout) with a full selection model supporting multi-select, expansion by relationship, and opacity-based focus.

## Architecture

React Context Provider pattern. `SelectionContext` manages all selection state; both `RepoGraph` and `SelectionSidebar` consume it independently via `useSelection()`.

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

## Data Model

```typescript
interface ExpansionCandidate {
  nodeId: string;
  sourceNodeIds: string[];  // which selected node(s) this relates to
}

interface ExpansionGroup {
  type: 'same-file' | 'callers' | 'callees';
  enabled: boolean;                    // group toggle (on/off)
  candidates: ExpansionCandidate[];    // unified across all selected nodes
  disabledIds: Set<string>;           // opt-out tracking (enabled by default)
}

interface SelectionState {
  selectedNodeIds: Set<string>;       // root selections (user-clicked)
  expansions: Map<string, ExpansionGroup>;  // keyed by type
}

interface SelectionContextValue {
  state: SelectionState;
  toggleNode(id: string): void;
  clearSelection(): void;
  toggleExpansionGroup(type: ExpansionGroup['type']): void;
  toggleExpandedNode(type: ExpansionGroup['type'], nodeId: string): void;
  activeNodeIds: Set<string>;         // selected ∪ expanded (derived)
  hasSelection: boolean;
}
```

### Expansion Logic

- **Same File:** All visible nodes sharing `filePath` with any selected node
- **Callers:** Visible nodes where a `CALLS` edge points TO any selected node (`toSymbol` = selected)
- **Callees:** Visible nodes where a `CALLS` edge points FROM any selected node (`fromSymbol` = selected)

Groups are unified — one "Callers" group combines candidates from all selected nodes. Each candidate tracks which selected node(s) it relates to for sidebar attribution.

## Data Flow

1. `page.tsx` wraps the graph area with `<SelectionProvider analysisData={...} visibleNodeIds={...}>`
2. `RepoGraph` calls `useSelection()` → reads `activeNodeIds` and `selectedNodeIds` for opacity rendering, calls `toggleNode()` on click
3. `SelectionSidebar` calls `useSelection()` → reads full state for sidebar UI, calls expansion actions
4. Provider computes `activeNodeIds` = `selectedNodeIds` ∪ all enabled expansion candidates (minus `disabledIds`)
5. Provider recomputes expansion candidates when `selectedNodeIds` or `visibleNodeIds` change

## Rendering Changes (RepoGraph)

### Click Handling

- Track `mousedown` position on canvas
- On `mouseup`, if Euclidean distance from mousedown < 3px, hit-test nodes and call `toggleNode(id)`
- Integrates with existing D3 zoom (which handles drag/pan)

### Draw Loop Opacity

When `hasSelection` is true:
- **Selected nodes:** Full opacity + dashed blue selection ring (2px, `#3b82f6`)
- **Expanded nodes:** Full opacity, no ring
- **Other nodes:** 30% opacity (`globalAlpha = 0.3`)
- **Edges with ≥1 endpoint in activeNodeIds:** Full opacity
- **Other edges:** 15% opacity (`globalAlpha = 0.15`)
- **No selection:** Everything at normal opacity (current behavior)

Context values are read into refs to avoid re-renders during the canvas draw loop.

### Zoom-to-Fit

`useEffect` watching `activeNodeIds`:
- Compute bounding box of all active nodes
- Check if all active nodes are already visible in current viewport
- If not visible, animate 250ms transition to fit with padding
- Skip zoom if already visible

## Sidebar

### Layout

Graph content area becomes a flex row: `[canvas (flex-1)] [sidebar (250px, conditional)]`. Canvas resizes naturally via flexbox. Sidebar renders only when `hasSelection` is true.

### Visual Spec

- Width: 250px fixed
- Header: "Selection" title + "Clear all" text link
- Selected nodes section: each node's `name` + truncated `filePath` (hover for full path)
- Three expansion groups: Same File, Callers, Callees
  - Toggle switch (on/off) per group
  - When enabled: checkbox list of candidates, all checked by default
  - Individual checkboxes can be unchecked/re-checked
  - Group toggle OFF collapses list, removes all group members from active set
  - Subtle file-path attribution per candidate
- Font: 12px body, 10px labels

## Search & Cross-Tab Migration

### Search

`handleSearchNode` calls `toggleNode()` instead of setting `highlightedNodeIdRef`. Zoom is handled by the context's zoom-to-fit effect.

### Cross-Tab Navigation

`handleNodeSelect` in `page.tsx` calls into selection context instead of `setHighlightedNodeId`. Tab switch + selection + zoom all happen through the new system.

### Old Code Removal

After new system is verified, remove:
- `highlightedNodeId` state in `page.tsx` (line 25)
- `highlightedNodeIdRef` in `RepoGraph.tsx` (line 46)
- `HIGHLIGHT_COLOR` constant (line 35)
- Yellow ring drawing code (lines 258-264)
- All `setTimeout` auto-clear logic (lines 354-357 in search, lines 420-423 in cross-tab, lines 111-116 in page.tsx)
- `highlightedNodeId` prop on `RepoGraph` (line 19)

## Future Extensibility

- `ExpansionGroup.type` can be extended with new relationship types
- `EdgeKind` filter can be parameterized per expansion type
- Candidate computation can include non-visible nodes
- Selection can be triggered programmatically for future navigation features
