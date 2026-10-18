'use client';

import { createContext, useContext, useState, useMemo, useCallback, useReducer, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import type { AnalysisNode, AnalysisEdge } from '@/lib/analysis/types';
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
  /** Nodes the user locked. */
  lockedNodeIds: Set<string>;
  /** Expansion groups (same-file, callers, callees only), covering whole-selection and per-row expansions. */
  expansions: Map<string, ExpansionGroup>;
  /** Relations switched on per row, keyed by the row's source. */
  rowExpansions: Map<SourceKey, Set<ExpansionType>>;
  /** The row the expansion group is scoped to, or null for "All selected". */
  focusKey: SourceKey | null;
  /** Derived: the same set as explicitNodeIds. */
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
  toggleLock(target: { kind: 'node'; id: string } | { kind: 'nodes'; ids: string[] }): void;
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
  /** Node ids that should be seeded as selected and locked (e.g. diff changes). */
  seedNodeIds?: Set<string>;
}

// --- Context ---

const SelectionContext = createContext<SelectionContextValue | null>(null);

/**
 * Returns the selection context for node highlighting.
 *
 * @throws Error when called outside {@link SelectionProvider}.
 */
export function useSelection(): SelectionContextValue {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error('useSelection must be used within a SelectionProvider');
  return ctx;
}

// --- Helpers ---

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
  const { nodes, edges, visibleNodeIds, seedNodeIds } = config;

  // --- Core state ---
  const [explicitNodeIds, setExplicitNodeIds] = useState<Set<string>>(
    () => seedNodeIds ? new Set(seedNodeIds) : new Set(),
  );
  const [lockedNodeIds, setLockedNodeIds] = useState<Set<string>>(
    () => seedNodeIds ? new Set(seedNodeIds) : new Set(),
  );
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
  const selectedNodeIds = explicitNodeIds;

  // --- Expansions (whole-selection and per-row) ---
  const currentExpansions = useMemo(
    () => computeExpansionGroups({
      selectedNodeIds,
      nodes,
      edges,
      visibleNodeIds,
      wholeEnabled,
      rowExpansions,
      disabledIds: disabledByType,
      focusKey,
    }),
    [selectedNodeIds, nodes, edges, visibleNodeIds, wholeEnabled, rowExpansions, disabledByType, focusKey],
  );

  // --- Derived: activeNodeIds ---
  const activeNodeIds = useMemo(
    () => computeActiveNodeIds(selectedNodeIds, currentExpansions),
    [selectedNodeIds, currentExpansions],
  );

  const hasSelection = selectedNodeIds.size > 0;

  // Refs to always have the latest state values inside callbacks
  const lockedNodeIdsRef = useRef(lockedNodeIds);
  lockedNodeIdsRef.current = lockedNodeIds;
  const seedNodeIdsRef = useRef(seedNodeIds);
  seedNodeIdsRef.current = seedNodeIds;

  const explicitNodeIdsRef = useRef(explicitNodeIds);
  explicitNodeIdsRef.current = explicitNodeIds;

  // --- Actions ---

  const toggleNode = useCallback((id: string) => {
    if (lockedNodeIdsRef.current.has(id)) return;
    setExplicitNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleNodes = useCallback((ids: string[], on: boolean) => {
    setExplicitNodeIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (lockedNodeIdsRef.current.has(id)) continue;
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }, []);

  const toggleLock = useCallback((target: { kind: 'node'; id: string } | { kind: 'nodes'; ids: string[] }) => {
    const ids = target.kind === 'node' ? [target.id] : target.ids;
    setLockedNodeIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (next.has(id)) next.delete(id);
        else next.add(id);
      }
      return next;
    });
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
    clearExpansions();
  }, [clearExpansions]);

  const clearSelection = useCallback(() => {
    setExplicitNodeIds(new Set());
    setLockedNodeIds(new Set());
    clearExpansions();
  }, [clearExpansions]);

  // Reuses the seed already held in memory; nothing is recomputed from the diff.
  const resetSelection = useCallback(() => {
    const seed = seedNodeIdsRef.current;
    setExplicitNodeIds(seed ? new Set(seed) : new Set());
    setLockedNodeIds(seed ? new Set(seed) : new Set());
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
    lockedNodeIds,
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
  seedNodeIds?: Set<string>;
  children: ReactNode;
}

/**
 * Context provider for node selection/highlighting state.
 *
 * @remarks
 * Supports two modes:
 * 1. **Thin wrapper** — pass a pre-built `value` from {@link useSelectionState}.
 * 2. **Self-contained** — pass `nodes`, `edges`, `visibleNodeIds` and
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
  seedNodeIds,
  children,
}: SelectionProviderProps) {
  // Internal state when no external value is provided
  const internalValue = useSelectionState({
    nodes: nodes ?? [],
    edges: edges ?? [],
    visibleNodeIds: visibleNodeIds ?? new Set(),
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