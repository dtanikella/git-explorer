import type { Area } from './types';
import type { AreaAnchorNode } from './anchors';
import { computeAreaHull, getTransitiveContains, type HullResult } from './renderer';

// ── Module-level summary of all area forces ──
//
// Force              | What it pulls               | graph-config.ts constant
// ───────────────────┼─────────────────────────────┼─────────────────────────
// clusterPull        | member nodes toward anchor  | forces.areaCluster
// areaAttract        | anchors toward each other   | forces.areaAttract
// parentPull         | child anchor toward parent  | forces.areaParent
// anchorRepel        | anchors away from each other| forces.anchorRepel
//                    | (size-scaled, see           |
//                    | computeAreaRadii)            |
// areaPin            | anchor toward zone centroid | forces.areaPin
// crossAreaPull      | node toward own region edge,| forces.crossAreaPull
//                    | facing the outside area(s)  |
//                    | it interacts with           |
// areaHullCollision  | unrelated areas' members    | forces.areaHullCollision
//                    | apart when their actual     |
//                    | hulls overlap                |
//
// All forces use alpha-scaled velocity nudges (no hard fx/fy pinning).
// areaPin's and crossAreaPull's regions are parent-relative: see resolveAreaRegion below.

export interface ForceNode {
  id: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

const MIN_DISTANCE = 1;

// Cap on the per-tick overlap magnitude createAreaHullCollisionForce will
// act on. See that function's doc comment for why this must be bounded.
const MAX_HULL_OVERLAP_PUSH = 100;

/**
 * Compute the centroid of one or more grid zone cells.
 * The 3x3 grid spans [0,width] x [0,height]; each cell's center is at
 * ((col+0.5)*width/3, (row+0.5)*height/3). Returns the arithmetic mean
 * of all selected cell centers, or null when zones is empty.
 */
export function zoneCentroid(
  zones: number[],
  width: number,
  height: number,
): { x: number; y: number } | null {
  if (zones.length === 0) return null;
  let sumX = 0;
  let sumY = 0;
  for (const index of zones) {
    const row = Math.floor(index / 3);
    const col = index % 3;
    sumX += (col + 0.5) * (width / 3);
    sumY += (row + 0.5) * (height / 3);
  }
  return { x: sumX / zones.length, y: sumY / zones.length };
}

/**
 * Creates a D3 force that pulls member nodes toward their area anchors.
 *
 * @remarks
 * For each node, computes a weighted centroid of the anchors of all areas
 * the node belongs to, then applies a velocity nudge proportional to
 * `strength * alpha`. Weight is determined by each area's `clusterStrength`.
 * Nodes that belong to no area or whose area has no anchor are unaffected.
 *
 * @param nodes - All force nodes in the simulation.
 * @param nodeToAreas - Maps each node ID to the list of areas it belongs to.
 * @param anchorsById - Maps area ID to anchor position.
 * @param strength - Scalar multiplier; the corresponding constant in
 *   {@link RepoGraphConfig.forces} is `areaCluster`.
 * @returns A force function suitable for `d3-force`.
 * @see commit 44a54d7
 */
export function createClusterPullForce(
  nodes: ForceNode[],
  nodeToAreas: Map<string, Area[]>,
  anchorsById: Map<string, AreaAnchorNode>,
  strength: number,
): (alpha: number) => void {
  return (alpha: number) => {
    for (const node of nodes) {
      if (node.x == null || node.y == null) continue;
      const areas = nodeToAreas.get(node.id);
      if (!areas || areas.length === 0) continue;

      let totalWeight = 0;
      let targetX = 0;
      let targetY = 0;
      for (const area of areas) {
        const anchor = anchorsById.get(area.id);
        if (!anchor || anchor.x == null || anchor.y == null) continue;
        totalWeight += area.clusterStrength;
        targetX += anchor.x * area.clusterStrength;
        targetY += anchor.y * area.clusterStrength;
      }
      if (totalWeight <= 0) continue;
      targetX /= totalWeight;
      targetY /= totalWeight;

      node.vx = (node.vx ?? 0) + (targetX - node.x) * strength * alpha;
      node.vy = (node.vy ?? 0) + (targetY - node.y) * strength * alpha;
    }
  };
}

/**
 * Creates a D3 force that pulls area anchors toward each other when they
 * share cross-area edges.
 *
 * @remarks
 * Reads edge weights from the cross-area edge map (keyed as
 * `"<areaIdA>|<areaIdB>"`). Each pair is nudged toward each other
 * proportional to `weight * strength * alpha`. The effect is that
 * areas with many cross-references cluster spatially.
 *
 * @param anchors - All area anchor nodes in the simulation.
 * @param edgeWeights - Cross-area edge weights keyed by `"<areaIdA>|<areaIdB>"`.
 * @param strength - Scalar multiplier; the corresponding constant in
 *   {@link RepoGraphConfig.forces} is `areaAttract`.
 * @returns A force function suitable for `d3-force`.
 * @see commit 44a54d7
 */
export function createAreaAttractForce(
  anchors: AreaAnchorNode[],
  edgeWeights: Map<string, number>,
  strength: number,
): (alpha: number) => void {
  const anchorsById = new Map(anchors.map((a) => [a.areaId, a]));

  return (alpha: number) => {
    for (const [key, weight] of edgeWeights) {
      const [idA, idB] = key.split('|');
      const a = anchorsById.get(idA);
      const b = anchorsById.get(idB);
      if (!a || !b) continue;
      if (a.x == null || a.y == null || b.x == null || b.y == null) continue;

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.max(Math.hypot(dx, dy), MIN_DISTANCE);
      const magnitude = weight * strength * alpha;
      const fx = (dx / dist) * magnitude;
      const fy = (dy / dist) * magnitude;

      a.vx = (a.vx ?? 0) + fx;
      a.vy = (a.vy ?? 0) + fy;
      b.vx = (b.vx ?? 0) - fx;
      b.vy = (b.vy ?? 0) - fy;
    }
  };
}

/**
 * Creates a D3 force that pulls a child area's anchor toward its parent
 * area's anchor.
 *
 * @remarks
 * Child anchors receive a velocity nudge toward their parent's current
 * position, proportional to `strength * alpha`. Anchors with no parent
 * are unaffected.
 *
 * @param anchors - All area anchor nodes; the force looks up each anchor's
 *   parent through `areasById`.
 * @param areasById - Maps area ID to full {@link Area} record, which includes
 *   the optional `parent` field.
 * @param strength - Scalar multiplier; the corresponding constant in
 *   {@link RepoGraphConfig.forces} is `areaParent`.
 * @returns A force function suitable for `d3-force`.
 * @see commit 44a54d7
 */
export function createParentPullForce(
  anchors: AreaAnchorNode[],
  areasById: Map<string, Area>,
  strength: number,
): (alpha: number) => void {
  const anchorsByAreaId = new Map(anchors.map((a) => [a.areaId, a]));

  return (alpha: number) => {
    for (const anchor of anchors) {
      const area = areasById.get(anchor.areaId);
      if (!area || !area.parent) continue;
      const parentAnchor = anchorsByAreaId.get(area.parent);
      if (!parentAnchor) continue;
      if (anchor.x == null || anchor.y == null || parentAnchor.x == null || parentAnchor.y == null) continue;

      anchor.vx = (anchor.vx ?? 0) + (parentAnchor.x - anchor.x) * strength * alpha;
      anchor.vy = (anchor.vy ?? 0) + (parentAnchor.y - anchor.y) * strength * alpha;
    }
  };
}

/**
 * Approximate each area's current on-screen footprint as a bounding-circle
 * radius around its anchor: the farthest direct member from the anchor,
 * extended outward through the hierarchy so a parent's radius also reaches
 * past its children's own bounding circles (recursive, cycle-safe). Feeds
 * `createAnchorRepelForce` so a 200-member area is treated as needing far
 * more clearance than a 3-member one, instead of every anchor being a
 * zero-radius point regardless of how much it actually spans on screen.
 */
export function computeAreaRadii(
  nodes: ForceNode[],
  nodeToAreas: Map<string, Area[]>,
  areasById: Map<string, Area>,
  anchorsById: Map<string, AreaAnchorNode>,
): Map<string, number> {
  const directRadii = new Map<string, number>();
  for (const node of nodes) {
    if (node.x == null || node.y == null) continue;
    const areas = nodeToAreas.get(node.id);
    if (!areas) continue;
    for (const area of areas) {
      const anchor = anchorsById.get(area.id);
      if (!anchor || anchor.x == null || anchor.y == null) continue;
      const dist = Math.hypot(node.x - anchor.x, node.y - anchor.y);
      directRadii.set(area.id, Math.max(directRadii.get(area.id) ?? 0, dist));
    }
  }

  const resolved = new Map<string, number>();
  const resolve = (areaId: string, seen: Set<string>): number => {
    if (resolved.has(areaId)) return resolved.get(areaId)!;
    if (seen.has(areaId)) return directRadii.get(areaId) ?? 0;
    seen.add(areaId);

    const area = areasById.get(areaId);
    const anchor = anchorsById.get(areaId);
    let radius = directRadii.get(areaId) ?? 0;
    if (area && anchor && anchor.x != null && anchor.y != null) {
      for (const childId of area.children) {
        const childAnchor = anchorsById.get(childId);
        if (!childAnchor || childAnchor.x == null || childAnchor.y == null) continue;
        const childRadius = resolve(childId, seen);
        const dist = Math.hypot(childAnchor.x - anchor.x, childAnchor.y - anchor.y);
        radius = Math.max(radius, dist + childRadius);
      }
    }
    resolved.set(areaId, radius);
    return radius;
  };

  for (const areaId of areasById.keys()) resolve(areaId, new Set());
  return resolved;
}

// Reference scale (px) for how much a combined area radius amplifies
// anchorRepel's strength — see createAnchorRepelForce. Every RADIUS_SCALE
// worth of combined radius roughly doubles the repulsion strength.
const RADIUS_SCALE = 100;

/**
 * Repel area anchors from each other, scaled by each area's current size
 * (see `computeAreaRadii`) rather than treating every anchor as an equal
 * zero-radius point — a bigger area's anchor pair pushes harder at the same
 * distance than two tiny ones. The falloff itself is still plain inverse-
 * square on the *raw* anchor-to-anchor distance (same shape as before this
 * force was made size-aware): scaling the strength multiplier is safe and
 * naturally bounded, since the force still decays to zero as anchors
 * separate. An earlier version instead subtracted the combined radius from
 * the distance before squaring it, which could pin the effective distance
 * at its floor indefinitely (whenever combined radius kept pace with or
 * exceeded raw distance) — removing the force's only decay mechanism and
 * injecting a large, non-decaying velocity every tick. That fed back into
 * `computeAreaRadii` (itself derived from current node positions) and
 * blew the whole simulation out to coordinates in the hundreds of
 * thousands within a handful of ticks. Keep the raw distance in the
 * denominator.
 */
export function createAnchorRepelForce(
  anchors: AreaAnchorNode[],
  nodes: ForceNode[],
  nodeToAreas: Map<string, Area[]>,
  areasById: Map<string, Area>,
  strength: number,
): (alpha: number) => void {
  const anchorsById = new Map(anchors.map((a) => [a.areaId, a]));

  return (alpha: number) => {
    const areaRadii = computeAreaRadii(nodes, nodeToAreas, areasById, anchorsById);

    for (let i = 0; i < anchors.length; i++) {
      for (let j = i + 1; j < anchors.length; j++) {
        const a = anchors[i];
        const b = anchors[j];
        if (a.x == null || a.y == null || b.x == null || b.y == null) continue;

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.max(Math.hypot(dx, dy), MIN_DISTANCE);
        const combinedRadius = (areaRadii.get(a.areaId) ?? 0) + (areaRadii.get(b.areaId) ?? 0);
        const sizeFactor = 1 + combinedRadius / RADIUS_SCALE;
        const magnitude = (strength * sizeFactor * alpha) / (dist * dist);
        const fx = (dx / dist) * magnitude;
        const fy = (dy / dist) * magnitude;

        a.vx = (a.vx ?? 0) - fx;
        a.vy = (a.vy ?? 0) - fy;
        b.vx = (b.vx ?? 0) + fx;
        b.vy = (b.vy ?? 0) + fy;
      }
    }
  };
}

export interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Resolve the rectangle an area's own 3x3 pin grid is drawn within.
 * A top-level area (no parent) grids across the whole canvas. A child area
 * grids within the bounding box of whichever cells its parent has pinned —
 * so zone indices are relative to the parent's allotted space, not absolute
 * canvas position. A parent with no pin of its own doesn't subdivide, so its
 * children inherit its own region unchanged. Guards against cyclical
 * `parent` links (malformed data) by bailing out to the full canvas.
 */
export function resolveAreaRegion(
  area: Area,
  areasById: Map<string, Area>,
  canvasWidth: number,
  canvasHeight: number,
  seen: Set<string> = new Set(),
): Region {
  const fullCanvas: Region = { x: 0, y: 0, width: canvasWidth, height: canvasHeight };
  if (!area.parent || seen.has(area.id)) return fullCanvas;
  const parent = areasById.get(area.parent);
  if (!parent) return fullCanvas;

  const parentRegion = resolveAreaRegion(
    parent,
    areasById,
    canvasWidth,
    canvasHeight,
    new Set(seen).add(area.id),
  );
  const parentZones = parent.pinnedZones ?? [];
  if (parentZones.length === 0) return parentRegion;
  return zoneBoundingBox(parentZones, parentRegion);
}

function zoneBoundingBox(zones: number[], region: Region): Region {
  let minCol = 2, maxCol = 0, minRow = 2, maxRow = 0;
  for (const index of zones) {
    const row = Math.floor(index / 3);
    const col = index % 3;
    minCol = Math.min(minCol, col);
    maxCol = Math.max(maxCol, col);
    minRow = Math.min(minRow, row);
    maxRow = Math.max(maxRow, row);
  }
  const cellWidth = region.width / 3;
  const cellHeight = region.height / 3;
  return {
    x: region.x + minCol * cellWidth,
    y: region.y + minRow * cellHeight,
    width: (maxCol - minCol + 1) * cellWidth,
    height: (maxRow - minRow + 1) * cellHeight,
  };
}

function zoneCentroidInRegion(
  zones: number[],
  region: Region,
): { x: number; y: number } | null {
  const local = zoneCentroid(zones, region.width, region.height);
  if (!local) return null;
  return { x: region.x + local.x, y: region.y + local.y };
}

/**
 * Pull each pinned area's anchor toward the centroid of its selected zone cells.
 * Only applies when the area has non-empty pinnedZones. Zone indices are
 * resolved relative to the area's parent's allotted region (see
 * `resolveAreaRegion`), not the raw canvas, so a child's grid nests inside
 * whatever cell(s) its parent occupies.
 * Velocity nudge uses the same alpha-scaled pattern as parentPull.
 */
export function createAreaPinForce(
  anchors: AreaAnchorNode[],
  areasById: Map<string, Area>,
  width: number,
  height: number,
  strength: number,
): (alpha: number) => void {
  return (alpha: number) => {
    for (const anchor of anchors) {
      const area = areasById.get(anchor.areaId);
      if (!area) continue;
      const zones = area.pinnedZones ?? [];
      if (zones.length === 0) continue;
      const region = resolveAreaRegion(area, areasById, width, height);
      const target = zoneCentroidInRegion(zones, region);
      if (!target) continue;
      if (anchor.x == null || anchor.y == null) continue;

      anchor.vx = (anchor.vx ?? 0) + (target.x - anchor.x) * strength * alpha;
      anchor.vy = (anchor.vy ?? 0) + (target.y - anchor.y) * strength * alpha;
    }
  };
}

/**
 * Point where a ray from a rectangle's center, in the given direction, meets
 * the rectangle's boundary. Falls back to the center itself for a zero
 * direction vector (no external interaction to lean toward).
 */
function rectBoundaryPoint(region: Region, dirX: number, dirY: number): { x: number; y: number } {
  const cx = region.x + region.width / 2;
  const cy = region.y + region.height / 2;
  if (dirX === 0 && dirY === 0) return { x: cx, y: cy };
  const halfWidth = region.width / 2;
  const halfHeight = region.height / 2;
  const tX = dirX !== 0 ? halfWidth / Math.abs(dirX) : Infinity;
  const tY = dirY !== 0 ? halfHeight / Math.abs(dirY) : Infinity;
  const t = Math.min(tX, tY);
  return { x: cx + dirX * t, y: cy + dirY * t };
}

/**
 * Pull a node that interacts with areas outside its own toward the edge of
 * its own area's allotted grid region (see `resolveAreaRegion`), on the side
 * facing whichever outside area(s) it interacts with — instead of the
 * region's center, where `clusterPull` alone would otherwise settle it.
 * "Interacts with" means having a CALLS/USES_TYPE/etc. edge into a node
 * that's a member of a different area (see `buildNodeCrossAreaTargets`);
 * weighted by edge count when a node touches several outside areas at once.
 * A node with no cross-area edges is left untouched (competes with nothing).
 * For a node in multiple of its own areas, blends each area's edge point,
 * weighted by that area's `clusterStrength` — same weighting `clusterPull`
 * uses for multi-membership.
 */
export function createCrossAreaPullForce(
  nodes: ForceNode[],
  nodeToAreas: Map<string, Area[]>,
  nodeCrossAreaTargets: Map<string, Map<string, number>>,
  anchorsById: Map<string, AreaAnchorNode>,
  areasById: Map<string, Area>,
  width: number,
  height: number,
  strength: number,
): (alpha: number) => void {
  return (alpha: number) => {
    for (const node of nodes) {
      if (node.x == null || node.y == null) continue;
      const ownAreas = nodeToAreas.get(node.id);
      if (!ownAreas || ownAreas.length === 0) continue;
      const crossTargets = nodeCrossAreaTargets.get(node.id);
      if (!crossTargets || crossTargets.size === 0) continue;

      let extWeight = 0;
      let extX = 0;
      let extY = 0;
      for (const [areaId, weight] of crossTargets) {
        const anchor = anchorsById.get(areaId);
        if (!anchor || anchor.x == null || anchor.y == null) continue;
        extWeight += weight;
        extX += anchor.x * weight;
        extY += anchor.y * weight;
      }
      if (extWeight <= 0) continue;
      extX /= extWeight;
      extY /= extWeight;

      let ownWeight = 0;
      let targetX = 0;
      let targetY = 0;
      for (const ownArea of ownAreas) {
        if (ownArea.clusterStrength <= 0) continue;
        const region = resolveAreaRegion(ownArea, areasById, width, height);
        const cx = region.x + region.width / 2;
        const cy = region.y + region.height / 2;
        const dx = extX - cx;
        const dy = extY - cy;
        const dist = Math.max(Math.hypot(dx, dy), MIN_DISTANCE);
        const edgePoint = rectBoundaryPoint(region, dx / dist, dy / dist);

        ownWeight += ownArea.clusterStrength;
        targetX += edgePoint.x * ownArea.clusterStrength;
        targetY += edgePoint.y * ownArea.clusterStrength;
      }
      if (ownWeight <= 0) continue;
      targetX /= ownWeight;
      targetY /= ownWeight;

      node.vx = (node.vx ?? 0) + (targetX - node.x) * strength * alpha;
      node.vy = (node.vy ?? 0) + (targetY - node.y) * strength * alpha;
    }
  };
}

interface BoundingCircle {
  cx: number;
  cy: number;
  r: number;
}

function hullToBoundingCircle(hull: HullResult): BoundingCircle | null {
  if (!hull) return null;
  if (hull.type === 'circle') return { cx: hull.cx, cy: hull.cy, r: hull.r };
  let cx = 0;
  let cy = 0;
  for (const [x, y] of hull.points) {
    cx += x;
    cy += y;
  }
  cx /= hull.points.length;
  cy /= hull.points.length;
  let r = 0;
  for (const [x, y] of hull.points) {
    r = Math.max(r, Math.hypot(x - cx, y - cy));
  }
  return { cx, cy, r };
}

function isDescendantOf(candidate: Area, ancestorId: string, areasById: Map<string, Area>): boolean {
  let cur: Area | undefined = candidate;
  const seen = new Set<string>();
  while (cur?.parent && !seen.has(cur.id)) {
    seen.add(cur.id);
    if (cur.parent === ancestorId) return true;
    cur = areasById.get(cur.parent);
  }
  return false;
}

/**
 * True unless `a` and `b` have no ancestor/descendant relationship (in
 * either direction). Used to exclude parent/child pairs from
 * `createAreaHullCollisionForce` — a parent's hull is *supposed* to enclose
 * its descendants' hulls (see `computeAreaHull`), so that overlap is correct
 * containment, not a collision to resolve.
 */
export function areAreasRelated(a: Area, b: Area, areasById: Map<string, Area>): boolean {
  return isDescendantOf(a, b.id, areasById) || isDescendantOf(b, a.id, areasById);
}

/**
 * Push apart the member nodes of two *unrelated* areas (no ancestor/
 * descendant relationship — see `areAreasRelated`) whenever their actual
 * rendered hulls (`computeAreaHull`, approximated here as a bounding circle)
 * currently overlap. Unlike `anchorRepel` — which only keeps the invisible
 * anchor points apart and, even size-scaled, is still an approximation —
 * this is a direct geometric check against each area's real current
 * footprint, and only pushes when there's an actual overlap to resolve.
 * Nudges every member of both areas uniformly along the hull-center-to-
 * center axis, scaled by how much the two circles overlap.
 */
export function createAreaHullCollisionForce(
  nodes: ForceNode[],
  areas: Area[],
  areasById: Map<string, Area>,
  strength: number,
): (alpha: number) => void {
  const unrelatedPairs: [Area, Area][] = [];
  for (let i = 0; i < areas.length; i++) {
    for (let j = i + 1; j < areas.length; j++) {
      if (!areAreasRelated(areas[i], areas[j], areasById)) {
        unrelatedPairs.push([areas[i], areas[j]]);
      }
    }
  }
  const membersByArea = new Map(areas.map((a) => [a.id, getTransitiveContains(a, areasById)]));

  return (alpha: number) => {
    if (unrelatedPairs.length === 0) return;

    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const nodePositions = new Map<string, { x: number; y: number; radius: number }>();
    for (const node of nodes) {
      if (node.x == null || node.y == null) continue;
      nodePositions.set(node.id, { x: node.x, y: node.y, radius: 0 });
    }

    const hullByArea = new Map<string, BoundingCircle | null>();
    for (const area of areas) {
      hullByArea.set(area.id, hullToBoundingCircle(computeAreaHull(area, nodePositions, areasById)));
    }

    for (const [a, b] of unrelatedPairs) {
      const hullA = hullByArea.get(a.id);
      const hullB = hullByArea.get(b.id);
      if (!hullA || !hullB) continue;

      const dx = hullB.cx - hullA.cx;
      const dy = hullB.cy - hullA.cy;
      const dist = Math.max(Math.hypot(dx, dy), MIN_DISTANCE);
      const rawOverlap = hullA.r + hullB.r - dist;
      if (rawOverlap <= 0) continue;
      // Cap the correction per tick instead of scaling linearly with the raw
      // overlap. Hull radius is recomputed from current node positions every
      // tick, so an uncapped push creates a feedback loop: a bigger push
      // spreads nodes further, which grows next tick's hull radius, which
      // grows the overlap, which grows the next push — left unbounded this
      // blows the whole simulation out to unusable coordinates within a
      // handful of ticks (observed: node positions past 1e12 in testing).
      // Capping means real overlaps resolve gradually across several ticks
      // instead of in one uncontrolled jump.
      const overlap = Math.min(rawOverlap, MAX_HULL_OVERLAP_PUSH);

      const pushX = (dx / dist) * overlap * strength * alpha;
      const pushY = (dy / dist) * overlap * strength * alpha;

      for (const symbol of membersByArea.get(a.id) ?? []) {
        const node = nodeById.get(symbol);
        if (!node) continue;
        node.vx = (node.vx ?? 0) - pushX;
        node.vy = (node.vy ?? 0) - pushY;
      }
      for (const symbol of membersByArea.get(b.id) ?? []) {
        const node = nodeById.get(symbol);
        if (!node) continue;
        node.vx = (node.vx ?? 0) + pushX;
        node.vy = (node.vy ?? 0) + pushY;
      }
    }
  };
}
