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

export function evaluateNodeForces(
  node: TsNode,
  rules: NodeForceRule[]
): ResolvedNodeForces {
  const result = { ...NODE_FORCE_DEFAULTS };
  const resolved = new Set<string>();

  for (const rule of rules) {
    if (!rule.enabled || !rule.forces || !rule.match(node)) continue;
    const forces = rule.forces;
    for (const key of Object.keys(forces) as (keyof typeof forces)[]) {
      if (!resolved.has(key) && forces[key] !== undefined) {
        (result as any)[key] = forces[key];
        resolved.add(key);
      }
    }
  }

  return result;
}

export function evaluateNodeStyle(
  node: TsNode,
  rules: NodeForceRule[]
): ResolvedNodeStyle {
  const result = { ...NODE_STYLE_DEFAULTS };
  const resolved = new Set<string>();

  for (const rule of rules) {
    if (!rule.enabled || !rule.style || !rule.match(node)) continue;
    const style = rule.style;
    for (const key of Object.keys(style) as (keyof typeof style)[]) {
      if (!resolved.has(key) && style[key] !== undefined) {
        (result as any)[key] = style[key];
        resolved.add(key);
      }
    }
  }

  return result;
}

export function evaluateEdgeForces(
  edge: TsEdge,
  rules: EdgeForceRule[]
): ResolvedEdgeForces {
  const result = { ...EDGE_FORCE_DEFAULTS };
  const resolved = new Set<string>();

  for (const rule of rules) {
    if (!rule.enabled || !rule.forces || !rule.match(edge)) continue;
    const forces = rule.forces;
    for (const key of Object.keys(forces) as (keyof typeof forces)[]) {
      if (!resolved.has(key) && forces[key] !== undefined) {
        (result as any)[key] = forces[key];
        resolved.add(key);
      }
    }
  }

  return result;
}

export function evaluateEdgeStyle(
  edge: TsEdge,
  rules: EdgeForceRule[]
): ResolvedEdgeStyle {
  const result = { ...EDGE_STYLE_DEFAULTS };
  const resolved = new Set<string>();

  for (const rule of rules) {
    if (!rule.enabled || !rule.style || !rule.match(edge)) continue;
    const style = rule.style;
    for (const key of Object.keys(style) as (keyof typeof style)[]) {
      if (!resolved.has(key) && style[key] !== undefined) {
        (result as any)[key] = style[key];
        resolved.add(key);
      }
    }
  }

  return result;
}
