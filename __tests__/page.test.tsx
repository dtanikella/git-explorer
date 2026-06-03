import { fireEvent, render, screen } from '@testing-library/react';
import Home from '../app/page';
import { INTERNAL_PROCESSING_CONFIG, createModulesViewConfig } from '@/lib/analysis/graph-config';

let lastRepoGraphProps: Record<string, unknown> | null = null;

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

describe('Homepage', () => {
  beforeEach(() => {
    lastRepoGraphProps = null;
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
