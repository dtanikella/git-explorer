'use client';

import React from 'react';

interface ColorLegendProps {
  className?: string;
}

export function ColorLegend({ className = '' }: ColorLegendProps) {
  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <div className="text-sm font-medium text-gray-700">Activity Level</div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-600">Least active</span>
        <div
          className="h-4 w-32 rounded"
          style={{
            background: 'linear-gradient(to right, #E5E5E5 0%, #006400 100%)'
          }}
        />
        <span className="text-sm text-gray-600">Most active</span>
      </div>
    </div>
  );
}