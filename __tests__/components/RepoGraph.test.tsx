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
    ['force', 'alpha', 'alphaTarget', 'alphaDecay', 'velocityDecay', 'restart', 'stop'].forEach((m) => {
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
    forceCenter: jest.fn(() => ({ strength: jest.fn().mockReturnThis() })),
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
  fillText: jest.fn(),
  globalAlpha: 1,
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
  font: '',
  textAlign: '',
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
import { DEFAULT_REPO_GRAPH_CONFIG } from '@/lib/analysis/graph-config';
import type { AnalysisResult } from '@/lib/analysis/types';

const emptyData: AnalysisResult = {
  nodes: [],
  edges: [],
  metadata: {
    repoPath: '/r',
    language: 'typescript',
    nodeCount: 0,
    edgeCount: 0,
    analysisDurationMs: 10,
    missingNodeTypes: [],
    missingEdgeKinds: []
  }
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('RepoGraph — props and rendering', () => {
  it('resolves config factories with loaded edges', async () => {
    const mockData: AnalysisResult = {
      nodes: [
        { scipSymbol: 's1', name: 'foo', syntaxType: 'FUNCTION', filePath: 'a.ts', startLine: 1, startCol: 0, isAsync: false, isExported: true, params: [], returnTypeText: null, isDefinition: true, inTestFile: false, referencedAt: [], outboundRefs: [] },
        { scipSymbol: 's2', name: 'bar', syntaxType: 'FUNCTION', filePath: 'b.ts', startLine: 1, startCol: 0, isAsync: false, isExported: true, params: [], returnTypeText: null, isDefinition: true, inTestFile: false, referencedAt: [], outboundRefs: [] },
      ],
      edges: [
        { kind: 'CALLS', fromFile: 'a.ts', fromName: 'foo', fromSymbol: 's1', toText: 'bar', toFile: 'b.ts', toName: 'bar', toSymbol: 's2', isExternal: false, edgePosition: { line: 2, col: 3 }, isOptionalChain: false, isAsync: false },
      ],
      metadata: { repoPath: '/r', language: 'typescript', nodeCount: 2, edgeCount: 1, analysisDurationMs: 10, missingNodeTypes: [], missingEdgeKinds: [] },
    };
    const configFactory = jest.fn(() => DEFAULT_REPO_GRAPH_CONFIG);

    render(<RepoGraph repoPath="/repo" hideTestFiles={true} config={configFactory} analysisData={mockData} loading={false} error={null} />);

    await waitFor(() => expect(configFactory).toHaveBeenCalledWith(mockData.edges));
    await act(async () => {});
  });

  it('shows loading state when loading prop is true', () => {
    const { getByText } = render(<RepoGraph repoPath="/repo" hideTestFiles={true} analysisData={null} loading={true} error={null} />);
    expect(getByText('Analyzing repository...')).toBeInTheDocument();
  });

  it('shows error state when error prop is set', () => {
    const { getByText } = render(<RepoGraph repoPath="/repo" hideTestFiles={true} analysisData={null} loading={false} error="Analysis failed" />);
    expect(getByText('Analysis failed')).toBeInTheDocument();
  });

  it('renders nothing when not loading, no error, and no data', () => {
    const { container } = render(<RepoGraph repoPath="/repo" hideTestFiles={true} analysisData={null} loading={false} error={null} />);
    expect(container.firstChild).toBeNull();
  });
});

describe('RepoGraph — canvas rendering', () => {
  it('calls ctx.clearRect on simulation tick when data is loaded', async () => {
    const mockData: AnalysisResult = {
      nodes: [
        { scipSymbol: 's1', name: 'foo', syntaxType: 'FUNCTION', filePath: 'a.ts', startLine: 1, startCol: 0, isAsync: false, isExported: true, params: [], returnTypeText: null, isDefinition: true, inTestFile: false, referencedAt: [], outboundRefs: [] },
        { scipSymbol: 's2', name: 'bar', syntaxType: 'FUNCTION', filePath: 'b.ts', startLine: 1, startCol: 0, isAsync: false, isExported: true, params: [], returnTypeText: null, isDefinition: true, inTestFile: false, referencedAt: [], outboundRefs: [] },
      ],
      edges: [
        { kind: 'CALLS', fromFile: 'a.ts', fromName: 'foo', fromSymbol: 's1', toText: 'bar', toFile: 'b.ts', toName: 'bar', toSymbol: 's2', isExternal: false, edgePosition: { line: 2, col: 3 }, isOptionalChain: false, isAsync: false },
      ],
      metadata: { repoPath: '/r', language: 'typescript', nodeCount: 2, edgeCount: 1, analysisDurationMs: 10, missingNodeTypes: [], missingEdgeKinds: [] },
    };

    const d3Mock = require('d3');
    render(<RepoGraph repoPath="/repo" hideTestFiles={true} analysisData={mockData} loading={false} error={null} />);

    await act(async () => {});

    const sim = d3Mock.__getLastSim();
    act(() => { sim._fireTick(); });

    expect(mockCtx.clearRect).toHaveBeenCalled();
    expect(mockCtx.beginPath).toHaveBeenCalled();
  });
});

describe('RepoGraph — search', () => {
  it('registers search handler when onSearchNode is provided', () => {
    const registerFn = jest.fn();
    render(<RepoGraph repoPath="/repo" hideTestFiles={true} onSearchNode={registerFn} analysisData={emptyData} loading={false} error={null} />);
    expect(registerFn).toHaveBeenCalledWith(expect.any(Function));
  });

  it('search handler returns false when no matching node exists', async () => {
    let searchFn: ((q: string) => boolean) | null = null;
    const registerFn = jest.fn((fn: (q: string) => boolean) => { searchFn = fn; });

    render(<RepoGraph repoPath="/repo" hideTestFiles={true} onSearchNode={registerFn} analysisData={emptyData} loading={false} error={null} />);
    await act(async () => {});

    expect(searchFn).not.toBeNull();
    expect(searchFn!('nonExistent')).toBe(false);
  });
});

describe('RepoGraph — tooltip', () => {
  it('does not crash on mousemove over canvas', async () => {
    const mockData: AnalysisResult = {
      nodes: [
        { scipSymbol: 's1', name: 'foo', syntaxType: 'FUNCTION', filePath: 'a.ts', startLine: 1, startCol: 0, isAsync: false, isExported: true, params: [], returnTypeText: null, isDefinition: true, inTestFile: false, referencedAt: [], outboundRefs: [] },
      ],
      edges: [],
      metadata: { repoPath: '/r', language: 'typescript', nodeCount: 1, edgeCount: 0, analysisDurationMs: 10, missingNodeTypes: [], missingEdgeKinds: [] },
    };

    const { container } = render(<RepoGraph repoPath="/repo" hideTestFiles={true} analysisData={mockData} loading={false} error={null} />);
    await act(async () => {});

    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();

    const moveEvent = new MouseEvent('mousemove', { clientX: 100, clientY: 100, bubbles: true });
    act(() => { canvas!.dispatchEvent(moveEvent); });
    // No crash = pass
  });

  it('does not crash on mouseleave', async () => {
    const mockData: AnalysisResult = {
      nodes: [
        { scipSymbol: 's1', name: 'foo', syntaxType: 'FUNCTION', filePath: 'a.ts', startLine: 1, startCol: 0, isAsync: false, isExported: true, params: [], returnTypeText: null, isDefinition: true, inTestFile: false, referencedAt: [], outboundRefs: [] },
      ],
      edges: [],
      metadata: { repoPath: '/r', language: 'typescript', nodeCount: 1, edgeCount: 0, analysisDurationMs: 10, missingNodeTypes: [], missingEdgeKinds: [] },
    };

    const { container } = render(<RepoGraph repoPath="/repo" hideTestFiles={true} analysisData={mockData} loading={false} error={null} />);
    await act(async () => {});

    const canvas = container.querySelector('canvas');
    const leaveEvent = new MouseEvent('mouseleave', { bubbles: true });
    act(() => { canvas!.dispatchEvent(leaveEvent); });
    // No crash = pass
  });
});
