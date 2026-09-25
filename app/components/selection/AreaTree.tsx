'use client';

import { useState, useMemo } from 'react';
import { useSelection } from '@/app/contexts/SelectionContext';
import { useAreaStore } from '@/app/contexts/AreaContext';
import { getDescendantIds } from '@/lib/areas/containment';
import type { AnalysisNode } from '@/lib/analysis/types';
import type { Area } from '@/lib/areas/types';

interface AreaTreeProps {
  nodes: AnalysisNode[];
}

function truncatePath(filePath: string): string {
  const parts = filePath.split('/');
  return parts[parts.length - 1];
}

/**
 * Renders the area tree with tri-state checkboxes and member selection.
 *
 * @remarks
 * Displays areas hierarchically with expand/collapse, tri-state
 * selection (checked / indeterminate / unchecked), and per-member
 * checkboxes. Area membership is part of the derived selection:
 * checking an area selects all its members; unchecking an individual
 * member puts it in excludedNodeIds.
 *
 * @param nodes - Analysis nodes for area membership display.
 */
export default function AreaTree({ nodes }: AreaTreeProps) {
  const { state, toggleArea, toggleNode } = useSelection();
  const { selectedAreaIds, excludedNodeIds } = state;
  const { areas, runtimeState } = useAreaStore();

  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set());

  const nodesBySymbol = useMemo(() => {
    const map = new Map<string, AnalysisNode>();
    for (const n of nodes) map.set(n.scipSymbol, n);
    return map;
  }, [nodes]);

  const areasById = useMemo(() => {
    const map = new Map<string, Area>();
    for (const a of areas) map.set(a.id, a);
    return map;
  }, [areas]);

  const topLevelAreas = useMemo(
    () => areas.filter((a) => a.parent === null).sort((a, b) => a.name.localeCompare(b.name)),
    [areas],
  );

  /**
   * Gets all descendant member node IDs for an area (its own contains
   * plus all descendants' contains).
   */
  const getAllDescendantMemberIds = (areaId: string): Set<string> => {
    const area = areasById.get(areaId);
    if (!area) return new Set();
    const ids = new Set(area.contains);
    for (const descId of getDescendantIds(areas, areaId)) {
      const desc = areasById.get(descId);
      if (desc) {
        for (const nid of desc.contains) ids.add(nid);
      }
    }
    return ids;
  };

  /**
   * Determines the tri-state of an area checkbox:
   * - 'checked' when every member is selected
   * - 'indeterminate' when some but not all members are selected
   * - 'unchecked' when no members are selected
   */
  const getAreaCheckState = (areaId: string): 'checked' | 'indeterminate' | 'unchecked' => {
    const memberIds = getAllDescendantMemberIds(areaId);
    if (memberIds.size === 0) return 'unchecked';

    let selectedCount = 0;
    for (const id of memberIds) {
      if (state.selectedNodeIds.has(id)) selectedCount++;
    }

    if (selectedCount === memberIds.size) return 'checked';
    if (selectedCount > 0) return 'indeterminate';
    return 'unchecked';
  };

  const toggleExpanded = (areaId: string) => {
    setExpandedAreas((prev) => {
      const next = new Set(prev);
      if (next.has(areaId)) next.delete(areaId);
      else next.add(areaId);
      return next;
    });
  };

  const renderArea = (area: Area, depth: number) => {
    const color = runtimeState.get(area.id)?.color ?? '#6b7280';
    const isExpanded = expandedAreas.has(area.id);
    const childAreas = area.children
      .map((id) => areasById.get(id))
      .filter(Boolean) as Area[];
    const memberNodeIds = getAllDescendantMemberIds(area.id);
    const hasChildren = childAreas.length > 0;
    const hasMembers = memberNodeIds.size > 0;
    const isExpandable = hasChildren;
    const checkState = getAreaCheckState(area.id);
    const isChecked = checkState === 'checked';

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
              checked={isChecked}
              ref={(el) => { if (el) el.indeterminate = checkState === 'indeterminate'; }}
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
            <span style={{ fontSize: 10, color: '#9ca3af', flexShrink: 0 }}>
              ({hasMembers ? memberNodeIds.size : 0})
            </span>
          </label>
        </div>

        {isExpanded && (
          <div style={{ paddingLeft: 16 }}>
            {childAreas.sort((a, b) => a.name.localeCompare(b.name)).map((child) => renderArea(child, depth + 1))}
            {/* Direct member nodes of this area (not descendant areas' members) */}
            {area.contains.map((nodeId) => {
              const node = nodesBySymbol.get(nodeId);
              if (!node) return null;
              const isSelected = state.selectedNodeIds.has(nodeId);
              const isExcluded = excludedNodeIds.has(nodeId);
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
                    opacity: isExcluded ? 0.5 : 1,
                    fontSize: 11,
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    toggleNode(nodeId);
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
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