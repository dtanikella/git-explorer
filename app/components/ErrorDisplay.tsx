'use client';

import React from 'react';

interface ErrorDisplayProps {
  /** Error message to display */
  error: string;
  /** Callback when user clicks retry */
  onRetry: () => void;
  /** Callback when user wants to select a different repository */
  onSelectDifferent: () => void;
  /** Whether retry is currently in progress */
  isRetrying?: boolean;
}

export function ErrorDisplay({ error, onRetry, onSelectDifferent, isRetrying }: ErrorDisplayProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 bg-red-50 border border-red-200 rounded-lg max-w-md mx-auto">
      <div className="text-red-600 mb-4">
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
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-red-800 mb-2">Analysis Failed</h3>
      <p className="text-red-700 text-center mb-6">{error}</p>
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={onRetry}
          disabled={isRetrying}
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isRetrying ? 'Retrying...' : 'Try Again'}
        </button>
        <button
          onClick={onSelectDifferent}
          className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
        >
          Select Different Repository
        </button>
      </div>
    </div>
  );
}