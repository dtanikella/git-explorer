import type { ChargeStrategy, EdgeForceStrategy } from './types';
import { legacyCharge, degreeScaledCharge } from './charge';
import { legacyEdge, weightModulatedEdge } from './edge';

/**
 * Active force scheme toggle (report §2.3).
 *
 * - `'legacy'` — the original hand-tuned constant system, kept fully intact and
 *   registered as the default. When active, `RepoGraph` and `graph-config.ts`
 *   behave exactly as before (byte-for-byte parity, pinned by tests).
 * - `'v2'` — community-detection-derived forces (`degreeScaledCharge`,
 *   `weightModulatedEdge`, embeddedness/null-model area forces).
 *
 * Selection order (highest priority first):
 *   1. `ACTIVE_SCHEME` env var (`'v2'` to opt in) — for non-browser contexts
 *      (API routes, tests, `npm run dev` with `ACTIVE_SCHEME=v2`).
 *   2. `?forceScheme=v2` URL query param — for live trial in the running app
 *      without a redeploy.
 *   3. The static default (`'legacy'`).
 *
 * Tunable knobs live at: `γ` — `lib/analysis/communities/metrics.ts`
 * (`CrossCommunityWeightOptions.gamma`, default 1.0); `ρ`/`β`/`d0` —
 * `lib/analysis/forces/edge.ts` (`RHO_DEFAULT`/`BETA_DEFAULT`/
 * `BASE_DISTANCE_DEFAULT`); `k` — `lib/analysis/forces/charge.ts`
 * (`CHARGE_COEFFICIENT_K`); `areaCluster`/`areaParent` — unchanged global
 * constants in `lib/analysis/graph-config.ts` (`DEFAULT_AREA_FORCES`).
 */

export type SchemeName = 'legacy' | 'v2';

/** Static default scheme — `'legacy'` keeps today's behavior untouched. */
export const DEFAULT_SCHEME: SchemeName = 'legacy';

/** URL query param that overrides the scheme in the browser. */
export const FORCE_SCHEME_QUERY_PARAM = 'forceScheme';

/** Env var that overrides the scheme in non-browser contexts. */
export const ACTIVE_SCHEME_ENV_VAR = 'ACTIVE_SCHEME';

/**
 * Resolve the scheme from a `URLSearchParams` object. Pure — no global reads,
 * so it is directly unit-testable with an injected object.
 */
export function schemeFromParams(
  params: URLSearchParams | null | undefined,
): SchemeName {
  return params?.get(FORCE_SCHEME_QUERY_PARAM) === 'v2' ? 'v2' : DEFAULT_SCHEME;
}

/**
 * Resolve the scheme from an env-style record (e.g. `process.env`). Pure —
 * injected for testability.
 */
export function schemeFromEnv(
  env: Record<string, string | undefined> | null | undefined,
): SchemeName {
  return env?.[ACTIVE_SCHEME_ENV_VAR] === 'v2' ? 'v2' : DEFAULT_SCHEME;
}

/**
 * Full resolution order: env override wins, then query param, then default.
 */
export function resolveScheme(
  params?: URLSearchParams | null,
  env?: Record<string, string | undefined> | null,
): SchemeName {
  const fromEnv = schemeFromEnv(env);
  if (fromEnv === 'v2') return 'v2';
  return schemeFromParams(params);
}

/** Guarded read of the current URL's query params (browser only). */
export function getBrowserParams(): URLSearchParams | null {
  if (typeof window === 'undefined' || typeof window.location === 'undefined') return null;
  try {
    return new URL(window.location.href).searchParams;
  } catch {
    return null;
  }
}

/** Guarded read of `process.env` (Node/server context only). */
export function getEnv(): Record<string, string | undefined> | null {
  return typeof process !== 'undefined' ? (process.env ?? null) : null;
}

/**
 * The scheme in effect right now: `ACTIVE_SCHEME` env var, else
 * `?forceScheme=v2`, else the `'legacy'` default.
 */
export function getActiveScheme(): SchemeName {
  return resolveScheme(getBrowserParams(), getEnv());
}

/** Return the charge strategy factory for the given scheme. */
export function getChargeStrategy(scheme: SchemeName): ChargeStrategy {
  return scheme === 'v2' ? degreeScaledCharge : legacyCharge;
}

/** Return the edge strategy factory for the given scheme. */
export function getEdgeStrategy(scheme: SchemeName): EdgeForceStrategy {
  return scheme === 'v2' ? weightModulatedEdge : legacyEdge;
}