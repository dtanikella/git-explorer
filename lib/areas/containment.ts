/**
 * Area containment utilities — keep a node's direct membership scoped to
 * exactly one area along any given ancestor/descendant chain, and roll up
 * member counts to include nested areas.
 *
 * A node that belongs to a child area already belongs to that area's
 * ancestors by nesting; it doesn't need its own duplicate entry in an
 * ancestor's `contains`, and an explicit ancestor membership is superseded
 * by a more specific one at a descendant.
 */

import type { Area } from './types';

/** Every ancestor id of `areaId`, walking up via `parent`. */
export function getAncestorIds(areas: Area[], areaId: string): Set<string> {
  const result = new Set<string>();
  let current = areas.find((a) => a.id === areaId);
  while (current?.parent) {
    result.add(current.parent);
    current = areas.find((a) => a.id === current!.parent);
  }
  return result;
}

/** Every descendant id of `areaId`, walking down via `children`. */
export function getDescendantIds(areas: Area[], areaId: string): Set<string> {
  const result = new Set<string>();
  const area = areas.find((a) => a.id === areaId);
  if (!area) return result;
  const stack = [...area.children];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (result.has(id)) continue;
    result.add(id);
    const child = areas.find((a) => a.id === id);
    if (child) stack.push(...child.children);
  }
  return result;
}

function stripFromRelatedAndAdd(
  areas: Area[],
  nodeId: string,
  targetAreaId: string,
  relatedIds: Set<string>,
  now: string
): Area[] {
  return areas.map((a) => {
    if (a.id === targetAreaId) {
      return a.contains.includes(nodeId)
        ? a
        : { ...a, contains: [...a.contains, nodeId], updated_at: now };
    }
    if (relatedIds.has(a.id) && a.contains.includes(nodeId)) {
      return { ...a, contains: a.contains.filter((id) => id !== nodeId), updated_at: now };
    }
    return a;
  });
}

/**
 * Adds nodeId to targetAreaId's direct contains, stripping it out of every
 * ancestor/descendant of targetAreaId so it appears at exactly one, most
 * specific, level of the hierarchy.
 */
export function addNodeToArea(areas: Area[], nodeId: string, targetAreaId: string, now: string): Area[] {
  const relatedIds = new Set([
    ...getAncestorIds(areas, targetAreaId),
    ...getDescendantIds(areas, targetAreaId),
  ]);
  return stripFromRelatedAndAdd(areas, nodeId, targetAreaId, relatedIds, now);
}

/** Adds every nodeId in nodeIds to targetAreaId, one save's worth of writes. */
export function addNodesToArea(areas: Area[], nodeIds: string[], targetAreaId: string, now: string): Area[] {
  return nodeIds.reduce((acc, nodeId) => addNodeToArea(acc, nodeId, targetAreaId, now), areas);
}

/**
 * Reassigns nodeId from fromAreaId to toAreaId: removes it from fromAreaId
 * (and, like addNodeToArea, from toAreaId's ancestor/descendant chain) and
 * adds it to toAreaId.
 */
export function moveNodeToArea(
  areas: Area[],
  nodeId: string,
  fromAreaId: string,
  toAreaId: string,
  now: string
): Area[] {
  if (fromAreaId === toAreaId) return areas;
  const relatedIds = new Set([
    fromAreaId,
    ...getAncestorIds(areas, toAreaId),
    ...getDescendantIds(areas, toAreaId),
  ]);
  return stripFromRelatedAndAdd(areas, nodeId, toAreaId, relatedIds, now);
}

/**
 * Member count per area, rolled up to include descendants' members — a node
 * already nested inside a child area isn't counted again separately at the
 * parent.
 */
export function computeRollupMemberCounts(areas: Area[]): Map<string, number> {
  const areasById = new Map(areas.map((a) => [a.id, a]));
  const counts = new Map<string, number>();

  const computeForArea = (areaId: string): Set<string> => {
    const area = areasById.get(areaId);
    if (!area) return new Set();
    const combined = new Set(area.contains);
    for (const childId of area.children) {
      for (const id of computeForArea(childId)) combined.add(id);
    }
    counts.set(areaId, combined.size);
    return combined;
  };

  for (const area of areas) {
    if (!counts.has(area.id)) computeForArea(area.id);
  }
  return counts;
}
