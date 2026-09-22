import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import AreaTreeTable from '@/app/components/areas/AreaTreeTable';
import type { Area, AreaRuntimeState } from '@/lib/areas/types';

const mockAreas: Area[] = [
  {
    id: 'auth',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    name: 'Auth Service',
    type: 'business_domain',
    contains: ['sym-login'],
    parent: null,
    children: [],
    clusterStrength: 0,
    pinnedZones: [4], // pinned to center
  },
  {
    id: 'payments',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    name: 'Payments',
    type: 'business_domain',
    contains: ['sym-charge'],
    parent: null,
    children: [],
    clusterStrength: 0,
    // no pinnedZones — old-format area
  },
];

const mockRuntimeState = new Map<string, AreaRuntimeState>([
  ['auth', { visible: true, color: '#3b82f6' }],
  ['payments', { visible: true, color: '#10b981' }],
]);

describe('AreaTreeTable pin column', () => {
  it('renders the Pin column header', () => {
    render(
      <AreaTreeTable
        areas={mockAreas}
        runtimeState={mockRuntimeState}
      />
    );
    expect(screen.getByText('Pin')).toBeInTheDocument();
  });

  it('renders a PinZonePicker for each area row', () => {
    render(
      <AreaTreeTable
        areas={mockAreas}
        runtimeState={mockRuntimeState}
      />
    );
    expect(screen.getByTestId('pin-zone-picker-auth')).toBeInTheDocument();
    expect(screen.getByTestId('pin-zone-picker-payments')).toBeInTheDocument();
  });

  it('reflects pinnedZones value on the picker (center cell selected)', () => {
    render(
      <AreaTreeTable
        areas={mockAreas}
        runtimeState={mockRuntimeState}
      />
    );
    expect(screen.getByTestId('pin-zone-cell-auth-4')).toHaveAttribute('aria-pressed', 'true');
    // Unselected cell
    expect(screen.getByTestId('pin-zone-cell-auth-0')).toHaveAttribute('aria-pressed', 'false');
  });

  it('old-format area without pinnedZones loads with no cells selected', () => {
    render(
      <AreaTreeTable
        areas={mockAreas}
        runtimeState={mockRuntimeState}
      />
    );
    // payments has no pinnedZones — all cells should be unselected
    for (let i = 0; i < 9; i++) {
      expect(screen.getByTestId(`pin-zone-cell-payments-${i}`)).toHaveAttribute('aria-pressed', 'false');
    }
  });

  it('calls onTogglePinZone with areaId and full zones array when a cell is toggled', () => {
    const handleTogglePinZone = jest.fn();
    render(
      <AreaTreeTable
        areas={mockAreas}
        runtimeState={mockRuntimeState}
        onTogglePinZone={handleTogglePinZone}
      />
    );
    // Toggle cell 0 on payments (currently unpinned)
    fireEvent.click(screen.getByTestId('pin-zone-cell-payments-0'));
    expect(handleTogglePinZone).toHaveBeenCalledWith('payments', [0]);
  });

  it('preserves existing row layout structure', () => {
    const { container } = render(
      <AreaTreeTable
        areas={mockAreas}
        runtimeState={mockRuntimeState}
      />
    );
    // The table should have one header row and area rows
    const rows = container.querySelectorAll('[data-testid^="area-row-"]');
    expect(rows.length).toBe(2);
  });
});