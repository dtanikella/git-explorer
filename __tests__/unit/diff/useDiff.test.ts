import { renderHook, act } from '@testing-library/react';
import { useDiff } from '@/app/components/diff/useDiff';

const mockRefsResponse = {
  success: true,
  data: {
    branches: ['main', 'develop', 'feature-x'],
    tags: ['v1.0.0'],
    defaultBranch: 'main',
    currentBranch: 'develop',
    sha: { input: 'abc123', valid: true, resolved: 'abc123def' },
  },
};

const mockBadShaRefsResponse = {
  success: true,
  data: {
    branches: ['main'],
    tags: [],
    defaultBranch: 'main',
    currentBranch: 'develop',
    sha: { input: 'badsha', valid: false, resolved: null },
  },
};

const mockDiffResponse = {
  success: true,
  state: 'ok',
  data: {
    nodes: [],
    edges: [],
    metadata: { labels: [], repoPath: '/test' },
    base: 'main',
    head: 'develop',
  },
  counts: { added: 1, modified: 2, deleted: 0 },
  changedFiles: 3,
  unmatched: [],
};



let fetchCalls: { url: string; method: string; body?: any }[] = [];

beforeEach(() => {
  fetchCalls = [];
});

function createSmartMock() {
  return jest.spyOn(global, 'fetch').mockImplementation(async (url: any, options?: any) => {
    const urlStr = url.toString();
    const body = options?.body ? JSON.parse(options.body) : undefined;
    fetchCalls.push({ url: urlStr, method: options?.method || 'GET', body });

    if (urlStr.includes('/api/diff')) {
      return { ok: true, json: async () => ({ ...mockDiffResponse }) } as Response;
    }

    if (urlStr.includes('sha=badsha') || urlStr.includes('sha=invalid')) {
      return { ok: true, json: async () => ({ ...mockBadShaRefsResponse }) } as Response;
    }

    // Refs fetch
    return { ok: true, json: async () => ({ ...mockRefsResponse }) } as Response;
  });
}

describe('useDiff', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loads refs when repoPath changes', async () => {
    const fetchMock = createSmartMock();

    const { result, rerender } = renderHook(
      (path: string) => useDiff(path),
      { initialProps: '' },
    );

    // Initially empty
    expect(result.current.refs).toBeNull();

    // Rerender with a repo path
    rerender('/some/repo');

    await act(async () => {
      await new Promise(process.nextTick);
    });

    expect(result.current.refs).toBeDefined();
    expect(result.current.refs!.branches).toContain('main');
    expect(result.current.base).toBe('main');
    expect(result.current.compare).toBe('develop');

    const refsCalls = fetchCalls.filter(c => c.url.includes('/api/git-refs') && !c.url.includes('sha='));
    expect(refsCalls.length).toBe(1);

    fetchMock.mockRestore();
  });

  it('sets defaults from refs data', async () => {
    const fetchMock = createSmartMock();

    const { result } = renderHook(() => useDiff('/some/repo'));

    await act(async () => {
      await new Promise(process.nextTick);
    });

    expect(result.current.base).toBe('main');
    expect(result.current.compare).toBe('develop');

    fetchMock.mockRestore();
  });

  it('issues a diff request when base or compare changes', async () => {
    const fetchMock = createSmartMock();

    renderHook(() => useDiff('/some/repo'));

    await act(async () => {
      await new Promise(process.nextTick);
    });

    // After refs load, base and compare are set, triggering a diff
    await act(async () => {
      await new Promise(process.nextTick);
    });

    const diffCalls = fetchCalls.filter(c => c.url.includes('/api/diff'));
    expect(diffCalls.length).toBe(1);
    expect(diffCalls[0].body).toEqual({
      repoPath: '/some/repo',
      base: 'main',
      compare: 'develop',
      hideTestFiles: true,
    });

    fetchMock.mockRestore();
  });

  it('cancels earlier requests when a newer one supersedes', async () => {
    const pendingResolves: Array<() => void> = [];
    let apiCallCount = 0;

    jest.spyOn(global, 'fetch').mockImplementation(async (url: any) => {
      const urlStr = url.toString();
      const idx = apiCallCount++;

      // Ref calls resolve immediately
      if (urlStr.includes('/api/git-refs')) {
        return { ok: true, json: async () => ({ ...mockRefsResponse }) } as Response;
      }

      // Diff calls: resolve in order
      return new Promise((resolve) => {
        pendingResolves.push(() => resolve({ ok: true, json: async () => {
          const response = idx === 2
            ? { ...mockDiffResponse, counts: { added: 5, modified: 3, deleted: 2 } }
            : { ...mockDiffResponse, counts: { added: 1, modified: 1, deleted: 0 } };
          return response;
        } }));
      });
    });

    const { result } = renderHook(() => useDiff('/some/repo'));

    await act(async () => {
      await new Promise(process.nextTick);
    });

    // Before first diff resolves, change compare to trigger second diff
    await act(async () => {
      result.current.setCompare('feature-x');
    });

    await act(async () => {
      await new Promise(process.nextTick);
    });

    // Now resolve both diffs in order
    await act(async () => {
      pendingResolves[0]();
      await new Promise(process.nextTick);
    });

    await act(async () => {
      pendingResolves[1]();
      await new Promise(process.nextTick);
    });

    // The later result should win (added=5)
    expect(result.current.result?.success).toBe(true);
    if (result.current.result?.success) {
      expect(result.current.result.counts.added).toBe(5);
    }

    jest.restoreAllMocks();
  });

  it('validates a bad SHA', async () => {
    const fetchMock = createSmartMock();

    const { result } = renderHook(() => useDiff('/some/repo'));

    await act(async () => {
      await new Promise(process.nextTick);
    });

    // Validate a bad SHA
    await act(async () => {
      await result.current.validateSha('badsha');
    });

    expect(result.current.shaValidation).toEqual({
      input: 'badsha',
      valid: false,
      resolved: null,
    });

    // Should not issue a diff because validateSha doesn't change base/compare
    // (the validateSha call only checks if a sha is valid)
    const shaCalls = fetchCalls.filter(c => c.url.includes('sha='));
    expect(shaCalls.length).toBe(1);

    fetchMock.mockRestore();
  });

  it('issues exactly one diff when changing base', async () => {
    const fetchMock = createSmartMock();

    const { result } = renderHook(() => useDiff('/some/repo'));

    await act(async () => {
      await new Promise(process.nextTick);
    });

    // Reset call tracking 
    const diffCallsBefore = fetchCalls.filter(c => c.url.includes('/api/diff')).length;

    // Change base
    await act(async () => {
      result.current.setBase('feature-x');
    });

    await act(async () => {
      await new Promise(process.nextTick);
    });

    const diffCallsAfter = fetchCalls.filter(c => c.url.includes('/api/diff'));
    // Should be one more diff call than before
    expect(diffCallsAfter.length).toBe(diffCallsBefore + 1);

    fetchMock.mockRestore();
  });
});