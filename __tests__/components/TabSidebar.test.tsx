import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import TabSidebar from '@/app/components/TabSidebar';

const renderSidebar = (over: Partial<React.ComponentProps<typeof TabSidebar>> = {}) => {
  const props = { activeTab: 'graph' as const, onTabChange: jest.fn(), diffMode: false, onDiffModeChange: jest.fn(), ...over };
  render(<TabSidebar {...props} />);
  return props;
};

describe('TabSidebar', () => {
  it('renders the Graph and Stats tabs', () => {
    renderSidebar();
    expect(screen.getByRole('button', { name: /graph/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /stats/i })).toBeInTheDocument();
  });

  it('highlights the active tab', () => {
    renderSidebar({ activeTab: 'stats' });
    expect(screen.getByRole('button', { name: /stats/i })).toHaveClass('border-l-2');
  });

  it('calls onTabChange when clicking a tab', () => {
    const { onTabChange } = renderSidebar();
    fireEvent.click(screen.getByRole('button', { name: /stats/i }));
    expect(onTabChange).toHaveBeenCalledWith('stats');
  });

  it('offers Diff as a toggle, not a tab', () => {
    const { onTabChange, onDiffModeChange } = renderSidebar();
    const toggle = screen.getByRole('button', { name: /diff/i });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(toggle);
    expect(onDiffModeChange).toHaveBeenCalledWith(true);
    expect(onTabChange).not.toHaveBeenCalled();
  });

  it('shows the toggle pressed while diff mode is on, and clicking turns it off', () => {
    const { onDiffModeChange } = renderSidebar({ diffMode: true });
    const toggle = screen.getByRole('button', { name: /diff/i });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(toggle).toHaveClass('border-l-2');
    fireEvent.click(toggle);
    expect(onDiffModeChange).toHaveBeenCalledWith(false);
  });
});
