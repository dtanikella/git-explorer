'use client';

import { useState } from 'react';

interface PathInputProps {
  onSubmit: (path: string) => void;
  error?: string;
  loading?: boolean;
}

export function PathInput({ onSubmit, error, loading }: PathInputProps) {
  const [path, setPath] = useState('');
  const [clientError, setClientError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setClientError('');

    if (!path.trim()) {
      setClientError('Path is required');
      return;
    }

    onSubmit(path.trim());
  };

  const getErrorMessage = (errorCode?: string) => {
    switch (errorCode) {
      case 'PATH_NOT_FOUND':
        return 'Repository path not found';
      case 'NOT_A_DIRECTORY':
        return 'Path is not a directory';
      case 'PERMISSION_DENIED':
        return 'Permission denied accessing repository';
      default:
        return errorCode;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="repo-path" className="block text-sm font-medium text-gray-700 mb-2">
          Repository Path
        </label>
        <input
          id="repo-path"
          type="text"
          value={path}
          onChange={(e) => setPath(e.target.value)}
          placeholder="Enter absolute path to repository"
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          disabled={loading}
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Loading...' : 'Visualize Repository'}
      </button>

      {(clientError || error) && (
        <div className="text-red-600 text-sm">
          {clientError || getErrorMessage(error)}
        </div>
      )}
    </form>
  );
}