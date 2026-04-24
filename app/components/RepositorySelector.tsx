'use client';

import { useState } from 'react';

interface RepositorySelectorProps {
  onRepositorySelected: (path: string) => void;
  isLoading?: boolean;
  error?: string;
  currentPath?: string;
  onError?: (message: string) => void;
}

export default function RepositorySelector({
  onRepositorySelected,
  isLoading = false,
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
    try {
      const res = await fetch('/api/browse-directory');
      const json = await res.json();
      if (json.success && json.path) {
        setInputPath(json.path);
        onRepositorySelected(json.path);
      }
    } catch {
      onError?.('Failed to open folder picker.');
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
            className="flex-1 input-field disabled:bg-gray-100"
          />
          <button
            onClick={handlePathSubmit}
            disabled={isLoading || !inputPath.trim()}
            className="btn-primary disabled:bg-gray-400 disabled:cursor-not-allowed"
            aria-label={isLoading ? 'Analyzing repository' : 'Analyze repository'}
          >
            {isLoading ? 'Analyzing...' : 'Analyze'}
          </button>
          <button
            onClick={handleFileSelect}
            disabled={isLoading}
            className="btn-secondary disabled:bg-gray-400 disabled:cursor-not-allowed"
            aria-label="Select directory"
          >
            Browse
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="error-message">
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