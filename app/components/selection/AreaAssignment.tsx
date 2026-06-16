'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { useAreaStore } from '@/app/contexts/AreaContext';
import type { Area, AreaType } from '@/lib/areas/types';
import { AREA_TYPES } from '@/lib/areas/types';

interface AreaAssignmentProps {
  effectiveNodeIds: string[];
  repoPath: string;
}

type SaveStatus = 'idle' | 'saving' | 'success' | 'error';

const NEW_AREA_SENTINEL = '__new__';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function generateAreaId(name: string): string {
  const slug = slugify(name);
  const suffix = Math.random().toString(16).slice(2, 6);
  return `${slug}-${suffix}`;
}

export default function AreaAssignment({ effectiveNodeIds, repoPath }: AreaAssignmentProps) {
  const { areas, runtimeState, getAreasForNode, setAreas } = useAreaStore();

  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<AreaType>('business_domain');
  const [newParent, setNewParent] = useState<string | null>(null);
  const [newChildren, setNewChildren] = useState<string[]>([]);

  useEffect(() => {
    if (saveStatus === 'success') {
      const timer = setTimeout(() => setSaveStatus('idle'), 2000);
      return () => clearTimeout(timer);
    }
  }, [saveStatus]);

  const commonAreas = useMemo(() => {
    if (effectiveNodeIds.length === 0) return [];
    const areasByNode = effectiveNodeIds.map((id) => getAreasForNode(id));
    if (areasByNode.length === 0) return [];
    const firstSet = new Set(areasByNode[0].map((a) => a.id));
    for (let i = 1; i < areasByNode.length; i++) {
      const nodeAreaIds = new Set(areasByNode[i].map((a) => a.id));
      for (const id of firstSet) {
        if (!nodeAreaIds.has(id)) firstSet.delete(id);
      }
    }
    return areas.filter((a) => firstSet.has(a.id));
  }, [effectiveNodeIds, getAreasForNode, areas]);

  const isNewArea = selectedAreaId === NEW_AREA_SENTINEL;
  const hasNodes = effectiveNodeIds.length > 0;
  const availableChildAreas = useMemo(() => areas.filter((area) => area.id !== newParent), [areas, newParent]);
  const canSubmit = hasNodes && (isNewArea ? newName.trim().length > 0 : selectedAreaId !== null);

  const saveAreaFile = useCallback(async (updatedAreas: Area[]) => {
    setSaveStatus('saving');
    setErrorMessage(null);
    try {
      const res = await fetch('/api/areas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          repoPath,
          data: { version: 1, areas: updatedAreas },
        }),
      });
      const result = await res.json();
      if (!result.success) {
        throw new Error(result.error || 'Save failed');
      }
      setAreas(updatedAreas);
      setSaveStatus('success');
    } catch (err) {
      setSaveStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Save failed');
    }
  }, [repoPath, setAreas]);

  const handleAddToExisting = useCallback(async () => {
    if (!selectedAreaId || selectedAreaId === NEW_AREA_SENTINEL) return;
    const now = new Date().toISOString();
    const updatedAreas = areas.map((a) => {
      if (a.id !== selectedAreaId) return a;
      const mergedContains = [...new Set([...a.contains, ...effectiveNodeIds])];
      return { ...a, contains: mergedContains, updated_at: now };
    });
    await saveAreaFile(updatedAreas);
  }, [selectedAreaId, areas, effectiveNodeIds, saveAreaFile]);

  const handleCreateNew = useCallback(async () => {
    if (!newName.trim()) return;
    if (newParent && newChildren.includes(newParent)) {
      setSaveStatus('error');
      setErrorMessage('Parent cannot also be a child');
      return;
    }
    const now = new Date().toISOString();
    const newArea: Area = {
      id: generateAreaId(newName),
      created_at: now,
      updated_at: now,
      name: newName.trim(),
      type: newType,
      contains: [...effectiveNodeIds],
      parent: newParent,
      children: [...newChildren],
      clusterStrength: 0,
    };

    let updatedAreas = [...areas, newArea];
    if (newParent) {
      updatedAreas = updatedAreas.map((a) => {
        if (a.id !== newParent) return a;
        return { ...a, children: [...new Set([...a.children, newArea.id])], updated_at: now };
      });
    }
    for (const childId of newChildren) {
      updatedAreas = updatedAreas.map((a) => {
        if (a.id !== childId) return a;
        return { ...a, parent: newArea.id, updated_at: now };
      });
    }

    await saveAreaFile(updatedAreas);
    setNewName('');
    setNewType('business_domain');
    setNewParent(null);
    setNewChildren([]);
    setSelectedAreaId(null);
  }, [newName, newType, newParent, newChildren, areas, effectiveNodeIds, saveAreaFile]);

  const handleAction = useCallback(() => {
    if (isNewArea) {
      handleCreateNew();
    } else {
      handleAddToExisting();
    }
  }, [isNewArea, handleCreateNew, handleAddToExisting]);

  return (
    <div
      style={{
        padding: '10px 12px',
        background: '#f3f4f6',
        borderTop: '2px solid #e5e7eb',
      }}
    >
      <div
        style={{
          fontWeight: 600,
          fontSize: 11,
          color: '#374151',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: 8,
        }}
      >
        Assign to Area
      </div>

      {commonAreas.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 10, color: '#6b7280' }}>Common areas:</span>
          {commonAreas.map((area) => {
            const areaColor = runtimeState.get(area.id)?.color ?? '#6b7280';
            return (
              <span
                key={area.id}
                data-testid={`common-area-badge-${area.id}`}
                style={{
                  display: 'inline-block',
                  background: `${areaColor}26`,
                  color: areaColor,
                  fontSize: 10,
                  padding: '1px 6px',
                  borderRadius: 9,
                  marginLeft: 4,
                  fontWeight: 500,
                }}
              >
                {area.name}
              </span>
            );
          })}
        </div>
      )}

      <select
        data-testid="area-picker"
        value={selectedAreaId ?? ''}
        onChange={(e) => setSelectedAreaId(e.target.value || null)}
        style={{
          width: '100%',
          border: '1px solid #d1d5db',
          borderRadius: 6,
          padding: '6px 10px',
          fontSize: 12,
          background: 'white',
          marginBottom: isNewArea ? 10 : 8,
          color: selectedAreaId ? '#374151' : '#9ca3af',
        }}
      >
        <option value="">Select an area…</option>
        {areas.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
        <option value={NEW_AREA_SENTINEL}>+ New Area</option>
      </select>

      {isNewArea && (
        <div
          style={{
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: 6,
            padding: 10,
            marginBottom: 8,
          }}
        >
          <div style={{ marginBottom: 6 }}>
            <label style={{ fontSize: 10, color: '#6b7280', display: 'block', marginBottom: 2 }}>
              Name *
            </label>
            <input
              data-testid="new-area-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g., Config Pipeline"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                border: '1px solid #d1d5db',
                borderRadius: 4,
                padding: '5px 8px',
                fontSize: 12,
              }}
            />
          </div>

          <div style={{ marginBottom: 6 }}>
            <label style={{ fontSize: 10, color: '#6b7280', display: 'block', marginBottom: 2 }}>
              Type
            </label>
            <select
              data-testid="new-area-type"
              value={newType}
              onChange={(e) => setNewType(e.target.value as AreaType)}
              style={{
                width: '100%',
                border: '1px solid #d1d5db',
                borderRadius: 4,
                padding: '5px 8px',
                fontSize: 12,
                background: 'white',
              }}
            >
              {AREA_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 6 }}>
            <label style={{ fontSize: 10, color: '#6b7280', display: 'block', marginBottom: 2 }}>
              Parent
            </label>
            <select
              data-testid="new-area-parent"
              value={newParent ?? ''}
              onChange={(e) => {
                const parentId = e.target.value || null;
                setNewParent(parentId);
                if (parentId) {
                  setNewChildren((currentChildren) => currentChildren.filter((childId) => childId !== parentId));
                }
              }}
              style={{
                width: '100%',
                border: '1px solid #d1d5db',
                borderRadius: 4,
                padding: '5px 8px',
                fontSize: 12,
                background: 'white',
              }}
            >
              <option value="">None</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 2 }}>
            <label style={{ fontSize: 10, color: '#6b7280', display: 'block', marginBottom: 2 }}>
              Children
            </label>
            <select
              data-testid="new-area-children"
              multiple
              value={newChildren}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions, (o) => o.value);
                setNewChildren(selected);
              }}
              style={{
                width: '100%',
                border: '1px solid #d1d5db',
                borderRadius: 4,
                padding: '5px 8px',
                fontSize: 12,
                background: 'white',
                minHeight: 48,
              }}
            >
              {availableChildAreas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          data-testid="area-action-button"
          onClick={handleAction}
          disabled={!canSubmit || saveStatus === 'saving'}
          style={{
            flex: 1,
            padding: '6px 0',
            background: canSubmit ? (isNewArea ? '#059669' : '#3b82f6') : '#d1d5db',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 500,
            cursor: canSubmit ? 'pointer' : 'default',
            opacity: saveStatus === 'saving' ? 0.7 : 1,
          }}
          title={!hasNodes ? 'No nodes to assign' : undefined}
        >
          {saveStatus === 'saving'
            ? 'Saving…'
            : isNewArea
              ? 'Create Area'
              : 'Add to Area'}
        </button>
        {saveStatus === 'success' && (
          <span style={{ color: '#059669', fontSize: 14 }} data-testid="save-success">
            ✓
          </span>
        )}
        {saveStatus === 'error' && (
          <span
            style={{ color: '#dc2626', fontSize: 11 }}
            data-testid="save-error"
          >
            {errorMessage ?? 'Save failed'}
          </span>
        )}
      </div>
    </div>
  );
}
