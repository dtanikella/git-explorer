'use client';

import { useState, useEffect } from 'react';
import RepositorySelector from './components/RepositorySelector';
import DateRangeSelector from './components/DateRangeSelector';
import { CoChangeGraph } from '@/lib/git/types';
import ForceDirectedGraph from './components/force-directed-graph';

export default function HomePage() {
  const [repoPath, setRepoPath] = useState<string>('');
  const [graphData, setGraphData] = useState<CoChangeGraph | null>(null);
  const [windowSize, setWindowSize] = useState({ width: 800, height: 600 });
  const [dateRange, setDateRange] = useState<string>('2w');

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

  const fetchGraphData = async (repo: string, range: string) => {
    try {
      const response = await fetch('/api/git-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ repoPath: repo, timeRange: range }),
      });
      const result = await response.json();
      if (result.success) {
        setGraphData(result.data);
      } else {
        setGraphData(null);
      }
    } catch (err) {
      setGraphData(null);
      console.error('Analysis failed:', err);
    }
  };

  const handleRepositorySelect = (path: string) => {
    setRepoPath(path);
    fetchGraphData(path, dateRange);
  };

  useEffect(() => {
    if (repoPath) {
      fetchGraphData(repoPath, dateRange);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange]);

    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="w-full max-w-6xl mx-auto">
          {/* Top row: repo input, analyze, browse (inside RepositorySelector) */}
          <div style={{ width: '100%', marginBottom: 16 }}>
            <RepositorySelector
              onRepositorySelected={handleRepositorySelect}
              currentPath={repoPath}
              isLoading={false}
              error={undefined}
              onError={undefined}
            />
          </div>
          {/* Second row: repo presets and date range selector */}
          <div style={{ display: 'flex', flexDirection: 'row', gap: 16, marginBottom: 24, width: '100%' }}>
            <div style={{ display: 'flex', flexDirection: 'row', gap: 16, flex: 3 }}>
              <button
                className="btn-secondary"
                style={{ minWidth: 140 }}
                onClick={() => handleRepositorySelect('/Users/dhananjaytanikella/code/fedora')}
              >
                fedora
              </button>
              <button
                className="btn-secondary"
                style={{ minWidth: 140 }}
                onClick={() => handleRepositorySelect('/Users/dhananjaytanikella/code/mono-frontend')}
              >
                mono-frontend
              </button>
              <button
                className="btn-secondary"
                style={{ minWidth: 220 }}
                onClick={() => handleRepositorySelect('/Users/dhananjaytanikella/code/student-checkout-frontend')}
              >
                student-checkout-frontend
              </button>
            </div>
            <div style={{ flex: 2, display: 'flex', justifyContent: 'flex-end' }}>
              <DateRangeSelector value={dateRange} onChange={setDateRange} />
            </div>
          </div>
          {/* Graph area: take as much width as possible */}
          {graphData && (
            <div style={{ width: '100%', minHeight: 600, background: '#fff', borderRadius: 8, border: '1px solid #ccc', padding: 0 }}>
              <ForceDirectedGraph data={graphData} />
            </div>
          )}
        </div>
      </main>
    );
}
