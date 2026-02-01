'use client';

type ViewMode = 'heatmap' | 'activity-graph';

interface ViewToggleProps {
  /**
   * Currently selected view mode
   */
  selected: ViewMode;

  /**
   * Callback fired when user selects a different view
   * @param mode - The newly selected view mode
   */
  onViewChange: (mode: ViewMode) => void;

  /**
   * Whether the toggle is disabled (e.g., during loading)
   * @default false
   */
  disabled?: boolean;
}

export function ViewToggle({ selected, onViewChange, disabled = false }: ViewToggleProps) {
  return (
    <div className="inline-flex rounded-md border border-gray-300 bg-white" role="radiogroup" aria-label="Visualization mode">
      <label className={`${selected === 'heatmap' ? 'selected' : ''} relative flex cursor-pointer items-center px-4 py-2 text-sm font-medium transition-colors ${
        selected === 'heatmap'
          ? 'bg-blue-600 text-white'
          : 'text-gray-700 hover:bg-gray-50'
      } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}>
        <input
          type="radio"
          name="view-mode"
          value="heatmap"
          checked={selected === 'heatmap'}
          onChange={() => onViewChange('heatmap')}
          disabled={disabled}
          className="sr-only"
          aria-label="Heatmap view"
        />
        Heatmap
      </label>
      <label className={`${selected === 'activity-graph' ? 'selected' : ''} relative flex cursor-pointer items-center px-4 py-2 text-sm font-medium transition-colors ${
        selected === 'activity-graph'
          ? 'bg-blue-600 text-white'
          : 'text-gray-700 hover:bg-gray-50'
      } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}>
        <input
          type="radio"
          name="view-mode"
          value="activity-graph"
          checked={selected === 'activity-graph'}
          onChange={() => onViewChange('activity-graph')}
          disabled={disabled}
          className="sr-only"
          aria-label="Activity Graph view"
        />
        Activity Graph
      </label>
    </div>
  );
}