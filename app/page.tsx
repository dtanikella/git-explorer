'use client';

import { useState, useCallback, useRef } from 'react';
import RepositorySelector from './components/RepositorySelector';
import DateRangeSelector from './components/DateRangeSelector';
import TsGraph from './components/ts-graph/TsGraph';

export default function HomePage() {
  const [repoPath, setRepoPath] = useState<string>('');
  const [dateRange, setDateRange] = useState<string>('2w');
  const [hideTestFiles, setHideTestFiles] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchNotFound, setSearchNotFound] = useState(false);
  const searchHandlerRef = useRef<((query: string) => boolean) | null>(null);

  const handleRepositorySelect = (path: string) => {
    setRepoPath(path);
  };

  const handleRegisterSearch = useCallback((handler: (query: string) => boolean) => {
    searchHandlerRef.current = handler;
  }, []);

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    if (searchHandlerRef.current) {
      const found = searchHandlerRef.current(searchQuery.trim());
      setSearchNotFound(!found);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  return (
    <main className="h-screen flex flex-col p-2 gap-2 overflow-hidden">
      {/* Row 1: Repository Selector */}
      <div className="shrink-0">
        <RepositorySelector
          onRepositorySelected={handleRepositorySelect}
          currentPath={repoPath}
          isLoading={false}
          error={undefined}
          onError={undefined}
        />
      </div>

      {/* Row 2: Tools & Filters */}
      <div className="shrink-0 flex items-center gap-4 px-2 py-1 bg-gray-50 border border-gray-200 rounded-md text-sm">
        <DateRangeSelector value={dateRange} onChange={setDateRange} />

        <label className="flex items-center gap-1.5 cursor-pointer text-gray-700">
          <input
            type="checkbox"
            checked={hideTestFiles}
            onChange={(e) => setHideTestFiles(e.target.checked)}
          />
          Hide test files
        </label>

        <div className="flex items-center gap-1 ml-auto">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setSearchNotFound(false); }}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search node..."
            disabled={!repoPath}
            className="px-2 py-1 text-sm border border-gray-300 rounded disabled:bg-gray-100"
          />
          <button
            onClick={handleSearch}
            disabled={!repoPath || !searchQuery.trim()}
            className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Search
          </button>
          {searchNotFound && (
            <span className="text-red-500 text-xs">Not found</span>
          )}
        </div>
      </div>

      {/* Row 3: TsGraph — fills all remaining space */}
      <div className="flex-1 min-h-0">
        {repoPath ? (
          <TsGraph
            repoPath={repoPath}
            hideTestFiles={hideTestFiles}
            onSearchNode={handleRegisterSearch}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 border border-dashed border-gray-300 rounded-lg">
            Select a repository to visualize
          </div>
        )}
      </div>
    </main>
  );
}
