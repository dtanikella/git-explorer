import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AreaProvider } from '@/app/contexts/AreaContext';
import AreaManagerView from '@/app/components/areas/AreaManagerView';
import type { Area } from '@/lib/areas/types';

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
  },
  {
    id: 'payments',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    name: 'Payments',
    type: 'utils',
    contains: [],
    parent: null,
    children: [],
    clusterStrength: 0,
  },
  {
    id: 'lib',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    name: 'Library',
    type: 'library',
    contains: ['sym-helper'],
    parent: null,
    children: ['sub-lib'],
    clusterStrength: 0,
  },
  {
    id: 'sub-lib',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    name: 'Sub Library',
    type: 'library',
    contains: ['sym-sub'],
    parent: 'lib',
    children: [],
    clusterStrength: 0,
  },
];

describe('AreaManagerView rename/delete', () => {
  const renderWithProvider = (areas: Area[] = mockAreas) => {
    return render(
      <AreaProvider areas={areas}>
        <AreaManagerView repoPath="/test" nodes={[]} />
      </AreaProvider>
    );
  };

  it('shows rename input when rename button is clicked', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('rename-area-auth'));
    expect(screen.getByTestId('inline-rename-input-auth')).toBeInTheDocument();
  });

  it('renames area on confirm', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('rename-area-auth'));
    const input = screen.getByTestId('inline-rename-input-auth');
    fireEvent.change(input, { target: { value: 'Renamed Auth' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByText('Renamed Auth')).toBeInTheDocument();
    expect(screen.queryByText('Auth Service')).not.toBeInTheDocument();
  });

  it('shows delete confirmation with orphan vs collapse choice for area with children', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('delete-area-lib'));
    expect(screen.getByTestId('delete-confirm-dialog')).toBeInTheDocument();
    expect(screen.getByText(/orphan/i)).toBeInTheDocument();
    expect(screen.getByText(/collapse/i)).toBeInTheDocument();
  });

  it('orphaning re-parents children to grandparent', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('delete-area-lib'));
    fireEvent.click(screen.getByTestId('delete-orphan-btn'));
    // Sub Library should now be a top-level area (parent = null)
    expect(screen.getByText('Sub Library')).toBeInTheDocument();
    // Library should be gone
    expect(screen.queryByText('Library')).not.toBeInTheDocument();
  });

  it('collapse deletes area and its children', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('delete-area-lib'));
    fireEvent.click(screen.getByTestId('delete-collapse-btn'));
    expect(screen.queryByText('Library')).not.toBeInTheDocument();
    expect(screen.queryByText('Sub Library')).not.toBeInTheDocument();
  });

  it('immediately deletes area without children (no dialog needed)', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('delete-area-payments'));
    expect(screen.queryByText('Payments')).not.toBeInTheDocument();
  });

  it('cancels rename on Escape', () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId('rename-area-auth'));
    const input = screen.getByTestId('inline-rename-input-auth');
    fireEvent.change(input, { target: { value: 'Changed' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.getByText('Auth Service')).toBeInTheDocument();
    expect(screen.queryByText('Changed')).not.toBeInTheDocument();
  });
});