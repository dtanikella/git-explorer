'use client';

import { useSelection } from '@/app/contexts/SelectionContext';

type BrowseMode = 'area' | 'file';
type FilterMode = 'all' | 'selected' | 'locked';

interface SelectionToolbarProps {
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  searchNotFound: boolean;
  onSearchSubmit: () => void;
  browseMode: BrowseMode;
  onBrowseModeChange: (mode: BrowseMode) => void;
  filterMode: FilterMode;
  onFilterModeChange: (mode: FilterMode) => void;
}

/**
 * Header toolbar for the selection sidebar.
 *
 * @remarks
 * Provides search, browse mode toggle (By area / By file),
 * filter toggle (All / Selected / Locked) with counts,
 * Clear unlocked, Clear all, Reset, and Lock all controls.
 *
 * @param searchQuery - Current search input value.
 * @param onSearchQueryChange - Called when search input changes.
 * @param searchNotFound - Whether the last search returned no results.
 * @param onSearchSubmit - Called when the search button or Enter is pressed.
 * @param browseMode - Current browse mode ('area' | 'file').
 * @param onBrowseModeChange - Called when browse mode changes.
 * @param filterMode - Current filter mode ('all' | 'selected' | 'locked').
 * @param onFilterModeChange - Called when filter mode changes.
 */
export default function SelectionToolbar({
  searchQuery,
  onSearchQueryChange,
  searchNotFound,
  onSearchSubmit,
  browseMode,
  onBrowseModeChange,
  filterMode,
  onFilterModeChange,
}: SelectionToolbarProps) {
  const { state, clearSelection, clearUnlocked, lockAll, hasSelection } = useSelection();
  const { lockedNodeIds, lockedAreaIds, selectedNodeIds } = state;
  const hasLocks = lockedNodeIds.size > 0 || lockedAreaIds.size > 0;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') onSearchSubmit();
  };

  const selectedCount = selectedNodeIds.size;
  const lockedCount = lockedNodeIds.size;

  return (
    <div style={{ borderBottom: '1px solid #e5e7eb' }}>
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px',
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 12 }}>Search & Select</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {hasLocks && (
            <button
              onClick={clearUnlocked}
              style={{
                background: 'none',
                border: 'none',
                color: '#6b7280',
                cursor: 'pointer',
                fontSize: 11,
                textDecoration: 'underline',
              }}
              title="Clear unlocked selections"
            >
              Clear unlocked
            </button>
          )}
          {!hasLocks ? (
            <button
              onClick={clearSelection}
              style={{
                background: 'none',
                border: 'none',
                color: '#6b7280',
                cursor: 'pointer',
                fontSize: 11,
                textDecoration: 'underline',
              }}
            >
              Clear all
            </button>
          ) : (
            <button
              onClick={clearSelection}
              style={{
                background: 'none',
                border: 'none',
                color: '#dc2626',
                cursor: 'pointer',
                fontSize: 11,
                textDecoration: 'underline',
              }}
              title="Clear all including locks"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: '0 12px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { onSearchQueryChange(e.target.value); }}
            onKeyDown={handleKeyDown}
            placeholder="Search node or area..."
            style={{
              flex: 1,
              padding: '5px 8px',
              fontSize: 12,
              border: '1px solid #d1d5db',
              borderRadius: 6,
            }}
          />
          <button
            onClick={onSearchSubmit}
            disabled={!searchQuery.trim()}
            style={{
              padding: '5px 10px',
              fontSize: 12,
              background: searchQuery.trim() ? '#3b82f6' : '#d1d5db',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: searchQuery.trim() ? 'pointer' : 'default',
            }}
          >
            Search
          </button>
        </div>
        {searchNotFound && (
          <div style={{ color: '#dc2626', fontSize: 11, marginTop: 4 }}>Not found</div>
        )}
      </div>

      {/* Browse mode tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', padding: '0 12px' }}>
        <button
          onClick={() => onBrowseModeChange('area')}
          style={{
            flex: 1,
            padding: '6px 0',
            fontSize: 11,
            fontWeight: 500,
            background: 'none',
            border: 'none',
            borderBottom: browseMode === 'area' ? '2px solid #3b82f6' : '2px solid transparent',
            color: browseMode === 'area' ? '#3b82f6' : '#6b7280',
            cursor: 'pointer',
          }}
        >
          By area
        </button>
        <button
          onClick={() => onBrowseModeChange('file')}
          style={{
            flex: 1,
            padding: '6px 0',
            fontSize: 11,
            fontWeight: 500,
            background: 'none',
            border: 'none',
            borderBottom: browseMode === 'file' ? '2px solid #3b82f6' : '2px solid transparent',
            color: browseMode === 'file' ? '#3b82f6' : '#6b7280',
            cursor: 'pointer',
          }}
        >
          By file
        </button>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', padding: '6px 12px', gap: 4 }}>
        <button
          onClick={() => onFilterModeChange('all')}
          style={{
            padding: '3px 10px',
            fontSize: 11,
            borderRadius: 12,
            border: 'none',
            background: filterMode === 'all' ? '#e5e7eb' : 'transparent',
            color: filterMode === 'all' ? '#374151' : '#6b7280',
            fontWeight: filterMode === 'all' ? 600 : 400,
            cursor: 'pointer',
          }}
        >
          All
        </button>
        <button
          onClick={() => onFilterModeChange('selected')}
          style={{
            padding: '3px 10px',
            fontSize: 11,
            borderRadius: 12,
            border: 'none',
            background: filterMode === 'selected' ? '#e5e7eb' : 'transparent',
            color: filterMode === 'selected' ? '#374151' : '#6b7280',
            fontWeight: filterMode === 'selected' ? 600 : 400,
            cursor: 'pointer',
          }}
        >
          Selected ({selectedCount})
        </button>
        <button
          onClick={() => onFilterModeChange('locked')}
          style={{
            padding: '3px 10px',
            fontSize: 11,
            borderRadius: 12,
            border: 'none',
            background: filterMode === 'locked' ? '#e5e7eb' : 'transparent',
            color: filterMode === 'locked' ? '#374151' : '#6b7280',
            fontWeight: filterMode === 'locked' ? 600 : 400,
            cursor: 'pointer',
          }}
        >
          Locked ({lockedCount})
        </button>
        {hasSelection && (
          <button
            onClick={lockAll}
            style={{
              padding: '3px 10px',
              fontSize: 11,
              borderRadius: 12,
              border: 'none',
              background: 'transparent',
              color: '#6b7280',
              cursor: 'pointer',
              marginLeft: 'auto',
            }}
            title="Lock all selected nodes"
          >
            Lock all
          </button>
        )}
      </div>
    </div>
  );
}