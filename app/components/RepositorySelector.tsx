'use client';

import { useState } from 'react';

interface RepositorySelectorProps {
  onRepositorySelected: (path: string) => void;
  isLoading: boolean;
  error?: string;
  currentPath?: string;
  onError?: (message: string) => void;
}

export default function RepositorySelector({
  onRepositorySelected,
  isLoading,
  error,
  currentPath,
  onError,
}: RepositorySelectorProps) {
  const [inputPath, setInputPath] = useState<string>('');

  const handlePathSubmit = () => {
    if (!inputPath.trim()) {
      onError?.('Please enter a repository path');
      return;
    }
    onRepositorySelected(inputPath.trim());
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      handlePathSubmit();
    }
  };

  const handleFileSelect = async () => {
    if (isLoading) return;

    // Fallback: try to use directory picker if available
    if ('showDirectoryPicker' in window) {
      try {
        // @ts-ignore - File System Access API
        const handle = await window.showDirectoryPicker();
        onRepositorySelected(handle.name);
      } catch (error) {
        if ((error as any).name !== 'AbortError') {
          onError?.('Failed to select directory. Please enter path manually.');
        }
      }
    } else {
      onError?.('Directory picker not supported. Please enter path manually.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="repo-path" className="block text-sm font-medium text-gray-700">
          Repository Path
        </label>
        <div className="flex space-x-2">
          <input
            id="repo-path"
            type="text"
            value={inputPath}
            onChange={(e) => setInputPath(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="/path/to/your/git/repository"
            disabled={isLoading}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          />
          <button
            onClick={handlePathSubmit}
            disabled={isLoading || !inputPath.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            aria-label={isLoading ? 'Analyzing repository' : 'Analyze repository'}
          >
            {isLoading ? 'Analyzing...' : 'Analyze'}
          </button>
          <button
            onClick={handleFileSelect}
            disabled={isLoading}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            aria-label="Select directory"
          >
            Browse
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="text-red-600 text-sm">
          {error}
        </div>
      )}

      {currentPath && (
        <div className="text-green-600 text-sm">
          Current: {currentPath}
        </div>
      )}
    </div>
  );
}