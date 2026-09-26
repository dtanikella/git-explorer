/**
 * Expansion computation for the shared selection sidebar.
 *
 * @remarks
 * Same-file, callers and callees relations are computed per *source*: a node,
 * an area (sub-areas count as part of it) or a folder/file path. The
 * whole-selection toggles apply each relation to every selected source, and
 * a row's own toggles apply it to that row alone, whether or not the row is
 * selected. Nodes already in the selection are never offered as candidates.
 * Area membership itself is handled by the selection state derivation, not
 * here.
 *
 * @see `app/contexts/SelectionContext` for state integration.
 */

import type { AnalysisNode, AnalysisEdge } from '@/lib/analysis/types';
import { EdgeKind } from '@/lib/analysis/types';
import type { Area } from '@/lib/areas/types';
import { getAreaMemberIds } from './stats';

// --- Types ---

export type ExpansionType = 'same-file' | 'callers' | 'callees';

/** Identifies what an expansion applies to: `n:<node>`, `a:<area>` or `h:<folder or file path>`. */
export type SourceKey = string;

export const nodeSourceKey = (nodeId: string): SourceKey => `n:${nodeId}`;
export const areaSourceKey = (areaId: string): SourceKey => `a:${areaId}`;
export const pathSourceKey = (path: string): SourceKey => `h:${path}`;

export interface ExpansionSource {
  key: SourceKey;
  kind: 'node' | 'area' | 'path';
  label: string;
  /** For area sources: the area id, for coloring. */
  areaId?: string;
  /** Every node the source covers. */
  nodeIds: string[];
}

/** The nodes one relation adds for one source. */
export interface SourceRelation {
  source: ExpansionSource;
  nodeIds: string[];
}

export interface ExpansionGroup {
  type: ExpansionType;
  /** Whether the whole-selection toggle is on. */
  enabled: boolean;
  /** What the whole-selection toggle adds: one entry per selected source. */
  available: SourceRelation[];
  /** What is on now: {@link ExpansionGroup.available} when enabled, plus every row that has this relation on. */
  active: SourceRelation[];
  /** The focused row's relation whether or not it is on; undefined without a focused row or candidates. */
  focused?: SourceRelation;
  /** Nodes excluded from this relation, shared by the whole-selection and per-row views. */
  disabledIds: Set<string>;
}

export interface ExpansionInput {
  selectedNodeIds: Set<string>;
  selectedAreaIds: Set<string>;
  nodes: AnalysisNode[];
  edges: AnalysisEdge[];
  visibleNodeIds: Set<string>;
  areas: Area[];
  /** Relations whose whole-selection toggle is on. */
  wholeEnabled: ReadonlySet<ExpansionType>;
  /** Relations switched on per row. */
  rowExpansions: ReadonlyMap<SourceKey, ReadonlySet<ExpansionType>>;
  /** Excluded node ids per relation. */
  disabledIds: ReadonlyMap<ExpansionType, ReadonlySet<string>>;
  /** The row the bottom group is currently scoped to. */
  focusKey: SourceKey | null;
}

// --- Constants ---

export const EXPANSION_TYPES: readonly ExpansionType[] = ['same-file', 'callers', 'callees'];

const CALLER_CALLEE_EDGE_KINDS = new Set<EdgeKind>([
  EdgeKind.CALLS,
  EdgeKind.INCLUDES,
  EdgeKind.INSTANTIATES,
  EdgeKind.USES_TYPE,
  EdgeKind.EXTENDS,
  EdgeKind.IMPLEMENTS,
]);

const inFolder = (filePath: string, path: string) =>
  filePath === path || filePath.startsWith(`${path}/`);

/**
 * Computes the expansion groups for the given selection and expansion state.
 *
 * @param input - Selection, analysis data and expansion state; see {@link ExpansionInput}.
 * @returns A map from expansion type to {@link ExpansionGroup}; empty when
 * nothing is selected, expanded or focused.
 */
