'use client';

import React from 'react';

interface DiscreteColorItem {
  label: string;
  color: string;
}

interface ColorLegendProps {
  className?: string;
  mode?: 'gradient' | 'discrete';
  discreteColors?: DiscreteColorItem[];
}

export function ColorLegend({ 
  className = '', 
  mode = 'gradient',
  discreteColors = []
}: ColorLegendProps) {
  if (mode === 'discrete') {
    return (
      <div className={`flex flex-col items-center gap-2 ${className}`}>
        <div className="text-sm font-medium text-gray-700">File Types</div>
        <div className="flex items-center gap-4">
          {discreteColors.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded border border-gray-300"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-sm text-gray-600">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Default gradient mode for treemap
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