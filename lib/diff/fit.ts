import type { GitAnalysisNode } from '@/lib/diff/types';
import type { Area } from '@/lib/areas/types';

/**
 * Compute the d3 zoom transform that fits all changed nodes and touched areas
 * into the given viewport, preserving aspect ratio (contain, like SVG `meet`).
 *
 * @param nodes diff result nodes carrying positions and diffStatus
 * @param areas area definitions
 * @param nodePositions current node positions (from the force simulation)
 * @param viewportWidth canvas width in px
 * @param viewportHeight canvas height in px
 * @param padding padding in simulation units (default 32)
 * @returns [translateX, translateY, scale] or null when nothing changed
 */
export function fitToChanges(
  nodes: GitAnalysisNode[],
  areas: Area[],
  nodePositions: Map<string, { x: number; y: number; radius: number }>,
  viewportWidth: number,
  viewportHeight: number,
  padding: number = 32,
): [number, number, number] | null {
  const changedNodeIds = new Set(
    nodes
      .filter((n) => n.diffStatus && n.diffStatus !== 'unchanged')
      .map((n) => n.scipSymbol),
  );

  if (changedNodeIds.size === 0) return null;

  // Collect position boxes for changed nodes
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const symbol of changedNodeIds) {
    const pos = nodePositions.get(symbol);
    if (!pos) continue;
    minX = Math.min(minX, pos.x - pos.radius);
    minY = Math.min(minY, pos.y - pos.radius);
    maxX = Math.max(maxX, pos.x + pos.radius);
    maxY = Math.max(maxY, pos.y + pos.radius);
  }

  // Add touched area hull circles
  const changedAreaIds = new Set(
    areas
      .filter((a) => a.contains.some((s) => changedNodeIds.has(s)))
      .map((a) => a.id),
  );

  for (const area of areas) {
    if (!changedAreaIds.has(area.id)) continue;
    // Use the average position of changed nodes in this area as the area center
    let ax = 0, ay = 0, count = 0, maxR = 0;
    for (const symbol of area.contains) {
      const pos = nodePositions.get(symbol);
      if (pos) {
        ax += pos.x;
        ay += pos.y;
        count++;
        maxR = Math.max(maxR, pos.radius);
      }
    }
    if (count > 0) {
      const cx = ax / count;
      const cy = ay / count;
      // Approximate area circle radius: max of member distance + max radius + hull padding
      let maxDist = 0;
      for (const symbol of area.contains) {
        const pos = nodePositions.get(symbol);
        if (pos) {
          maxDist = Math.max(maxDist, Math.hypot(pos.x - cx, pos.y - cy));
        }
      }
      const areaR = maxDist + maxR + 55; // HULL_PADDING from renderer.ts
      minX = Math.min(minX, cx - areaR);
      minY = Math.min(minY, cy - areaR);
      maxX = Math.max(maxX, cx + areaR);
      maxY = Math.max(maxY, cy + areaR);
    }
  }

  // If no nodes were positioned, return null
  if (!isFinite(minX)) return null;

  const bboxW = maxX - minX;
  const bboxH = maxY - minY;
  const scale = Math.min(
    (viewportWidth - 2 * padding) / Math.max(bboxW, 1),
    (viewportHeight - 2 * padding) / Math.max(bboxH, 1),
  );
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const tx = viewportWidth / 2 - cx * scale;
  const ty = viewportHeight / 2 - cy * scale;

  return [tx, ty, scale];
}