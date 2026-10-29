/**
 * @jest-environment node
 */
import {
  clearResponseCache,
  getCachedResponse,
  responseCacheKey,
  setCachedResponse,
} from '@/app/services/analysis/response-cache';
import { getCurrentHead } from '@/lib/scip/cache';

jest.mock('@/lib/scip/cache', () => ({ getCurrentHead: jest.fn() }));
const mockHead = getCurrentHead as jest.MockedFunction<typeof getCurrentHead>;

describe('response cache', () => {
  beforeEach(() => {
    clearResponseCache();
    mockHead.mockReset();
  });

  it('keys on resolved path, HEAD and hideTestFiles', async () => {
    mockHead.mockResolvedValue('sha1');
    const a = await responseCacheKey('/repo/./app', true);
    expect(a).toBe(await responseCacheKey('/repo/app', true));
    expect(a).not.toBe(await responseCacheKey('/repo/app', false));
    mockHead.mockResolvedValue('sha2');
    expect(a).not.toBe(await responseCacheKey('/repo/app', true));
  });

  it('returns null when HEAD cannot be resolved', async () => {
    mockHead.mockRejectedValue(new Error('not a git repository'));
    expect(await responseCacheKey('/nowhere', true)).toBeNull();
  });

  it('evicts the least recently used entry beyond two', () => {
    setCachedResponse('a', 'A');
    setCachedResponse('b', 'B');
    expect(getCachedResponse('a')).toBe('A');
    setCachedResponse('c', 'C');
    expect(getCachedResponse('b')).toBeUndefined();
    expect(getCachedResponse('a')).toBe('A');
    expect(getCachedResponse('c')).toBe('C');
  });
});
