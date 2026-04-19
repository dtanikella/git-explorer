import { render, screen } from '@testing-library/react';
import Home from '../app/page';

// Mock TsGraph to avoid d3/DOM issues in test environment
jest.mock('@/app/components/ts-graph/TsGraph', () => {
  return function MockTsGraph() {
    return <div data-testid="ts-graph" />;
  };
});

describe('Homepage', () => {
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
    expect(screen.getByPlaceholderText('Search node...')).toBeInTheDocument();
  });
});
