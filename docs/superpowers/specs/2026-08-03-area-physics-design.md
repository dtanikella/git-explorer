# Area Physics Design

## Problem

Areas currently have zero influence on the force simulation in `RepoGraph.tsx`. The area "blob" drawn by `computeAreaHull` (`lib/areas/renderer.ts`) is a convex hull/circle computed *after the fact* from wherever member nodes happen to land under the existing `link`/`charge`/`center`/`collide` forces. There is no force that:

- clumps a node's neighbors-by-area together
- pulls areas that interact a lot (via cross-area co-change edges) closer to each other
- keeps a parent area large enough to visually contain its children

`Area.clusterStrength` (`lib/areas/types.ts`) already exists in the schema, validated to `[0, 1]`, but is unused anywhere in the simulation.

## Goals

1. Nodes belonging to the same area visually clump together, tunable per-area via `clusterStrength`.
2. Areas with more cross-area co-change edges between their members are pulled closer together.
3. A parent area's overlay always geometrically contains its children's overlays.
4. (Already true by construction, no work needed) The area overlay shape follows whatever the actual member node positions are, since `computeAreaHull` always recomputes from live positions.

## Non-goals

- Runtime UI controls (sliders) for tuning these forces. They are config constants in `lib/analysis/graph-config.ts`, same pattern as existing `charge`/`collide` tuning.
- Changing how areas are assigned/edited (`AreaAssignment`, `AreaContext`) — this is purely simulation/rendering physics.

## Design

### Anchor nodes

Every `Area` gets one synthetic `AreaAnchorNode` (extends `d3.SimulationNodeDatum`), not rendered and not clickable, tagged e.g. `kind: 'anchor'` so existing per-frame iteration over `simNodes` (rendering, click/drag hit-testing) can skip it. Anchors are added to the same `simNodes` array passed into `d3.forceSimulation` so they participate in the same tick loop, alpha decay, and velocity decay as real nodes.

Anchors are seeded at the centroid of their area's current members on creation. When `areas` changes, existing anchors carry their position forward (not reset) so the layout doesn't jump; only new/removed areas add/remove anchors.

Anchors get a light `forceManyBody` repulsion among themselves (separate from the real-node charge force) so unrelated areas don't collapse onto the same point. They are excluded from `forceLink` and `forceCollide` (those remain real-node-only).

### Multi-area membership

`nodeToAreas: Map<string, Area[]>` (from `AreaContext`) means a node can belong to more than one area. The clustering force computes, per node, the **weighted average** of its areas' anchor positions (weighted by each area's `clusterStrength`) as the pull target. Nodes belonging to zero areas are unaffected, same as today.

### The three custom forces

Registered via `.force(name, fn)` alongside the existing `link`/`charge`/`center`/`collide`:

1. **`clusterPull`** — implements goal 1. For each real node with ≥1 area (via `nodeToAreas`), compute the `clusterStrength`-weighted average target across its areas' anchors; nudge the node's `vx`/`vy` toward that target, scaled by `alpha` and a new `forces.areaCluster` config multiplier.

2. **`areaAttract`** — implements goal 2. Cross-area edge weights are computed once per `areas`/`simEdges` change (not per tick): for each edge in `simEdges`, map both endpoints through `nodeToAreas`; for every pair of distinct areas touched, increment a `Map<areaPairKey, weight>`. Each tick, for every pair with weight > 0, pull the two areas' anchors toward each other, strength scaling with `weight * forces.areaAttract`.

3. **`parentPull`** — implements goal 3 (positioning half). For each area with a non-null `parent`, pull its anchor toward the parent area's anchor, strength = `forces.areaParent`. This keeps hierarchies spatially grouped so the geometric containment step below doesn't have to stretch far.

### Containment (geometric guarantee)

`computeAreaHull` (`lib/areas/renderer.ts`) changes from hulling `area.contains` to hulling the **transitive closure**: the area's own `contains` plus every descendant's `contains`, walked via `children`. This makes "parent hull encloses child hull" a geometric fact independent of how well the simulation has settled — `parentPull` just keeps the resulting shape reasonably tight instead of relying on physics alone for correctness.

### Config wiring

New constants in `lib/analysis/graph-config.ts`, alongside existing `forces.node`/`forces.edge`:

- `forces.areaCluster` — multiplier applied on top of each area's `clusterStrength` in `clusterPull`.
- `forces.areaAttract` — scales cross-area edge weight into `areaAttract` force strength.
- `forces.areaParent` — constant strength for `parentPull`.

No new UI; same pattern as the current `charge`/`collide` tuning constants.

## Testing

- Unit tests (pure logic, easy to test in isolation):
  - Cross-area edge weight `Map` construction from `simEdges` + `nodeToAreas`.
  - Transitive `contains` closure used by `computeAreaHull` for parent areas.
  - Multi-area weighted-average target calculation for `clusterPull`.
- Simulation smoke test: extend existing `RepoGraph` test coverage to assert the three new forces are registered and the simulation ticks without throwing when areas (including nested parent/child and multi-area-membership fixtures) are present.
- Force tuning itself (how strong `areaCluster`/`areaAttract`/`areaParent` should be) is validated visually in the browser, same as the existing charge/collide constants — not meaningfully unit-testable.

## Open questions / risks

- Anchor node repulsion strength needs tuning against real repo data to avoid either area collapse (too weak) or areas flying apart (too strong) — expect iteration once visually testable.
- Areas with a single member already special-case to a circle hull in `computeAreaHull`; transitive closure means a parent with only single-member children still needs the multi-point hull path once ≥2 total points are gathered — verify this fallthrough works correctly at the boundary (parent + 1 child, 2 total points → circle path; parent + 2+ descendants → polygon path).
