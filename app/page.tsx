'use client';

import { useState, useCallback, useEffect } from 'react';
import RepositorySelector from './components/RepositorySelector';
import RepoGraph from './components/repo-graph/RepoGraph';
import { createModulesViewConfig } from '@/lib/analysis/graph-config';
import type { AnalysisResult } from '@/lib/analysis/types';

export default function HomePage() {
  const [repoPath, setRepoPath] = useState<string>('');
  const [hideTestFiles, setHideTestFiles] = useState(true);

  const [analysisData, setAnalysisData] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!repoPath) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch('/api/repo-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoPath, hideTestFiles }),
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        return res.json();
      })
      .then((result) => {
        if (result.success) {
          setAnalysisData(result.data);
        } else {
          setError(result.error || 'Analysis failed');
        }
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setError(err.message || 'Network error');
        setLoading(false);
      });

    return () => controller.abort();
  }, [repoPath, hideTestFiles]);

  const handleRepositorySelect = useCallback((path: string) => {
    setRepoPath(path);
  }, []);

  return (
    <main className="h-screen flex flex-col p-2 gap-2 overflow-hidden">
      <div className="shrink-0 flex items-center gap-4">
        <div className="flex-1">
          <RepositorySelector
            onRepositorySelected={handleRepositorySelect}
            currentPath={repoPath}
          />
        </div>
        <label className="flex items-center gap-1 text-sm text-gray-600 whitespace-nowrap">
          <input
            type="checkbox"
            checked={hideTestFiles}
            onChange={(e) => setHideTestFiles(e.target.checked)}
          />
          Hide test files
        </label>
      </div>

      <div className="flex-1 min-h-0">
        {!repoPath ? (
          <div className="w-full h-full flex items-center justify-center text-gray-400 border border-dashed border-gray-300 rounded-lg">
            Select a repository to visualize
          </div>
        ) : (
          <RepoGraph
            repoPath={repoPath}
            hideTestFiles={hideTestFiles}
            config={createModulesViewConfig}
            analysisData={analysisData}
            loading={loading}
            error={error}
          />
        )}
      </div>
    </main>
  );
}
