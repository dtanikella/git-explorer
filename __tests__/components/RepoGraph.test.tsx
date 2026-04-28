import React from 'react';
import { render, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('d3', () => {
  const chainable = (): any => {
    const obj: Record<string, any> = {};
    const methods = [
      'append', 'style', 'attr', 'call', 'on', 'remove',
      'selectAll', 'join', 'data', 'html', 'text', 'transition', 'duration',
    ];
    methods.forEach((m) => {
      obj[m] = jest.fn(() => obj);
    });
    return obj;
  };

  const simMethods = (): any => {
    let tickHandler: (() => void) | null = null;
    const obj: Record<string, any> = {};
    ['force', 'alpha', 'alphaTarget', 'restart', 'stop'].forEach((m) => {
      obj[m] = jest.fn(() => obj);
    });
    obj.on = jest.fn((event: string, handler: () => void) => {
      if (event === 'tick') tickHandler = handler;
      return obj;
    });
    obj._fireTick = () => { if (tickHandler) tickHandler(); };
    return obj;
  };

  const linkForce = (): any => {
    const obj: Record<string, any> = {};
    ['id', 'distance', 'strength'].forEach((m) => { obj[m] = jest.fn(() => obj); });
    return obj;
  };

  const zoomBehavior = (): any => {
    const obj: Record<string, any> = {};
    obj.scaleExtent = jest.fn(() => obj);
    obj.on = jest.fn(() => obj);
    return obj;
  };

  let lastSim: any = null;

  return {
    select: jest.fn(() => chainable()),
    forceSimulation: jest.fn((nodes: any[]) => {
      if (nodes) nodes.forEach((n: any, i: number) => { n.x = 100 + i * 50; n.y = 100 + i * 50; });
      lastSim = simMethods();
      return lastSim;
    }),
    forceLink: jest.fn(() => linkForce()),
    forceManyBody: jest.fn(() => ({ strength: jest.fn().mockReturnThis() })),
    forceCollide: jest.fn(() => ({ radius: jest.fn().mockReturnThis() })),
    forceCenter: jest.fn(),
    zoom: jest.fn(() => zoomBehavior()),
    zoomIdentity: { k: 1, x: 0, y: 0, translate: jest.fn().mockReturnThis(), scale: jest.fn().mockReturnThis() },
    __getLastSim: () => lastSim,
  };
});

const mockCtx = {
  clearRect: jest.fn(),
  beginPath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  arc: jest.fn(),
  fill: jest.fn(),
  stroke: jest.fn(),
  save: jest.fn(),
  restore: jest.fn(),
  setTransform: jest.fn(),
  globalAlpha: 1,
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
};

beforeAll(() => {
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockCtx as any);
  global.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  }));
});

import RepoGraph from '@/app/components/repo-graph/RepoGraph';

const mockFetch = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, data: { nodes: [], edges: [], metadata: { repoPath: '/r', language: 'typescript', nodeCount: 0, edgeCount: 0, analysisDurationMs: 10, missingNodeTypes: [], missingEdgeKinds: [] } } }),
  });
  global.fetch = mockFetch;
});

describe('RepoGraph — data fetching', () => {
  it('fetches from /api/repo-analysis with hideTestFiles=true', async () => {
    render(<RepoGraph repoPath="/some/repo" hideTestFiles={true} />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/repo-analysis', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ repoPath: '/some/repo', hideTestFiles: true }),
      }));
    });

    await act(async () => {});
  });

  it('fetches from /api/repo-analysis with hideTestFiles=false', async () => {
    render(<RepoGraph repoPath="/some/repo" hideTestFiles={false} />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/repo-analysis', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ repoPath: '/some/repo', hideTestFiles: false }),
      }));
    });

    await act(async () => {});
  });

  it('does not fetch when repoPath is empty', () => {
    render(<RepoGraph repoPath="" hideTestFiles={true} />);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('shows loading state while fetching', () => {
    mockFetch.mockReturnValue(new Promise(() => {})); // never resolves
    const { getByText } = render(<RepoGraph repoPath="/repo" hideTestFiles={true} />);
    expect(getByText('Analyzing repository...')).toBeInTheDocument();
  });

  it('shows error state on failure', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: false, error: 'Analysis failed' }),
    });

    const { getByText } = render(<RepoGraph repoPath="/repo" hideTestFiles={true} />);
    await waitFor(() => expect(getByText('Analysis failed')).toBeInTheDocument());
    await act(async () => {});
  });
});
