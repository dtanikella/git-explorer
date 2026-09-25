'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import type { Area, AreaRuntimeState } from '@/lib/areas/types';
import type { SyntaxType } from '@/lib/analysis/types';
import { computeRollupMemberCounts } from '@/lib/areas/containment';
import { getAreaColor, deriveBorderColor } from '@/lib/areas/color';
import { SYNTAX_TYPE_LABELS, SYNTAX_TYPE_BADGE_COLORS } from '@/lib/analysis/syntax-type-labels';
import PinZonePicker from './PinZonePicker';

const PRESET_COLORS = [
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#eab308',
  '#84cc16',
  '#10b981',
  '#06b6d4',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#d946ef',
  '#ec4899',
  '#78716c',
  '#0f172a',
];

const HEX_PATTERN = /^#?[0-9a-fA-F]{6}$/;

function normalizeHex(value: string): string | null {
  const trimmed = value.trim();
  if (!HEX_PATTERN.test(trimmed)) return null;
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
}

interface AreaTreeTableProps {
  areas: Area[];
  runtimeState: Map<string, AreaRuntimeState>;
  nodeNames?: Record<string, string>;
  nodeTypes?: Record<string, SyntaxType>;
  renameAreaId?: string | null;
  renameValue?: string;
  onRenameStart?: (areaId: string, currentName: string) => void;
  onRenameConfirm?: () => void;
  onRenameCancel?: () => void;
  onRenameKeyDown?: (e: React.KeyboardEvent) => void;
  onRenameValueChange?: (value: string) => void;
  onDeleteStart?: (areaId: string) => void;
  onAddChildArea?: (parentId: string) => void;
  onChangeType?: (areaId: string, newType: string) => void;
  onRemoveMember?: (areaId: string, nodeId: string) => void;
  onTogglePinZone?: (areaId: string, zones: number[]) => void;
  onSetAreaColor?: (areaId: string, color: string) => void;
  createParentId?: string | null;
  newChildAreaName?: string;
  onNewChildAreaNameChange?: (value: string) => void;
  onConfirmCreateChild?: () => void;
  onCancelCreateChild?: () => void;
  onCreateChildKeyDown?: (e: React.KeyboardEvent) => void;
}

function truncatePath(filePath: string): string {
  const parts = filePath.split('/');
  return parts[parts.length - 1];
}

function DraggableMemberRow({
  nodeId,
  areaId,
  depth,
  children,
}: {
  nodeId: string;
  areaId: string;
  depth: number;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `member-drag-${areaId}-${nodeId}`,
    data: { type: 'node', nodeId, areaId },
  });

  return (
    <div
      ref={setNodeRef}
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
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      <span
        {...listeners}
        {...attributes}
        title="Drag to move to another area"
        style={{ width: 14, flexShrink: 0, textAlign: 'center', cursor: 'grab', color: '#d1d5db', fontSize: 9, touchAction: 'none' }}
      >
        ⠿
      </span>
      {children}
    </div>
  );
}

function DroppableAreaRow({
  area,
  depth,
  children,
}: {
  area: Area;
  depth: number;
  children: React.ReactNode;
}) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `area-${area.id}`,
    data: { type: 'area', areaId: area.id },
  });
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `area-drag-${area.id}`,
    data: { type: 'area', areaId: area.id, area },
  });

  return (
    <div
      ref={(el) => {
        setDropRef(el);
        setDragRef(el);
      }}
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
        background: isOver ? '#eff6ff' : 'transparent',
        boxShadow: isOver ? 'inset 0 0 0 1px #3b82f6' : 'none',
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      <span
        {...listeners}
        {...attributes}
        title="Drag to reparent"
        style={{ cursor: 'grab', color: '#d1d5db', fontSize: 10, flexShrink: 0, touchAction: 'none' }}
      >
        ⠿
      </span>
      {children}
    </div>
  );
}

/**
 * Interactive table for viewing and managing the area tree hierarchy.
 *
 * @remarks
 * Displays areas with their members, visibility toggles, and color
 * swatches. Supports drag-and-drop reordering and area membership
 * management.
 */
