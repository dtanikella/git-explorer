import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import AreaManagerView from '@/app/components/areas/AreaManagerView';

describe('AreaManagerView shell', () => {
  it('renders the toolbar with + New Area button', () => {
    render(<AreaManagerView repoPath="/test" nodes={[]} areas={[]} />);
    expect(screen.getByTestId('area-toolbar')).toBeInTheDocument();
    expect(screen.getByTestId('new-area-button')).toBeInTheDocument();
    expect(screen.getByText('+ New Area')).toBeInTheDocument();
  });

  it('renders the tree table area', () => {
    render(<AreaManagerView repoPath="/test" nodes={[]} areas={[]} />);
    expect(screen.getByTestId('area-tree-table')).toBeInTheDocument();
  });

  it('renders the node browser right rail', () => {
    render(<AreaManagerView repoPath="/test" nodes={[]} areas={[]} />);
    expect(screen.getByTestId('node-browser-pane')).toBeInTheDocument();
  });

  it('shows empty state when no areas exist', () => {
    render(<AreaManagerView repoPath="/test" nodes={[]} areas={[]} />);
    expect(screen.getByText(/No areas yet/i)).toBeInTheDocument();
  });

  it('renders the Nodes header in the right rail', () => {
    render(<AreaManagerView repoPath="/test" nodes={[]} areas={[]} />);
    expect(screen.getByText('Nodes')).toBeInTheDocument();
  });
});