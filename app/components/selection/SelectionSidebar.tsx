'use client';

import { useMemo } from 'react';
import { useSelection } from '@/app/contexts/SelectionContext';
import type { ExpansionGroup } from '@/app/contexts/SelectionContext';
import type { AnalysisNode } from '@/lib/analysis/types';

interface SelectionSidebarProps {
  nodes: AnalysisNode[];
}

const GROUP_LABELS: Record<string, string> = {
  'same-file': 'Same File',
  'callers': 'Callers',
  'callees': 'Callees',
};

function truncatePath(filePath: string): string {
  const parts = filePath.split('/');
  return parts[parts.length - 1];
}

export default function SelectionSidebar({ nodes }: SelectionSidebarProps) {
  const { state, clearSelection, toggleNode, toggleExpansionGroup, toggleExpandedNode } = useSelection();
  const { selectedNodeIds, expansions } = state;

  const nodesBySymbol = useMemo(() => {
    const map = new Map<string, AnalysisNode>();
    for (const n of nodes) map.set(n.scipSymbol, n);
    return map;
  }, [nodes]);

  const selectedNodes = useMemo(
    () => [...selectedNodeIds].map((id) => nodesBySymbol.get(id)).filter(Boolean) as AnalysisNode[],
    [selectedNodeIds, nodesBySymbol],
  );

  const groupOrder: ExpansionGroup['type'][] = ['same-file', 'callers', 'callees'];

  return (
    <div
      style={{
        width: 400,
        borderLeft: '1px solid #e5e7eb',
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
        <span style={{ fontWeight: 600 }}>Selection</span>
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
        {/* Selected nodes */}
        <div style={{ marginBottom: 12 }}>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                <span style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{node.name}</span>
                <span
                  style={{ fontSize: 10, color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  title={node.filePath}
                >
                  {truncatePath(node.filePath)}
                </span>
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

        {/* Expansion groups */}
        {groupOrder.map((type) => {
          const group = expansions.get(type);
          if (!group) return null;
          const candidateCount = group.candidates.length;

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

              {/* Candidate list */}
              {group.enabled && candidateCount > 0 && (
                <div style={{ paddingLeft: 8 }}>
                  {group.candidates.map((candidate) => {
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
                          toggleExpandedNode(type, candidate.nodeId);
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={!isDisabled}
                          readOnly
                          style={{ margin: 0, cursor: 'pointer' }}
                        />
                        <span>
                          <span>{node.name}</span>
                          <span
                            style={{ fontSize: 10, color: '#9ca3af', marginLeft: 4 }}
                            title={node.filePath}
                          >
                            {truncatePath(node.filePath)}
                          </span>
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
    </div>
  );
}
