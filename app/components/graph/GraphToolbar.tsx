'use client';

import type { RepoGraphConfig } from '@/lib/analysis/graph-config';
import type { AnalysisEdge } from '@/lib/analysis/types';

interface ViewOption {
  label: string;
  config: RepoGraphConfig | ((edges: AnalysisEdge[]) => RepoGraphConfig);
}

interface GraphToolbarProps {
  hideTestFiles: boolean;
  onHideTestFilesChange: (hide: boolean) => void;
  selectedView: string;
  onViewChange: (view: string) => void;
  viewOptions: Record<string, ViewOption>;
  disabled: boolean;
}

export default function GraphToolbar({
  hideTestFiles,
  onHideTestFilesChange,
  selectedView,
  onViewChange,
  viewOptions,
  disabled,
}: GraphToolbarProps) {
  return (
    <div className="shrink-0 flex items-center gap-4 px-2 py-1 bg-gray-50 border border-gray-200 rounded-md text-sm">
      <label className="flex items-center gap-1.5 cursor-pointer text-gray-700">
        <input
          type="checkbox"
          checked={hideTestFiles}
          onChange={(e) => onHideTestFilesChange(e.target.checked)}
        />
        Hide test files
      </label>

      <label className="flex items-center gap-1.5 text-gray-700">
        View
        <select
          value={selectedView}
          onChange={(e) => onViewChange(e.target.value)}
          disabled={disabled}
          className="px-2 py-1 text-sm border border-gray-300 rounded bg-white disabled:bg-gray-100"
        >
          {Object.entries(viewOptions).map(([key, { label }]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </label>
    </div>
  );
}
