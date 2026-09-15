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
            />
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