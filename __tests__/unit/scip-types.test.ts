import {
  IndexResult,
  CacheResult,
  IndexOptions,
  ScipIndexError,
  ScipReadError,
  ScipCacheError,
} from '@/lib/scip/types';

describe('SCIP types', () => {
  describe('IndexResult', () => {
    it('has indexPath and fromCache fields', () => {
      const result: IndexResult = { indexPath: '/tmp/index.scip', fromCache: true };
      expect(result.indexPath).toBe('/tmp/index.scip');
      expect(result.fromCache).toBe(true);
    });
  });

  describe('CacheResult', () => {
    it('has indexPath, headSha, and indexedAt fields', () => {
      const result: CacheResult = {
        indexPath: '/tmp/index.scip',
        headSha: 'abc123',
        indexedAt: '2026-04-28T00:00:00.000Z',
      };
      expect(result.indexPath).toBe('/tmp/index.scip');
      expect(result.headSha).toBe('abc123');
      expect(result.indexedAt).toBe('2026-04-28T00:00:00.000Z');
    });
  });

  describe('IndexOptions', () => {
    it('allows optional forceReindex and timeout', () => {
      const opts: IndexOptions = {};
      expect(opts.forceReindex).toBeUndefined();
      expect(opts.timeout).toBeUndefined();

      const opts2: IndexOptions = { forceReindex: true, timeout: 30000 };
      expect(opts2.forceReindex).toBe(true);
      expect(opts2.timeout).toBe(30000);
    });
  });

  describe('ScipIndexError', () => {
    it('captures exit code and stderr', () => {
      const err = new ScipIndexError('indexing failed', 1, 'tsconfig not found');
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe('ScipIndexError');
      expect(err.message).toBe('indexing failed');
      expect(err.exitCode).toBe(1);
      expect(err.stderr).toBe('tsconfig not found');
    });
  });

  describe('ScipReadError', () => {
    it('captures the file path', () => {
      const err = new ScipReadError('decode failed', '/tmp/index.scip');
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe('ScipReadError');
      expect(err.filePath).toBe('/tmp/index.scip');
    });
  });

  describe('ScipCacheError', () => {
    it('captures the repo path', () => {
      const err = new ScipCacheError('permission denied', '/repo');
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe('ScipCacheError');
      expect(err.repoPath).toBe('/repo');
    });
  });
});
