import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import DiffStatePanel from '@/app/components/diff/DiffStatePanel';

describe('DiffStatePanel', () => {
  it('renders empty state', () => {
    render(<DiffStatePanel state="empty" />);
    expect(screen.getByText('Choose a branch to compare.')).toBeInTheDocument();
  });

  it('renders loading state without previous result (returns null)', () => {
    const { container } = render(<DiffStatePanel state="loading" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders loading state with previous result (returns null)', () => {
    const { container } = render(<DiffStatePanel state="loading" hasPreviousResult={true} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders no-changes state (returns null)', () => {
    const { container } = render(<DiffStatePanel state="no-changes" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders generic error state', () => {
    render(<DiffStatePanel state="error" errorMessage="Something went wrong" />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('renders DIFFT_MISSING error with install commands', () => {
    render(
      <DiffStatePanel
        state="error"
        errorCode="DIFFT_MISSING"
        errorMessage="Difftastic >= 0.71.0 not found"
      />,
    );
    expect(screen.getByText('Difftastic >= 0.71.0 not found')).toBeInTheDocument();
    expect(screen.getByText(/brew install difftastic/)).toBeInTheDocument();
    expect(screen.getByText(/cargo install difftastic/)).toBeInTheDocument();
  });

  it('renders DIFFT_TOO_OLD error with upgrade commands', () => {
    render(
      <DiffStatePanel
        state="error"
        errorCode="DIFFT_TOO_OLD"
        errorMessage="Difftastic too old"
      />,
    );
    expect(screen.getByText('Difftastic too old')).toBeInTheDocument();
    expect(screen.getByText(/brew upgrade difftastic/)).toBeInTheDocument();
    expect(screen.getByText(/cargo install difftastic --force/)).toBeInTheDocument();
  });
});