import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AreaProvider } from '@/app/contexts/AreaContext';
import AreaManagerView from '@/app/components/areas/AreaManagerView';
import type { Area } from '@/lib/areas/types';

describe('AreaManagerView shell', () => {
  const renderWithProvider = (areas: Area[], nodes: any[] = []) => {
    return render(
      <AreaProvider areas={areas}>
        <AreaManagerView repoPath="/test" nodes={nodes} />
      </AreaProvider>
    );
  };

  it('renders the toolbar with + New Area button', () => {
    renderWithProvider([]);
    expect(screen.getByTestId('area-toolbar')).toBeInTheDocument();
    expect(screen.getByTestId('new-area-button')).toBeInTheDocument();
    expect(screen.getByText('+ New Area')).toBeInTheDocument();
  });

  it('renders the tree table', () => {
    renderWithProvider([]);
    expect(screen.getByTestId('area-tree-table')).toBeInTheDocument();
  });

  it('renders the node browser right rail', () => {
    renderWithProvider([]);
    expect(screen.getByTestId('node-browser-pane')).toBeInTheDocument();
  });

  it('shows empty state when no areas exist', () => {
    renderWithProvider([]);
    expect(screen.getByText(/No areas yet/i)).toBeInTheDocument();
  });

  it('renders the Nodes header in the right rail', () => {
    renderWithProvider([]);
    expect(screen.getByText('Nodes')).toBeInTheDocument();
  });

  it('shows area names when areas exist', () => {
    const areas: Area[] = [
      {
        id: 'auth',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        name: 'Auth Service',
        type: 'business_domain',
        contains: [],
        parent: null,
        children: [],
        clusterStrength: 0,
      },
    ];
    renderWithProvider(areas);
    expect(screen.getByText('Auth Service')).toBeInTheDocument();
  });
});