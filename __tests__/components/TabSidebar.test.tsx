import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import TabSidebar from '@/app/components/TabSidebar';

describe('TabSidebar', () => {
  it('renders Graph, Stats, Areas, and Diff tab buttons', () => {
    render(<TabSidebar activeTab="graph" onTabChange={jest.fn()} />);
    expect(screen.getByRole('button', { name: /graph/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /stats/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /areas/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /diff/i })).toBeInTheDocument();
  });

  it('highlights the active tab', () => {
    render(<TabSidebar activeTab="stats" onTabChange={jest.fn()} />);
    const statsBtn = screen.getByRole('button', { name: /stats/i });
    expect(statsBtn).toHaveClass('border-l-2');
  });

  it('highlights the areas tab when active', () => {
    render(<TabSidebar activeTab="areas" onTabChange={jest.fn()} />);
    const areasBtn = screen.getByRole('button', { name: /areas/i });
    expect(areasBtn).toHaveClass('border-l-2');
  });

  it('highlights the diff tab when active', () => {
    render(<TabSidebar activeTab="diff" onTabChange={jest.fn()} />);
    const diffBtn = screen.getByRole('button', { name: /diff/i });
    expect(diffBtn).toHaveClass('border-l-2');
  });

  it('calls onTabChange when clicking a tab', () => {
    const onTabChange = jest.fn();
    render(<TabSidebar activeTab="graph" onTabChange={onTabChange} />);
    fireEvent.click(screen.getByRole('button', { name: /stats/i }));
    expect(onTabChange).toHaveBeenCalledWith('stats');
  });

  it('calls onTabChange when clicking the areas tab', () => {
    const onTabChange = jest.fn();
    render(<TabSidebar activeTab="graph" onTabChange={onTabChange} />);
    fireEvent.click(screen.getByRole('button', { name: /areas/i }));
    expect(onTabChange).toHaveBeenCalledWith('areas');
  });

  it('calls onTabChange when clicking the diff tab', () => {
    const onTabChange = jest.fn();
    render(<TabSidebar activeTab="graph" onTabChange={onTabChange} />);
    fireEvent.click(screen.getByRole('button', { name: /diff/i }));
    expect(onTabChange).toHaveBeenCalledWith('diff');
  });
});