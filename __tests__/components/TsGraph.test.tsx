import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// ── Sigma mock ────────────────────────────────────────────────────────────────
const mockSigmaKill = jest.fn();
const MockSigma = jest.fn().mockImplementation(() => ({
  on: jest.fn(),
  kill: mockSigmaKill,
  graphToViewport: jest.fn(() => ({ x: 100, y: 200 })),
  getCamera: jest.fn(() => ({ disable: jest.fn(), enable: jest.fn() })),
  viewportToGraph: jest.fn(() => ({ x: 0, y: 0 })),
}));
jest.mock('sigma', () => ({ __esModule: true, default: MockSigma }));

// ── Graphology mock ───────────────────────────────────────────────────────────
const MockGraph = jest.fn().mockImplementation(() => ({
  addNode: jest.fn(),
  addEdge: jest.fn(),
  hasEdge: jest.fn(() => false),
  getNodeAttributes: jest.fn(() => ({ label: 'testNode', x: 0, y: 0 })),
  setNodeAttribute: jest.fn(),
  order: 2,
}));
jest.mock('graphology', () => ({ __esModule: true, default: MockGraph, DirectedGraph: MockGraph }));

// ── ForceAtlas2 mock ──────────────────────────────────────────────────────────
jest.mock('graphology-layout-forceatlas2', () => ({
  __esModule: true,
  default: { assign: jest.fn() },
}));

import TsGraph from '@/app/components/ts-graph/TsGraph';

const mockFetch = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, data: { nodes: [], edges: [] } }),
  });
  global.fetch = mockFetch;
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const FUNCTION_NODE = (id: string, name: string) => ({
  id,
  kind: 'FUNCTION' as const,
  name,
  parent: null,
  children: [],
  siblings: [],
  params: [],
  returnType: null,
});

const CALL_EDGE = (id: string, source: string, target: string) => ({
  id,
  type: 'call' as const,
  source,
  target,
  callScope: 'same-file' as const,
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TsGraph — Sigma migration', () => {
  it('T023: renders loading state while fetch is pending', () => {
    let resolvePromise!: (v: unknown) => void;
    mockFetch.mockReturnValueOnce(new Promise((res) => { resolvePromise = res; }));

    render(<TsGraph repoPath="/some/repo" />);

    expect(screen.getByText(/analyzing typescript structure/i)).toBeInTheDocument();

    // resolve to avoid act() warning
    resolvePromise({ ok: true, json: async () => ({ success: true, data: { nodes: [], edges: [] } }) });
  });

  it('T024: sends hideTestFiles: true on mount', async () => {
    render(<TsGraph repoPath="/some/repo" />);

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/ts-analysis');
    expect(JSON.parse(options.body as string)).toMatchObject({
      repoPath: '/some/repo',
      hideTestFiles: true,
    });
  });

  it('T025: renders error message on API failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ success: false, error: 'Analysis failed' }),
    });

    render(<TsGraph repoPath="/some/repo" />);

    await waitFor(() =>
      expect(screen.getByText('Analysis failed')).toBeInTheDocument()
    );
  });

  it('T026: renders no-nodes message when graph has no nodes', async () => {
    render(<TsGraph repoPath="/some/repo" />);

    await waitFor(() =>
      expect(screen.getByText(/no typescript symbols found/i)).toBeInTheDocument()
    );
  });

  it('T027: mounts Sigma when graph data contains nodes', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          nodes: [FUNCTION_NODE('fn1', 'alpha'), FUNCTION_NODE('fn2', 'beta')],
          edges: [CALL_EDGE('e1', 'fn1', 'fn2')],
        },
      }),
    });

    render(<TsGraph repoPath="/some/repo" />);

    await waitFor(() => expect(MockSigma).toHaveBeenCalledTimes(1));
  });

  it('T028: kills Sigma on unmount', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          nodes: [FUNCTION_NODE('fn1', 'alpha'), FUNCTION_NODE('fn2', 'beta')],
          edges: [CALL_EDGE('e1', 'fn1', 'fn2')],
        },
      }),
    });

    const { unmount } = render(<TsGraph repoPath="/some/repo" />);

    await waitFor(() => expect(MockSigma).toHaveBeenCalledTimes(1));

    unmount();

    expect(mockSigmaKill).toHaveBeenCalledTimes(1);
  });
});
