'use client';

import { createContext, useContext, useState, useMemo, useCallback, useReducer, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import type { AnalysisNode, AnalysisEdge } from '@/lib/analysis/types';
import type { Area } from '@/lib/areas/types';
import { getDescendantIds } from '@/lib/areas/containment';
import { computeExpansionGroups, computeActiveNodeIds, collectRelationIds } from '@/lib/selection/candidates';
import type { ExpansionGroup, ExpansionType, SourceKey } from '@/lib/selection/candidates';

// --- State Types ---

/**
 * The raw, user-driven selection state. Everything except `selectedNodeIds`
 * and `expansions` is directly user- actionable.
 */
export interface SelectionState {
  /** Nodes the user explicitly checked. */
  explicitNodeIds: Set<string>;
  /** Areas the user checked. */
  selectedAreaIds: Set<string>;
  /** Nodes the user unchecked within a checked area. */
  excludedNodeIds: Set<string>;
  /** Nodes the user locked. */
  lockedNodeIds: Set<string>;
  /** Areas the user locked. */
  lockedAreaIds: Set<string>;
  /** Expansion groups (same-file, callers, callees only), covering whole-selection and per-row expansions. */
  expansions: Map<string, ExpansionGroup>;
  /** Relations switched on per row, keyed by the row's source. */
  rowExpansions: Map<SourceKey, Set<ExpansionType>>;
  /** The row the expansion group is scoped to, or null for "All selected". */
  focusKey: SourceKey | null;
  /** Derived: explicitNodeIds ∪ (members of checked areas \ excludedNodeIds). */
  selectedNodeIds: Set<string>;
}

/**
 * The full context value exposed via {@link useSelection}.
 */
export interface SelectionContextValue {
  state: SelectionState;
  activeNodeIds: Set<string>;
  hasSelection: boolean;
  toggleNode(id: string): void;
  toggleNodes(ids: string[], on: boolean): void;
  toggleArea(id: string): void;
  toggleLock(target: { kind: 'node' | 'area'; id: string } | { kind: 'nodes'; ids: string[] }): void;
  lockAll(): void;
  clearUnlocked(): void;
  clearSelection(): void;
  /** Restores the tab's initial state: nothing selected, plus the seed (e.g. diff changes) selected and locked. */
  resetSelection(): void;
  /** Toggles a relation for the whole selection. */
  toggleExpansionGroup(type: ExpansionType): void;
  /** Scopes the expansion group to a row, or back to "All selected" when the row is already focused or `null`. */
  toggleFocus(key: SourceKey | null): void;
  /** Toggles a relation for the focused row alone. */
  toggleFocusedExpansion(type: ExpansionType): void;
  toggleExpandedNode(type: ExpansionType, nodeId: string): void;
  setExpandedNodes(type: ExpansionType, nodeIds: string[], include: boolean): void;
}

/**
 * Configuration passed to {@link useSelectionState} for a single tab.
 */
export interface SelectionStateConfig {
  nodes: AnalysisNode[];
  edges: AnalysisEdge[];
  visibleNodeIds: Set<string>;
  areas: Area[];
  /** Node ids that should be seeded as selected and locked (e.g. diff changes). */
  seedNodeIds?: Set<string>;
}

// --- Context ---

const SelectionContext = createContext<SelectionContextValue | null>(null);

/**
 * Returns the selection context for node and area highlighting.
 *
 * @throws Error when called outside {@link SelectionProvider}.
 */
export function useSelection(): SelectionContextValue {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error('useSelection must be used within a SelectionProvider');
  return ctx;
}

// --- Helpers ---

/**
 * Computes the derived selectedNodeIds from the user-driven state.
 * A node is selected when:
 * - it is in explicitNodeIds, OR
 * - it is a member of a checked area (including descendant area members)
 *   and is NOT in excludedNodeIds
 */
function computeSelectedNodeIds(
  explicitNodeIds: Set<string>,
  selectedAreaIds: Set<string>,
  excludedNodeIds: Set<string>,
  areas: Area[],
): Set<string> {
  const result = new Set(explicitNodeIds);

  if (selectedAreaIds.size > 0) {
    const areasById = new Map(areas.map((a) => [a.id, a]));
    const areaMembers = new Set<string>();

    for (const areaId of selectedAreaIds) {
      const area = areasById.get(areaId);
      if (!area) continue;
      // Direct members
      for (const id of area.contains) areaMembers.add(id);
      // Descendant members
      for (const descId of getDescendantIds(areas, areaId)) {
        const desc = areasById.get(descId);
        if (desc) {
          for (const id of desc.contains) areaMembers.add(id);
        }
      }
    }

    for (const id of areaMembers) {
      if (!excludedNodeIds.has(id)) {
        result.add(id);
      }
    }
  }

  return result;
}

/**
 * Checks whether a node id is a member of any of the given area ids
 * (including through descendant areas).
 */
function isNodeInAreas(nodeId: string, areaIds: Set<string>, areas: Area[]): boolean {
  if (areaIds.size === 0) return false;
  const areasById = new Map(areas.map((a) => [a.id, a]));
  for (const areaId of areaIds) {
    const area = areasById.get(areaId);
    if (!area) continue;
    if (area.contains.includes(nodeId)) return true;
    for (const descId of getDescendantIds(areas, areaId)) {
      const desc = areasById.get(descId);
      if (desc && desc.contains.includes(nodeId)) return true;
    }
  }
  return false;
}

/**
 * Collects all member node ids for a set of area ids (including descendants).
 */
function getMemberIdsForAreas(areaIds: Set<string>, areas: Area[]): Set<string> {
  const result = new Set<string>();
  const areasById = new Map(areas.map((a) => [a.id, a]));
  for (const areaId of areaIds) {
    const area = areasById.get(areaId);
    if (!area) continue;
    for (const id of area.contains) result.add(id);
    for (const descId of getDescendantIds(areas, areaId)) {
      const desc = areasById.get(descId);
      if (desc) {
        for (const id of desc.contains) result.add(id);
      }
    }
  }
  return result;
}

// --- Hook: useSelectionState ---

/**
 * Creates selection state and actions for a single tab.
 *
 * @remarks
 * Each tab (Graph, Diff) calls this hook independently so that
 * selection persists when switching tabs. The result is passed to
 * {@link SelectionProvider} as a prop.
 *
 * @param config - The configuration for this tab's selection state.
 * @returns A {@link SelectionContextValue} with state and actions.
 */
export function useSelectionState(config: SelectionStateConfig): SelectionContextValue {
  const { nodes, edges, visibleNodeIds, areas, seedNodeIds } = config;

  // --- Core state ---
  const [explicitNodeIds, setExplicitNodeIds] = useState<Set<string>>(
    () => seedNodeIds ? new Set(seedNodeIds) : new Set(),
  );
  const [selectedAreaIds, setSelectedAreaIds] = useState<Set<string>>(new Set());
  const [excludedNodeIds, setExcludedNodeIds] = useState<Set<string>>(new Set());
  const [lockedNodeIds, setLockedNodeIds] = useState<Set<string>>(
    () => seedNodeIds ? new Set(seedNodeIds) : new Set(),
  );
  const [lockedAreaIds, setLockedAreaIds] = useState<Set<string>>(new Set());
  const [wholeEnabled, setWholeEnabled] = useState<Set<ExpansionType>>(new Set());
  const [disabledByType, setDisabledByType] = useState<Map<ExpansionType, Set<string>>>(new Map());
  const [rowExpansions, setRowExpansions] = useState<Map<SourceKey, Set<ExpansionType>>>(new Map());
  const [focusKey, setFocusKey] = useState<SourceKey | null>(null);

  // --- Diff seeding: sync seedNodeIds changes ---
  const prevSeedRef = useRef<Set<string> | undefined>(undefined);
  useEffect(() => {
    if (!seedNodeIds) return;
    // On first seed, add and lock all seed ids
    if (!prevSeedRef.current) {
      setExplicitNodeIds((prev) => {
        const next = new Set(prev);
        for (const id of seedNodeIds) next.add(id);
        return next;
      });
      setLockedNodeIds((prev) => {
        const next = new Set(prev);
        for (const id of seedNodeIds) next.add(id);
        return next;
      });
      prevSeedRef.current = new Set(seedNodeIds);
      return;
    }

    const prevSeed = prevSeedRef.current;
    const newIds = [...seedNodeIds].filter((id) => !prevSeed.has(id));
    const removedIds = [...prevSeed].filter((id) => !seedNodeIds.has(id));

    if (newIds.length > 0) {
      setExplicitNodeIds((prev) => {
        const next = new Set(prev);
        for (const id of newIds) next.add(id);
        return next;
      });
      setLockedNodeIds((prev) => {
        const next = new Set(prev);
        for (const id of newIds) next.add(id);
        return next;
      });
    }

    if (removedIds.length > 0) {
      setExplicitNodeIds((prev) => {
        const next = new Set(prev);
        for (const id of removedIds) next.delete(id);
        return next;
      });
      setLockedNodeIds((prev) => {
        const next = new Set(prev);
        // Only remove if the user hasn't unlocked it
        for (const id of removedIds) {
          if (prev.has(id)) next.delete(id);
        }
        return next;
      });
    }

    prevSeedRef.current = new Set(seedNodeIds);
  }, [seedNodeIds]);

  // --- Derived: selectedNodeIds ---
  const selectedNodeIds = useMemo(
    () => computeSelectedNodeIds(explicitNodeIds, selectedAreaIds, excludedNodeIds, areas),
    [explicitNodeIds, selectedAreaIds, excludedNodeIds, areas],
  );

  // --- Expansions (whole-selection and per-row) ---
  const currentExpansions = useMemo(
    () => computeExpansionGroups({
      selectedNodeIds,
      selectedAreaIds,
      nodes,
      edges,
      visibleNodeIds,
      areas,
      wholeEnabled,
      rowExpansions,
      disabledIds: disabledByType,
      focusKey,
    }),
    [selectedNodeIds, selectedAreaIds, nodes, edges, visibleNodeIds, areas, wholeEnabled, rowExpansions, disabledByType, focusKey],
  );

  // --- Derived: activeNodeIds ---
  const activeNodeIds = useMemo(
    () => computeActiveNodeIds(selectedNodeIds, currentExpansions),
    [selectedNodeIds, currentExpansions],
  );

  const hasSelection = selectedNodeIds.size > 0 || selectedAreaIds.size > 0;

  // Refs to always have the latest state values inside callbacks
  const selectedAreaIdsRef = useRef(selectedAreaIds);
  selectedAreaIdsRef.current = selectedAreaIds;

  const areasRef = useRef(areas);
  areasRef.current = areas;

  const lockedNodeIdsRef = useRef(lockedNodeIds);
  lockedNodeIdsRef.current = lockedNodeIds;
  const seedNodeIdsRef = useRef(seedNodeIds);
  seedNodeIdsRef.current = seedNodeIds;

  const explicitNodeIdsRef = useRef(explicitNodeIds);
  explicitNodeIdsRef.current = explicitNodeIds;

  const excludedNodeIdsRef = useRef(excludedNodeIds);
  excludedNodeIdsRef.current = excludedNodeIds;

  // --- Actions ---

  const toggleNode = useCallback((id: string) => {
    if (lockedNodeIdsRef.current.has(id)) return;

    const isExplicit = explicitNodeIdsRef.current.has(id);
    const isInArea = isNodeInAreas(id, selectedAreaIdsRef.current, areasRef.current);
    const isExcluded = excludedNodeIdsRef.current.has(id);
    const isSelected = isExplicit || (isInArea && !isExcluded);

    if (isSelected) {
      // Deselecting
      setExplicitNodeIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      if (isInArea) {
        setExcludedNodeIds((prev) => new Set(prev).add(id));
      }
    } else {
      // Selecting
      setExplicitNodeIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      setExcludedNodeIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, []);

  const toggleNodes = useCallback((ids: string[], on: boolean) => {
    if (on) {
      setExplicitNodeIds((prev) => {
        const next = new Set(prev);
        for (const id of ids) {
          if (!lockedNodeIdsRef.current.has(id)) {
            next.add(id);
          }
        }
        return next;
      });
      setExcludedNodeIds((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.delete(id);
        return next;
      });
    } else {
      setExplicitNodeIds((prev) => {
        const next = new Set(prev);
        for (const id of ids) {
          if (!lockedNodeIdsRef.current.has(id)) {
            next.delete(id);
            if (isNodeInAreas(id, selectedAreaIdsRef.current, areasRef.current)) {
              setExcludedNodeIds((exPrev) => new Set(exPrev).add(id));
            }
          }
        }
        return next;
      });
    }
  }, []);

  const toggleArea = useCallback((id: string) => {
    setSelectedAreaIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        // Unchecking — remove area, clear exclusions for its members,
        // remove unlocked members from explicitNodeIds
        next.delete(id);
        const memberIds = getMemberIdsForAreas(new Set([id]), areasRef.current);

        setExcludedNodeIds((exPrev) => {
          const exNext = new Set(exPrev);
          for (const mId of memberIds) exNext.delete(mId);
          return exNext;
        });

        setExplicitNodeIds((exPrev) => {
          const exNext = new Set(exPrev);
          for (const mId of memberIds) {
            if (!lockedNodeIdsRef.current.has(mId)) {
              exNext.delete(mId);
            }
          }
          return exNext;
        });

        return next;
      } else {
        // Checking — add area, remove descendant areas from selection
        next.add(id);
        for (const area of areasRef.current) {
          if (area.parent === id || getDescendantIds(areasRef.current, id).has(area.id)) {
            next.delete(area.id);
          }
        }

        // Clear exclusions for this area's members
        const memberIds = getMemberIdsForAreas(new Set([id]), areasRef.current);
        setExcludedNodeIds((exPrev) => {
          const exNext = new Set(exPrev);
          for (const mId of memberIds) exNext.delete(mId);
          return exNext;
        });

        return next;
      }
    });
  }, []);

  const toggleLock = useCallback((target: { kind: 'node' | 'area'; id: string } | { kind: 'nodes'; ids: string[] }) => {
    if (target.kind === 'node') {
      setLockedNodeIds((prev) => {
        const next = new Set(prev);
        if (next.has(target.id)) {
          next.delete(target.id);
        } else {
          next.add(target.id);
        }
        return next;
      });
    } else if (target.kind === 'nodes') {
      setLockedNodeIds((prev) => {
        const next = new Set(prev);
        for (const id of target.ids) {
          if (next.has(id)) {
            next.delete(id);
          } else {
            next.add(id);
          }
        }
        return next;
      });
    } else if (target.kind === 'area') {
      setLockedAreaIds((prev) => {
        const next = new Set(prev);
        if (next.has(target.id)) {
          next.delete(target.id);
        } else {
          next.add(target.id);
          // Locking an area clears exclusions for its members
          const memberIds = getMemberIdsForAreas(new Set([target.id]), areasRef.current);
          setExcludedNodeIds((exPrev) => {
            const exNext = new Set(exPrev);
            for (const mId of memberIds) exNext.delete(mId);
            return exNext;
          });
        }
        return next;
      });
    }
  }, []);

  // Clearing removes every per-row expansion and returns focus to "All selected"
  const clearExpansions = useCallback(() => {
    setWholeEnabled(new Set());
    setDisabledByType(new Map());
    setRowExpansions(new Map());
    setFocusKey(null);
  }, []);

  const lockAll = useCallback(() => {
    setLockedNodeIds((prev) => {
      const next = new Set(prev);
      for (const id of selectedNodeIds) {
        next.add(id);
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNodeIds]);

  const clearUnlocked = useCallback(() => {
    setExplicitNodeIds((prev) => {
      const next = new Set(prev);
      for (const id of prev) {
        if (!lockedNodeIdsRef.current.has(id)) {
          next.delete(id);
        }
      }
      return next;
    });
    setSelectedAreaIds(new Set());
    setExcludedNodeIds(new Set());
    clearExpansions();
  }, [clearExpansions]);

  const clearSelection = useCallback(() => {
    setExplicitNodeIds(new Set());
    setSelectedAreaIds(new Set());
    setExcludedNodeIds(new Set());
    setLockedNodeIds(new Set());
    setLockedAreaIds(new Set());
    clearExpansions();
  }, [clearExpansions]);

  // Reuses the seed already held in memory; nothing is recomputed from the diff.
  const resetSelection = useCallback(() => {
    const seed = seedNodeIdsRef.current;
    setExplicitNodeIds(seed ? new Set(seed) : new Set());
    setSelectedAreaIds(new Set());
    setExcludedNodeIds(new Set());
    setLockedNodeIds(seed ? new Set(seed) : new Set());
    setLockedAreaIds(new Set());
    clearExpansions();
  }, [clearExpansions]);

  const toggleExpansionGroup = useCallback((type: ExpansionType) => {
    setWholeEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  const toggleFocus = useCallback((key: SourceKey | null) => {
    setFocusKey((prev) => (key === null || prev === key ? null : key));
  }, []);

  const focusKeyRef = useRef(focusKey);
  focusKeyRef.current = focusKey;

  const toggleFocusedExpansion = useCallback((type: ExpansionType) => {
    const key = focusKeyRef.current;
    if (!key) return;
    setRowExpansions((prev) => {
      const next = new Map(prev);
      const types = new Set(prev.get(key));
      if (types.has(type)) types.delete(type);
      else types.add(type);
      if (types.size > 0) next.set(key, types);
      else next.delete(key);
      return next;
    });
  }, []);

  const toggleExpandedNode = useCallback((type: ExpansionType, nodeId: string) => {
    setDisabledByType((prev) => {
      const next = new Map(prev);
      const disabled = new Set(prev.get(type));
      if (disabled.has(nodeId)) disabled.delete(nodeId);
      else disabled.add(nodeId);
      next.set(type, disabled);
      return next;
    });
  }, []);

  const setExpandedNodes = useCallback((type: ExpansionType, nodeIds: string[], include: boolean) => {
    setDisabledByType((prev) => {
      const next = new Map(prev);
      const disabled = new Set(prev.get(type));
      for (const id of nodeIds) {
        if (include) disabled.delete(id);
        else disabled.add(id);
      }
      next.set(type, disabled);
      return next;
    });
  }, []);

  const state: SelectionState = {
    explicitNodeIds,
    selectedAreaIds,
    excludedNodeIds,
    lockedNodeIds,
    lockedAreaIds,
    expansions: currentExpansions,
    rowExpansions,
    focusKey,
    selectedNodeIds,
  };

  return {
    state,
    activeNodeIds,
    hasSelection,
    toggleNode,
    toggleNodes,
    toggleArea,
    toggleLock,
    lockAll,
    clearUnlocked,
    clearSelection,
    resetSelection,
    toggleExpansionGroup,
    toggleFocus,
    toggleFocusedExpansion,
    toggleExpandedNode,
    setExpandedNodes,
  };
}

// --- Provider ---

/**
 * Props for the thin {@link SelectionProvider} wrapper.
 */
export interface SelectionProviderProps {
  /** The full context value, typically from {@link useSelectionState}. */
  value?: SelectionContextValue;
  /**
   * When `value` is not provided, these props are used to create
   * a self-contained selection state with {@link useSelectionState}.
   */
  nodes?: AnalysisNode[];
  edges?: AnalysisEdge[];
  visibleNodeIds?: Set<string>;
  areas?: Area[];
  seedNodeIds?: Set<string>;
  children: ReactNode;
}

/**
 * Context provider for node and area selection/highlighting state.
 *
 * @remarks
 * Supports two modes:
 * 1. **Thin wrapper** — pass a pre-built `value` from {@link useSelectionState}.
 * 2. **Self-contained** — pass `nodes`, `edges`, `visibleNodeIds`, `areas` and
 *    optionally `seedNodeIds` to create internal state.
 *
 * The thin wrapper mode is used for per-tab persistence: `page.tsx` calls
 * `useSelectionState` once per tab and passes the return value here.
 */
export function SelectionProvider({
  value: externalValue,
  nodes,
  edges,
  visibleNodeIds,
  areas,
  seedNodeIds,
  children,
}: SelectionProviderProps) {
  // Internal state when no external value is provided
  const internalValue = useSelectionState({
    nodes: nodes ?? [],
    edges: edges ?? [],
    visibleNodeIds: visibleNodeIds ?? new Set(),
    areas: areas ?? [],
    seedNodeIds,
  });

  const value = externalValue ?? internalValue;

  return (
    <SelectionContext.Provider value={value}>
      {children}
    </SelectionContext.Provider>
  );
}

/**
 * Computes the number of expanded (non-excluded) nodes in an expansion
 * group, across the whole-selection toggle and per-row expansions. Returns 0
 * if the group doesn't exist or nothing is on.
 *
 * @param expansions - The expansions map from selection state.
 * @param type - The expansion type.
 */
export function getExpandedCandidateCount(
  expansions: Map<string, ExpansionGroup>,
  type: ExpansionType,
): number {
  const group = expansions.get(type);
  if (!group) return 0;
  return collectRelationIds(group.active, group.disabledIds).length;
}