export function computeExpansionGroups(input: ExpansionInput): Map<ExpansionType, ExpansionGroup> {
  const {
    selectedNodeIds, selectedAreaIds, nodes, edges, visibleNodeIds, areas,
    wholeEnabled, rowExpansions, disabledIds, focusKey,
  } = input;

  if (
    selectedNodeIds.size === 0 &&
    selectedAreaIds.size === 0 &&
    rowExpansions.size === 0 &&
    focusKey === null
  ) {
    return new Map();
  }

  const nodesBySymbol = new Map<string, AnalysisNode>();
  for (const n of nodes) nodesBySymbol.set(n.scipSymbol, n);
  const areasById = new Map(areas.map((a) => [a.id, a]));
  const areaMembers = getAreaMemberIds(areas);

  // Edge indexes so each source only walks its own edges
  const callersOf = new Map<string, string[]>();
  const calleesOf = new Map<string, string[]>();
  for (const e of edges) {
    if (!CALLER_CALLEE_EDGE_KINDS.has(e.kind)) continue;
    if (!callersOf.has(e.toSymbol)) callersOf.set(e.toSymbol, []);
    callersOf.get(e.toSymbol)!.push(e.fromSymbol);
    if (!calleesOf.has(e.fromSymbol)) calleesOf.set(e.fromSymbol, []);
    calleesOf.get(e.fromSymbol)!.push(e.toSymbol);
  }

  const sourceCache = new Map<SourceKey, ExpansionSource | null>();
  function getSource(key: SourceKey): ExpansionSource | null {
    if (sourceCache.has(key)) return sourceCache.get(key)!;
    const value = key.slice(2);
    let source: ExpansionSource | null = null;
    if (key.startsWith('n:')) {
      source = { key, kind: 'node', label: nodesBySymbol.get(value)?.name ?? value, nodeIds: [value] };
    } else if (key.startsWith('a:')) {
      const area = areasById.get(value);
      if (area) {
        source = { key, kind: 'area', label: area.name, areaId: area.id, nodeIds: [...(areaMembers.get(value) ?? [])] };
      }
    } else if (key.startsWith('h:')) {
      source = {
        key,
        kind: 'path',
        label: value,
        nodeIds: nodes.filter((n) => inFolder(n.filePath, value)).map((n) => n.scipSymbol),
      };
    }
    sourceCache.set(key, source);
    return source;
  }

  function relate(source: ExpansionSource, type: ExpansionType): SourceRelation | null {
    const members = new Set(source.nodeIds);
    const found = new Set<string>();
    const consider = (id: string) => {
      if (!members.has(id) && !selectedNodeIds.has(id) && visibleNodeIds.has(id)) found.add(id);
    };

    if (type === 'same-file') {
      const files = new Set<string>();
      for (const id of source.nodeIds) {
        const n = nodesBySymbol.get(id);
        if (n) files.add(n.filePath);
      }
      for (const n of nodes) {
        if (files.has(n.filePath) && !selectedNodeIds.has(n.scipSymbol) && visibleNodeIds.has(n.scipSymbol)) {
          found.add(n.scipSymbol);
        }
      }
    } else {
      const index = type === 'callers' ? callersOf : calleesOf;
      for (const id of source.nodeIds) {
        for (const other of index.get(id) ?? []) consider(other);
      }
    }
    return found.size > 0 ? { source, nodeIds: [...found] } : null;
  }

  // The selected sources: each checked area, plus each selected node no checked area covers
  const checkedAreas = [...selectedAreaIds].filter((id) => {
    for (let p = areasById.get(id)?.parent; p; p = areasById.get(p)?.parent) {
      if (selectedAreaIds.has(p)) return false;
    }
    return areasById.has(id);
  });
  const covered = new Set<string>();
  for (const id of checkedAreas) for (const m of areaMembers.get(id) ?? []) covered.add(m);
  const selectedKeys: SourceKey[] = [
    ...checkedAreas.map(areaSourceKey),
    ...[...selectedNodeIds].filter((id) => !covered.has(id)).map(nodeSourceKey),
  ];

  const result = new Map<ExpansionType, ExpansionGroup>();
  for (const type of EXPANSION_TYPES) {
    const enabled = wholeEnabled.has(type);
    const relationFor = (key: SourceKey) => {
      const source = getSource(key);
      return source ? relate(source, type) : null;
    };
    const notNull = (r: SourceRelation | null): r is SourceRelation => r !== null;

    const available = selectedKeys.map(relationFor).filter(notNull);
    const rowRelations = [...rowExpansions]
      .filter(([, types]) => types.has(type))
      .map(([key]) => relationFor(key))
      .filter(notNull);
    const active = [
      ...(enabled ? available : []),
      ...rowRelations.filter((r) => !(enabled && available.some((a) => a.source.key === r.source.key))),
    ];

    result.set(type, {
      type,
      enabled,
      available,
      active,
      focused: focusKey ? relationFor(focusKey) ?? undefined : undefined,
      disabledIds: new Set(disabledIds.get(type) ?? []),
    });
  }
  return result;
}

/**
 * Collects the distinct node ids across relations, skipping excluded ones.
 *
 * @param relations - Relations to flatten.
 * @param disabledIds - Node ids to leave out.
 * @returns The distinct, non-excluded node ids in first-seen order.
 */
export function collectRelationIds(
  relations: SourceRelation[],
  disabledIds?: ReadonlySet<string>,
): string[] {
  const ids = new Set<string>();
  for (const r of relations) {
    for (const id of r.nodeIds) {
      if (!disabledIds?.has(id)) ids.add(id);
    }
  }
  return [...ids];
}

/**
 * Computes the set of active node ids from the selected node ids and
 * expansion groups.
 *
 * @param selectedNodeIds - The derived set of selected node ids.
 * @param expansions - The expansion groups map.
 * @returns The full set of active (selected+expanded) node ids.
 */
export function computeActiveNodeIds(
  selectedNodeIds: Set<string>,
  expansions: Map<string, ExpansionGroup>,
): Set<string> {
  const active = new Set(selectedNodeIds);
  for (const group of expansions.values()) {
    for (const id of collectRelationIds(group.active, group.disabledIds)) active.add(id);
  }
  return active;
}
