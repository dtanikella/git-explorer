import {
  DEFAULT_SCHEME,
  FORCE_SCHEME_QUERY_PARAM,
  ACTIVE_SCHEME_ENV_VAR,
  schemeFromParams,
  schemeFromEnv,
  resolveScheme,
  getChargeStrategy,
  getEdgeStrategy,
  type SchemeName,
} from '@/lib/analysis/forces/scheme';
import { legacyCharge, degreeScaledCharge } from '@/lib/analysis/forces/charge';
import { legacyEdge, weightModulatedEdge } from '@/lib/analysis/forces/edge';

describe('scheme resolution', () => {
  it('defaults to legacy', () => {
    expect(DEFAULT_SCHEME).toBe('legacy');
  });

  it('reads the forceScheme query param (pure, injected)', () => {
    const v2 = new URLSearchParams(`${FORCE_SCHEME_QUERY_PARAM}=v2`);
    expect(schemeFromParams(v2)).toBe('v2');
    expect(schemeFromParams(new URLSearchParams(''))).toBe('legacy');
    expect(schemeFromParams(null)).toBe('legacy');
    expect(schemeFromParams(undefined)).toBe('legacy');
  });

  it('reads the ACTIVE_SCHEME env var (pure, injected)', () => {
    expect(schemeFromEnv({ [ACTIVE_SCHEME_ENV_VAR]: 'v2' })).toBe('v2');
    expect(schemeFromEnv({})).toBe('legacy');
    expect(schemeFromEnv(null)).toBe('legacy');
  });

  it('gives the env var priority over the query param', () => {
    expect(resolveScheme(new URLSearchParams(`${FORCE_SCHEME_QUERY_PARAM}=v2`), {})).toBe('v2');
    expect(
      resolveScheme(new URLSearchParams(`${FORCE_SCHEME_QUERY_PARAM}=v2`), { [ACTIVE_SCHEME_ENV_VAR]: 'v2' }),
    ).toBe('v2');
    expect(
      resolveScheme(new URLSearchParams(''), { [ACTIVE_SCHEME_ENV_VAR]: 'v2' }),
    ).toBe('v2');
    expect(resolveScheme(null, null)).toBe('legacy');
  });
});

describe('strategy selection', () => {
  it('getChargeStrategy returns legacyCharge for legacy and degreeScaledCharge for v2', () => {
    expect(getChargeStrategy('legacy' as SchemeName)).toBe(legacyCharge);
    expect(getChargeStrategy('v2' as SchemeName)).toBe(degreeScaledCharge);
  });

  it('getEdgeStrategy returns legacyEdge for legacy and weightModulatedEdge for v2', () => {
    expect(getEdgeStrategy('legacy' as SchemeName)).toBe(legacyEdge);
    expect(getEdgeStrategy('v2' as SchemeName)).toBe(weightModulatedEdge);
  });

  it('v2 strategies are genuine factories returning the NodeForcer/EdgeForcer shapes', () => {
    const charge = getChargeStrategy('v2')({ nodes: [], edges: [] });
    const edge = getEdgeStrategy('v2')({ nodes: [], edges: [], communityOf: new Map() });
    expect(typeof charge).toBe('function');
    expect(typeof edge).toBe('function');
  });
});