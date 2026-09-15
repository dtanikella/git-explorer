'use client';

import React, { useState, useMemo, useCallback } from 'react';
import type { Area, AreaRuntimeState } from '@/lib/areas/types';

interface AreaTreeTableProps {
  areas: Area[];
  runtimeState: Map<string, AreaRuntimeState>;
  nodeNames?: Record<string, string>;
  onRenameArea?: (areaId: string, newName: string) => void;
  onDeleteArea?: (areaId: string) => void;
  onChangeType?: (areaId: string, newType: string) => void;
  onRemoveMember?: (areaId: string, nodeId: string) => void;
  onAddMember?: (areaId: string, nodeId: string) => void;
}

function truncatePath(filePath: string): string {
  const parts = filePath.split('/');
  return parts[parts.length - 1];
}

export default function AreaTreeTable({
  areas,
  runtimeState,
  nodeNames = {},
  onRenameArea,
  onDeleteArea,
  onChangeType,
  onRemoveMember,
  onAddMember,
}: AreaTreeTableProps) {
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set());
  const [popoverNodeId, setPopoverNodeId] = useState<string | null>(null);
  const [popoverPosition, setPopoverPosition] = useState<{ top: number; left: number } | null>(null);

  const areasById = useMemo(() => {
    const map = new Map<string, Area>();
    for (const a of areas) map.set(a.id, a);
    return map;
  }, [areas]);

  // Build nodeToAreas lookup
  const nodeToAreas = useMemo(() => {
    const map = new Map<string, Area[]>();
    for (const area of areas) {
      for (const nodeId of area.contains) {
        const existing = map.get(nodeId);
        if (existing) {
          existing.push(area);
        } else {
          map.set(nodeId, [area]);
        }
      }
    }
    return map;
  }, [areas]);

  const topLevel = useMemo(() => areas.filter((a) => a.parent === null), [areas]);

  const toggleExpanded = useCallback((areaId: string) => {
    setExpandedAreas((prev) => {
      const next = new Set(prev);
      if (next.has(areaId)) next.delete(areaId);
      else next.add(areaId);
      return next;
    });
    setPopoverNodeId(null);
  }, []);

  const handlePopoverClick = useCallback((nodeId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    setPopoverPosition({ top: rect.bottom + 4, left: rect.left });
    setPopoverNodeId(popoverNodeId === nodeId ? null : nodeId);
  }, [popoverNodeId]);

  const isExpanded = (areaId: string) => expandedAreas.has(areaId);

  const renderMemberRow = (nodeId: string, areaId: string, depth: number) => {
    const nodeName = nodeNames[nodeId] ?? nodeId;
    const otherAreas = nodeToAreas.get(nodeId)?.filter((a) => a.id !== areaId) ?? [];
    const hasOtherMemberships = otherAreas.length > 0;
    const showPopover = popoverNodeId === nodeId;

    return (
      <div
        key={`${areaId}-${nodeId}`}
        data-testid={`member-row-${areaId}-${nodeId}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 8px',
          borderBottom: '1px solid #f5f5f5',
          fontSize: 11,
          paddingLeft: 26 + (depth + 1) * 20,
          color: '#374151',
        }}
      >
        <span style={{ width: 14, flexShrink: 0 }} />
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {truncatePath(nodeName)}
        </span>
        {hasOtherMemberships && (
          <span
            data-testid={`multi-member-chip-${nodeId}-${areaId}`}
            onClick={(e) => handlePopoverClick(nodeId, e)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 2,
              fontSize: 10,
              background: '#f3f4f6',
              color: '#6b7280',
              padding: '1px 6px',
              borderRadius: 8,
              cursor: 'pointer',
              border: '1px solid #e5e7eb',
            }}
          >
            +{otherAreas.length} other
            <span style={{ fontSize: 8 }}>▾</span>
          </span>
        )}

        {/* Popover for other memberships */}
        {showPopover && hasOtherMemberships && popoverPosition && (
          <div
            data-testid={`membership-popover-${nodeId}`}
            style={{
              position: 'fixed',
              top: popoverPosition.top,
              left: popoverPosition.left,
              background: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              padding: 8,
              zIndex: 100,
              minWidth: 140,
              fontSize: 11,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 600, marginBottom: 6, color: '#374151' }}>Also in:</div>
            {otherAreas.map((area) => {
              const color = runtimeState.get(area.id)?.color ?? '#6b7280';
              const isCurrentArea = area.id === areaId;
              return (
                <div
                  key={area.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '3px 0',
                    opacity: isCurrentArea ? 0.5 : 1,
                  }}
                >
                  <span
                    style={{
                      display: 'inline-block',
                      background: `${color}26`,
                      color,
                      fontSize: 10,
                      padding: '1px 6px',
                      borderRadius: 9,
                      fontWeight: 500,
                    }}
                  >
                    {area.name}
                  </span>
                  <button
                    data-testid={`popover-remove-${nodeId}-${area.id}`}
                    onClick={() => {
                      onRemoveMember?.(area.id, nodeId);
                      setPopoverNodeId(null);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#ef4444',
                      cursor: 'pointer',
                      fontSize: 10,
                      padding: '1px 4px',
                    }}
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderRow = (area: Area, depth: number) => {
    const color = runtimeState.get(area.id)?.color ?? '#6b7280';
    const expanded = isExpanded(area.id);
    const hasChildren = area.children.length > 0;
    const hasMembers = area.contains.length > 0;

    return (
      <React.Fragment key={area.id}>
        <div
          data-testid={`area-row-${area.id}`}
          data-droppable={area.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 8px',
            borderBottom: '1px solid #f0f0f0',
            fontSize: 12,
            paddingLeft: 12 + depth * 20,
          }}
        >
          {/* Expand caret */}
          <span
            data-testid={`expand-caret-${area.id}`}
            onClick={() => toggleExpanded(area.id)}
            style={{
              cursor: (hasChildren || hasMembers) ? 'pointer' : 'default',
              fontSize: 8,
              width: 14,
              textAlign: 'center',
              flexShrink: 0,
              color: (hasChildren || hasMembers) ? '#374151' : '#d1d5db',
              userSelect: 'none',
            }}
          >
            {(hasChildren || hasMembers) ? (expanded ? '▼' : '▶') : ''}
          </span>

          {/* Name */}
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>
            {area.name}
          </span>

          {/* Type pill */}
          <span
            data-testid={`type-pill-${area.id}`}
            style={{
              display: 'inline-block',
              background: `${color}26`,
              color: color,
              fontSize: 10,
              padding: '2px 8px',
              borderRadius: 9,
              fontWeight: 500,
              cursor: 'pointer',
              flexShrink: 0,
            }}
            title="Click to edit type"
            onClick={() => {
              const types = ['business_domain', 'utils', 'external_service', 'internal_service', 'library', 'entrypoint'];
              const currentIdx = types.indexOf(area.type);
              const nextType = types[(currentIdx + 1) % types.length];
              onChangeType?.(area.id, nextType);
            }}
          >
            {area.type}
          </span>

          {/* Members count */}
          <span style={{ color: '#9ca3af', fontSize: 11, flexShrink: 0, width: 30, textAlign: 'right' }}>
            {area.contains.length}
          </span>

          {/* Actions */}
          <span style={{ flexShrink: 0, display: 'flex', gap: 4 }}>
            <button
              data-testid={`rename-area-${area.id}`}
              onClick={() => onRenameArea?.(area.id, area.name)}
              style={{
                background: 'none',
                border: 'none',
                color: '#6b7280',
                cursor: 'pointer',
                fontSize: 11,
                padding: '2px 4px',
              }}
              title="Rename"
            >
              ✏️
            </button>
            <button
              data-testid={`delete-area-${area.id}`}
              onClick={() => onDeleteArea?.(area.id)}
              style={{
                background: 'none',
                border: 'none',
                color: '#ef4444',
                cursor: 'pointer',
                fontSize: 11,
                padding: '2px 4px',
              }}
              title="Delete"
            >
              🗑️
            </button>
          </span>
        </div>

        {/* Expanded content: children + member rows */}
        {expanded && (
          <>
            {/* Child areas */}
            {area.children
              .map((childId) => areasById.get(childId))
              .filter(Boolean)
              .map((child) => renderRow(child as Area, depth + 1))}

            {/* Member nodes (duplicate-row model) */}
            {area.contains.map((nodeId) => renderMemberRow(nodeId, area.id, depth))}
          </>
        )}
      </React.Fragment>
    );
  };

  return (
    <div data-testid="area-tree-table">
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 8px',
          borderBottom: '2px solid #e5e7eb',
          fontSize: 11,
          fontWeight: 600,
          color: '#6b7280',
          paddingLeft: 12,
        }}
      >
        <span style={{ width: 14, flexShrink: 0 }} />
        <span style={{ flex: 1 }}>Name</span>
        <span style={{ flexShrink: 0, width: 'auto', minWidth: 80 }}>Type</span>
        <span style={{ flexShrink: 0, width: 30, textAlign: 'right' }}>Members</span>
        <span style={{ flexShrink: 0, width: 48 }} />
      </div>

      {topLevel.length === 0 ? (
        <div style={{ fontSize: 12, color: '#9ca3af', padding: '24px 12px', textAlign: 'center' }}>
          No areas yet. Create your first area.
        </div>
      ) : (
        topLevel.map((area) => renderRow(area, 0))
      )}
    </div>
  );
}