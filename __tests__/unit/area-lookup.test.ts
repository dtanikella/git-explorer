import { buildNodeToAreas, buildAreaToNodes } from '@/lib/areas/lookup';
import type { Area } from '@/lib/areas/types';

const areaAuth: Area = {
  id: 'auth',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  name: 'Auth',
  type: 'business_domain',
  contains: ['sym-login', 'sym-logout', 'sym-shared'],
  parent: null,
  children: [],
  clusterStrength: 0,
};

const areaUtils: Area = {
  id: 'utils',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  name: 'Utils',
  type: 'utils',
  contains: ['sym-shared', 'sym-helper'],
  parent: null,
  children: [],
  clusterStrength: 0,
};

describe('buildNodeToAreas', () => {
  it('maps each scipSymbol to the areas containing it', () => {
    const map = buildNodeToAreas([areaAuth, areaUtils]);
    expect(map.get('sym-login')).toEqual([areaAuth]);
    expect(map.get('sym-logout')).toEqual([areaAuth]);
    expect(map.get('sym-helper')).toEqual([areaUtils]);
  });

  it('maps overlapping nodes to multiple areas', () => {
    const map = buildNodeToAreas([areaAuth, areaUtils]);
    const areas = map.get('sym-shared')!;
    expect(areas).toHaveLength(2);
    expect(areas).toContain(areaAuth);
    expect(areas).toContain(areaUtils);
  });

  it('returns empty map for empty areas', () => {
    const map = buildNodeToAreas([]);
    expect(map.size).toBe(0);
  });
});

describe('buildAreaToNodes', () => {
  it('maps each area ID to its member scipSymbols', () => {
    const map = buildAreaToNodes([areaAuth, areaUtils]);
    expect(map.get('auth')).toEqual(new Set(['sym-login', 'sym-logout', 'sym-shared']));
    expect(map.get('utils')).toEqual(new Set(['sym-shared', 'sym-helper']));
  });

  it('returns empty map for empty areas', () => {
    const map = buildAreaToNodes([]);
    expect(map.size).toBe(0);
  });
});
