'use client';

import React, { useState } from 'react';
import type { Area, AreaRuntimeState } from '@/lib/areas/types';

interface AreaTreeTableProps {
  areas: Area[];
  runtimeState: Map<string, AreaRuntimeState>;
  onRenameArea?: (areaId: string, newName: string) => void;
  onDeleteArea?: (areaId: string) => void;
  onChangeType?: (areaId: string, newType: string) => void;
}

export default function AreaTreeTable({
  areas,
  runtimeState,
  onRenameArea,
  onDeleteArea,
  onChangeType,
}: AreaTreeTableProps) {
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set());

  const areasById = new Map<string, Area>();
  for (const a of areas) areasById.set(a.id, a);

  const topLevel = areas.filter((a) => a.parent === null);

  const toggleExpanded = (areaId: string) => {
    setExpandedAreas((prev) => {
      const next = new Set(prev);
      if (next.has(areaId)) next.delete(areaId);
      else next.add(areaId);
      return next;
    });
  };

  const isExpanded = (areaId: string) => expandedAreas.has(areaId);

  const renderRow = (area: Area, depth: number) => {
    const color = runtimeState.get(area.id)?.color ?? '#6b7280';
    const expanded = isExpanded(area.id);
    const hasChildren = area.children.length > 0;

    return (
      <React.Fragment key={area.id}>
        <div
          data-testid={`area-row-${area.id}`}
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
              cursor: hasChildren ? 'pointer' : 'default',
              fontSize: 8,
              width: 14,
              textAlign: 'center',
              flexShrink: 0,
              color: hasChildren ? '#374151' : '#d1d5db',
              userSelect: 'none',
            }}
          >
            {hasChildren ? (expanded ? '▼' : '▶') : ''}
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

        {/* Children */}
        {expanded && hasChildren && area.children
          .map((childId) => areasById.get(childId))
          .filter(Boolean)
          .map((child) => renderRow(child as Area, depth + 1))
        }
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