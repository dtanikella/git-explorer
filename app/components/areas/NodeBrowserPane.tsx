'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import { useDraggable } from '@dnd-kit/core';
import type { AnalysisNode } from '@/lib/analysis/types';
import { SYNTAX_TYPE_LABELS, SYNTAX_TYPE_BADGE_COLORS } from '@/lib/analysis/syntax-type-labels';

interface NodeBrowserPaneProps {
  nodes: AnalysisNode[];
  assignedNodeIds?: Set<string>;
}

function truncatePath(filePath: string): string {
  const parts = filePath.split('/');
  return parts[parts.length - 1];
}

function DraggableNodeRow({
  node,
  isAssigned,
  isSelected,
  dragNodeIds,
  onRowClick,
}: {
  node: AnalysisNode;
  isAssigned: boolean;
  isSelected: boolean;
  dragNodeIds: string[];
  onRowClick: (nodeId: string, e: React.MouseEvent) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `node-${node.scipSymbol}`,
    data: { type: 'node', nodeId: node.scipSymbol, nodeIds: dragNodeIds },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      data-testid={`node-item-${node.scipSymbol}`}
      data-draggable={node.scipSymbol}
      data-selected={isSelected}
      onClick={(e) => onRowClick(node.scipSymbol, e)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 12px 3px 16px',
        cursor: 'pointer',
        fontSize: 11,
        color: isAssigned ? '#6b7280' : '#374151',
        background: isSelected ? '#dbeafe' : isAssigned ? '#f9fafb' : 'transparent',
        opacity: isDragging ? 0.4 : 1,
        touchAction: 'none',
        userSelect: 'none',
      }}
    >
      <span
        title={SYNTAX_TYPE_LABELS[node.syntaxType]}
        style={{
          fontSize: 8,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.3px',
          padding: '1px 4px',
          borderRadius: 4,
          flexShrink: 0,
          color: isAssigned ? '#9ca3af' : SYNTAX_TYPE_BADGE_COLORS[node.syntaxType],
          background: isAssigned ? '#f3f4f6' : `${SYNTAX_TYPE_BADGE_COLORS[node.syntaxType]}1a`,
        }}
      >
        {SYNTAX_TYPE_LABELS[node.syntaxType]}
      </span>
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {truncatePath(node.name)}
      </span>
    </div>
  );
}

/**
 * Searchable/filterable browser pane for selecting nodes to assign to areas.
 *
 * @remarks
 * Displays analysis nodes with search, type filter, and unassigned-only
 * toggle. Selected nodes can be drag-assigned to areas in the area tree.
 *
 * @param nodes - All analysis nodes available for browsing.
 * @param assignedNodeIds - Set of node IDs already assigned to areas.
 */
export default function NodeBrowserPane({
  nodes,
  assignedNodeIds = new Set(),
}: NodeBrowserPaneProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const anchorRef = useRef<string | null>(null);

  // Distinct node kinds actually present, for the type filter's options
  const presentTypes = useMemo(() => {
    const types = new Set<AnalysisNode['syntaxType']>();
    for (const n of nodes) types.add(n.syntaxType);
    return [...types].sort((a, b) => SYNTAX_TYPE_LABELS[a].localeCompare(SYNTAX_TYPE_LABELS[b]));
  }, [nodes]);

  // Group nodes by file path, and keep the flattened visible order for shift-range-select
  const { grouped, flatOrder } = useMemo(() => {
    const filtered = nodes.filter((n) => {
      if (searchQuery && !n.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (unassignedOnly && assignedNodeIds.has(n.scipSymbol)) return false;
      if (typeFilter !== 'all' && n.syntaxType !== typeFilter) return false;
      return true;
    });

    const groups = new Map<string, AnalysisNode[]>();
    const order: string[] = [];
    for (const node of filtered) {
      const filePath = node.filePath;
      const existing = groups.get(filePath);
      if (existing) {
        existing.push(node);
      } else {
        groups.set(filePath, [node]);
      }
      order.push(node.scipSymbol);
    }
    return { grouped: groups, flatOrder: order };
  }, [nodes, searchQuery, unassignedOnly, typeFilter, assignedNodeIds]);

  // Plain click selects just this row; cmd/ctrl-click toggles it in/out of the
  // selection; shift-click extends the selection from the last-clicked row.
  const handleRowClick = useCallback(
    (nodeId: string, e: React.MouseEvent) => {
      if (e.shiftKey && anchorRef.current) {
        const from = flatOrder.indexOf(anchorRef.current);
        const to = flatOrder.indexOf(nodeId);
        if (from !== -1 && to !== -1) {
          const [start, end] = from < to ? [from, to] : [to, from];
          setSelectedIds(new Set(flatOrder.slice(start, end + 1)));
        }
        return;
      }
      if (e.metaKey || e.ctrlKey) {
        setSelectedIds((prev) => {
          const next = new Set(prev);
          if (next.has(nodeId)) next.delete(nodeId);
          else next.add(nodeId);
          return next;
        });
        anchorRef.current = nodeId;
        return;
      }
      setSelectedIds(new Set([nodeId]));
      anchorRef.current = nodeId;
    },
    [flatOrder]
  );

  return (
    <div
      data-testid="node-browser-pane"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Search header */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
          Nodes
          <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 400, marginLeft: 6 }}>
            ({nodes.length} nodes)
          </span>
          {selectedIds.size > 1 && (
            <span data-testid="selection-count" style={{ fontSize: 10, color: '#3b82f6', fontWeight: 600, marginLeft: 6 }}>
              {selectedIds.size} selected
            </span>
          )}
        </div>
        <input
          data-testid="node-search-input"
          type="text"
          placeholder="Search nodes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '5px 8px',
            fontSize: 11,
            border: '1px solid #d1d5db',
            borderRadius: 6,
            outline: 'none',
          }}
        />
        <select
          data-testid="node-type-filter"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            marginTop: 6,
            padding: '4px 6px',
            fontSize: 11,
            border: '1px solid #d1d5db',
            borderRadius: 6,
            outline: 'none',
            color: '#374151',
            background: 'white',
          }}
        >
          <option value="all">All types</option>
          {presentTypes.map((t) => (
            <option key={t} value={t}>
              {SYNTAX_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <label
          data-testid="unassigned-toggle"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            marginTop: 6,
            fontSize: 11,
            color: '#6b7280',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={unassignedOnly}
            onChange={(e) => setUnassignedOnly(e.target.checked)}
            style={{ margin: 0 }}
          />
          Unassigned only
        </label>
      </div>

      {/* Node list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {grouped.size === 0 ? (
          <div style={{ fontSize: 11, color: '#9ca3af', padding: '12px', textAlign: 'center' }}>
            {searchQuery || unassignedOnly || typeFilter !== 'all' ? 'No matching nodes' : 'No nodes loaded'}
          </div>
        ) : (
          [...grouped.entries()].map(([filePath, fileNodes]) => (
            <div key={filePath} style={{ marginBottom: 4 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: '#9ca3af',
                  padding: '4px 12px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                {filePath}
              </div>
              {fileNodes.map((node, i) => {
                const isSelected = selectedIds.has(node.scipSymbol);
                const isMultiDrag = isSelected && selectedIds.size > 1;
                return (
                  <DraggableNodeRow
                    key={`${filePath}::${node.scipSymbol}::${i}`}
                    node={node}
                    isAssigned={assignedNodeIds.has(node.scipSymbol)}
                    isSelected={isSelected}
                    dragNodeIds={isMultiDrag ? [...selectedIds] : [node.scipSymbol]}
                    onRowClick={handleRowClick}
                  />
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
