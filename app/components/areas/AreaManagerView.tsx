'use client';

import { useMemo, useState, useCallback } from 'react';
import { useAreaStore } from '@/app/contexts/AreaContext';
import { generateAreaId } from '@/lib/areas/id';
import AreaTreeTable from './AreaTreeTable';
import NodeBrowserPane from './NodeBrowserPane';
import type { AnalysisNode } from '@/lib/analysis/types';
import type { Area, AreaType } from '@/lib/areas/types';

interface AreaManagerViewProps {
  repoPath: string;
  nodes: AnalysisNode[];
}

export default function AreaManagerView({ repoPath, nodes }: AreaManagerViewProps) {
  const { areas, runtimeState, setAreas } = useAreaStore();
  const [createMode, setCreateMode] = useState(false);
  const [newAreaName, setNewAreaName] = useState('');
  const [renameAreaId, setRenameAreaId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Build node names lookup from AnalysisNode[]
  const nodeNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const n of nodes) {
      map[n.scipSymbol] = n.name;
    }
    return map;
  }, [nodes]);

  // Build set of all assigned node IDs
  const assignedNodeIds = useMemo(() => {
    const ids = new Set<string>();
    for (const area of areas) {
      for (const nodeId of area.contains) {
        ids.add(nodeId);
      }
    }
    return ids;
  }, [areas]);

  const handleStartCreate = useCallback(() => {
    setCreateMode(true);
    setNewAreaName('');
  }, []);

  const handleConfirmCreate = useCallback(() => {
    const name = newAreaName.trim();
    if (!name) {
      setCreateMode(false);
      return;
    }

    const now = new Date().toISOString();
    const newArea: Area = {
      id: generateAreaId(name),
      created_at: now,
      updated_at: now,
      name,
      type: 'business_domain' as AreaType,
      contains: [],
      parent: null,
      children: [],
      clusterStrength: 0,
    };

    setAreas([...areas, newArea]);
    setCreateMode(false);
    setNewAreaName('');
  }, [newAreaName, areas, setAreas]);

  const handleCancelCreate = useCallback(() => {
    setCreateMode(false);
    setNewAreaName('');
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleConfirmCreate();
      } else if (e.key === 'Escape') {
        handleCancelCreate();
      }
    },
    [handleConfirmCreate, handleCancelCreate]
  );

  // Rename handlers
  const handleRenameStart = useCallback((areaId: string, currentName: string) => {
    setRenameAreaId(areaId);
    setRenameValue(currentName);
  }, []);

  const handleRenameConfirm = useCallback(() => {
    if (!renameAreaId || !renameValue.trim()) {
      setRenameAreaId(null);
      return;
    }
    const now = new Date().toISOString();
    setAreas(
      areas.map((a) =>
        a.id === renameAreaId ? { ...a, name: renameValue.trim(), updated_at: now } : a
      )
    );
    setRenameAreaId(null);
    setRenameValue('');
  }, [renameAreaId, renameValue, areas, setAreas]);

  const handleRenameCancel = useCallback(() => {
    setRenameAreaId(null);
    setRenameValue('');
  }, []);

  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleRenameConfirm();
      else if (e.key === 'Escape') handleRenameCancel();
    },
    [handleRenameConfirm, handleRenameCancel]
  );

  // Delete handlers
  const handleDeleteStart = useCallback((areaId: string) => {
    const area = areas.find((a) => a.id === areaId);
    if (!area) return;

    // If area has children, show confirmation dialog
    if (area.children.length > 0) {
      setDeleteConfirm(areaId);
    } else {
      // Immediate delete
      const now = new Date().toISOString();
      // Update parent if exists
      const updatedAreas = areas
        .filter((a) => a.id !== areaId)
        .map((a) =>
          a.id === area.parent
            ? { ...a, children: a.children.filter((c) => c !== areaId), updated_at: now }
            : a
        );
      setAreas(updatedAreas);
    }
  }, [areas, setAreas]);

  const handleDeleteOrphan = useCallback(() => {
    if (!deleteConfirm) return;
    const now = new Date().toISOString();
    const areaToDelete = areas.find((a) => a.id === deleteConfirm);
    if (!areaToDelete) return;

    // Orphan: re-parent children to the deleted area's parent
    const updatedAreas = areas
      .filter((a) => a.id !== deleteConfirm)
      .map((a) => {
        if (a.id === areaToDelete.parent) {
          // Remove deleted area from parent's children and add grandchildren
          return {
            ...a,
            children: [
              ...a.children.filter((c) => c !== deleteConfirm),
              ...areaToDelete.children,
            ],
            updated_at: now,
          };
        }
        if (areaToDelete.children.includes(a.id)) {
          // Re-parent this child to the grandparent
          return { ...a, parent: areaToDelete.parent, updated_at: now };
        }
        return a;
      });
    setAreas(updatedAreas);
    setDeleteConfirm(null);
  }, [deleteConfirm, areas, setAreas]);

  const handleDeleteCollapse = useCallback(() => {
    if (!deleteConfirm) return;
    const now = new Date().toISOString();

    // Collect all descendant IDs
    const idsToRemove = new Set<string>([deleteConfirm]);
    const stack = [...areas.filter((a) => a.parent === deleteConfirm || deleteConfirm === a.id)];
    while (stack.length > 0) {
      const a = stack.pop()!;
      if (a.children) {
        for (const cId of a.children) {
          idsToRemove.add(cId);
          const child = areas.find((ca) => ca.id === cId);
          if (child) stack.push(child);
        }
      }
    }

    const updatedAreas = areas
      .filter((a) => !idsToRemove.has(a.id))
      .map((a) => {
        // Clean up references to deleted areas
        if (a.children) {
          return {
            ...a,
            children: a.children.filter((c) => !idsToRemove.has(c)),
            updated_at: now,
          };
        }
        return a;
      });
    setAreas(updatedAreas);
    setDeleteConfirm(null);
  }, [deleteConfirm, areas, setAreas]);

  const handleDeleteCancel = useCallback(() => {
    setDeleteConfirm(null);
  }, []);

  return (
    <div className="w-full h-full flex" data-testid="area-manager-view">
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Toolbar */}
        <div
          data-testid="area-toolbar"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            borderBottom: '1px solid #e5e7eb',
            background: '#fafafa',
          }}
        >
          <button
            data-testid="new-area-button"
            onClick={handleStartCreate}
            disabled={createMode}
            style={{
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 500,
              background: createMode ? '#d1d5db' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: createMode ? 'default' : 'pointer',
            }}
          >
            + New Area
          </button>
        </div>

        {/* Body: tree table main + node browser right rail */}
        <div className="flex-1 flex" style={{ minHeight: 0 }}>
          {/* Main tree table area */}
          <div
            className="flex-1 min-w-0"
            style={{ overflow: 'auto', padding: 4 }}
          >
            {/* Inline create row */}
            {createMode && (
              <div
                data-testid="inline-create-row"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 8px',
                  borderBottom: '1px solid #e5e7eb',
                  background: '#f0fdf4',
                }}
              >
                <span style={{ width: 14, flexShrink: 0, color: '#22c55e', fontSize: 8 }}>▶</span>
                <input
                  data-testid="inline-create-input"
                  autoFocus
                  value={newAreaName}
                  onChange={(e) => setNewAreaName(e.target.value)}
                  onKeyDown={handleKeyDown}
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
                  data-testid="inline-create-confirm"
                  onClick={handleConfirmCreate}
                  disabled={!newAreaName.trim()}
                  style={{
                    padding: '4px 10px',
                    fontSize: 11,
                    background: newAreaName.trim() ? '#22c55e' : '#d1d5db',
                    color: 'white',
                    border: 'none',
                    borderRadius: 6,
                    cursor: newAreaName.trim() ? 'pointer' : 'default',
                  }}
                >
                  Create
                </button>
                <button
                  data-testid="inline-create-cancel"
                  onClick={handleCancelCreate}
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

            <AreaTreeTable
              areas={areas}
              runtimeState={runtimeState}
              nodeNames={nodeNames}
              renameAreaId={renameAreaId}
              renameValue={renameValue}
              onRenameStart={handleRenameStart}
              onRenameConfirm={handleRenameConfirm}
              onRenameCancel={handleRenameCancel}
              onRenameKeyDown={handleRenameKeyDown}
              onRenameValueChange={setRenameValue}
              onDeleteStart={handleDeleteStart}
            />

            {/* Delete confirmation dialog */}
            {deleteConfirm && (
              <div
                data-testid="delete-confirm-dialog"
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(0,0,0,0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 200,
                }}
                onClick={handleDeleteCancel}
              >
                <div
                  style={{
                    background: 'white',
                    borderRadius: 12,
                    padding: 24,
                    minWidth: 300,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 8px' }}>
                    Delete area?
                  </h3>
                  <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 16px' }}>
                    This area has child areas. What would you like to do with them?
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <button
                      data-testid="delete-orphan-btn"
                      onClick={handleDeleteOrphan}
                      style={{
                        padding: '10px 16px',
                        fontSize: 13,
                        background: '#fef3c7',
                        color: '#92400e',
                        border: '1px solid #fde68a',
                        borderRadius: 8,
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <strong>Orphan children</strong>
                      <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>
                        Re-parent children to become top-level areas
                      </div>
                    </button>
                    <button
                      data-testid="delete-collapse-btn"
                      onClick={handleDeleteCollapse}
                      style={{
                        padding: '10px 16px',
                        fontSize: 13,
                        background: '#fee2e2',
                        color: '#991b1b',
                        border: '1px solid #fecaca',
                        borderRadius: 8,
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <strong>Collapse (delete all)</strong>
                      <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>
                        Delete this area and all its children
                      </div>
                    </button>
                    <button
                      data-testid="delete-cancel-btn"
                      onClick={handleDeleteCancel}
                      style={{
                        padding: '10px 16px',
                        fontSize: 13,
                        background: '#f3f4f6',
                        color: '#374151',
                        border: '1px solid #e5e7eb',
                        borderRadius: 8,
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Node browser right rail */}
          <div
            style={{
              width: 280,
              borderLeft: '1px solid #e5e7eb',
              background: '#fafafa',
              display: 'flex',
              flexDirection: 'column',
              flexShrink: 0,
            }}
          >
            <NodeBrowserPane
              nodes={nodes}
              assignedNodeIds={assignedNodeIds}
            />
          </div>
        </div>
      </div>
    </div>
  );
}