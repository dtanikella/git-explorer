import { resolveAreaInfluence } from '@/lib/areas/property-resolver';
import type { Area } from '@/lib/areas/types';

const areaAuth: Area = {
  id: 'auth',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  name: 'Auth',
  type: 'business_domain',
  contains: ['sym-login', 'sym-logout'],
  parent: null,
  children: [],
  clusterStrength: 0,
};

describe('resolveAreaInfluence', () => {
  const nodeToAreas = new Map<string, Area[]>([
    ['sym-login', [areaAuth]],
    ['sym-logout', [areaAuth]],
  ]);

  it('returns null when no areas are visible', () => {
    const result = resolveAreaInfluence('sym-login', [], nodeToAreas);
    expect(result).toBeNull();
  });

  it('returns null for a node belonging to a visible area', () => {
    const result = resolveAreaInfluence('sym-login', [areaAuth], nodeToAreas);
    expect(result).toBeNull();
  });

  it('returns dimmed:true for a node NOT in any visible area', () => {
    const result = resolveAreaInfluence('sym-unrelated', [areaAuth], nodeToAreas);
    expect(result).toEqual({ dimmed: true });
  });

  it('returns dimmed:true when nodeToAreas is empty (no areas loaded)', () => {
    const result = resolveAreaInfluence('sym-login', [areaAuth], new Map());
    expect(result).toEqual({ dimmed: true });
  });
});
