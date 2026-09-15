import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AreaProvider } from '@/app/contexts/AreaContext';
import AreaManagerView from '@/app/components/areas/AreaManagerView';

describe('Empty state', () => {
  const renderEmpty = () => {
    return render(
      <AreaProvider areas={[]}>
        <AreaManagerView repoPath="/test" nodes={[]} />
      </AreaProvider>
    );
  };

  it('shows "No areas yet" message', () => {
    renderEmpty();
    expect(screen.getByText(/No areas yet/i)).toBeInTheDocument();
  });

  it('shows hint to create first area', () => {
    renderEmpty();
    expect(screen.getByText(/Create your first area/i)).toBeInTheDocument();
  });

  it('shows inline create when + New Area is clicked from empty state', () => {
    renderEmpty();
    fireEvent.click(screen.getByTestId('new-area-button'));
    expect(screen.getByTestId('inline-create-input')).toBeInTheDocument();
  });

  it('area appears in tree after creation from empty state', () => {
    renderEmpty();
    fireEvent.click(screen.getByTestId('new-area-button'));
    const input = screen.getByTestId('inline-create-input');
    fireEvent.change(input, { target: { value: 'First Area' } });
    fireEvent.click(screen.getByTestId('inline-create-confirm'));
    // Empty state should be gone
    expect(screen.queryByText(/No areas yet/i)).not.toBeInTheDocument();
    // Area should appear
    expect(screen.getByText('First Area')).toBeInTheDocument();
  });
});