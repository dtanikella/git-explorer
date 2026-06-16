# Area Assignment from Selection — Design Spec

**Issue:** [#33](https://github.com/dtanikella/git-explorer/issues/33)  
**Date:** 2026-06-16  
**Status:** Approved  
**Depends on:** Areas foundation (#14, merged on `areas` branch)

## Summary

Add the ability to assign the current selection (selected nodes + enabled expansion candidates) to an area — either an existing area or a new area created inline. The area assignment UI lives in the selection sidebar as a self-contained component.

**Scope of this issue:**
- Area picker dropdown with autocomplete
- Inline new area creation form
- Save to `.git-explorer/areas.json` via existing API
- Common area badges (read-only, color-aware, extensible styling)
- Success/error feedback

**Out of scope:** Editing existing area metadata, area deletion, custom color picker UI.

---

## Component Architecture

### New File: `app/components/selection/AreaAssignment.tsx`

Self-contained component responsible for all area assignment logic.

```ts
interface AreaAssignmentProps {
  effectiveNodeIds: string[];  // selected + enabled expansion candidate IDs
  repoPath: string;
}
```

### Data Flow

1. Component reads existing areas via `useAreaStore()` from `AreaContext`
2. Areas are fetched each time the sidebar opens (sidebar visibility change triggers `POST /api/areas { action: 'load' }` in `page.tsx`)
3. On save, component calls `POST /api/areas { action: 'save', repoPath, data: AreaFile }` with the full merged `AreaFile`
4. After successful save, calls `setAreas()` on `AreaContext` to update runtime state and trigger graph re-render

### Local State

- `selectedAreaId: string | null` — picked area ID, or `'__new__'` for new area flow
- `newAreaForm: { name: string; type: AreaType; parent: string | null; children: string[] }` — creation form fields
- `saveStatus: 'idle' | 'saving' | 'success' | 'error'` — for success/error indicator

### AreaContext Changes

Add `setAreas(areas: Area[]): void` to `AreaStoreValue` so `AreaAssignment` can push updated area data after save without a full re-fetch.

---

## UI Layout

The area assignment section appears below the existing selection/expansion content in `SelectionSidebar`, separated by a subtle visual divider (2px border + background color change).

### Two Zones (Always Visible When Sidebar Open)

- **Top:** Selection criteria (existing — selected nodes, expansion groups)
- **Bottom:** Area assignment (new)

Both scroll together within the sidebar's scrollable area.

### Common Area Badges

When all nodes in the effective selection share one or more areas in common, show them as read-only pill badges at the top of the area section.

**Styling:** Each badge uses the area's runtime color from `AreaRuntimeState` (deterministic hash color). Background at low opacity (~0.15), text in the full color. This makes badges visually distinct per-area.

**Extensibility:** Badge rendering accepts the area's runtime state (including color). Future enhancements (custom colors, click-to-filter, tooltips) can be added by extending the badge component without restructuring. The color derivation pipeline is: `Area.id → hashToColor() → AreaRuntimeState.color → badge style`. A future user-defined `color` field on `Area` would simply override the hash step.

### Area Picker

Dropdown/autocomplete listing all existing areas by name, with `+ New Area` at the bottom of the list.

- When an existing area is selected: single "Add to Area" button
- When `+ New Area` is selected: inline form expands below

The dropdown always renders, even when no areas exist (showing only `+ New Area`).

### New Area Form

Inline form that expands below the dropdown when `+ New Area` is selected:

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Name | Text input | Yes | Placeholder: "e.g., Config Pipeline" |
| Type | Select dropdown | No | Options from `AreaType` enum, defaults to `business_domain` |
| Parent | Autocomplete input | No | Searches existing areas by name |
| Children | Autocomplete input (multi) | No | Searches existing areas by name, multi-select |

"Create Area" button saves the new area with the effective selection's nodes as `contains`.

### Success Indicator

Green ✓ checkmark appears inline next to the save/create button after a successful save. Auto-dismisses after ~2 seconds. Applies to both flows.

### Error State

On API failure, a red error message replaces the success indicator spot below the button. No automatic retry — user can click again.

### Empty Selection Edge Case

If `effectiveNodeIds` is empty (e.g., all expansion candidates disabled after initial selection), the "Add to Area" / "Create Area" buttons are disabled with a tooltip: "No nodes to assign". The dropdown and form remain visible but inert.

---

## Save Logic

### Add to Existing Area

1. User picks area from dropdown → clicks "Add to Area"
2. Component merges effective node IDs into that area's `contains` array (deduplicating via `Set`)
3. Updates `updated_at` to current ISO timestamp
4. Sends `POST /api/areas { action: 'save', repoPath, data: fullAreaFile }` with complete `AreaFile`
5. On success → calls `setAreas()` → green ✓ for ~2s

### Create New Area

1. User fills form → clicks "Create Area"
2. Component generates new `Area` object:
   - `id`: slugified from name + 4-char random hex suffix (e.g., `config-pipeline-a3f2`)
   - `created_at` / `updated_at`: current ISO timestamp
   - `contains`: effective node IDs
   - `type`: selected value or `'business_domain'` default
   - `parent`: selected area ID or `null`
   - `children`: selected area IDs or `[]`
   - `clusterStrength`: `0`
3. **Parent/children wiring:** If parent is set, also adds new area's ID to parent's `children` array. If children are set, sets each child's `parent` to new area's ID. Bidirectional consistency in a single save.
4. Appends new area to existing areas array
5. Sends full `AreaFile` via save endpoint
6. Same success flow as above

---

## Integration Points

### SelectionSidebar Changes

`SelectionSidebar.tsx` renders `<AreaAssignment>` at the bottom of its scrollable content area. It computes the effective node IDs (selected + enabled expansion candidates) and passes them as a prop.

### page.tsx Changes

- Pass `repoPath` through to `SelectionSidebar` → `AreaAssignment`
- Trigger area re-fetch when sidebar becomes visible (on selection change)

### AreaContext Changes

- Add `setAreas(areas: Area[]): void` to the context value
- Implementation: updates the `areas` state, which triggers `useEffect` to rebuild `runtimeState` and `nodeToAreas`

---

## Testing Strategy

### Unit Tests — `AreaAssignment.tsx`

- Renders dropdown with existing areas + "+ New Area" option
- Shows common area badges when all selected nodes share areas
- Badge colors match area runtime state colors
- "Add to Area" merges node IDs into existing area's `contains` (deduplicates)
- "Create Area" generates correct `Area` object with all required fields
- Parent/children wiring is bidirectional on create
- Success indicator appears and auto-dismisses after ~2s
- Error state renders on API failure
- Empty state: dropdown shows only "+ New Area" when no areas exist

### Not Testing (Covered Elsewhere)

- AreaContext internals (`__tests__/contexts/AreaContext.test.tsx`)
- Area rendering/overlays (existing renderer tests)
- API route (`__tests__/integration/areas-api.test.ts`)
- Graph re-render after save (visual behavior, existing render pipeline)

---

## Design Principles

1. **Self-contained component** — `AreaAssignment` owns all area mutation logic. SelectionSidebar just renders it with the right props.
2. **Extensible badge styling** — Color pipeline is clear and overridable. Future custom colors slot in without restructuring.
3. **Single save operation** — Both flows (add + create) produce a complete `AreaFile` and save atomically. No partial updates.
4. **Bidirectional consistency** — Parent/children relationships are wired in both directions in a single save.
5. **Graceful degradation** — No areas? Dropdown shows only "+ New Area". API error? Message shown, user can retry.
