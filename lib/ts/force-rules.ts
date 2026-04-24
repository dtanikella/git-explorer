import {
  TsNode,
  TsEdge,
  NodeForceRule,
  EdgeForceRule,
  ResolvedNodeForces,
  ResolvedNodeStyle,
  ResolvedEdgeForces,
  ResolvedEdgeStyle,
} from './types';

export const NODE_FORCE_DEFAULTS: ResolvedNodeForces = {
  charge: -250,
  collideRadius: 10,
  centerStrength: 0.1,
  fx: null,
  fy: null,
  zone: null,
};

export const NODE_STYLE_DEFAULTS: ResolvedNodeStyle = {
  color: '#999999',
  radius: 6,
};

export const EDGE_FORCE_DEFAULTS: ResolvedEdgeForces = {
  linkStrength: 0.5,
  linkDistance: 100,
};

export const EDGE_STYLE_DEFAULTS: ResolvedEdgeStyle = {
  color: '#999999',
  width: 1,
};

// Generic first-match-wins evaluator: iterates rules top-down, fills each
// property of the result once from the first rule that matches and defines it.
function evaluate<TInput, TRule extends { enabled: boolean; match: (input: TInput) => boolean }, TSubObj extends object, TResult extends TSubObj>(
  input: TInput,
  rules: TRule[],
  getSubObj: (rule: TRule) => TSubObj | undefined,
  defaults: TResult
): TResult {
  const result = { ...defaults } as TResult;
  const resolved = new Set<string>();

  for (const rule of rules) {
    if (!rule.enabled) continue;
    const sub = getSubObj(rule);
    if (!sub) continue;
    if (!rule.match(input)) continue;

    for (const key of Object.keys(sub) as (keyof TSubObj)[]) {
      if (!resolved.has(key as string) && sub[key] !== undefined) {
        (result as Record<string, unknown>)[key as string] = sub[key];
        resolved.add(key as string);
      }
    }
  }

  return result;
}

export function evaluateNodeForces(
  node: TsNode,
  rules: NodeForceRule[]
): ResolvedNodeForces {
  return evaluate(node, rules, (r) => r.forces, NODE_FORCE_DEFAULTS);
}

export function evaluateNodeStyle(
  node: TsNode,
  rules: NodeForceRule[]
): ResolvedNodeStyle {
  return evaluate(node, rules, (r) => r.style, NODE_STYLE_DEFAULTS);
}

export function evaluateEdgeForces(
  edge: TsEdge,
  rules: EdgeForceRule[]
): ResolvedEdgeForces {
  return evaluate(edge, rules, (r) => r.forces, EDGE_FORCE_DEFAULTS);
}

export function evaluateEdgeStyle(
  edge: TsEdge,
  rules: EdgeForceRule[]
): ResolvedEdgeStyle {
  return evaluate(edge, rules, (r) => r.style, EDGE_STYLE_DEFAULTS);
}
