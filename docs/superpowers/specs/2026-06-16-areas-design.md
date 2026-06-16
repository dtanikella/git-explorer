# Areas (Domains) — Design Spec

**Issue:** [#14](https://github.com/dtanikella/git-explorer/issues/14)  
**Date:** 2026-06-16  
**Status:** Approved

## Summary

Introduce **areas** as a first-class abstraction for grouping AnalysisNodes into meaningful clusters. An area is a user-defined grouping (business domain, service, utility, etc.) that renders as a convex-hull overlay on the RepoGraph canvas. Areas are persisted in the target repo and loaded at runtime.

**Scope of this issue:**
- Data model and type definitions
- File-based persistence (`.git-explorer/areas.json`)
- Runtime state layer with lookup maps and visibility toggling
- Canvas rendering of area overlays (convex hull, generous padding)
- Property resolution (dim non-member nodes when areas are visible)

**Explicitly deferred:** CRUD UI (#33), selection/highlight (#30), custom colors (#31).

---

## Data Model

### Persisted Types

```ts
type AreaType =
  | 'business_domain'
  | 'utils'
  | 'external_service'
  | 'internal_service'
  | 'library'
  | 'entrypoint';

interface Area {
  id: string;
  created_at: string;       // ISO 8601 timestamp
  updated_at: string;       // ISO 8601 timestamp
  name: string;
  type: AreaType;
  contains: string[];       // scipSymbol identifiers of member AnalysisNodes
  parent: string | null;    // parent area ID (null if top-level)
  children: string[];       // child area IDs
  clusterStrength: number;  // 0–1, default 0 (no clustering force applied)
}

interface AreaFile {
  version: 1;
  areas: Area[];
}
```

### Runtime Types (not persisted)

```ts
interface AreaRuntimeState {
  visible: boolean;
  color: string;  // hex color, generated deterministically from area ID
}
```

### Key Decisions

- `contains` references nodes by `scipSymbol` (unique, stable within analysis session)
- `type` is a label; rendering rules per type are a future extension
- `siblings` field omitted — derivable from `parent.children`
- `clusterStrength` exists in the model but has no force effect at default 0
- Single source of truth: `Area.contains` owns the node↔area relationship
- AnalysisNode interface is NOT modified; reverse lookup is purely runtime

---

## Storage

- Areas persisted as JSON at `<targetRepo>/.git-explorer/areas.json`
- File format follows the `AreaFile` interface (versioned for future migrations)
- Travels with the repo (sharable, version-controllable via git)
- If file doesn't exist, the system operates with zero areas (no error)

---

## Architecture

### File Structure

```
lib/areas/
  types.ts              — Area, AreaType, AreaFile, AreaRuntimeState
  lookup.ts             — buildNodeToAreas(), buildAreaToNodes()
  store.ts              — AreaStore interface, buildAreaStore() factory
  renderer.ts           — drawAreaOverlays() pure function
  property-resolver.ts  — resolveAreaInfluence() pure function

app/api/areas/
  route.ts              — POST endpoint for load/save

app/contexts/
  AreaContext.tsx        — React context + AreaProvider + useAreaStore hook
```

### Runtime Layer

#### Lookup (`lib/areas/lookup.ts`)

Two maps computed on data load:
- `nodeToAreas: Map<string, Area[]>` — scipSymbol → areas containing it
- `areaToNodes: Map<string, Set<string>>` — area ID → member scipSymbols

Recomputed only when area data changes.

#### Store (`lib/areas/store.ts`)

```ts
interface AreaStore {
  areas: Area[];
  runtimeState: Map<string, AreaRuntimeState>;
  nodeToAreas: Map<string, Area[]>;

  toggleVisibility(areaId: string): void;
  getVisibleAreas(): Area[];
  getAreasForNode(scipSymbol: string): Area[];
}
```

- Exposed via `useAreaStore()` hook
- `AreaProvider` wraps the page content alongside `SelectionProvider`
- Colors generated deterministically from area ID hash (stable across re-renders, varied across areas)

#### Loading Flow

1. User selects repo → analysis runs
2. After analysis succeeds, fetch: `POST /api/areas { repoPath, action: 'load' }`
3. If file doesn't exist → empty areas state
4. If file exists → parse, validate, build lookup maps, assign colors

---

## Rendering

### Area Overlay Renderer (`lib/areas/renderer.ts`)

Pure function with no side effects beyond canvas drawing:

```ts
function drawAreaOverlays(
  ctx: CanvasRenderingContext2D,
  areas: Area[],
  runtimeState: Map<string, AreaRuntimeState>,
  nodePositions: Map<string, { x: number; y: number; radius: number }>,
  padding: number
): void
```

**Algorithm per visible area:**
1. Collect positions of member nodes currently in the simulation
2. If 0 positioned nodes → skip
3. If 1 node → draw padded circle
4. If 2 nodes → draw padded ellipse/capsule shape
5. If ≥ 3 nodes → compute convex hull, expand outward by `padding`, draw filled polygon

**Visual style:**
- Fill: area color at ~0.08 opacity
- Stroke: area color at ~0.3 opacity, 2px width
- Rounded corners on the expanded hull (smooth appearance)

**Padding:** 55px — generous separation for clear visual grouping.

**Hull expansion:** Minkowski sum approach — offset each vertex along its bisector normal by the padding value, with arc segments at vertices for smooth corners.

### Integration in RepoGraph

Single insertion point in `drawFrame()`:

```ts
// After c.setTransform() but BEFORE edge drawing:
drawAreaOverlays(c, visibleAreas, runtimeState, nodePositionMap, 55);
```

Area rendering is one function call — no interleaving with node/edge logic.

### Property Resolver (`lib/areas/property-resolver.ts`)

```ts
function resolveAreaInfluence(
  nodeId: string,
  visibleAreas: Area[],
  nodeToAreas: Map<string, Area[]>,
): { dimmed: boolean } | null
```

**MVP behavior:** If any areas are visible and a node doesn't belong to ANY visible area → returns `{ dimmed: true }`. Otherwise `null` (no override).

**Node rendering integration:** In the node draw loop, after computing `nStyle`, check the resolver. If `dimmed: true`, reduce opacity to 0.15.

**Performance:** O(1) map lookup per node per frame. Negligible cost — same as the existing `NodeStyler` call.

---

## API

### `POST /api/areas/route.ts`

Request body:
```ts
{ action: 'load', repoPath: string }
// or
{ action: 'save', repoPath: string, data: AreaFile }
```

Response:
- `load`: returns `{ areas: AreaFile }` or `{ areas: { version: 1, areas: [] } }` if file missing
- `save`: returns `{ success: true }` or error

**Security:** Validates repoPath exists and contains `.git` directory (same pattern as existing `/api/repo-analysis` route).

---

## Design Principles

1. **Isolated and loosely coupled** — Area rendering is a single function call with no knowledge of node/edge internals. Removing it is deleting one line.
2. **Extensible** — New area types add entries to a renderer map. New property influences add fields to the resolver return type. No rewrites.
3. **Toggle-friendly** — Visibility is runtime state, not data mutation. Toggling triggers a re-render, not a file write.
4. **Zero-cost when unused** — If no areas file exists, the system does nothing. No performance overhead on repos without areas.
5. **Property resolution chain** — Clean pattern for areas to influence node appearance. Future extensions (color override, grouping forces) add fields without changing the interface.

---

## Testing Strategy

- **Unit tests** for `lookup.ts` — verify map building with various area configurations
- **Unit tests** for `property-resolver.ts` — verify dimming logic with visible/hidden areas
- **Unit tests** for `renderer.ts` — verify convex hull computation and edge cases (0, 1, 2 nodes)
- **Integration test** for API route — verify load/save with real file system
- **Component test** for RepoGraph — verify area overlays render when data is present
