import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Home from '../../app/page';

// Mock fetch API
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({
      success: true,
      data: {
        nodes: [
          { scipSymbol: 'node1', label: 'file1.ts', module: 'src', inDegree: 1, outDegree: 2 },
          { scipSymbol: 'node2', label: 'file2.ts', module: 'src', inDegree: 2, outDegree: 1 },
        ],
        edges: [
          { source: 'node1', target: 'node2', count: 5 },
        ],
      },
    }),
  })
) as jest.Mock;

// Mock all the components
jest.mock('@/app/components/RepositorySelector', () => {
  return function MockRepositorySelector({
    onRepositorySelected,
  }: {
    onRepositorySelected: (path: string) => void;
  }) {
    return (
      <button onClick={() => onRepositorySelected('/test/repo')}>
        Select Repository
      </button>
    );
  };
});

jest.mock('@/app/components/repo-graph/RepoGraph', () => {
  return function MockRepoGraph() {
    return <div data-testid="repo-graph">Graph View</div>;
  };
});

jest.mock('@/app/components/TabSidebar', () => {
  return function MockTabSidebar({
    activeTab,
    onTabChange,
  }: {
    activeTab: string;
    onTabChange: (tab: string) => void;
  }) {
    return (
      <div data-testid="tab-sidebar">
        <button
          onClick={() => onTabChange('graph')}
          data-active={activeTab === 'graph'}
        >
          Graph Tab
        </button>
        <button
          onClick={() => onTabChange('stats')}
          data-active={activeTab === 'stats'}
        >
          Stats Tab
        </button>
      </div>
    );
  };
});

jest.mock('@/app/components/graph/GraphToolbar', () => {
  return function MockGraphToolbar() {
    return <div data-testid="graph-toolbar">Graph Toolbar</div>;
  };
});

jest.mock('@/app/components/stats/StatsToolbar', () => {
  return function MockStatsToolbar() {
    return <div data-testid="stats-toolbar">Stats Toolbar</div>;
  };
});

jest.mock('@/app/components/stats/StatsTreemap', () => {
  return function MockStatsTreemap() {
    return <div data-testid="stats-treemap">Stats Treemap</div>;
  };
});

describe('View Switching Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('can switch between graph and stats tabs', async () => {
    render(<Home />);

    // Select repository
    const selectButton = screen.getByRole('button', { name: /select repository/i });
    fireEvent.click(selectButton);

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByTestId('repo-graph')).toBeInTheDocument();
    });

    // Should show graph tab by default
    expect(screen.getByTestId('graph-toolbar')).toBeInTheDocument();
    expect(screen.queryByTestId('stats-toolbar')).not.toBeInTheDocument();

    // Switch to stats tab
    const statsButton = screen.getByRole('button', { name: /stats tab/i });
    fireEvent.click(statsButton);

    // Should show stats toolbar and treemap
    await waitFor(() => {
      expect(screen.getByTestId('stats-toolbar')).toBeInTheDocument();
      expect(screen.getByTestId('stats-treemap')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('graph-toolbar')).not.toBeInTheDocument();

    // Switch back to graph tab
    const graphButton = screen.getByRole('button', { name: /graph tab/i });
    fireEvent.click(graphButton);

    // Should show graph toolbar and graph again
    await waitFor(() => {
      expect(screen.getByTestId('graph-toolbar')).toBeInTheDocument();
      expect(screen.getByTestId('repo-graph')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('stats-toolbar')).not.toBeInTheDocument();
  });
});