export default function AreaTreeTable({
  areas,
  runtimeState,
  nodeNames = {},
  nodeTypes = {},
  renameAreaId,
  renameValue,
  onRenameStart,
  onRenameConfirm,
  onRenameCancel,
  onRenameKeyDown,
  onRenameValueChange,
  onDeleteStart,
  onAddChildArea,
  onChangeType,
  onRemoveMember,
  onTogglePinZone,
  onSetAreaColor,
  createParentId,
  newChildAreaName,
  onNewChildAreaNameChange,
  onConfirmCreateChild,
  onCancelCreateChild,
  onCreateChildKeyDown,
}: AreaTreeTableProps) {
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set());
  const [popoverNodeId, setPopoverNodeId] = useState<string | null>(null);
  const [popoverPosition, setPopoverPosition] = useState<{ top: number; left: number } | null>(null);
  const [colorPopoverAreaId, setColorPopoverAreaId] = useState<string | null>(null);
  const [colorPopoverPosition, setColorPopoverPosition] = useState<{ top: number; left: number } | null>(null);
  const [colorPopoverHexValue, setColorPopoverHexValue] = useState<string>('');

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

  const rollupMemberCounts = useMemo(() => computeRollupMemberCounts(areas), [areas]);

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

  const handleColorSwatchClick = useCallback((areaId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    setColorPopoverPosition({ top: rect.bottom + 4, left: rect.left });
    if (colorPopoverAreaId === areaId) {
      setColorPopoverAreaId(null);
    } else {
      setColorPopoverAreaId(areaId);
      setColorPopoverHexValue('');
    }
  }, [colorPopoverAreaId]);

  const handleColorPresetSelect = useCallback((hex: string) => {
    if (colorPopoverAreaId) {
      onSetAreaColor?.(colorPopoverAreaId, hex);
      setColorPopoverAreaId(null);
    }
  }, [colorPopoverAreaId, onSetAreaColor]);

  const handleColorHexCommit = useCallback(() => {
    if (!colorPopoverAreaId) return;
    const normalized = normalizeHex(colorPopoverHexValue);
    if (normalized) {
      onSetAreaColor?.(colorPopoverAreaId, normalized);
      setColorPopoverAreaId(null);
    }
  }, [colorPopoverAreaId, colorPopoverHexValue, onSetAreaColor]);

  const handleColorHexChange = useCallback((value: string) => {
    setColorPopoverHexValue(value);
    // Live preview: if valid hex, update immediately
    const normalized = normalizeHex(value);
    if (normalized && colorPopoverAreaId) {
      onSetAreaColor?.(colorPopoverAreaId, normalized);
    }
  }, [colorPopoverAreaId, onSetAreaColor]);

  const handleColorHexKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleColorHexCommit();
    }
  }, [handleColorHexCommit]);

  const handlePopoverClick = useCallback((nodeId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    setPopoverPosition({ top: rect.bottom + 4, left: rect.left });
    setPopoverNodeId(popoverNodeId === nodeId ? null : nodeId);
  }, [popoverNodeId]);

  const isExpanded = (areaId: string) => expandedAreas.has(areaId);

  const renderMemberRow = (nodeId: string, areaId: string, depth: number) => {
    const nodeName = nodeNames[nodeId] ?? nodeId;
    const nodeType = nodeTypes[nodeId];
    const otherAreas = nodeToAreas.get(nodeId)?.filter((a) => a.id !== areaId) ?? [];
    const hasOtherMemberships = otherAreas.length > 0;
    const showPopover = popoverNodeId === nodeId;

    return (
      <DraggableMemberRow key={`${areaId}-${nodeId}`} nodeId={nodeId} areaId={areaId} depth={depth}>
        {nodeType && (
          <span
            title={SYNTAX_TYPE_LABELS[nodeType]}
            style={{
              fontSize: 8,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.3px',
              padding: '1px 4px',
              borderRadius: 4,
              flexShrink: 0,
              color: SYNTAX_TYPE_BADGE_COLORS[nodeType],
              background: `${SYNTAX_TYPE_BADGE_COLORS[nodeType]}1a`,
            }}
          >
            {SYNTAX_TYPE_LABELS[nodeType]}
          </span>
        )}
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {truncatePath(nodeName)}
        </span>
        <button
          data-testid={`remove-member-${areaId}-${nodeId}`}
          onClick={(e) => {
            e.stopPropagation();
            onRemoveMember?.(areaId, nodeId);
          }}
          title="Remove from this area"
          style={{
            background: 'none',
            border: 'none',
            color: '#d1d5db',
            cursor: 'pointer',
            fontSize: 12,
            padding: '1px 4px',
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          ×
        </button>
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
              const color = getAreaColor(area);
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
      </DraggableMemberRow>
    );
  };

  const renderRow = (area: Area, depth: number) => {
    const color = getAreaColor(area);
    const expanded = isExpanded(area.id);
    const hasChildren = area.children.length > 0;
    const hasMembers = area.contains.length > 0;
    const isRenaming = renameAreaId === area.id;

    return (
      <React.Fragment key={area.id}>
        <DroppableAreaRow area={area} depth={depth}>
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

          {/* Color swatch */}
          <span
            data-testid={`color-swatch-${area.id}`}
            onClick={(e) => handleColorSwatchClick(area.id, e)}
            title="Click to set area color"
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              flexShrink: 0,
              cursor: 'pointer',
              background: color,
              boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.12)',
            }}
          />

          {/* Name or rename input */}
          {isRenaming ? (
            <input
              data-testid={`inline-rename-input-${area.id}`}
              autoFocus
              value={renameValue ?? area.name}
              onChange={(e) => onRenameValueChange?.(e.target.value)}
              onKeyDown={onRenameKeyDown}
              onBlur={onRenameConfirm}
              style={{
                flex: 1,
                padding: '3px 6px',
                fontSize: 12,
                border: '1px solid #3b82f6',
                borderRadius: 4,
                outline: 'none',
              }}
            />
          ) : (
            <span
              data-testid={`area-name-${area.id}`}
              onClick={() => onRenameStart?.(area.id, area.name)}
              title="Click to rename"
              style={{
                flex: 1,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                fontWeight: 500,
                cursor: 'text',
              }}
            >
              {area.name}
            </span>
          )}

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

          {/* Members count (rolled up to include descendants) */}
          <span style={{ color: '#9ca3af', fontSize: 11, flexShrink: 0, width: 30, textAlign: 'right' }}>
            {rollupMemberCounts.get(area.id) ?? area.contains.length}
          </span>

          {/* Pin zone picker */}
          <span style={{ flexShrink: 0, width: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <PinZonePicker
              areaId={area.id}
              value={area.pinnedZones ?? []}
              onChange={(zones) => onTogglePinZone?.(area.id, zones)}
            />
          </span>

          {/* Actions */}
          <span style={{ flexShrink: 0, display: 'flex', gap: 4 }}>
            <button
              data-testid={`add-child-area-${area.id}`}
              onClick={() => onAddChildArea?.(area.id)}
              style={{
                background: 'none',
                border: 'none',
                color: '#6b7280',
                cursor: 'pointer',
                fontSize: 13,
                padding: '2px 4px',
                lineHeight: 1,
              }}
              title="Add child area"
            >
              +
            </button>
            <button
              data-testid={`delete-area-${area.id}`}
              onClick={() => onDeleteStart?.(area.id)}
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
        </DroppableAreaRow>

        {/* Color popover */}
        {colorPopoverAreaId === area.id && colorPopoverPosition && (
          <div
            data-testid={`color-popover-${area.id}`}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: colorPopoverPosition.top,
              left: colorPopoverPosition.left,
              background: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: 10,
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              padding: 14,
              zIndex: 100,
              width: 226,
              fontSize: 11,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#6b7280', marginBottom: 8 }}>
              Area color
            </div>
            {/* Preset swatches: 7x2 grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 10 }}>
              {PRESET_COLORS.map((presetHex) => (
                <span
                  key={presetHex}
                  onClick={() => handleColorPresetSelect(presetHex)}
                  role="button"
                  aria-label={`Color ${presetHex}`}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    cursor: 'pointer',
                    background: presetHex,
                    boxShadow: presetHex === color
                      ? '0 0 0 2px white, 0 0 0 4px #374151'
                      : 'inset 0 0 0 1px rgba(0,0,0,0.12)',
                  }}
                />
              ))}
            </div>
            {/* Hex input */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#6b7280', marginBottom: 10 }}>
              <input
                data-testid={`color-hex-input-${area.id}`}
                type="text"
                value={colorPopoverHexValue}
                onChange={(e) => handleColorHexChange(e.target.value)}
                onKeyDown={handleColorHexKeyDown}
                onBlur={handleColorHexCommit}
                placeholder={color}
                style={{
                  flex: 1,
                  fontFamily: 'ui-monospace, "SF Mono", monospace',
                  fontSize: 12,
                  padding: '5px 8px',
                  border: '1px solid #e5e7eb',
                  borderRadius: 6,
                  color: '#374151',
                  background: '#f9fafb',
                  outline: 'none',
                }}
              />
            </div>
            {/* Border preview */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 10, borderTop: '1px solid #e5e7eb' }}>
              <div
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 4,
                  flexShrink: 0,
                  background: color,
                  border: `2.5px solid ${deriveBorderColor(color)}`,
                }}
              />
              <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.35 }}>
                Border auto-derives: <b style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 600 }}>{deriveBorderColor(color)}</b> (35% darker)
              </div>
            </div>
          </div>
        )}

        {/* Inline child-area creation row */}
        {createParentId === area.id && (
          <div
            data-testid={`inline-create-child-row-${area.id}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 8px',
              paddingLeft: 12 + (depth + 1) * 20,
              borderBottom: '1px solid #e5e7eb',
              background: '#f0fdf4',
            }}
          >
            <span style={{ width: 14, flexShrink: 0, color: '#22c55e', fontSize: 8 }}>▶</span>
            <input
              data-testid={`inline-create-child-input-${area.id}`}
              autoFocus
              value={newChildAreaName ?? ''}
              onChange={(e) => onNewChildAreaNameChange?.(e.target.value)}
              onKeyDown={onCreateChildKeyDown}
              placeholder="Area name..."
              style={{
                flex: 1,
                padding: '4px 8px',
                fontSize: 12,
                border: '1px solid #22c55e',
                borderRadius: 6,
                outline: 'none',
              }}
            />
            <button
              data-testid={`inline-create-child-confirm-${area.id}`}
              onClick={onConfirmCreateChild}
              disabled={!newChildAreaName?.trim()}
              style={{
                padding: '4px 10px',
                fontSize: 11,
                background: newChildAreaName?.trim() ? '#22c55e' : '#d1d5db',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: newChildAreaName?.trim() ? 'pointer' : 'default',
              }}
            >
              Create
            </button>
            <button
              data-testid={`inline-create-child-cancel-${area.id}`}
              onClick={onCancelCreateChild}
              style={{
                padding: '4px 10px',
                fontSize: 11,
                background: 'white',
                color: '#374151',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        )}

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
        <span style={{ flexShrink: 0, width: 36, textAlign: 'center' }}>Pin</span>
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