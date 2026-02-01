'use client';

import React from 'react';
import { TimeRangePreset } from '@/lib/git/types';

interface DateRangeSelectorProps {
  /** Currently selected time range */
  selected: TimeRangePreset;

  /** Callback when user selects a new range */
  onRangeChange: (range: TimeRangePreset) => void;

  /** Whether selector should be disabled (during loading) */
  disabled?: boolean;
}

const RANGE_OPTIONS: { value: TimeRangePreset; label: string }[] = [
  { value: '2w', label: 'Last 2 weeks' },
  { value: '1m', label: 'Last Month' },
  { value: '3m', label: 'Last Quarter' },
  { value: '6m', label: 'Last 6 Months' },
  { value: '1y', label: 'Last Year' },
];

export function DateRangeSelector({ selected, onRangeChange, disabled }: DateRangeSelectorProps) {
  return (
    <fieldset
      className="space-y-2"
      disabled={disabled}
      role="radiogroup"
      aria-label="Select time range"
    >
      <legend className="text-sm font-medium text-gray-700 mb-3">Time Range</legend>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
        {RANGE_OPTIONS.map((option) => (
          <label
            key={option.value}
            className={`
              relative flex items-center justify-center px-3 py-2 text-sm font-medium rounded-md border cursor-pointer transition-colors
              ${selected === option.value
                ? 'bg-blue-50 border-blue-200 text-blue-900'
                : 'bg-white border-gray-200 text-gray-900 hover:bg-gray-50'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            <input
              type="radio"
              name="timeRange"
              value={option.value}
              checked={selected === option.value}
              onChange={() => onRangeChange(option.value)}
              disabled={disabled}
              className="sr-only"
            />
            <span className="text-center">{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}