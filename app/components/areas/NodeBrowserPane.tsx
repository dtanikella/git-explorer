'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import { useDraggable } from '@dnd-kit/core';
import type { AnalysisNode } from '@/lib/analysis/types';
import { buildFileNodes, type TreeNode } from '@/lib/selection/trees';
import { SYNTAX_TYPE_LABELS, SYNTAX_TYPE_BADGE_COLORS } from '@/lib/analysis/syntax-type-labels';

interface NodeBrowserPaneProps {
  nodes: AnalysisNode[];
  assignedNodeIds?: Set<string>;
}

type SyntaxTypeValue = AnalysisNode['syntaxType'];

/** Pixels of indentation per tree depth. */
const INDENT = 12;

function truncatePath(filePath: string): string {
  const parts = filePath.split('/');
  return parts[parts.length - 1];
}

function countMembers(node: TreeNode): number {
  return (node.members?.length ?? 0) + (node.children?.reduce((n, c) => n + countMembers(c), 0) ?? 0);
}

/** Node ids in the order they are shown, skipping anything under a collapsed row. */
function flattenVisible(nodes: TreeNode[], collapsed: Set<string>): string[] {
  const out: string[] = [];
  for (const node of nodes) {
    if (collapsed.has(node.id)) continue;
    for (const child of node.children ? flattenVisible(node.children, collapsed) : []) out.push(child);
    for (const m of node.members ?? []) out.push(m.scipSymbol);
  }
  return out;
}

function DraggableNodeRow({
  node,
  isAssigned,
  isSelected,
  dragNodeIds,
  onRowClick,
  depth,
}: {
  depth: number;
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
        padding: `3px 12px 3px ${16 + depth * INDENT}px`,
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
 * Searchable browser pane for selecting nodes to assign to areas.
 *
 * @remarks
 * Displays analysis nodes as a collapsible directory, file, node hierarchy
 * (single-child directory chains are collapsed into one row) with search, a
 * multi-select type filter (no chips selected shows every type) and an
 * unassigned-only toggle. Selected nodes can be drag-assigned to areas in the area tree.
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
  const [typeFilter, setTypeFilter] = useState<Set<SyntaxTypeValue>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const anchorRef = useRef<string | null>(null);

  // Distinct node kinds actually present, for the type chips
  const presentTypes = useMemo(() => {
    const types = new Set<SyntaxTypeValue>();
    for (const n of nodes) types.add(n.syntaxType);
    return [...types].sort((a, b) => SYNTAX_TYPE_LABELS[a].localeCompare(SYNTAX_TYPE_LABELS[b]));
  }, [nodes]);

  const toggleTypeFilter = useCallback((type: SyntaxTypeValue) => {
    setTypeFilter((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  const toggleCollapsed = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Directory tree of the matching nodes, plus the
  // flattened visible order for shift-range-select
  const { tree, flatOrder, matchCount } = useMemo(() => {
    const filtered = nodes.filter((n) => {
      if (searchQuery && !n.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (unassignedOnly && assignedNodeIds.has(n.scipSymbol)) return false;
      if (typeFilter.size > 0 && !typeFilter.has(n.syntaxType)) return false;
      return true;
    });
    const built = buildFileNodes(filtered, '', true);
    return {
      tree: built,
      flatOrder: flattenVisible(built, collapsed),
      matchCount: filtered.length,
    };
  }, [nodes, searchQuery, unassignedOnly, typeFilter, assignedNodeIds, collapsed]);

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

  const renderTreeNode = (node: TreeNode, depth: number): React.ReactNode => {
    const isCollapsed = collapsed.has(node.id);
    const isFile = !!node.filePath;
    return (
      <div key={node.id}>
        <div
          data-testid={`${isFile ? 'file' : 'dir'}-row-${node.id}`}
          onClick={() => toggleCollapsed(node.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: `3px 12px 3px ${8 + depth * INDENT}px`,
            cursor: 'pointer',
            userSelect: 'none',
            fontSize: 11,
            fontWeight: isFile ? 500 : 600,
            color: isFile ? '#374151' : '#6b7280',
          }}
          title={node.filePath ?? node.name}
        >
          <span style={{ fontSize: 8, width: 10, textAlign: 'center', flexShrink: 0, color: '#9ca3af' }}>
            {isCollapsed ? '▶' : '▼'}
          </span>
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {node.name}
          </span>
          <span style={{ fontSize: 9, color: '#9ca3af', fontWeight: 400, flexShrink: 0 }}>
            {countMembers(node)}
          </span>
        </div>
        {!isCollapsed && (
          <>
            {node.children?.map((child) => renderTreeNode(child, depth + 1))}
            {node.members?.map((member, i) => {
              const isSelected = selectedIds.has(member.scipSymbol);
              const isMultiDrag = isSelected && selectedIds.size > 1;
              return (
                <DraggableNodeRow
                  key={`${node.id}::${member.scipSymbol}::${i}`}
                  node={member}
                  depth={depth + 1}
                  isAssigned={assignedNodeIds.has(member.scipSymbol)}
                  isSelected={isSelected}
                  dragNodeIds={isMultiDrag ? [...selectedIds] : [member.scipSymbol]}
                  onRowClick={handleRowClick}
                />
              );
            })}
          </>
        )}
      </div>
    );
  };

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
        <div style={{ marginTop: 6 }}>
          <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 3 }}>
            Types
            {typeFilter.size > 0 && (
              <button
                type="button"
                data-testid="node-type-clear"
                onClick={() => setTypeFilter(new Set())}
                style={{
                  marginLeft: 6,
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  fontSize: 10,
                  color: '#6b7280',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                }}
              >
                clear
              </button>
            )}
          </div>
          <div data-testid="node-type-filter" style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {presentTypes.map((t) => {
              const active = typeFilter.has(t);
              const color = SYNTAX_TYPE_BADGE_COLORS[t];
              return (
                <button
                  key={t}
                  type="button"
                  data-testid={`node-type-chip-${t}`}
                  aria-pressed={active}
                  onClick={() => toggleTypeFilter(t)}
                  style={{
                    fontSize: 9,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.3px',
                    padding: '2px 6px',
                    borderRadius: 4,
                    cursor: 'pointer',
                    border: `1px solid ${color}`,
                    color: active ? '#fff' : color,
                    background: active ? color : `${color}1a`,
                  }}
                >
                  {SYNTAX_TYPE_LABELS[t]}
                </button>
              );
            })}
          </div>
        </div>
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
        {matchCount === 0 ? (
          <div style={{ fontSize: 11, color: '#9ca3af', padding: '12px', textAlign: 'center' }}>
            {searchQuery || unassignedOnly || typeFilter.size > 0 ? 'No matching nodes' : 'No nodes loaded'}
          </div>
        ) : (
          tree.map((node) => renderTreeNode(node, 0))
        )}
      </div>
    </div>
  );
}
