import {
  communitiesToAreas,
  areasToCommunityOf,
  ID_PRESERVATION_IOU_THRESHOLD,
} from '@/lib/analysis/communities/toAreas';
import type { CommunityMap } from '@/lib/analysis/communities/detect';
import type { Area } from '@/lib/areas/types';

function makePreviousArea(overrides: Partial<Area> & { id: string; contains: string[] }): Area {
  return {
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    name: 'Previous',
    type: 'business_domain',
    parent: null,
    children: [],
    clusterStrength: 0,
    ...overrides,
  };
}

function partitionOf(community: string, ...members: string[]): CommunityMap {
  const map: CommunityMap = new Map();
  for (const m of members) map.set(m, community);
  return map;
}

describe('communitiesToAreas', () => {
  it('mints fresh ids without crashing when no previous areas exist', () => {
    const partition = partitionOf('C1', 'a', 'b', 'c', 'd');
    const areas = communitiesToAreas(partition);
    expect(areas).toHaveLength(1);
    expect(areas[0].id).toBe('community-0');
    expect(areas[0].contains).toEqual(['a', 'b', 'c', 'd']);
    expect(areas[0].parent).toBeNull();
    expect(areas[0].type).toBe('business_domain');
  });

  it('reuses the previous Area.id exactly when node sets are identical', () => {
    const previous = [makePreviousArea({ id: 'legacy-1', contains: ['a', 'b', 'c', 'd'] })];
    const partition = partitionOf('C1', 'a', 'b', 'c', 'd');
    const areas = communitiesToAreas(partition, undefined, previous);
    expect(areas).toHaveLength(1);
    expect(areas[0].id).toBe('legacy-1');
    expect(areas[0].created_at).toBe('2026-01-01T00:00:00Z'); // continuity of created_at
  });

  it('does not claim the old id when a hand-split area no longer matches above threshold', () => {
    const previous = [makePreviousArea({ id: 'big', contains: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] })];
    // Hand-split into {a,b,c} (IoU 3/8 = 0.375 < 0.5 → new id) and
    // {d,e,f,g,h} (IoU 5/8 = 0.625 ≥ 0.5 → reuses 'big').
    const partition = new Map<string, string>([
      ['a', 'X'], ['b', 'X'], ['c', 'X'],
      ['d', 'Y'], ['e', 'Y'], ['f', 'Y'], ['g', 'Y'], ['h', 'Y'],
    ]);
    const areas = communitiesToAreas(partition, undefined, previous);
    expect(areas).toHaveLength(2);
    const xArea = areas.find((a) => a.contains.length === 3)!;
    const yArea = areas.find((a) => a.contains.length === 5)!;
    expect(xArea.id).not.toBe('big');
    expect(yArea.id).toBe('big');
    expect(xArea.id).not.toBe(yArea.id);
  });

  it('emits one area per hierarchy level with parent/children links', () => {
    // Two levels: coarse {a,b,c,d} (id '0') → fine {a,b} ('0'), {c,d} ('0').
    // Hand-build the hierarchy so parent linkage is deterministic.
    const partition: CommunityMap = new Map([
      ['a', 'f1'], ['b', 'f1'],
      ['c', 'f2'], ['d', 'f2'],
    ]);
    const hierarchy = [
      {
        resolution: 0.5,
        partition: partitionOf('root', 'a', 'b', 'c', 'd'),
        parentOf: new Map<string, string | null>([['root', null]]),
      },
      {
        resolution: 1.0,
        partition,
        parentOf: new Map<string, string | null>([
          ['f1', 'root'],
          ['f2', 'root'],
        ]),
      },
    ];
    const areas = communitiesToAreas(partition, hierarchy);
    expect(areas).toHaveLength(3);
    const root = areas.find((a) => a.contains.length === 4)!;
    const f1 = areas.find((a) => a.contains.length === 2 && a.contains.includes('a'))!;
    const f2 = areas.find((a) => a.contains.length === 2 && a.contains.includes('c'))!;
    expect(root.parent).toBeNull();
    expect(f1.parent).toBe(root.id);
    expect(f2.parent).toBe(root.id);
    expect(root.children.sort()).toEqual([f1.id, f2.id].sort());
  });
});

describe('areasToCommunityOf', () => {
  it('round-trips every node in Area.contains back to its Area.id', () => {
    const areas: Area[] = [
      makePreviousArea({ id: 'auth', contains: ['sym-login', 'sym-logout'] }),
      makePreviousArea({ id: 'payments', contains: ['sym-charge'] }),
    ];
    const map = areasToCommunityOf(areas);
    expect(map.get('sym-login')).toBe('auth');
    expect(map.get('sym-logout')).toBe('auth');
    expect(map.get('sym-charge')).toBe('payments');
    expect(map.has('sym-unknown')).toBe(false);
  });

  it('later areas win on duplicate membership', () => {
    const areas: Area[] = [
      makePreviousArea({ id: 'first', contains: ['sym-x'] }),
      makePreviousArea({ id: 'second', contains: ['sym-x'] }),
    ];
    const map = areasToCommunityOf(areas);
    expect(map.get('sym-x')).toBe('second');
  });
});

describe('ID_PRESERVATION_IOU_THRESHOLD', () => {
  it('is a named constant (not a magic number) at 0.5', () => {
    // 0.5 = "a majority of the new community's nodes were in this previous
    // area and vice versa" — strict enough to avoid claiming unrelated areas,
    // loose enough for stable ids across small detection jitter.
    expect(ID_PRESERVATION_IOU_THRESHOLD).toBe(0.5);
  });
});