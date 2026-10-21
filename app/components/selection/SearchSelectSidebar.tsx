'use client';

import { useMemo, useState, useCallback } from 'react';
import { useSelection } from '@/app/contexts/SelectionContext';
import { buildFileTree } from '@/lib/selection/trees';
import type { AnalysisNode } from '@/lib/analysis/types';
import SelectionToolbar from './SelectionToolbar';
import SelectionTree from './SelectionTree';
import ExpansionGroups from './ExpansionGroups';

type FilterMode = 'all' | 'selected' | 'locked';

interface SearchSelectSidebarProps {
  nodes: AnalysisNode[];
  onSearchNode: (query: string) => boolean;
}

/**
 * Shared selection sidebar used by both the Graph and Diff tabs.
 *
 * @remarks
 * Composes {@link SelectionToolbar}, {@link SelectionTree},
 * and {@link ExpansionGroups} into a
 * unified sidebar with a browse-by-file view,
 * search and filtering.
 *
 * @param nodes - All analysis nodes.
 * @param onSearchNode - Callback to pan the graph to a node.
 */
export default function SearchSelectSidebar({ nodes, onSearchNode }: SearchSelectSidebarProps) {
  const { state, activeNodeIds } = useSelection();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchNotFound, setSearchNotFound] = useState(false);
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
  const fileTree = useMemo(
    () => buildFileTree(filterRelevantIds ? nodes.filter((n) => filterRelevantIds.has(n.scipSymbol)) : nodes),
    [nodes, filterRelevantIds],
  );

  const handleSearchSubmit = useCallback(() => {
    const query = searchQuery.trim();
    if (!query) return;

    const nodeFound = onSearchNode(query);
    if (nodeFound) {
      setSearchNotFound(false);
      return;
    }

    setSearchNotFound(true);
  }, [searchQuery, onSearchNode]);

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
        filterMode={filterMode}
        onFilterModeChange={setFilterMode}
      />

      {/* Scrollable content */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px 12px' }}>
        {/* Tree view */}
        {fileTree && (
          <div style={{ marginBottom: 12 }}>
            <SelectionTree
              tree={fileTree}
              expanded={expandedTreeIds}
              onToggleExpand={handleToggleExpand}
            />
          </div>
        )}

        {/* Expansion groups */}
        {(activeNodeIds.size > 0 || state.focusKey !== null || (state.rowExpansions?.size ?? 0) > 0) && (
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #e5e7eb' }}>
            <ExpansionGroups nodes={nodes} />
          </div>
        )}
      </div>
    </div>
  );
}
