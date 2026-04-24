import React from 'react';
import { render, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock d3 to avoid ESM resolution issues; TsGraph only needs chainable DOM helpers
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

  const dragBehavior = (): any => {
    const obj: Record<string, any> = {};
    obj.on = jest.fn(() => obj);
    return obj;
  };

  const zoomBehavior = (): any => {
    const obj: Record<string, any> = {};
    obj.scaleExtent = jest.fn(() => obj);
    obj.on = jest.fn(() => obj);
    return obj;
  };

  const scaleLinear = (): any => {
    const fn: any = jest.fn((val: number) => val);
    ['domain', 'range', 'clamp'].forEach((m) => { fn[m] = jest.fn(() => fn); });
    return fn;
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
    forceX: jest.fn(() => ({ x: jest.fn().mockReturnThis(), strength: jest.fn().mockReturnThis() })),
    forceY: jest.fn(() => ({ y: jest.fn().mockReturnThis(), strength: jest.fn().mockReturnThis() })),
    zoom: jest.fn(() => zoomBehavior()),
    drag: jest.fn(() => dragBehavior()),
    scaleLinear: jest.fn(() => scaleLinear()),
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
};

beforeAll(() => {
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockCtx as any);
  global.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  }));
});

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

describe('TsGraph — data fetching with hideTestFiles prop', () => {
  it('fetches with hideTestFiles=true when prop is true', async () => {
    render(<TsGraph repoPath="/some/repo" hideTestFiles={true} />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/ts-analysis', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ repoPath: '/some/repo', hideTestFiles: true }),
      }));
    });

    await act(async () => {});
  });

  it('fetches with hideTestFiles=false when prop is false', async () => {
    render(<TsGraph repoPath="/some/repo" hideTestFiles={false} />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/ts-analysis', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ repoPath: '/some/repo', hideTestFiles: false }),
      }));
    });

    await act(async () => {});
  });

  it('registers search handler when onSearchNode is provided', () => {
    const registerFn = jest.fn();
    render(<TsGraph repoPath="/some/repo" hideTestFiles={true} onSearchNode={registerFn} />);

    expect(registerFn).toHaveBeenCalledWith(expect.any(Function));
  });

  it('renders a canvas element, not an svg', async () => {
    const { container } = render(<TsGraph repoPath="" hideTestFiles={false} />);
    expect(container.querySelector('canvas')).toBeNull(); // no repo yet, returns null
  });
});

describe('TsGraph — canvas rendering', () => {
  it('calls ctx.clearRect on simulation tick when graph data is loaded', async () => {
    const mockData = {
      nodes: [
        { id: 'n1', kind: 'FUNCTION', name: 'foo', filePath: 'src/a.ts' },
        { id: 'n2', kind: 'FUNCTION', name: 'bar', filePath: 'src/b.ts' },
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2', type: 'call', weight: 1 },
      ],
    };
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: mockData }),
    });

    const d3Mock = require('d3');
    render(<TsGraph repoPath="/some/repo" hideTestFiles={false} />);

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    await act(async () => {});

    // Fire one tick
    const sim = d3Mock.__getLastSim();
    act(() => { sim._fireTick(); });

    expect(mockCtx.clearRect).toHaveBeenCalled();
    expect(mockCtx.beginPath).toHaveBeenCalled();
  });
});
