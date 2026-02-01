'use client';

import { useState } from 'react';

interface RepositorySelectorProps {
  onRepositorySelected: (handle: FileSystemDirectoryHandle) => void;
  isLoading: boolean;
  error?: string;
  currentPath?: string;
}

export default function RepositorySelector({
  onRepositorySelected,
  isLoading,
  error,
  currentPath,
}: RepositorySelectorProps) {
  const [selectedPath, setSelectedPath] = useState<string>('');

  const handleSelectDirectory = async () => {
    if (isLoading) return;

    // Check if File System Access API is supported
    if (!('showDirectoryPicker' in window)) {
      setError('Directory picker is not supported in this browser. Please use Chrome, Edge, or another Chromium-based browser.');
      return;
    }

    try {
      // @ts-ignore - File System Access API
      const handle = await window.showDirectoryPicker();
      setSelectedPath(handle.name);
      setError(undefined);
      onRepositorySelected(handle);
    } catch (error) {
      if ((error as any).name !== 'AbortError') {
        console.error('Directory selection failed:', error);
        setError('Failed to select directory. Please try again.');
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <button
          onClick={handleSelectDirectory}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          aria-label={isLoading ? 'Selecting repository' : 'Select repository directory'}
        >
          {isLoading ? 'Selecting...' : 'Select Repository Directory'}
        </button>
      </div>

      {selectedPath && !error && (
        <div className="text-green-600 text-sm">
          Selected: {selectedPath}
        </div>
      )}

      {error && (
        <div role="alert" className="text-red-600 text-sm">
          {error}
        </div>
      )}

      {currentPath && !error && (
        <div className="text-green-600 text-sm">
          Current: {currentPath}
        </div>
      )}
    </div>
  );
}