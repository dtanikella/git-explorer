import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AreaProvider } from '@/app/contexts/AreaContext';
import AreaManagerView from '@/app/components/areas/AreaManagerView';
import type { Area } from '@/lib/areas/types';

describe('AreaManagerView create flow', () => {
  const renderWithProvider = (areas: Area[] = [], nodes: any[] = []) => {
    return render(
      <AreaProvider areas={areas}>
        <AreaManagerView repoPath="/test" nodes={nodes} areas={areas} />
      </AreaProvider>
    );
  };

  it('shows inline create input on + New Area click', () => {
    renderWithProvider([]);
    fireEvent.click(screen.getByTestId('new-area-button'));
    expect(screen.getByTestId('inline-create-input')).toBeInTheDocument();
  });

  it('creates a new area when confirm is clicked', () => {
    renderWithProvider([]);
    fireEvent.click(screen.getByTestId('new-area-button'));
    const input = screen.getByTestId('inline-create-input');
    fireEvent.change(input, { target: { value: 'New Area' } });
    fireEvent.click(screen.getByTestId('inline-create-confirm'));
    expect(screen.getByText('New Area')).toBeInTheDocument();
  });

  it('cancels inline creation', () => {
    renderWithProvider([]);
    fireEvent.click(screen.getByTestId('new-area-button'));
    fireEvent.change(screen.getByTestId('inline-create-input'), { target: { value: 'Cancel Me' } });
    fireEvent.click(screen.getByTestId('inline-create-cancel'));
    expect(screen.queryByText('Cancel Me')).not.toBeInTheDocument();
  });

  it('creates area on Enter key', () => {
    renderWithProvider([]);
    fireEvent.click(screen.getByTestId('new-area-button'));
    const input = screen.getByTestId('inline-create-input');
    fireEvent.change(input, { target: { value: 'Enter Area' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByText('Enter Area')).toBeInTheDocument();
  });

  it('cancels on Escape key', () => {
    renderWithProvider([]);
    fireEvent.click(screen.getByTestId('new-area-button'));
    const input = screen.getByTestId('inline-create-input');
    fireEvent.change(input, { target: { value: 'Escape Me' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByText('Escape Me')).not.toBeInTheDocument();
  });
});