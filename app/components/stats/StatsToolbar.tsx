'use client';

interface StatsToolbarProps {
  topN: number;
  onTopNChange: (n: number) => void;
  hideTestFiles: boolean;
  onHideTestFilesChange: (hide: boolean) => void;
  disabled: boolean;
}

const TOP_N_OPTIONS = [10, 20, 50];

export default function StatsToolbar({
  topN,
  onTopNChange,
  hideTestFiles,
  onHideTestFilesChange,
  disabled,
}: StatsToolbarProps) {
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
        Show top
        <select
          value={topN}
          onChange={(e) => onTopNChange(Number(e.target.value))}
          disabled={disabled}
          className="px-2 py-1 text-sm border border-gray-300 rounded bg-white disabled:bg-gray-100"
        >
          {TOP_N_OPTIONS.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </label>
    </div>
  );
}
