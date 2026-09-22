import { areaPairKey, buildCrossAreaEdgeWeights, buildNodeCrossAreaTargets } from '@/lib/areas/cross-area-edges';
import type { Area } from '@/lib/areas/types';

function makeArea(id: string, contains: string[]): Area {
  return {
    id,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    name: id,
    type: 'business_domain',
    contains,
    parent: null,
    children: [],
    clusterStrength: 0.5,
  };
}

describe('areaPairKey', () => {
  it('is symmetric regardless of argument order', () => {
    expect(areaPairKey('auth', 'billing')).toBe(areaPairKey('billing', 'auth'));
  });
});

describe('buildCrossAreaEdgeWeights', () => {
  const auth = makeArea('auth', ['sym-login']);
  const billing = makeArea('billing', ['sym-charge']);
  const utils = makeArea('utils', ['sym-helper']);
  const nodeToAreas = new Map<string, Area[]>([
    ['sym-login', [auth]],
    ['sym-charge', [billing]],
    ['sym-helper', [utils]],
  ]);

  it('counts one cross-area edge', () => {
    const weights = buildCrossAreaEdgeWeights([['sym-login', 'sym-charge']], nodeToAreas);
    expect(weights.get(areaPairKey('auth', 'billing'))).toBe(1);
  });

  it('aggregates weight across multiple edges between the same area pair', () => {
    const weights = buildCrossAreaEdgeWeights(
      [
        ['sym-login', 'sym-charge'],
        ['sym-charge', 'sym-login'],
      ],
      nodeToAreas,
    );
    expect(weights.get(areaPairKey('auth', 'billing'))).toBe(2);
  });

  it('ignores edges within the same area', () => {
    const sameAreaMap = new Map<string, Area[]>([
      ['sym-login', [auth]],
      ['sym-login-2', [auth]],
    ]);
    const weights = buildCrossAreaEdgeWeights([['sym-login', 'sym-login-2']], sameAreaMap);
    expect(weights.size).toBe(0);
  });

  it('ignores edges where an endpoint belongs to no area', () => {
    const weights = buildCrossAreaEdgeWeights([['sym-login', 'sym-unmapped']], nodeToAreas);
    expect(weights.size).toBe(0);
  });

  it('fans out across all area combinations for multi-area nodes', () => {
    const shared = makeArea('shared', ['sym-login']);
    const multiMap = new Map<string, Area[]>([
      ['sym-login', [auth, shared]],
      ['sym-charge', [billing]],
    ]);
    const weights = buildCrossAreaEdgeWeights([['sym-login', 'sym-charge']], multiMap);
    expect(weights.get(areaPairKey('auth', 'billing'))).toBe(1);
    expect(weights.get(areaPairKey('shared', 'billing'))).toBe(1);
  });
});

describe('buildNodeCrossAreaTargets', () => {
  const auth = makeArea('auth', ['sym-login']);
  const billing = makeArea('billing', ['sym-charge']);
  const utils = makeArea('utils', ['sym-helper']);
  const nodeToAreas = new Map<string, Area[]>([
    ['sym-login', [auth]],
    ['sym-charge', [billing]],
    ['sym-helper', [utils]],
  ]);

  it('records the target area for both endpoints of a cross-area edge', () => {
    const targets = buildNodeCrossAreaTargets([['sym-login', 'sym-charge']], nodeToAreas);
    expect(targets.get('sym-login')?.get('billing')).toBe(1);
    expect(targets.get('sym-charge')?.get('auth')).toBe(1);
  });

  it('accumulates weight across repeated edges into the same outside area', () => {
    const targets = buildNodeCrossAreaTargets(
      [
        ['sym-login', 'sym-charge'],
        ['sym-login', 'sym-charge'],
      ],
      nodeToAreas,
    );
    expect(targets.get('sym-login')?.get('billing')).toBe(2);
  });

  it('does not record a node\'s own area as a cross-area target', () => {
    const sameAreaMap = new Map<string, Area[]>([
      ['sym-login', [auth]],
      ['sym-login-2', [auth]],
    ]);
    const targets = buildNodeCrossAreaTargets([['sym-login', 'sym-login-2']], sameAreaMap);
    expect(targets.has('sym-login')).toBe(false);
    expect(targets.has('sym-login-2')).toBe(false);
  });

  it('leaves a node with no edges out of the result entirely', () => {
    const targets = buildNodeCrossAreaTargets([], nodeToAreas);
    expect(targets.get('sym-helper')).toBeUndefined();
  });
});
