import type { Area } from '@/lib/areas/types';
import type { CommunityMap } from './detect';
import type { HierarchyLevel } from './hierarchy';
import { membersByCommunity } from './hierarchy';

/**
 * IoU threshold for reusing a previous `Area.id` across regeneration (Phase-4
 * judgment call, per the plan's blast-radius risk note on ID-matching
 * fragility). 0.5 means "a majority of the new community's nodes were in this
 * previous area, and vice versa" — strict enough to avoid claiming unrelated
 * areas when the partition shifts, loose enough to keep ids stable across small
 * detection jitter (a few nodes reassigned). Named so it can be retuned in one
 * place.
 */
export const ID_PRESERVATION_IOU_THRESHOLD = 0.5;

/**
 * Invert `Area.contains`: node `scipSymbol` → the `Area.id` that contains it.
 * Nodes not contained in any area are simply absent from the map.
 */
export function areasToCommunityOf(areas: Area[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const area of areas) {
    for (const symbol of area.contains) {
      map.set(symbol, area.id);
    }
  }
  return map;
}

/** Intersection-over-union of two node sets (0 when either is empty). */
function iou(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  let intersection = 0;
  for (const node of a) {
    if (b.has(node)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function areaLabel(communityId: string, index: number): string {
  return `Community ${communityId !== '' ? communityId : String(index + 1)}`;
}

/**
 * Adapter from the community-detection pipeline into the `lib/areas/types.ts`
 * schema (no schema change — the runtime representation stays ordinary `Area[]`).
 *
 * Emits one `Area` per community at every hierarchy level (report §1.3: each
 * level's anchor exists, so `parentPull` can connect across levels), with
 * `parent`/`children` derived from the hierarchy's `parentOf` links.
 *
 * ID continuity: each new community's node set is matched against every
 * `previousArea` by IoU; the best match at/above `ID_PRESERVATION_IOU_THRESHOLD`
 * reuses that area's `id` (and `created_at`) — this is what keeps `areas.json`
 * stable across regenerations, mirroring the anchor-persistence approach in
 * report §1.2. Unmatched communities get a deterministic fresh id. A previous
 * area can be claimed by at most one new community.
 *
 * `partition` is the primary (finest) partition; `hierarchy` carries the full
 * resolution sweep (levels[last] is the finest). When `hierarchy` is omitted,
 * a single-level hierarchy (the given partition, no parents) is assumed.
 */
export function communitiesToAreas(
  partition: CommunityMap,
  hierarchy?: HierarchyLevel[],
  previousAreas?: Area[],
): Area[] {
  const levels: HierarchyLevel[] =
    hierarchy && hierarchy.length > 0
      ? hierarchy
      : [
          {
            resolution: 1.0,
            partition,
            parentOf: new Map<string, string | null>(),
          },
        ];

  const previous = previousAreas ?? [];
  const now = new Date().toISOString();

  // raw community id → assigned Area id (for parent/children linkage).
  const areaIdByCommunity = new Map<string, string>();
  const claimable = previous.map((a) => ({ area: a, claimed: false }));

  const created: Area[] = [];
  let seq = 0;

  for (const level of levels) {
    const members = membersByCommunity(level.partition);

    for (const [communityId, memberList] of members) {
      const membersSet = new Set(memberList);

      // Best IoU match against unclaimed previous areas.
      let bestMatch: { area: Area; iou: number } | null = null;
      for (const candidate of claimable) {
        if (candidate.claimed) continue;
        const score = iou(membersSet, new Set(candidate.area.contains));
        if (score > (bestMatch?.iou ?? 0)) {
          bestMatch = { area: candidate.area, iou: score };
        }
      }

      const reuse = bestMatch !== null && bestMatch.iou >= ID_PRESERVATION_IOU_THRESHOLD;
      if (bestMatch !== null && reuse) {
        bestMatch.claimed = true;
      }

      const id = reuse && bestMatch ? bestMatch.area.id : `community-${seq}`;
      seq++;

      const parentRaw = level.parentOf.get(communityId) ?? null;
      const parent = parentRaw != null ? (areaIdByCommunity.get(parentRaw) ?? null) : null;

      const area: Area = {
        id,
        created_at: reuse && bestMatch ? bestMatch.area.created_at : now,
        updated_at: now,
        name: areaLabel(communityId, seq - 1),
        type: 'business_domain',
        contains: memberList,
        parent,
        children: [],
        clusterStrength: 0,
      };
      areaIdByCommunity.set(communityId, id);
      created.push(area);
    }
  }

  // Fill children from the parent links (reverse map).
  const byId = new Map(created.map((a) => [a.id, a]));
  for (const area of created) {
    if (area.parent && byId.has(area.parent)) {
      byId.get(area.parent)!.children.push(area.id);
    }
  }

  return created;
}