import type { Area } from './types';
import type { AreaAnchorNode } from './anchors';

export interface ForceNode {
  id: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

const MIN_DISTANCE = 1;

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

export function createAnchorRepelForce(
  anchors: AreaAnchorNode[],
  strength: number,
): (alpha: number) => void {
  return (alpha: number) => {
    for (let i = 0; i < anchors.length; i++) {
      for (let j = i + 1; j < anchors.length; j++) {
        const a = anchors[i];
        const b = anchors[j];
        if (a.x == null || a.y == null || b.x == null || b.y == null) continue;

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.max(Math.hypot(dx, dy), MIN_DISTANCE);
        const magnitude = (strength * alpha) / (dist * dist);
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
