/**
 * Expansion candidate computation for the shared selection sidebar.
 *
 * @remarks
 * Computes same-file, callers, and callees expansion candidates
 * based on selected nodes and areas. Does NOT produce area-members
 * candidates; area membership is handled directly by the selection
 * state derivation.
 *
 * @see `app/contexts/SelectionContext` for state integration.
 */

import type { AnalysisNode, AnalysisEdge } from '@/lib/analysis/types';
import { EdgeKind } from '@/lib/analysis/types';
import type { Area } from '@/lib/areas/types';
import { getDescendantIds } from '@/lib/areas/containment';

// --- Types ---

export interface ExpansionCandidate {
  nodeId: string;
  sourceNodeIds: string[];
}

export interface ExpansionGroup {
  type: 'same-file' | 'callers' | 'callees';
  enabled: boolean;
  candidates: ExpansionCandidate[];
  disabledIds: Set<string>;
}

export type ExpansionType = ExpansionGroup['type'];

// --- Constants ---

const CALLER_CALLEE_EDGE_KINDS = new Set<EdgeKind>([
  EdgeKind.CALLS,
  EdgeKind.INCLUDES,
  EdgeKind.INSTANTIATES,
  EdgeKind.USES_TYPE,
  EdgeKind.EXTENDS,
  EdgeKind.IMPLEMENTS,
]);

const EXPANSION_TYPES: ExpansionType[] = ['same-file', 'callers', 'callees'];

// Candidates carrying a previously-carried-over prevExpansions map.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrevMap = Map<string, any>;

/**
 * Computes expansion candidates for the given selection state.
 *
 * @param selectedNodeIds - The derived set of selected node ids.
 * @param selectedAreaIds - The set of selected area ids.
 * @param nodes - All analysis nodes in view.
 * @param edges - All analysis edges.
 * @param visibleNodeIds - The set of node ids currently visible in the graph.
 * @param areas - All area definitions.
 * @param prevExpansions - Previous expansion state to preserve enabled/disabled flags.
 * @returns A map from expansion type to {@link ExpansionGroup}.
 */
export function computeExpansionCandidates(
  selectedNodeIds: Set<string>,
  selectedAreaIds: Set<string>,
  nodes: AnalysisNode[],
  edges: AnalysisEdge[],
  visibleNodeIds: Set<string>,
  areas: Area[],
  prevExpansions?: PrevMap,
): Map<string, ExpansionGroup> {
  if (selectedNodeIds.size === 0 && selectedAreaIds.size === 0) return new Map();

  const nodesBySymbol = new Map<string, AnalysisNode>();
  for (const n of nodes) nodesBySymbol.set(n.scipSymbol, n);

  // ---- Same File ----
  const selectedFilePaths = new Set<string>();
  for (const id of selectedNodeIds) {
    const node = nodesBySymbol.get(id);
    if (node) selectedFilePaths.add(node.filePath);
  }

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

  // ---- Callers ----
  const callerCandidates: ExpansionCandidate[] = [];
  const callerMap = new Map<string, Set<string>>();
  for (const e of edges) {
    if (!CALLER_CALLEE_EDGE_KINDS.has(e.kind)) continue;
    if (!selectedNodeIds.has(e.toSymbol)) continue;
    if (selectedNodeIds.has(e.fromSymbol)) continue;
    if (!visibleNodeIds.has(e.fromSymbol)) continue;
    if (!callerMap.has(e.fromSymbol)) callerMap.set(e.fromSymbol, new Set());
    callerMap.get(e.fromSymbol)!.add(e.toSymbol);
  }
  for (const [nodeId, sources] of callerMap) {
    callerCandidates.push({ nodeId, sourceNodeIds: [...sources] });
  }

  // ---- Callees ----
  const calleeCandidates: ExpansionCandidate[] = [];
  const calleeMap = new Map<string, Set<string>>();
  for (const e of edges) {
    if (!CALLER_CALLEE_EDGE_KINDS.has(e.kind)) continue;
    if (!selectedNodeIds.has(e.fromSymbol)) continue;
    if (selectedNodeIds.has(e.toSymbol)) continue;
    if (!visibleNodeIds.has(e.toSymbol)) continue;
    if (!calleeMap.has(e.toSymbol)) calleeMap.set(e.toSymbol, new Set());
    calleeMap.get(e.toSymbol)!.add(e.fromSymbol);
  }
  for (const [nodeId, sources] of calleeMap) {
    calleeCandidates.push({ nodeId, sourceNodeIds: [...sources] });
  }

  function makeGroup(
    type: ExpansionType,
    candidates: ExpansionCandidate[],
    defaultEnabled: boolean,
  ): ExpansionGroup {
    const prev = prevExpansions?.get(type);
    return {
      type,
      enabled: prev ? prev.enabled : defaultEnabled,
      candidates,
      disabledIds: prev
        ? new Set([...prev.disabledIds].filter((id: string) => candidates.some((c) => c.nodeId === id)))
        : new Set(),
    };
  }

  const result = new Map<string, ExpansionGroup>();
  result.set('same-file', makeGroup('same-file', sameFileCandidates, false));
  result.set('callers', makeGroup('callers', callerCandidates, false));
  result.set('callees', makeGroup('callees', calleeCandidates, false));

  return result;
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
    if (!group.enabled) continue;
    for (const c of group.candidates) {
      if (!group.disabledIds.has(c.nodeId)) {
        active.add(c.nodeId);
      }
    }
  }
  return active;
}