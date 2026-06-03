import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import TabSidebar from '@/app/components/TabSidebar';

describe('TabSidebar', () => {
  it('renders Graph and Stats tab buttons', () => {
    render(<TabSidebar activeTab="graph" onTabChange={jest.fn()} />);
    expect(screen.getByRole('button', { name: /graph/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /stats/i })).toBeInTheDocument();
  });

  it('highlights the active tab', () => {
    render(<TabSidebar activeTab="stats" onTabChange={jest.fn()} />);
    const statsBtn = screen.getByRole('button', { name: /stats/i });
    expect(statsBtn).toHaveClass('border-l-2');
  });

  it('calls onTabChange when clicking a tab', () => {
    const onTabChange = jest.fn();
    render(<TabSidebar activeTab="graph" onTabChange={onTabChange} />);
    fireEvent.click(screen.getByRole('button', { name: /stats/i }));
    expect(onTabChange).toHaveBeenCalledWith('stats');
  });
});
