'use client';

import { useState } from 'react';
import RepositorySelector from './components/RepositorySelector';
import LoadingState from './components/LoadingState';
import { TreemapChart } from './components/TreemapChart';
import { TreeNode } from '@/lib/git/types';

export default function Home() {
  const [repoPath, setRepoPath] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [treeData, setTreeData] = useState<TreeNode | null>(null);

  const handleRepositorySelect = async (path: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/git-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ repoPath: path, timeRange: '2w' }),
      });

      const result = await response.json();

      if (result.success) {
        console.log('Page: Setting treeData:', {
          hasChildren: !!result.data.children,
          childrenLength: result.data.children?.length,
          children: result.data.children?.map(c => ({ name: c.name, isFile: c.isFile }))
        });
        setTreeData(result.data);
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

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        {isLoading ? (
          <LoadingState message="Analyzing repository..." />
        ) : (
          <RepositorySelector
            onRepositorySelected={handleRepositorySelect}
            isLoading={isLoading}
            error={error || undefined}
            currentPath={repoPath}
            onError={setError}
          />
        )}

        {treeData && (
          <div className="mt-8">
            <h2 className="text-xl font-bold mb-4">Repository Analysis</h2>
            <TreemapChart
              data={treeData}
              width={800}
              height={600}
            />
          </div>
        )}
      </div>
    </main>
  );
}
