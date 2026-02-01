import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PathInput } from '../../app/components/PathInput';

describe('PathInput', () => {
  const mockOnSubmit = jest.fn();

  beforeEach(() => {
    mockOnSubmit.mockClear();
  });

  it('shows error for empty path on submit', async () => {
    render(<PathInput onSubmit={mockOnSubmit} />);

    const submitButton = screen.getByRole('button', { name: /visualize repository/i });

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Path is required')).toBeInTheDocument();
    });

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('calls onSubmit with valid path and shows loading state', async () => {
    render(<PathInput onSubmit={mockOnSubmit} />);

    const input = screen.getByRole('textbox');
    const submitButton = screen.getByRole('button', { name: /visualize repository/i });

    fireEvent.change(input, { target: { value: '/some/path' } });
    fireEvent.click(submitButton);

    expect(mockOnSubmit).toHaveBeenCalledWith('/some/path');

    // Re-render with loading state to check loading UI
    render(<PathInput onSubmit={mockOnSubmit} loading={true} />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('displays API error messages', () => {
    render(<PathInput onSubmit={mockOnSubmit} error="PATH_NOT_FOUND" />);

    expect(screen.getByText('Repository path not found')).toBeInTheDocument();
  });

  it('displays permission denied error', () => {
    render(<PathInput onSubmit={mockOnSubmit} error="PERMISSION_DENIED" />);

    expect(screen.getByText('Permission denied accessing repository')).toBeInTheDocument();
  });

  it('displays not a directory error', () => {
    render(<PathInput onSubmit={mockOnSubmit} error="NOT_A_DIRECTORY" />);

    expect(screen.getByText('Path is not a directory')).toBeInTheDocument();
  });
});