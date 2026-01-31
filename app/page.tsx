'use client';

import { useState } from 'react';
import { FileTree } from '../lib/types';
import { fileSizeStrategy } from '../lib/strategies/sizing';
import { extensionColorStrategy } from '../lib/strategies/coloring';
import { RepoVisualization } from './components/RepoVisualization';

interface ApiResponse {
  success: boolean;
  data?: FileTree;
  error?: {
    code: string;
    message: string;
  };
}

export default function Home() {
  const [path, setPath] = useState('');
  const [fileTree, setFileTree] = useState<FileTree | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!path.trim()) return;

    setLoading(true);
    setError(null);
    setFileTree(null);

    try {
      const response = await fetch('/api/file-tree', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path: path.trim() }),
      });

      const result: ApiResponse = await response.json();

      if (result.success && result.data) {
        setFileTree(result.data);
      } else if (result.error) {
        setError(result.error.message);
      } else {
        setError('Unknown error occurred');
      }
    } catch (err) {
      setError('Failed to fetch repository data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-4xl font-bold mb-8">Git Repository Visualizer</h1>

      <form onSubmit={handleSubmit} className="mb-8">
        <div className="flex gap-4">
          <input
            type="text"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="Enter absolute path to repository"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !path.trim()}
            className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {loading ? 'Loading...' : 'Visualize'}
          </button>
        </div>
      </form>

      {error && (
        <div className="mb-8 p-4 bg-red-100 border border-red-400 text-red-700 rounded-md">
          {error}
        </div>
      )}

      {fileTree && (
        <RepoVisualization
          data={fileTree}
          sizingStrategy={fileSizeStrategy}
          coloringStrategy={extensionColorStrategy}
        />
      )}
    </main>
  );
}
