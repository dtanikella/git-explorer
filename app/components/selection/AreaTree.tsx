'use client';

import { useState, useMemo } from 'react';
import { useSelection } from '@/app/contexts/SelectionContext';
import { useAreaStore } from '@/app/contexts/AreaContext';
import type { AnalysisNode } from '@/lib/analysis/types';

interface AreaTreeProps {
  nodes: AnalysisNode[];
}

function truncatePath(filePath: string): string {
  const parts = filePath.split('/');
  return parts[parts.length - 1];
}

export default function AreaTree({ nodes }: AreaTreeProps) {
  const { state, toggleArea, toggleAreaMember } = useSelection();
  const { selectedAreaIds, expansions } = state;
  const { areas, runtimeState } = useAreaStore();

  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set());

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

  const topLevelAreas = useMemo(
    () => areas.filter((a) => a.parent === null).sort((a, b) => a.name.localeCompare(b.name)),
    [areas],
  );

  const areaMembersGroup = expansions.get('area-members');

  const toggleExpanded = (areaId: string) => {
    setExpandedAreas((prev) => {
      const next = new Set(prev);
      if (next.has(areaId)) next.delete(areaId);
      else next.add(areaId);
      return next;
    });
  };

  const renderArea = (area: typeof areas[number], depth: number) => {
    const color = runtimeState.get(area.id)?.color ?? '#6b7280';
    const isSelected = selectedAreaIds.has(area.id);
    const isExpanded = expandedAreas.has(area.id);
    const childAreas = area.children
      .map((id) => areasById.get(id))
      .filter(Boolean) as typeof areas[number][];
    const memberNodeIds = area.contains;
    const hasChildren = childAreas.length > 0;
    const hasMembers = memberNodeIds.length > 0;
    const isExpandable = hasChildren || hasMembers;

    return (
      <div key={area.id} style={{ marginLeft: depth > 0 ? 12 : 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '3px 0',
            fontSize: 12,
          }}
        >
          <span
            onClick={() => isExpandable && toggleExpanded(area.id)}
            style={{
              cursor: isExpandable ? 'pointer' : 'default',
              fontSize: 8,
              userSelect: 'none',
              width: 10,
              textAlign: 'center',
              flexShrink: 0,
              color: isExpandable ? '#374151' : '#d1d5db',
            }}
          >
            {isExpandable ? (isExpanded ? '▼' : '▶') : ''}
          </span>
          <label
            style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', flex: 1, minWidth: 0 }}
            onClick={(e) => {
              e.preventDefault();
              toggleArea(area.id);
            }}
          >
            <input
              type="checkbox"
              checked={isSelected}
              readOnly
              style={{ margin: 0, cursor: 'pointer', flexShrink: 0 }}
            />
            <span
              style={{
                display: 'inline-block',
                background: `${color}26`,
                color,
                fontSize: 10,
                padding: '2px 8px',
                borderRadius: 9,
                fontWeight: 500,
                flexShrink: 0,
              }}
            >
              {area.name}
            </span>
            <span style={{ fontSize: 10, color: '#9ca3af', flexShrink: 0 }}>({memberNodeIds.length})</span>
          </label>
        </div>

        {isExpanded && (
          <div style={{ paddingLeft: 16 }}>
            {childAreas.sort((a, b) => a.name.localeCompare(b.name)).map((child) => renderArea(child, depth + 1))}
            {memberNodeIds.map((nodeId) => {
              const node = nodesBySymbol.get(nodeId);
              if (!node) return null;
              const isDisabled = areaMembersGroup?.disabledIds.has(nodeId) ?? false;
              return (
                <label
                  key={nodeId}
                  data-testid={`area-member-${area.id}-${nodeId}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '2px 0',
                    cursor: 'pointer',
                    opacity: isDisabled ? 0.5 : 1,
                    fontSize: 11,
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    toggleAreaMember(nodeId);
                  }}
                >
                  <input
                    type="checkbox"
                    checked={!isDisabled}
                    readOnly
                    style={{ margin: 0, cursor: 'pointer' }}
                  />
                  <span>{node.name}</span>
                  <span style={{ fontSize: 10, color: '#9ca3af' }} title={node.filePath}>
                    {truncatePath(node.filePath)}
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  if (topLevelAreas.length === 0) {
    return (
      <div style={{ fontSize: 11, color: '#9ca3af', padding: '4px 0' }}>
        No areas defined.
      </div>
    );
  }

  return (
    <div>
      {topLevelAreas.map((area) => renderArea(area, 0))}
    </div>
  );
}
