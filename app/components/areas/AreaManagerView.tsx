'use client';

import { useAreaStore } from '@/app/contexts/AreaContext';
import AreaTreeTable from './AreaTreeTable';

interface AreaManagerViewProps {
  repoPath: string;
  nodes: any[];
  areas: any[];
}

export default function AreaManagerView({ repoPath, nodes, areas }: AreaManagerViewProps) {
  const { runtimeState, setAreas } = useAreaStore();

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
            style={{
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 500,
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
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
            <AreaTreeTable
              areas={areas}
              runtimeState={runtimeState}
            />
          </div>

          {/* Node browser right rail */}
          <div
            data-testid="node-browser-pane"
            style={{
              width: 280,
              borderLeft: '1px solid #e5e7eb',
              background: '#fafafa',
              display: 'flex',
              flexDirection: 'column',
              flexShrink: 0,
            }}
          >
            <div style={{ padding: '8px 12px', borderBottom: '1px solid #e5e7eb', fontSize: 12, fontWeight: 600 }}>
              Nodes
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}