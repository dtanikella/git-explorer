import { render, screen } from '@testing-library/react';
import LoadingState from '@/app/components/LoadingState';

describe('LoadingState', () => {
  it('renders spinner', () => {
    render(<LoadingState />);

    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('displays default message when no message prop provided', () => {
    render(<LoadingState />);

    expect(screen.getByText('Analyzing repository...')).toBeInTheDocument();
  });

  it('displays custom message when provided', () => {
    render(<LoadingState message="Processing 5,234 commits..." />);

    expect(screen.getByText('Processing 5,234 commits...')).toBeInTheDocument();
  });

  it('has appropriate ARIA attributes', () => {
    render(<LoadingState />);

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-label', 'Loading');

    const message = screen.getByText('Analyzing repository...');
    expect(message).toHaveAttribute('aria-live', 'polite');
  });
});