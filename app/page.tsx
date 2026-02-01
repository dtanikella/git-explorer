'use client';

import { useState } from 'react';
import { FileTree } from '../lib/types';
import { fileSizeStrategy } from '../lib/strategies/sizing';
import { extensionColorStrategy } from '../lib/strategies/coloring';
import { RepoVisualization } from './components/RepoVisualization';
import { PathInput } from './components/PathInput';

interface ApiResponse {
  success: boolean;
  data?: FileTree;
  error?: {
    code: string;
    message: string;
  };
}

export default function Home() {
  const [fileTree, setFileTree] = useState<FileTree | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (path: string) => {
    setLoading(true);
    setError(null);
    setFileTree(null);

    try {
      const response = await fetch('/api/file-tree', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path }),
      });

      const result: ApiResponse = await response.json();

      if (result.success && result.data) {
        setFileTree(result.data);
      } else if (result.error) {
        setError(result.error.code);
      } else {
        setError('UNKNOWN_ERROR');
      }
    } catch (err) {
      setError('NETWORK_ERROR');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-4xl font-bold mb-8">Git Repository Visualizer</h1>

      <div className="mb-8">
        <PathInput onSubmit={handleSubmit} error={error} loading={loading} />
      </div>

      {fileTree && (
        fileTree.children && fileTree.children.length > 0 ? (
          <RepoVisualization
            data={fileTree}
            sizingStrategy={fileSizeStrategy}
            coloringStrategy={extensionColorStrategy}
          />
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">Repository is empty</p>
          </div>
        )
      )}
    </main>
  );
}
