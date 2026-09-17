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
    contains: ['sym-login', 'sym-logout', 'sym-shared'],
    parent: null,
    children: [],
    clusterStrength: 0,
  },
  {
    id: 'payments',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    name: 'Payments',
    type: 'business_domain',
    contains: ['sym-charge', 'sym-shared'],
    parent: null,
    children: [],
    clusterStrength: 0,
  },
];

const mockRuntimeState = new Map<string, AreaRuntimeState>([
  ['auth', { visible: true, color: '#3b82f6' }],
  ['payments', { visible: true, color: '#10b981' }],
]);

const mockNodeNames: Record<string, string> = {
  'sym-login': 'login.ts',
  'sym-logout': 'logout.ts',
  'sym-shared': 'shared.ts',
  'sym-charge': 'charge.ts',
};

describe('AreaTreeTable member sub-rows', () => {
  it('shows member nodes when area is expanded', () => {
    render(
      <AreaTreeTable
        areas={mockAreas}
        runtimeState={mockRuntimeState}
        nodeNames={mockNodeNames}
      />
    );
    // Expand Auth
    fireEvent.click(screen.getByTestId('expand-caret-auth'));
    expect(screen.getByText('login.ts')).toBeInTheDocument();
    expect(screen.getByText('logout.ts')).toBeInTheDocument();
  });

  it('shows "+N" chip for nodes in multiple areas', () => {
    render(
      <AreaTreeTable
        areas={mockAreas}
        runtimeState={mockRuntimeState}
        nodeNames={mockNodeNames}
      />
    );
    fireEvent.click(screen.getByTestId('expand-caret-auth'));
    // shared.ts is in both auth and payments
    expect(screen.getByText(/\+1 other/)).toBeInTheDocument();
  });

  it('shows popover with other memberships on "+N" chip click', () => {
    render(
      <AreaTreeTable
        areas={mockAreas}
        runtimeState={mockRuntimeState}
        nodeNames={mockNodeNames}
      />
    );
    fireEvent.click(screen.getByTestId('expand-caret-auth'));
    // Click the +N chip
    fireEvent.click(screen.getByText(/\+1 other/));
    expect(screen.getByTestId('membership-popover-sym-shared')).toBeInTheDocument();
    expect(screen.getByText('Remove')).toBeInTheDocument();
  });

  it('tracks node membership across areas', () => {
    render(
      <AreaTreeTable
        areas={mockAreas}
        runtimeState={mockRuntimeState}
        nodeNames={mockNodeNames}
      />
    );
    // Expand payments
    fireEvent.click(screen.getByTestId('expand-caret-payments'));
    expect(screen.getByText('charge.ts')).toBeInTheDocument();
    expect(screen.getByText('shared.ts')).toBeInTheDocument();
  });

  it('removes a member from the row\'s own area via the per-row remove button', () => {
    const onRemoveMember = jest.fn();
    render(
      <AreaTreeTable
        areas={mockAreas}
        runtimeState={mockRuntimeState}
        nodeNames={mockNodeNames}
        onRemoveMember={onRemoveMember}
      />
    );
    fireEvent.click(screen.getByTestId('expand-caret-auth'));
    fireEvent.click(screen.getByTestId('remove-member-auth-sym-login'));
    expect(onRemoveMember).toHaveBeenCalledWith('auth', 'sym-login');
  });
});