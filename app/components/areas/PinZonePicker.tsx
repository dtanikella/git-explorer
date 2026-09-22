'use client';

import React from 'react';

interface PinZonePickerProps {
  areaId: string;
  value: number[];
  onChange: (zones: number[]) => void;
  size?: number;
}

const ZONE_LABELS = [
  'top-left', 'top-center', 'top-right',
  'center-left', 'center', 'center-right',
  'bottom-left', 'bottom-center', 'bottom-right',
];

// Compact 3x3 toggle grid for pinning an area to one or more regions of the
// repo-graph canvas. Controlled: `value` holds selected row-major cell indices (0-8).
export default function PinZonePicker({ areaId, value, onChange, size = 36 }: PinZonePickerProps) {
  const selected = new Set(value);

  const toggleZone = (index: number) => {
    const next = new Set(selected);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    onChange(Array.from(next).sort((a, b) => a - b));
  };

  const gap = 2;
  const cellSize = (size - gap * 2) / 3;

  return (
    <div
      role="group"
      aria-label="Pin to graph zones"
      data-testid={`pin-zone-picker-${areaId}`}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(3, ${cellSize}px)`,
        gridTemplateRows: `repeat(3, ${cellSize}px)`,
        gap,
        width: size,
        height: size,
        flexShrink: 0,
        padding: 2,
        border: '1px solid #e5e7eb',
        borderRadius: 4,
        background: '#f9fafb',
      }}
    >
      {ZONE_LABELS.map((label, index) => {
        const isSelected = selected.has(index);
        return (
          <button
            key={index}
            type="button"
            data-testid={`pin-zone-cell-${areaId}-${index}`}
            aria-pressed={isSelected}
            title={`Pin toward ${label.replace('-', ' ')}`}
            onClick={() => toggleZone(index)}
            style={{
              width: cellSize,
              height: cellSize,
              padding: 0,
              border: isSelected ? '1px solid #3b82f6' : '1px solid #d1d5db',
              borderRadius: 2,
              background: isSelected ? '#3b82f6' : '#ffffff',
              cursor: 'pointer',
              boxShadow: isSelected ? 'inset 0 0 0 1px #3b82f6' : 'none',
              transition: 'background 0.1s ease, border-color 0.1s ease',
            }}
          />
        );
      })}
    </div>
  );
}
