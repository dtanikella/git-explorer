import { getCachedIndex, saveCachedIndex, isCacheValid } from '@/lib/scip/cache';
import { ScipCacheError } from '@/lib/scip/types';
import * as path from 'path';

jest.mock('fs/promises');
const fs = require('fs/promises');

jest.mock('simple-git', () => jest.fn().mockReturnValue({
  revparse: jest.fn(),
}));
const simpleGit = require('simple-git');

const REPO = '/fake/repo';
const CACHE_DIR = path.join(REPO, '.git-explorer');
const INDEX_PATH = path.join(CACHE_DIR, 'index.scip');
const META_PATH = path.join(CACHE_DIR, 'cache-meta.json');

describe('getCachedIndex', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns CacheResult when cache is valid', async () => {
    const headSha = 'abc123def456';
    simpleGit().revparse.mockResolvedValue(headSha);
    fs.readFile.mockResolvedValue(JSON.stringify({
      headSha,
      indexedAt: '2026-04-28T00:00:00.000Z',
    }));
    fs.access.mockResolvedValue(undefined);

    const result = await getCachedIndex(REPO);

    expect(result).toEqual({
      indexPath: INDEX_PATH,
      headSha,
      indexedAt: '2026-04-28T00:00:00.000Z',
    });
  });

  it('returns null when cache-meta.json does not exist', async () => {
    simpleGit().revparse.mockResolvedValue('abc123');
    fs.readFile.mockRejectedValue(new Error('ENOENT'));

    const result = await getCachedIndex(REPO);
    expect(result).toBeNull();
  });

  it('returns null when HEAD SHA does not match cached SHA', async () => {
    simpleGit().revparse.mockResolvedValue('newsha999');
    fs.readFile.mockResolvedValue(JSON.stringify({
      headSha: 'oldsha111',
      indexedAt: '2026-04-28T00:00:00.000Z',
    }));

    const result = await getCachedIndex(REPO);
    expect(result).toBeNull();
  });

  it('returns null when index.scip file is missing', async () => {
    const headSha = 'abc123';
    simpleGit().revparse.mockResolvedValue(headSha);
    fs.readFile.mockResolvedValue(JSON.stringify({
      headSha,
      indexedAt: '2026-04-28T00:00:00.000Z',
    }));
    fs.access.mockRejectedValue(new Error('ENOENT'));

    const result = await getCachedIndex(REPO);
    expect(result).toBeNull();
  });
});

describe('saveCachedIndex', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates cache dir, verifies index file, and writes meta file', async () => {
    simpleGit().revparse.mockResolvedValue('abc123');
    fs.mkdir.mockResolvedValue(undefined);
    fs.access.mockResolvedValue(undefined);
    fs.writeFile.mockResolvedValue(undefined);

    await saveCachedIndex(REPO, INDEX_PATH);

    expect(fs.mkdir).toHaveBeenCalledWith(CACHE_DIR, { recursive: true });
    expect(fs.access).toHaveBeenCalledWith(INDEX_PATH);
    expect(fs.writeFile).toHaveBeenCalledWith(
      META_PATH,
      expect.stringContaining('"headSha":"abc123"'),
    );
  });

  it('copies index file when source differs from cache location', async () => {
    const externalPath = '/tmp/output/index.scip';
    simpleGit().revparse.mockResolvedValue('abc123');
    fs.mkdir.mockResolvedValue(undefined);
    fs.copyFile.mockResolvedValue(undefined);
    fs.access.mockResolvedValue(undefined);
    fs.writeFile.mockResolvedValue(undefined);

    await saveCachedIndex(REPO, externalPath);

    expect(fs.copyFile).toHaveBeenCalledWith(externalPath, INDEX_PATH);
  });

  it('throws ScipCacheError when index file is missing', async () => {
    simpleGit().revparse.mockResolvedValue('abc123');
    fs.mkdir.mockResolvedValue(undefined);
    fs.access.mockRejectedValue(new Error('ENOENT'));

    await expect(saveCachedIndex(REPO, INDEX_PATH)).rejects.toThrow('Failed to save cache');
  });
});

describe('isCacheValid', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns true when cache matches HEAD', async () => {
    simpleGit().revparse.mockResolvedValue('abc123');
    fs.readFile.mockResolvedValue(JSON.stringify({ headSha: 'abc123', indexedAt: '...' }));
    fs.access.mockResolvedValue(undefined);

    expect(await isCacheValid(REPO)).toBe(true);
  });

  it('returns false when no cache exists', async () => {
    simpleGit().revparse.mockResolvedValue('abc123');
    fs.readFile.mockRejectedValue(new Error('ENOENT'));

    expect(await isCacheValid(REPO)).toBe(false);
  });
});
