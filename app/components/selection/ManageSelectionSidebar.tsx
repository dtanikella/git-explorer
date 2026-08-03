'use client';

import { useSelection } from '@/app/contexts/SelectionContext';
import AreaAssignment from '@/app/components/selection/AreaAssignment';

interface ManageSelectionSidebarProps {
  effectiveNodeIds: string[];
  repoPath: string;
}

export default function ManageSelectionSidebar({ effectiveNodeIds, repoPath }: ManageSelectionSidebarProps) {
  const { hasSelection } = useSelection();

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
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <AreaAssignment effectiveNodeIds={effectiveNodeIds} repoPath={repoPath} />
      </div>
    </div>
  );
}
