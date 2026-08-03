'use client';

import { useMemo, useState } from 'react';
import { useSelection } from '@/app/contexts/SelectionContext';
import { useAreaStore } from '@/app/contexts/AreaContext';
import type { ExpansionGroup } from '@/app/contexts/SelectionContext';
import type { AnalysisNode } from '@/lib/analysis/types';

interface SearchSelectSidebarProps {
  nodes: AnalysisNode[];
  onSearchNode: (query: string) => boolean;
  repoPath: string;
}

const GROUP_LABELS: Record<string, string> = {
  'same-file': 'Same File',
  'callers': 'Callers',
  'callees': 'Callees',
  'area-members': 'Area Members',
};

function truncatePath(filePath: string): string {
  const parts = filePath.split('/');
  return parts[parts.length - 1];
}

export default function SearchSelectSidebar({ nodes, onSearchNode }: SearchSelectSidebarProps) {
  const {
    state,
    clearSelection,
    toggleNode,
    toggleArea,
    toggleExpansionGroup,
    toggleExpandedNode,
    toggleAreaMember,
  } = useSelection();
  const { selectedNodeIds, selectedAreaIds, expansions } = state;
  const { areas, runtimeState, nodeToAreas } = useAreaStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchNotFound, setSearchNotFound] = useState(false);

  const nodesBySymbol = useMemo(() => {
    const map = new Map<string, AnalysisNode>();
    for (const n of nodes) map.set(n.scipSymbol, n);
    return map;
  }, [nodes]);

  const areasById = useMemo(() => {
    const map = new Map<string, typeof areas[number]>();
    for (const a of areas) map.set(a.id, a);
    return map;
  }, [areas]);

  const selectedNodes = useMemo(
    () => [...selectedNodeIds].map((id) => nodesBySymbol.get(id)).filter(Boolean) as AnalysisNode[],
    [selectedNodeIds, nodesBySymbol],
  );

  const selectedAreas = useMemo(
    () => [...selectedAreaIds].map((id) => areasById.get(id)).filter(Boolean) as typeof areas[number][],
    [selectedAreaIds, areasById],
  );

  const groupOrder: ExpansionGroup['type'][] = ['same-file', 'callers', 'callees', 'area-members'];

  // Track which source-node subgroups are collapsed (key: "type:srcId")
  const [collapsedSubgroups, setCollapsedSubgroups] = useState<Set<string>>(new Set());

  const toggleCollapse = (key: string) => {
    setCollapsedSubgroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    const found = onSearchNode(searchQuery.trim());
    setSearchNotFound(!found);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const renderTagsForNode = (nodeId: string) => {
    const nodeAreas = nodeToAreas.get(nodeId) ?? [];
    return nodeAreas.map((area) => {
      const color = runtimeState.get(area.id)?.color ?? '#6b7280';
      return (
        <span
          key={area.id}
          style={{
            display: 'inline-block',
            background: `${color}26`,
            color,
            fontSize: 9,
            padding: '1px 5px',
            borderRadius: 8,
            marginLeft: 4,
            fontWeight: 500,
          }}
        >
          {area.name}
        </span>
      );
    });
  };

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
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        <span style={{ fontWeight: 600 }}>Search & Select</span>
        <button
          onClick={clearSelection}
          style={{
            background: 'none',
            border: 'none',
            color: '#6b7280',
            cursor: 'pointer',
            fontSize: 11,
            textDecoration: 'underline',
          }}
        >
          Clear all
        </button>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setSearchNotFound(false); }}
            onKeyDown={handleKeyDown}
            placeholder="Search node or area..."
            style={{
              flex: 1,
              padding: '5px 8px',
              fontSize: 12,
              border: '1px solid #d1d5db',
              borderRadius: 6,
            }}
          />
          <button
            onClick={handleSearch}
            disabled={!searchQuery.trim()}
            style={{
              padding: '5px 10px',
              fontSize: 12,
              background: searchQuery.trim() ? '#3b82f6' : '#d1d5db',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: searchQuery.trim() ? 'pointer' : 'default',
            }}
          >
            Search
          </button>
        </div>
        {searchNotFound && (
          <div style={{ color: '#dc2626', fontSize: 11, marginBottom: 8 }}>Not found</div>
        )}

        {/* Selected nodes */}
        {selectedNodes.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4, fontWeight: 500 }}>Selected nodes</div>
            {selectedNodes.map((node) => (
              <div
                key={node.scipSymbol}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '4px 0',
                  borderBottom: '1px solid #f3f4f6',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{node.name}</span>
                  <span
                    style={{ fontSize: 10, color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    title={node.filePath}
                  >
                    {truncatePath(node.filePath)}
                  </span>
                  {renderTagsForNode(node.scipSymbol)}
                </div>
                <button
                  data-testid={`deselect-${node.scipSymbol}`}
                  onClick={() => toggleNode(node.scipSymbol)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#9ca3af',
                    cursor: 'pointer',
                    fontSize: 14,
                    lineHeight: 1,
                    padding: '0 2px',
                    flexShrink: 0,
                  }}
                  title="Deselect"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Selected areas */}
        {selectedAreas.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4, fontWeight: 500 }}>Selected areas</div>
            {selectedAreas.map((area) => {
              const color = runtimeState.get(area.id)?.color ?? '#6b7280';
              return (
                <div
                  key={area.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '4px 0',
                    borderBottom: '1px solid #f3f4f6',
                  }}
                >
                  <span
                    style={{
                      display: 'inline-block',
                      background: `${color}26`,
                      color,
                      fontSize: 10,
                      padding: '2px 8px',
                      borderRadius: 9,
                      fontWeight: 500,
                    }}
                  >
                    {area.name}
                  </span>
                  <button
                    data-testid={`deselect-area-${area.id}`}
                    onClick={() => toggleArea(area.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#9ca3af',
                      cursor: 'pointer',
                      fontSize: 14,
                      lineHeight: 1,
                      padding: '0 2px',
                    }}
                    title="Deselect area"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Expansion groups */}
        {groupOrder.map((type) => {
          const group = expansions.get(type);
          if (!group) return null;
          const candidateCount = group.candidates.length;

          // Group candidates by source selected node/area
          const bySource = new Map<string, typeof group.candidates>();
          for (const candidate of group.candidates) {
            for (const srcId of candidate.sourceNodeIds) {
              if (!bySource.has(srcId)) bySource.set(srcId, []);
              bySource.get(srcId)!.push(candidate);
            }
          }

          return (
            <div key={type} style={{ marginBottom: 8 }}>
              {/* Group header */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '4px 0',
                }}
              >
                <span style={{ fontSize: 11, color: '#6b7280' }}>
                  <span>{GROUP_LABELS[type]}</span>{' '}
                  <span>({candidateCount})</span>
                </span>
                <button
                  data-testid={`toggle-${type}`}
                  onClick={() => toggleExpansionGroup(type)}
                  style={{
                    width: 32,
                    height: 18,
                    borderRadius: 9,
                    border: 'none',
                    cursor: candidateCount > 0 ? 'pointer' : 'default',
                    background: group.enabled ? '#3b82f6' : '#d1d5db',
                    position: 'relative',
                    transition: 'background 0.2s',
                    opacity: candidateCount > 0 ? 1 : 0.4,
                  }}
                  disabled={candidateCount === 0}
                >
                  <span
                    style={{
                      position: 'absolute',
                      top: 2,
                      left: group.enabled ? 16 : 2,
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      background: '#fff',
                      transition: 'left 0.2s',
                    }}
                  />
                </button>
              </div>

              {/* Candidate list grouped by source node/area */}
              {group.enabled && candidateCount > 0 && (
                <div style={{ paddingLeft: 8 }}>
                  {[...bySource.entries()].map(([srcId, candidates]) => {
                    const srcNode = nodesBySymbol.get(srcId);
                    const srcArea = areasById.get(srcId);
                    const srcLabel = srcNode ? srcNode.name : srcArea ? srcArea.name : srcId;
                    const allDisabled = candidates.every((c) => group.disabledIds.has(c.nodeId));
                    const noneDisabled = candidates.every((c) => !group.disabledIds.has(c.nodeId));
                    const sourceIsArea = !!srcArea;

                    return (
                      <div key={srcId} style={{ marginBottom: 4 }}>
                        {/* Source node/area subgroup header */}
                        {(selectedNodeIds.size + selectedAreaIds.size > 1) && (() => {
                          const collapseKey = `${type}:${srcId}`;
                          const isCollapsed = collapsedSubgroups.has(collapseKey);
                          return (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '2px 0',
                                fontSize: 11,
                                color: '#374151',
                                fontWeight: 500,
                              }}
                            >
                              <span
                                onClick={() => toggleCollapse(collapseKey)}
                                style={{
                                  cursor: 'pointer',
                                  fontSize: 8,
                                  userSelect: 'none',
                                  width: 10,
                                  textAlign: 'center',
                                  flexShrink: 0,
                                }}
                              >
                                {isCollapsed ? '▶' : '▼'}
                              </span>
                              <label
                                style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', flex: 1 }}
                                onClick={(e) => {
                                  e.preventDefault();
                                  for (const c of candidates) {
                                    const isCurrentlyDisabled = group.disabledIds.has(c.nodeId);
                                    if (noneDisabled && !isCurrentlyDisabled) {
                                      if (type === 'area-members') toggleAreaMember(c.nodeId);
                                      else toggleExpandedNode(type, c.nodeId);
                                    } else if (!noneDisabled && isCurrentlyDisabled) {
                                      if (type === 'area-members') toggleAreaMember(c.nodeId);
                                      else toggleExpandedNode(type, c.nodeId);
                                    }
                                  }
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={!allDisabled}
                                  ref={(el) => { if (el) el.indeterminate = !allDisabled && !noneDisabled; }}
                                  readOnly
                                  style={{ margin: 0, cursor: 'pointer' }}
                                />
                                <span>{srcLabel}</span>
                                <span style={{ fontSize: 10, color: '#9ca3af' }}>({candidates.length})</span>
                              </label>
                            </div>
                          );
                        })()}
                        {/* Individual candidates */}
                        {!(selectedNodeIds.size + selectedAreaIds.size > 1 && collapsedSubgroups.has(`${type}:${srcId}`)) && (
                          <div style={{ paddingLeft: selectedNodeIds.size + selectedAreaIds.size > 1 ? 16 : 0 }}>
                            {candidates.map((candidate) => {
                              const node = nodesBySymbol.get(candidate.nodeId);
                              if (!node) return null;
                              const isDisabled = group.disabledIds.has(candidate.nodeId);
                              return (
                                <label
                                  key={candidate.nodeId}
                                  data-testid={`candidate-${type}-${candidate.nodeId}`}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    padding: '2px 0',
                                    cursor: 'pointer',
                                    opacity: isDisabled ? 0.5 : 1,
                                  }}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    if (type === 'area-members') toggleAreaMember(candidate.nodeId);
                                    else toggleExpandedNode(type, candidate.nodeId);
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={!isDisabled}
                                    readOnly
                                    style={{ margin: 0, cursor: 'pointer' }}
                                  />
                                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                                    <span>{node.name}</span>
                                    <span
                                      style={{ fontSize: 10, color: '#9ca3af' }}
                                      title={node.filePath}
                                    >
                                      {truncatePath(node.filePath)}
                                    </span>
                                    {sourceIsArea && renderTagsForNode(candidate.nodeId)}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Select By Area (placeholder for Phase 3) */}
        <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6, fontWeight: 500 }}>Select By</div>
          <div style={{ fontSize: 11, color: '#9ca3af', padding: '4px 0' }}>Area hierarchy tree (Phase 3)</div>
        </div>
      </div>
    </div>
  );
}
