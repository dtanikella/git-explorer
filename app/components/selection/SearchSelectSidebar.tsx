'use client';

import { useMemo, useState, useCallback } from 'react';
import { useSelection } from '@/app/contexts/SelectionContext';
import { useAreaStore } from '@/app/contexts/AreaContext';
import { buildAreaTree, buildFileTree } from '@/lib/selection/trees';
import type { AnalysisNode, AnalysisEdge } from '@/lib/analysis/types';
import SelectionToolbar from './SelectionToolbar';
import SelectionTree from './SelectionTree';
import ExpansionGroups from './ExpansionGroups';
import SelectionStats from './SelectionStats';

type BrowseMode = 'area' | 'file';
type FilterMode = 'all' | 'selected' | 'locked';

interface SearchSelectSidebarProps {
  nodes: AnalysisNode[];
  edges: AnalysisEdge[];
  onSearchNode: (query: string) => boolean;
  repoPath: string;
}

/**
 * Shared selection sidebar used by both the Graph and Diff tabs.
 *
 * @remarks
 * Composes {@link SelectionToolbar}, {@link SelectionTree},
 * {@link ExpansionGroups}, and {@link SelectionStats} into a
 * unified sidebar with browse-by-area and browse-by-file views,
 * search, filtering, and a stats panel.
 *
 * @param nodes - All analysis nodes.
 * @param edges - All analysis edges.
 * @param onSearchNode - Callback to pan the graph to a node.
 * @param repoPath - Current repository path.
 */
export default function SearchSelectSidebar({ nodes, edges, onSearchNode, repoPath }: SearchSelectSidebarProps) {
  const { state, toggleArea, toggleNode, activeNodeIds } = useSelection();
  const { areas, runtimeState, nodeToAreas } = useAreaStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchNotFound, setSearchNotFound] = useState(false);
  const [browseMode, setBrowseMode] = useState<BrowseMode>('area');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [expandedTreeIds, setExpandedTreeIds] = useState<Set<string>>(new Set());

  const nodesBySymbol = useMemo(() => {
    const map = new Map<string, AnalysisNode>();
    for (const n of nodes) map.set(n.scipSymbol, n);
    return map;
  }, [nodes]);

  // --- Filter state based on filterMode ---
  const filterRelevantIds = useMemo(() => {
    switch (filterMode) {
      case 'selected':
        return state.selectedNodeIds;
      case 'locked':
        return state.lockedNodeIds;
      default:
        return null; // show all
    }
  }, [filterMode, state.selectedNodeIds, state.lockedNodeIds]);

  // --- Tree building ---
  const areaTree = useMemo(() => {
    if (browseMode !== 'area') return null;
    // Determine which nodes to include based on filter
    const allNodes = filterRelevantIds
      ? nodes.filter((n) => filterRelevantIds.has(n.scipSymbol))
      : nodes;
    const nodeSymbols = new Map(allNodes.map((n) => [n.scipSymbol, n]));
    return buildAreaTree(areas, nodeSymbols);
  }, [browseMode, areas, nodes, filterRelevantIds]);

  const fileTree = useMemo(() => {
    if (browseMode !== 'file') return null;
    const allNodes = filterRelevantIds
      ? nodes.filter((n) => filterRelevantIds.has(n.scipSymbol))
      : nodes;
    // For file tree, only show selected/locked nodes when filtering
    if (filterMode !== 'all' && filterRelevantIds) {
      return buildFileTree(nodes.filter((n) => filterRelevantIds.has(n.scipSymbol)));
    }
    return buildFileTree(nodes);
  }, [browseMode, nodes, filterRelevantIds, filterMode]);

  const handleSearchSubmit = useCallback(() => {
    const query = searchQuery.trim();
    if (!query) return;

    const nodeFound = onSearchNode(query);
    if (nodeFound) {
      setSearchNotFound(false);
      return;
    }

    // Fallback to area name search
    const lowerQuery = query.toLowerCase();
    const areaMatch = areas.find((a) => a.name.toLowerCase().includes(lowerQuery));
    if (areaMatch) {
      toggleArea(areaMatch.id);
      setSearchNotFound(false);
      return;
    }

    setSearchNotFound(true);
  }, [searchQuery, onSearchNode, areas, toggleArea]);

  const handleSearchQueryChange = useCallback((query: string) => {
    setSearchQuery(query);
    setSearchNotFound(false);
  }, []);

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedTreeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return (
    <div
      data-testid="search-select-sidebar"
      style={{
        width: 350,
        borderRight: '1px solid #e5e7eb',
        background: '#f9fafb',
        display: 'flex',
        flexDirection: 'column',
        fontSize: 12,
        overflow: 'hidden',
      }}
    >
      {/* Toolbar */}
      <SelectionToolbar
        searchQuery={searchQuery}
        onSearchQueryChange={handleSearchQueryChange}
        searchNotFound={searchNotFound}
        onSearchSubmit={handleSearchSubmit}
        browseMode={browseMode}
        onBrowseModeChange={setBrowseMode}
        filterMode={filterMode}
        onFilterModeChange={setFilterMode}
      />

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
        {/* Tree view */}
        {browseMode === 'area' && areaTree && (
          <div style={{ marginBottom: 12 }}>
            <SelectionTree
              tree={areaTree}
              mode="area"
              expanded={expandedTreeIds}
              onToggleExpand={handleToggleExpand}
            />
          </div>
        )}
        {browseMode === 'file' && fileTree && (
          <div style={{ marginBottom: 12 }}>
            <SelectionTree
              tree={fileTree}
              mode="file"
              expanded={expandedTreeIds}
              onToggleExpand={handleToggleExpand}
            />
          </div>
        )}

        {/* Expansion groups */}
        {activeNodeIds.size > 0 && (
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #e5e7eb' }}>
            <ExpansionGroups nodes={nodes} />
          </div>
        )}

        {/* Stats panel */}
        {activeNodeIds.size > 0 && (
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #e5e7eb' }}>
            <SelectionStats edges={edges} />
          </div>
        )}
      </div>
    </div>
  );
}