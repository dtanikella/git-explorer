'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { useSelection } from '@/app/contexts/SelectionContext';
import { useAreaStore } from '@/app/contexts/AreaContext';
import type { Area, AreaType } from '@/lib/areas/types';
import { AREA_TYPES } from '@/lib/areas/types';

interface ManageSelectionSidebarProps {
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

interface DraftArea {
  name: string;
  type: AreaType;
  parent: string | null;
  children: string[];
}

export default function ManageSelectionSidebar({ effectiveNodeIds, repoPath }: ManageSelectionSidebarProps) {
  const { hasSelection } = useSelection();
  const { areas, runtimeState, setAreas, getAreasForNode } = useAreaStore();

  const [pendingAdds, setPendingAdds] = useState<Set<string>>(new Set());
  const [pendingRemovals, setPendingRemovals] = useState<Set<string>>(new Set());
  const [pendingCreate, setPendingCreate] = useState<DraftArea | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [selectedAreaId, setSelectedAreaId] = useState<string>('');
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<AreaType>('business_domain');
  const [newParent, setNewParent] = useState<string | null>(null);
  const [newChildren, setNewChildren] = useState<string[]>([]);

  // Clear pending state whenever the selection changes
  useEffect(() => {
    setPendingAdds(new Set());
    setPendingRemovals(new Set());
    setPendingCreate(null);
    setSelectedAreaId('');
    setNewName('');
    setNewType('business_domain');
    setNewParent(null);
    setNewChildren([]);
    setSaveStatus('idle');
    setErrorMessage(null);
  }, [effectiveNodeIds]);

  // Reset success/error status after a delay
  useEffect(() => {
    if (saveStatus === 'success' || saveStatus === 'error') {
      const timer = setTimeout(() => setSaveStatus('idle'), 2000);
      return () => clearTimeout(timer);
    }
  }, [saveStatus]);

  const areasById = useMemo(() => {
    const map = new Map<string, Area>();
    for (const a of areas) map.set(a.id, a);
    return map;
  }, [areas]);

  // Common areas = areas assigned to ALL effective nodes
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

  const isNewAreaSelected = selectedAreaId === NEW_AREA_SENTINEL;
  const hasNodes = effectiveNodeIds.length > 0;

  const availableChildAreas = useMemo(
    () => areas.filter((area) => area.id !== newParent),
    [areas, newParent],
  );

  const canStageAdd = hasNodes && (isNewAreaSelected ? newName.trim().length > 0 : selectedAreaId !== '');

  const isCreateFormValid = useMemo(() => {
    if (!isNewAreaSelected) return true;
    if (!newName.trim()) return false;
    if (newParent && newChildren.includes(newParent)) return false;
    return true;
  }, [isNewAreaSelected, newName, newParent, newChildren]);

  const canSave = hasNodes && (pendingAdds.size > 0 || pendingRemovals.size > 0 || pendingCreate !== null);

  const stageAdd = useCallback(() => {
    if (!canStageAdd || !isCreateFormValid) return;

    if (isNewAreaSelected) {
      setPendingCreate({
        name: newName.trim(),
        type: newType,
        parent: newParent,
        children: [...newChildren],
      });
    } else {
      setPendingAdds((prev) => {
        const next = new Set(prev);
        next.add(selectedAreaId);
        return next;
      });
      // Also remove from pending removals if it was staged for removal
      setPendingRemovals((prev) => {
        const next = new Set(prev);
        next.delete(selectedAreaId);
        return next;
      });
    }

    setSelectedAreaId('');
    setNewName('');
    setNewType('business_domain');
    setNewParent(null);
    setNewChildren([]);
  }, [canStageAdd, isCreateFormValid, isNewAreaSelected, newName, newType, newParent, newChildren, selectedAreaId]);

  const removeCommonArea = useCallback((areaId: string) => {
    setPendingRemovals((prev) => {
      const next = new Set(prev);
      next.add(areaId);
      return next;
    });
    setPendingAdds((prev) => {
      const next = new Set(prev);
      next.delete(areaId);
      return next;
    });
  }, []);

  const unstageRemoval = useCallback((areaId: string) => {
    setPendingRemovals((prev) => {
      const next = new Set(prev);
      next.delete(areaId);
      return next;
    });
  }, []);

  const unstageAdd = useCallback((areaId: string) => {
    setPendingAdds((prev) => {
      const next = new Set(prev);
      next.delete(areaId);
      return next;
    });
  }, []);

  const discardCreate = useCallback(() => {
    setPendingCreate(null);
  }, []);

  const clearPending = useCallback(() => {
    setPendingAdds(new Set());
    setPendingRemovals(new Set());
    setPendingCreate(null);
    setSelectedAreaId('');
    setNewName('');
    setNewType('business_domain');
    setNewParent(null);
    setNewChildren([]);
    setErrorMessage(null);
  }, []);

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
      clearPending();
      setSaveStatus('success');
    } catch (err) {
      setSaveStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Save failed');
    }
  }, [repoPath, setAreas, clearPending]);

  const handleSave = useCallback(() => {
    if (!canSave) return;

    const now = new Date().toISOString();
    let updatedAreas = [...areas];

    // Apply removals first
    for (const areaId of pendingRemovals) {
      updatedAreas = updatedAreas.map((a) => {
        if (a.id !== areaId) return a;
        return {
          ...a,
          contains: a.contains.filter((id) => !effectiveNodeIds.includes(id)),
          updated_at: now,
        };
      });
    }

    // Apply adds
    for (const areaId of pendingAdds) {
      updatedAreas = updatedAreas.map((a) => {
        if (a.id !== areaId) return a;
        const mergedContains = [...new Set([...a.contains, ...effectiveNodeIds])];
        return { ...a, contains: mergedContains, updated_at: now };
      });
    }

    // Apply create
    if (pendingCreate) {
      if (pendingCreate.parent && pendingCreate.children.includes(pendingCreate.parent)) {
        setSaveStatus('error');
        setErrorMessage('Parent cannot also be a child');
        return;
      }
      const newArea: Area = {
        id: generateAreaId(pendingCreate.name),
        created_at: now,
        updated_at: now,
        name: pendingCreate.name,
        type: pendingCreate.type,
        contains: [...effectiveNodeIds],
        parent: pendingCreate.parent,
        children: [...pendingCreate.children],
        clusterStrength: 0,
      };
      updatedAreas = [...updatedAreas, newArea];
      if (pendingCreate.parent) {
        updatedAreas = updatedAreas.map((a) => {
          if (a.id !== pendingCreate.parent) return a;
          return { ...a, children: [...new Set([...a.children, newArea.id])], updated_at: now };
        });
      }
      for (const childId of pendingCreate.children) {
        updatedAreas = updatedAreas.map((a) => {
          if (a.id !== childId) return a;
          return { ...a, parent: newArea.id, updated_at: now };
        });
      }
    }

    saveAreaFile(updatedAreas);
  }, [canSave, areas, pendingRemovals, pendingAdds, pendingCreate, effectiveNodeIds, saveAreaFile]);

  if (!hasSelection) return null;

  return (
    <div
      data-testid="manage-selection-sidebar"
      style={{
        width: 350,
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
        <span style={{ fontWeight: 600 }}>Manage Selection</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            data-testid="save-selection"
            onClick={handleSave}
            disabled={!canSave || saveStatus === 'saving'}
            style={{
              padding: '4px 10px',
              fontSize: 11,
              background: canSave ? '#3b82f6' : '#d1d5db',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: canSave ? 'pointer' : 'default',
              opacity: saveStatus === 'saving' ? 0.7 : 1,
            }}
          >
            {saveStatus === 'saving' ? 'Saving…' : 'Save'}
          </button>
          <button
            data-testid="clear-pending"
            onClick={clearPending}
            disabled={pendingAdds.size === 0 && pendingRemovals.size === 0 && pendingCreate === null}
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
            Clear
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
        {effectiveNodeIds.length === 0 && (
          <div style={{ color: '#6b7280', fontSize: 11, padding: '8px 0' }}>
            No nodes selected.
          </div>
        )}

        {effectiveNodeIds.length > 0 && (
          <>
            {/* Currently assigned areas */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6, fontWeight: 500 }}>
                Currently assigned ({commonAreas.length})
              </div>
              {commonAreas.length === 0 && (
                <div style={{ fontSize: 11, color: '#9ca3af', padding: '2px 0' }}>
                  No common areas for selected nodes.
                </div>
              )}
              {commonAreas.map((area) => {
                const color = runtimeState.get(area.id)?.color ?? '#6b7280';
                const isPendingRemoval = pendingRemovals.has(area.id);
                return (
                  <div
                    key={area.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '3px 0',
                      opacity: isPendingRemoval ? 0.5 : 1,
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-block',
                        background: `${color}26`,
                        color,
                        fontSize: 10,
                        padding: '2px 8px',
                        borderRadius: 9,
                        fontWeight: 500,
                      }}
                    >
                      {area.name}
                    </span>
                    {isPendingRemoval ? (
                      <button
                        data-testid={`unstage-removal-${area.id}`}
                        onClick={() => unstageRemoval(area.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#6b7280',
                          cursor: 'pointer',
                          fontSize: 11,
                          textDecoration: 'underline',
                        }}
                      >
                        Undo
                      </button>
                    ) : (
                      <button
                        data-testid={`remove-area-${area.id}`}
                        onClick={() => removeCommonArea(area.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#9ca3af',
                          cursor: 'pointer',
                          fontSize: 14,
                          lineHeight: 1,
                          padding: '0 2px',
                        }}
                        title="Remove assignment"
                      >
                        ×
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Staged additions */}
            {(pendingAdds.size > 0 || pendingCreate) && (
              <div style={{ marginBottom: 12, padding: 8, background: '#eff6ff', borderRadius: 6 }}>
                <div style={{ fontSize: 11, color: '#374151', marginBottom: 6, fontWeight: 500 }}>Staged additions</div>
                {[...pendingAdds].map((areaId) => {
                  const area = areasById.get(areaId);
                  if (!area) return null;
                  const color = runtimeState.get(area.id)?.color ?? '#6b7280';
                  return (
                    <div key={areaId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 0' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          background: `${color}26`,
                          color,
                          fontSize: 10,
                          padding: '2px 8px',
                          borderRadius: 9,
                          fontWeight: 500,
                        }}
                      >
                        {area.name}
                      </span>
                      <button
                        data-testid={`unstage-add-${areaId}`}
                        onClick={() => unstageAdd(areaId)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#9ca3af',
                          cursor: 'pointer',
                          fontSize: 14,
                          lineHeight: 1,
                          padding: '0 2px',
                        }}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
                {pendingCreate && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 0' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        background: '#dbeafe',
                        color: '#1e40af',
                        fontSize: 10,
                        padding: '2px 8px',
                        borderRadius: 9,
                        fontWeight: 500,
                      }}
                    >
                      Create: {pendingCreate.name}
                    </span>
                    <button
                      data-testid="discard-create"
                      onClick={discardCreate}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#9ca3af',
                        cursor: 'pointer',
                        fontSize: 14,
                        lineHeight: 1,
                        padding: '0 2px',
                      }}
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Assign new */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6, fontWeight: 500 }}>Assign new</div>
              <select
                data-testid="assign-area-picker"
                value={selectedAreaId}
                onChange={(e) => setSelectedAreaId(e.target.value)}
                style={{
                  width: '100%',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  padding: '6px 10px',
                  fontSize: 12,
                  background: 'white',
                  marginBottom: isNewAreaSelected ? 10 : 8,
                }}
              >
                <option value="">Select an area…</option>
                {areas
                  .filter((a) => !commonAreas.some((ca) => ca.id === a.id) && !pendingAdds.has(a.id))
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                <option value={NEW_AREA_SENTINEL}>+ New Area</option>
              </select>

              {isNewAreaSelected && (
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
                    <label style={{ fontSize: 10, color: '#6b7280', display: 'block', marginBottom: 2 }}>Name *</label>
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
                    <label style={{ fontSize: 10, color: '#6b7280', display: 'block', marginBottom: 2 }}>Type</label>
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
                    <label style={{ fontSize: 10, color: '#6b7280', display: 'block', marginBottom: 2 }}>Parent</label>
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

                  <div>
                    <label style={{ fontSize: 10, color: '#6b7280', display: 'block', marginBottom: 2 }}>Children</label>
                    {newChildren.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
                        {newChildren.map((childId) => {
                          const childArea = areas.find((a) => a.id === childId);
                          return (
                            <span
                              key={childId}
                              data-testid={`child-chip-${childId}`}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                                background: '#e0f2fe',
                                color: '#0369a1',
                                fontSize: 10,
                                padding: '2px 6px',
                                borderRadius: 9,
                                fontWeight: 500,
                              }}
                            >
                              {childArea?.name ?? childId}
                              <button
                                type="button"
                                onClick={() => setNewChildren((prev) => prev.filter((id) => id !== childId))}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#0369a1',
                                  cursor: 'pointer',
                                  fontSize: 12,
                                  lineHeight: 1,
                                  padding: 0,
                                }}
                              >
                                ×
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                    <select
                      data-testid="new-area-children"
                      value=""
                      onChange={(e) => {
                        if (e.target.value && !newChildren.includes(e.target.value)) {
                          setNewChildren((prev) => [...prev, e.target.value]);
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
                      <option value="">Add child area…</option>
                      {availableChildAreas
                        .filter((a) => !newChildren.includes(a.id))
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              )}

              <button
                data-testid="stage-add"
                onClick={stageAdd}
                disabled={!canStageAdd || !isCreateFormValid}
                style={{
                  width: '100%',
                  padding: '6px 0',
                  background: canStageAdd && isCreateFormValid ? '#059669' : '#d1d5db',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: canStageAdd && isCreateFormValid ? 'pointer' : 'default',
                }}
              >
                {isNewAreaSelected ? 'Stage Create' : 'Stage Add'}
              </button>
            </div>

            {/* Status */}
            {saveStatus === 'success' && (
              <div data-testid="save-success" style={{ color: '#059669', fontSize: 11, padding: '4px 0' }}>
                Saved successfully
              </div>
            )}
            {saveStatus === 'error' && (
              <div data-testid="save-error" style={{ color: '#dc2626', fontSize: 11, padding: '4px 0' }}>
                {errorMessage ?? 'Save failed'}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
