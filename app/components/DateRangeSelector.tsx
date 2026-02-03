import React from 'react';

const PRESET_OPTIONS = [
  { value: '2w', label: 'Last 2 weeks' },
  { value: '1m', label: 'Last Month' },
  { value: '3m', label: 'Last Quarter' },
  { value: '6m', label: 'Last 6 Months' },
  { value: '1y', label: 'Last Year' },
];

export interface DateRangeSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export default function DateRangeSelector({ value, onChange }: DateRangeSelectorProps) {
  return (
    <label style={{ display: 'inline-block', marginRight: 12 }}>
      Date Range:
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 4 }}
      >
        {PRESET_OPTIONS.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </label>
  );
}
