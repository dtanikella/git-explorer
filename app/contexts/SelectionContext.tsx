'use client';

import { createContext, useContext, useState, useMemo, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { AnalysisNode, AnalysisEdge } from '@/lib/analysis/types';
import { EdgeKind } from '@/lib/analysis/types';
import type { Area } from '@/lib/areas/types';

// --- Types ---

export interface ExpansionCandidate {
  nodeId: string;
  sourceNodeIds: string[];
}

export interface ExpansionGroup {
  type: 'same-file' | 'callers' | 'callees' | 'area-members';
  enabled: boolean;
  candidates: ExpansionCandidate[];
  disabledIds: Set<string>;
}

export interface SelectionState {
  selectedNodeIds: Set<string>;
  selectedAreaIds: Set<string>;
  expansions: Map<string, ExpansionGroup>;
}

export interface SelectionContextValue {
  state: SelectionState;
  toggleNode(id: string): void;
  toggleArea(id: string): void;
  clearSelection(): void;
  toggleExpansionGroup(type: ExpansionGroup['type']): void;
  toggleExpandedNode(type: ExpansionGroup['type'], nodeId: string): void;
  toggleAreaMember(nodeId: string): void;
  activeNodeIds: Set<string>;
  hasSelection: boolean;
}

// --- Context ---

const SelectionContext = createContext<SelectionContextValue | null>(null);

export function useSelection(): SelectionContextValue {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error('useSelection must be used within a SelectionProvider');
  return ctx;
}

// --- Expansion computation ---

function computeExpansions(
  selectedNodeIds: Set<string>,
  selectedAreaIds: Set<string>,
  nodes: AnalysisNode[],
  edges: AnalysisEdge[],
  visibleNodeIds: Set<string>,
  areas: Area[],
  prevExpansions: Map<string, ExpansionGroup>,
): Map<string, ExpansionGroup> {
  if (selectedNodeIds.size === 0 && selectedAreaIds.size === 0) return new Map();

  const nodesBySymbol = new Map<string, AnalysisNode>();
  for (const n of nodes) nodesBySymbol.set(n.scipSymbol, n);

  const selectedFilePaths = new Set<string>();
  for (const id of selectedNodeIds) {
    const node = nodesBySymbol.get(id);
    if (node) selectedFilePaths.add(node.filePath);
  }

  // Same File: visible nodes sharing filePath with any selected node (excluding selected nodes themselves)
  const sameFileCandidates: ExpansionCandidate[] = [];
  for (const n of nodes) {
    if (selectedNodeIds.has(n.scipSymbol)) continue;
    if (!visibleNodeIds.has(n.scipSymbol)) continue;
    if (selectedFilePaths.has(n.filePath)) {
      const sourceNodeIds = [...selectedNodeIds].filter((id) => {
        const sn = nodesBySymbol.get(id);
        return sn && sn.filePath === n.filePath;
      });
      sameFileCandidates.push({ nodeId: n.scipSymbol, sourceNodeIds });
    }
  }

  // Callers: visible nodes where a CALLS edge points TO any selected node
  const callerCandidates: ExpansionCandidate[] = [];
  const callerMap = new Map<string, Set<string>>();
  for (const e of edges) {
    if (e.kind !== EdgeKind.CALLS) continue;
    if (!selectedNodeIds.has(e.toSymbol)) continue;
    if (selectedNodeIds.has(e.fromSymbol)) continue;
    if (!visibleNodeIds.has(e.fromSymbol)) continue;
    if (!callerMap.has(e.fromSymbol)) callerMap.set(e.fromSymbol, new Set());
    callerMap.get(e.fromSymbol)!.add(e.toSymbol);
  }
  for (const [nodeId, sources] of callerMap) {
    callerCandidates.push({ nodeId, sourceNodeIds: [...sources] });
  }

  // Callees: visible nodes where a CALLS edge points FROM any selected node
  const calleeCandidates: ExpansionCandidate[] = [];
  const calleeMap = new Map<string, Set<string>>();
  for (const e of edges) {
    if (e.kind !== EdgeKind.CALLS) continue;
    if (!selectedNodeIds.has(e.fromSymbol)) continue;
    if (selectedNodeIds.has(e.toSymbol)) continue;
    if (!visibleNodeIds.has(e.toSymbol)) continue;
    if (!calleeMap.has(e.toSymbol)) calleeMap.set(e.toSymbol, new Set());
    calleeMap.get(e.toSymbol)!.add(e.fromSymbol);
  }
  for (const [nodeId, sources] of calleeMap) {
    calleeCandidates.push({ nodeId, sourceNodeIds: [...sources] });
  }

  // Area members: union of contains[] across selected areas.
  // Each candidate carries the source area id so the UI can group by area.
  const areaMemberMap = new Map<string, Set<string>>();
  for (const area of areas) {
    if (!selectedAreaIds.has(area.id)) continue;
    for (const nodeId of area.contains) {
      if (!visibleNodeIds.has(nodeId)) continue;
      if (!areaMemberMap.has(nodeId)) areaMemberMap.set(nodeId, new Set());
      areaMemberMap.get(nodeId)!.add(area.id);
    }
  }
  const areaMemberCandidates: ExpansionCandidate[] = [];
  for (const [nodeId, sourceAreaIds] of areaMemberMap) {
    areaMemberCandidates.push({ nodeId, sourceNodeIds: [...sourceAreaIds] });
  }

  function makeGroup(
    type: ExpansionGroup['type'],
    candidates: ExpansionCandidate[],
    defaultEnabled: boolean,
  ): ExpansionGroup {
    const prev = prevExpansions.get(type);
    return {
      type,
      enabled: prev ? prev.enabled : defaultEnabled,
      candidates,
      disabledIds: prev ? new Set([...prev.disabledIds].filter((id) => candidates.some((c) => c.nodeId === id))) : new Set(),
    };
  }

  const result = new Map<string, ExpansionGroup>();
  result.set('same-file', makeGroup('same-file', sameFileCandidates, false));
  result.set('callers', makeGroup('callers', callerCandidates, false));
  result.set('callees', makeGroup('callees', calleeCandidates, false));
  result.set('area-members', makeGroup('area-members', areaMemberCandidates, true));
  return result;
}

function computeActiveNodeIds(selectedNodeIds: Set<string>, expansions: Map<string, ExpansionGroup>): Set<string> {
  const active = new Set(selectedNodeIds);
  for (const group of expansions.values()) {
    if (!group.enabled) continue;
    for (const c of group.candidates) {
      if (!group.disabledIds.has(c.nodeId)) {
        active.add(c.nodeId);
      }
    }
  }
  return active;
}

// --- Provider ---

interface SelectionProviderProps {
  nodes: AnalysisNode[];
  edges: AnalysisEdge[];
  visibleNodeIds: Set<string>;
  areas: Area[];
  children: ReactNode;
}

export function SelectionProvider({ nodes, edges, visibleNodeIds, areas, children }: SelectionProviderProps) {
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [selectedAreaIds, setSelectedAreaIds] = useState<Set<string>>(new Set());
  const [expansions, setExpansions] = useState<Map<string, ExpansionGroup>>(new Map());

  // Recompute expansion candidates when selection or visible nodes change
  const computedExpansions = useMemo(
    () => computeExpansions(selectedNodeIds, selectedAreaIds, nodes, edges, visibleNodeIds, areas, expansions),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- expansions intentionally excluded to avoid infinite loop
    [selectedNodeIds, selectedAreaIds, nodes, edges, visibleNodeIds, areas],
  );

  // Sync computed expansions into state (preserving enabled/disabledIds from user)
  const currentExpansions = useMemo(() => {
    const merged = new Map<string, ExpansionGroup>();
    for (const [key, computed] of computedExpansions) {
      const prev = expansions.get(key);
      merged.set(key, {
        ...computed,
        enabled: prev ? prev.enabled : computed.enabled,
        disabledIds: prev
          ? new Set([...prev.disabledIds].filter((id) => computed.candidates.some((c) => c.nodeId === id)))
          : computed.disabledIds,
      });
    }
    return merged;
  }, [computedExpansions, expansions]);

  const activeNodeIds = useMemo(
    () => computeActiveNodeIds(selectedNodeIds, currentExpansions),
    [selectedNodeIds, currentExpansions],
  );

  const hasSelection = selectedNodeIds.size > 0 || selectedAreaIds.size > 0;

  const toggleNode = useCallback((id: string) => {
    setSelectedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleArea = useCallback((id: string) => {
    setSelectedAreaIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedNodeIds(new Set());
    setSelectedAreaIds(new Set());
    setExpansions(new Map());
  }, []);

  const toggleExpansionGroup = useCallback((type: ExpansionGroup['type']) => {
    setExpansions((prev) => {
      const next = new Map(prev);
      const group = next.get(type);
      if (group) {
        next.set(type, { ...group, enabled: !group.enabled, disabledIds: new Set() });
      } else {
        next.set(type, { type, enabled: true, candidates: [], disabledIds: new Set() });
      }
      return next;
    });
  }, []);

  const toggleExpandedNode = useCallback((type: ExpansionGroup['type'], nodeId: string) => {
    setExpansions((prev) => {
      const next = new Map(prev);
      const group = next.get(type);
      if (!group) return prev;
      const nextDisabled = new Set(group.disabledIds);
      if (nextDisabled.has(nodeId)) {
        nextDisabled.delete(nodeId);
      } else {
        nextDisabled.add(nodeId);
      }
      next.set(type, { ...group, disabledIds: nextDisabled });
      return next;
    });
  }, []);

  const toggleAreaMember = useCallback((nodeId: string) => {
    setExpansions((prev) => {
      const next = new Map(prev);
      const group = next.get('area-members') ?? currentExpansions.get('area-members');
      if (!group) return prev;
      const nextDisabled = new Set(group.disabledIds);
      if (nextDisabled.has(nodeId)) {
        nextDisabled.delete(nodeId);
      } else {
        nextDisabled.add(nodeId);
      }
      next.set('area-members', { ...group, disabledIds: nextDisabled });
      return next;
    });
  }, [currentExpansions]);

  const value = useMemo<SelectionContextValue>(() => ({
    state: { selectedNodeIds, selectedAreaIds, expansions: currentExpansions },
    toggleNode,
    toggleArea,
    clearSelection,
    toggleExpansionGroup,
    toggleExpandedNode,
    toggleAreaMember,
    activeNodeIds,
    hasSelection,
  }), [selectedNodeIds, selectedAreaIds, currentExpansions, toggleNode, toggleArea, clearSelection, toggleExpansionGroup, toggleExpandedNode, toggleAreaMember, activeNodeIds, hasSelection]);

  return (
    <SelectionContext.Provider value={value}>
      {children}
    </SelectionContext.Provider>
  );
}
