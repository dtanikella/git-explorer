'use client';

import { useState } from 'react';
import RepositorySelector from './components/RepositorySelector';
import LoadingState from './components/LoadingState';
import { analyzeClientRepository, ClientTreeNode } from '@/lib/git/client-analyzer';

export default function Home() {
  const [repoHandle, setRepoHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [treeData, setTreeData] = useState<ClientTreeNode | null>(null);

  const handleRepositorySelect = async (handle: FileSystemDirectoryHandle) => {
    setIsLoading(true);
    setError(null);

    try {
      const tree = await analyzeClientRepository(handle, '2w');
      setTreeData(tree);
      setRepoHandle(handle);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to analyze repository';
      setError(errorMessage);
      console.error('Analysis failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        {isLoading ? (
          <LoadingState message="Analyzing repository..." />
        ) : (
          <RepositorySelector
            onRepositorySelected={handleRepositorySelect}
            isLoading={false}
            error={error || undefined}
            currentPath={repoHandle?.name}
          />
        )}

        {treeData && (
          <div className="mt-8">
            <h2 className="text-xl font-bold mb-4">Repository Analysis</h2>
            <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
              {JSON.stringify(treeData, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </main>
  );
}
