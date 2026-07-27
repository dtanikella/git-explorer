import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import RepositorySelector from '@/app/components/RepositorySelector';

describe('RepositorySelector', () => {
  const mockOnRepositorySelected = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders select directory button', () => {
    render(
      <RepositorySelector
        onRepositorySelected={mockOnRepositorySelected}
        isLoading={false}
      />
    );

    expect(screen.getByRole('button', { name: 'Select directory' })).toBeInTheDocument();
  });

  it('calls onRepositorySelected when directory is selected', async () => {
    // Mock the server-side directory browser endpoint
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ success: true, path: '/path/to/test-repo' }),
    } as unknown as Response);

    render(
      <RepositorySelector
        onRepositorySelected={mockOnRepositorySelected}
        isLoading={false}
      />
    );

    const button = screen.getByRole('button', { name: 'Select directory' });
    fireEvent.click(button);

    // Wait for the async operation
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(mockOnRepositorySelected).toHaveBeenCalledWith('/path/to/test-repo');
  });

  it('disables button when isLoading is true', () => {
    render(
      <RepositorySelector
        onRepositorySelected={mockOnRepositorySelected}
        isLoading={true}
      />
    );

    const button = screen.getByRole('button', { name: 'Analyzing repository' });
    expect(button).toBeDisabled();
  });

  it('displays error message when error prop is provided', () => {
    render(
      <RepositorySelector
        onRepositorySelected={mockOnRepositorySelected}
        isLoading={false}
        error="Test error"
      />
    );

    expect(screen.getByText('Test error')).toBeInTheDocument();
  });

  it('shows selected path when directory is selected', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ success: true, path: '/path/to/test-repo' }),
    } as unknown as Response);

    const { rerender } = render(
      <RepositorySelector
        onRepositorySelected={mockOnRepositorySelected}
        isLoading={false}
      />
    );

    const button = screen.getByRole('button', { name: 'Select directory' });
    
    await act(async () => {
      fireEvent.click(button);
      // Wait for the async operation to complete
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // After selection, the parent would pass currentPath
    rerender(
      <RepositorySelector
        onRepositorySelected={mockOnRepositorySelected}
        isLoading={false}
        currentPath="/path/to/test-repo"
      />
    );

    expect(screen.getByText('Current: /path/to/test-repo')).toBeInTheDocument();
  });

  it('shows current path when currentPath prop is provided', () => {
    render(
      <RepositorySelector
        onRepositorySelected={mockOnRepositorySelected}
        isLoading={false}
        currentPath="/current/repo"
      />
    );

    expect(screen.getByText('Current: /current/repo')).toBeInTheDocument();
  });
});