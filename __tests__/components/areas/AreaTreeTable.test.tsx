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
    contains: ['sym-login', 'sym-logout'],
    parent: null,
    children: ['payments'],
    clusterStrength: 0,
  },
  {
    id: 'payments',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    name: 'Payments',
    type: 'business_domain',
    contains: ['sym-charge'],
    parent: 'auth',
    children: [],
    clusterStrength: 0,
  },
  {
    id: 'utils',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    name: 'Utils Lib',
    type: 'utils',
    contains: [],
    parent: null,
    children: [],
    clusterStrength: 0,
  },
];

const mockRuntimeState = new Map<string, AreaRuntimeState>([
  ['auth', { visible: true, color: '#3b82f6' }],
  ['payments', { visible: true, color: '#10b981' }],
  ['utils', { visible: true, color: '#f59e0b' }],
]);

describe('AreaTreeTable', () => {
  it('renders all top-level areas', () => {
    render(<AreaTreeTable areas={mockAreas} runtimeState={mockRuntimeState} />);
    expect(screen.getByText('Auth Service')).toBeInTheDocument();
    expect(screen.getByText('Utils Lib')).toBeInTheDocument();
  });

  it('renders the header columns', () => {
    render(<AreaTreeTable areas={mockAreas} runtimeState={mockRuntimeState} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
    expect(screen.getByText('Members')).toBeInTheDocument();
  });

  it('shows member count for areas, rolled up to include descendants', () => {
    render(<AreaTreeTable areas={mockAreas} runtimeState={mockRuntimeState} />);
    // Auth has 2 direct members + Payments' 1 nested member = 3
    expect(screen.getByText('3')).toBeInTheDocument();
    // Utils has no members
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('shows type pill with color from runtime state', () => {
    render(<AreaTreeTable areas={mockAreas} runtimeState={mockRuntimeState} />);
    const typePills = screen.getAllByText('business_domain');
    expect(typePills.length).toBeGreaterThanOrEqual(1);
    // First pill should have the color from runtime state
    const pill = typePills[0];
    expect(pill).toHaveAttribute('style');
    expect(pill.style.color).toBeTruthy();
  });

  it('expands child areas on caret click', () => {
    render(<AreaTreeTable areas={mockAreas} runtimeState={mockRuntimeState} />);
    // Payments should not be visible initially (child of Auth)
    expect(screen.queryByText('Payments')).not.toBeInTheDocument();
    
    // Click expand caret on Auth
    const caret = screen.getByTestId('expand-caret-auth');
    fireEvent.click(caret);
    
    // Now Payments should be visible
    expect(screen.getByText('Payments')).toBeInTheDocument();
  });
});