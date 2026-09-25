import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CompareBar from '@/app/components/diff/CompareBar';
import type { UseDiffReturn } from '@/app/components/diff/useDiff';
import type { DiffResponse } from '@/lib/diff/types';

function createMockDiffState(overrides: Partial<UseDiffReturn> = {}): UseDiffReturn {
  return {
    refs: {
      branches: ['main', 'develop', 'feature-x'],
      tags: ['v1.0.0', 'v2.0.0'],
      defaultBranch: 'main',
      currentBranch: 'develop',
    },
    base: 'main',
    compare: 'develop',
    result: null,
    loading: false,
    error: null,
    shaValidation: null,
    setBase: jest.fn(),
    setCompare: jest.fn(),
    validateSha: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

beforeEach(() => {
  // Mock ResizeObserver to fire callback with a large width
  let resizeCallback: ((entries: ResizeObserverEntry[]) => void) | null = null;
  global.ResizeObserver = class {
    constructor(callback: (entries: ResizeObserverEntry[]) => void) {
      resizeCallback = callback;
    }
    observe() {
      // Fire synchronously so tests don't need async waits
      if (resizeCallback) {
        resizeCallback([{ contentRect: { width: 1136, height: 40 } }]);
      }
    }
    unobserve() {}
    disconnect() {}
  } as any;
});

describe('CompareBar', () => {
  it('renders base and compare pickers', () => {
    const state = createMockDiffState();
    render(<CompareBar diffState={state} />);
    expect(screen.getByText('main')).toBeInTheDocument();
    expect(screen.getByText('develop')).toBeInTheDocument();
  });

  it('shows "select…" when no compare ref is chosen', () => {
    const state = createMockDiffState({ base: '', compare: '' });
    render(<CompareBar diffState={state} />);
    const pills = screen.getAllByText('select…');
    expect(pills.length).toBe(2);
  });

  it('displays status line when diff result is ok', async () => {
    const result: DiffResponse = {
      success: true,
      state: 'ok',
      data: {
        nodes: [],
        edges: [],
        metadata: { labels: [], repoPath: '/test' },
        base: 'main',
        head: 'develop',
      },
      counts: { added: 3, modified: 5, deleted: 2 },
      changedFiles: 10,
      unmatched: [],
    };
    const state = createMockDiffState({ result });
    render(<CompareBar diffState={state} />);
    await waitFor(() => {
      expect(screen.getByText(/✓ 10 TS files changed/)).toBeInTheDocument();
    });
  });

  it('displays loading status', async () => {
    const state = createMockDiffState({ loading: true });
    render(<CompareBar diffState={state} />);
    await waitFor(() => {
      expect(screen.getByText('Diffing…')).toBeInTheDocument();
    });
  });

  it('displays error status', async () => {
    const state = createMockDiffState({ error: 'Something went wrong' });
    render(<CompareBar diffState={state} />);
    await waitFor(() => {
      expect(screen.getByText(/⚠ Something went wrong/)).toBeInTheDocument();
    });
  });

  it('displays no-changes status', async () => {
    const result: DiffResponse = {
      success: true,
      state: 'no-changes',
      data: {
        nodes: [],
        edges: [],
        metadata: { labels: [], repoPath: '/test' },
        base: 'main',
        head: 'develop',
      },
      counts: { added: 0, modified: 0, deleted: 0 },
      changedFiles: 0,
      unmatched: [],
    };
    const state = createMockDiffState({ result });
    render(<CompareBar diffState={state} />);
    await waitFor(() => {
      expect(screen.getByText('No TypeScript changes between these refs')).toBeInTheDocument();
    });
  });

  it('shows counts for added, modified, deleted', async () => {
    const result: DiffResponse = {
      success: true,
      state: 'ok',
      data: {
        nodes: [],
        edges: [],
        metadata: { labels: [], repoPath: '/test' },
        base: 'main',
        head: 'develop',
      },
      counts: { added: 3, modified: 5, deleted: 2 },
      changedFiles: 10,
      unmatched: [],
    };
    const state = createMockDiffState({ result });
    render(<CompareBar diffState={state} />);
    await waitFor(() => {
      expect(screen.getByText('3 added')).toBeInTheDocument();
      expect(screen.getByText('5 modified')).toBeInTheDocument();
      expect(screen.getByText('2 deleted')).toBeInTheDocument();
    });
  });

  it('calls setCompare when clicking a branch in the compare picker', () => {
    const setCompare = jest.fn();
    const state = createMockDiffState({ setCompare, base: 'main', compare: '' });
    render(<CompareBar diffState={state} />);

    // The compare button shows 'select…'
    const selectButtons = screen.getAllByText('select…');
    const compareButton = selectButtons[0].closest('button')!;
    fireEvent.click(compareButton);

    // Now click a branch in the dropdown
    const featureXOption = screen.getByText('feature-x');
    fireEvent.click(featureXOption);

    expect(setCompare).toHaveBeenCalledWith('feature-x');
  });

  it('disables pickers while loading', () => {
    const state = createMockDiffState({ loading: true });
    render(<CompareBar diffState={state} />);
    const buttons = screen.getAllByRole('button');
    for (const btn of buttons) {
      expect(btn).toBeDisabled();
    }
  });

  it('renders SVGs for carets and arrow', () => {
    const state = createMockDiffState();
    render(<CompareBar diffState={state} />);
    const svgs = document.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThan(0);
  });
});