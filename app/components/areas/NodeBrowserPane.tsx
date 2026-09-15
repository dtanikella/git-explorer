'use client';

import { useState, useMemo } from 'react';
import type { AnalysisNode } from '@/lib/analysis/types';

interface NodeBrowserPaneProps {
  nodes: AnalysisNode[];
  assignedNodeIds?: Set<string>;
  onAssignNode?: (nodeId: string) => void;
}

function truncatePath(filePath: string): string {
  const parts = filePath.split('/');
  return parts[parts.length - 1];
}

export default function NodeBrowserPane({
  nodes,
  assignedNodeIds = new Set(),
  onAssignNode,
}: NodeBrowserPaneProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [unassignedOnly, setUnassignedOnly] = useState(false);

  // Group nodes by file path
  const grouped = useMemo(() => {
    const filtered = nodes.filter((n) => {
      if (searchQuery && !n.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (unassignedOnly && assignedNodeIds.has(n.scipSymbol)) return false;
      return true;
    });

    const groups = new Map<string, AnalysisNode[]>();
    for (const node of filtered) {
      const filePath = node.filePath;
      const existing = groups.get(filePath);
      if (existing) {
        existing.push(node);
      } else {
        groups.set(filePath, [node]);
      }
    }
    return groups;
  }, [nodes, searchQuery, unassignedOnly, assignedNodeIds]);

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
            {searchQuery || unassignedOnly ? 'No matching nodes' : 'No nodes loaded'}
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
              {fileNodes.map((node) => {
                const isAssigned = assignedNodeIds.has(node.scipSymbol);
                return (
                  <div
                    key={node.scipSymbol}
                    data-testid={`node-item-${node.scipSymbol}`}
                    onClick={() => onAssignNode?.(node.scipSymbol)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '3px 12px 3px 16px',
                      cursor: onAssignNode ? 'pointer' : 'default',
                      fontSize: 11,
                      color: isAssigned ? '#6b7280' : '#374151',
                      background: isAssigned ? '#f9fafb' : 'transparent',
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: isAssigned ? '#d1d5db' : '#3b82f6', flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {truncatePath(node.name)}
                    </span>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}