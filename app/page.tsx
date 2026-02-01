'use client';

import { useState, useEffect } from 'react';
import RepositorySelector from './components/RepositorySelector';
import LoadingState from './components/LoadingState';
import { TreemapChart } from './components/TreemapChart';
import { ColorLegend } from './components/ColorLegend';
import { DateRangeSelector } from './components/DateRangeSelector';
import { ErrorDisplay } from './components/ErrorDisplay';
import { ViewToggle } from './components/ViewToggle';
import ForceGraphChart from './components/ForceGraphChart';
import { TreeNode, TimeRangePreset, AnalysisMetadata } from '@/lib/git/types';

export default function Home() {
  const [repoPath, setRepoPath] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [treeData, setTreeData] = useState<TreeNode | null>(null);
  const [metadata, setMetadata] = useState<AnalysisMetadata | null>(null);
  const [selectedRange, setSelectedRange] = useState<TimeRangePreset>('2w');
  const [windowSize, setWindowSize] = useState({ width: 800, height: 600 });
  const [viewMode, setViewMode] = useState<'heatmap' | 'activity-graph'>('heatmap');

  useEffect(() => {
    const updateSize = () => {
      setWindowSize({
        width: Math.min(window.innerWidth - 64, 1200), // Max width with padding
        height: Math.min(window.innerHeight - 300, 800), // Leave space for other UI
      });
    };

    updateSize(); // Set initial size
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const handleRepositorySelect = async (path: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/git-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ repoPath: path, timeRange: selectedRange }),
      });

      const result = await response.json();

      if (result.success) {
        setTreeData(result.data);
        setMetadata(result.metadata);
        setRepoPath(path);
      } else {
        setError(result.error);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to analyze repository';
      setError(errorMessage);
      console.error('Analysis failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRangeChange = async (newRange: TimeRangePreset) => {
    if (!repoPath) return; // No repository selected yet

    setSelectedRange(newRange);
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/git-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ repoPath, timeRange: newRange }),
      });

      const result = await response.json();

      if (result.success) {
        setTreeData(result.data);
        setMetadata(result.metadata);
      } else {
        setError(result.error);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to analyze repository';
      setError(errorMessage);
      console.error('Analysis failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        {isLoading ? (
          <LoadingState message="Analyzing repository..." />
        ) : (
          <>
            <RepositorySelector
              onRepositorySelected={handleRepositorySelect}
              isLoading={isLoading}
              error={error || undefined}
              currentPath={repoPath}
              onError={setError}
            />
            {error && (
              <div className="mt-6">
                <ErrorDisplay
                  error={error}
                  onRetry={() => {
                    if (repoPath) {
                      handleRepositorySelect(repoPath);
                    }
                  }}
                  onSelectDifferent={() => {
                    setError(null);
                    setTreeData(null);
                    setMetadata(null);
                    setRepoPath('');
                  }}
                  isRetrying={isLoading}
                />
              </div>
            )}
          </>
        )}

        {treeData && metadata && (
          <div className="mt-8">
            <h2 className="text-xl font-bold mb-4">Repository Analysis</h2>
            <DateRangeSelector
              selected={selectedRange}
              onRangeChange={handleRangeChange}
              disabled={isLoading}
            />
            <div className="mt-4">
              <ViewToggle
                selected={viewMode}
                onViewChange={setViewMode}
                disabled={isLoading}
              />
            </div>
            <div className="mt-6">
              {metadata.filesDisplayed === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="text-gray-500 mb-4">
                    <svg
                      className="w-12 h-12 mx-auto"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">No Commits Found</h3>
                  <p className="text-gray-600 text-center">
                    No commits were found in the selected time period ({metadata.timeRange}).
                    Try selecting a different time range or repository.
                  </p>
                </div>
              ) : (
                <>
                  {viewMode === 'heatmap' ? (
                    <>
                      <TreemapChart
                        data={treeData}
                        width={windowSize.width}
                        height={windowSize.height}
                      />
                      <ColorLegend className="mt-4" />
                    </>
                  ) : (
                    <>
                      <ForceGraphChart
                        data={treeData}
                        width={windowSize.width}
                        height={windowSize.height}
                      />
                      <ColorLegend 
                        className="mt-4" 
                        mode="discrete"
                        discreteColors={[
                          { label: 'Ruby (.rb)', color: '#E0115F' },
                          { label: 'React (.tsx)', color: '#ADD8E6' },
                          { label: 'Other/Test', color: '#808080' }
                        ]}
                      />
                    </>
                  )}
                </>
              )}
            </div>

            {metadata && (
              <div className="mt-6 card">
                <h3 className="text-lg font-semibold mb-3">Analysis Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-gray-500">Files Analyzed</div>
                    <div className="font-semibold text-lg">{metadata.totalFilesAnalyzed?.toLocaleString() || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Files Displayed</div>
                    <div className="font-semibold text-lg">{metadata.filesDisplayed?.toLocaleString() || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Total Commits</div>
                    <div className="font-semibold text-lg">{metadata.totalCommits?.toLocaleString() || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Analysis Time</div>
                    <div className="font-semibold text-lg">{metadata.analysisDurationMs ? `${metadata.analysisDurationMs}ms` : 'N/A'}</div>
                  </div>
                </div>
                <div className="mt-3 text-sm text-gray-600">
                  Time Range: {metadata.timeRange}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
