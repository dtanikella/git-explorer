import { fireEvent, render, screen } from '@testing-library/react';
import Home from '../app/page';
import { INTERNAL_PROCESSING_CONFIG, createModulesViewConfig } from '@/lib/analysis/graph-config';

let lastRepoGraphProps: Record<string, unknown> | null = null;

// Mock fetch
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ success: true, data: { nodes: [], edges: [] } }),
  })
) as jest.Mock;

jest.mock('@/app/components/RepositorySelector', () => {
  return function MockRepositorySelector({
    onRepositorySelected,
    currentPath,
  }: {
    onRepositorySelected: (path: string) => void;
    currentPath?: string;
  }) {
    return (
      <div>
        <button onClick={() => onRepositorySelected('/mock/repo')}>Select directory</button>
        {currentPath && <div>Current: {currentPath}</div>}
      </div>
    );
  };
});

// Mock RepoGraph to avoid d3/DOM issues in test environment
jest.mock('@/app/components/repo-graph/RepoGraph', () => {
  return function MockRepoGraph(props: Record<string, unknown>) {
    lastRepoGraphProps = props;
    return <div data-testid="repo-graph" />;
  };
});

// Mock TabSidebar
jest.mock('@/app/components/TabSidebar', () => {
  return function MockTabSidebar({ activeTab, onTabChange }: { activeTab: string; onTabChange: (tab: string) => void }) {
    return (
      <div data-testid="tab-sidebar">
        <button onClick={() => onTabChange('graph')}>Graph</button>
        <button onClick={() => onTabChange('stats')}>Stats</button>
      </div>
    );
  };
});

// Mock GraphToolbar
jest.mock('@/app/components/graph/GraphToolbar', () => {
  return function MockGraphToolbar({
    hideTestFiles,
    onHideTestFilesChange,
    selectedView,
    onViewChange,
    viewOptions,
    searchQuery,
    onSearchQueryChange,
    onSearch,
    searchNotFound,
    disabled,
  }: {
    hideTestFiles: boolean;
    onHideTestFilesChange: (value: boolean) => void;
    selectedView: string;
    onViewChange: (value: string) => void;
    viewOptions: Record<string, { label: string }>;
    searchQuery: string;
    onSearchQueryChange: (value: string) => void;
    onSearch: () => void;
    searchNotFound: boolean;
    disabled: boolean;
  }) {
    return (
      <div data-testid="graph-toolbar">
        <label>
          <input
            type="checkbox"
            checked={hideTestFiles}
            onChange={(e) => onHideTestFilesChange(e.target.checked)}
          />
          Hide test files
        </label>
        <label>
          View
          <select value={selectedView} onChange={(e) => onViewChange(e.target.value)} disabled={disabled}>
            {Object.entries(viewOptions).map(([key, { label }]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <input
          type="text"
          placeholder="Search node..."
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          disabled={disabled}
        />
        <button onClick={onSearch} disabled={disabled || !searchQuery.trim()}>
          Search
        </button>
      </div>
    );
  };
});

// Mock StatsToolbar
jest.mock('@/app/components/stats/StatsToolbar', () => {
  return function MockStatsToolbar() {
    return <div data-testid="stats-toolbar" />;
  };
});

// Mock StatsTreemap
jest.mock('@/app/components/stats/StatsTreemap', () => {
  return function MockStatsTreemap() {
    return <div data-testid="stats-treemap" />;
  };
});

describe('Homepage', () => {
  beforeEach(() => {
    lastRepoGraphProps = null;
    (global.fetch as jest.Mock).mockClear();
  });

  it('renders repository selector', () => {
    render(<Home />);
    expect(screen.getByRole('button', { name: 'Select directory' })).toBeInTheDocument();
  });

  it('shows placeholder when no repo is selected', () => {
    render(<Home />);
    expect(screen.getByText('Select a repository to visualize')).toBeInTheDocument();
  });

  it('renders tools and filters toolbar', () => {
    render(<Home />);
    expect(screen.getByRole('checkbox', { name: /hide test files/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /view/i })).toBeDisabled();
    expect(screen.getByRole('option', { name: 'Internal Processing' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Modules' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search node...')).toBeInTheDocument();
  });

  it('switches repo graph config when the selected view changes', () => {
    render(<Home />);

    fireEvent.click(screen.getByRole('button', { name: 'Select directory' }));

    expect(screen.getByTestId('repo-graph')).toBeInTheDocument();
    expect(lastRepoGraphProps?.config).toBe(createModulesViewConfig);

    fireEvent.change(screen.getByRole('combobox', { name: /view/i }), {
      target: { value: 'internal' },
    });

    expect(lastRepoGraphProps?.config).toBe(INTERNAL_PROCESSING_CONFIG);
  });
});
