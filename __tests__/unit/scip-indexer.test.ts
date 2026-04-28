import { indexTypeScriptRepo } from '@/lib/scip/ts/indexer';
import { ScipIndexError } from '@/lib/scip/types';

jest.mock('fs/promises');
const fs = require('fs/promises');

jest.mock('child_process');
const { execFile } = require('child_process');

jest.mock('@/lib/scip/cache');
const { getCachedIndex, saveCachedIndex } = require('@/lib/scip/cache');

describe('indexTypeScriptRepo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fs.mkdir.mockResolvedValue(undefined);
  });

  it('returns cached result when cache is valid', async () => {
    getCachedIndex.mockResolvedValue({
      indexPath: '/repo/.git-explorer/index.scip',
      headSha: 'abc123',
      indexedAt: '2026-04-28T00:00:00.000Z',
    });

    const result = await indexTypeScriptRepo('/repo');

    expect(result).toEqual({
      indexPath: '/repo/.git-explorer/index.scip',
      fromCache: true,
    });
    expect(execFile).not.toHaveBeenCalled();
  });

  it('runs scip-typescript index on cache miss', async () => {
    getCachedIndex.mockResolvedValue(null);
    saveCachedIndex.mockResolvedValue(undefined);

    execFile.mockImplementation(
      (_cmd: string, _args: string[], _opts: object, cb: Function) => {
        cb(null, 'Indexing complete', '');
        return { kill: jest.fn() };
      }
    );

    const result = await indexTypeScriptRepo('/repo');

    expect(result.fromCache).toBe(false);
    expect(result.indexPath).toContain('.git-explorer/index.scip');
    expect(execFile).toHaveBeenCalledTimes(1);
    expect(saveCachedIndex).toHaveBeenCalled();
  });

  it('throws ScipIndexError on subprocess failure', async () => {
    getCachedIndex.mockResolvedValue(null);

    const processError = new Error('process failed') as Error & { code: number };
    processError.code = 1;
    execFile.mockImplementation(
      (_cmd: string, _args: string[], _opts: object, cb: Function) => {
        cb(processError, '', 'tsconfig.json not found');
        return { kill: jest.fn() };
      }
    );

    await expect(indexTypeScriptRepo('/repo'))
      .rejects
      .toThrow(ScipIndexError);
  });

  it('skips cache check when forceReindex is true', async () => {
    saveCachedIndex.mockResolvedValue(undefined);
    execFile.mockImplementation(
      (_cmd: string, _args: string[], _opts: object, cb: Function) => {
        cb(null, '', '');
        return { kill: jest.fn() };
      }
    );

    const result = await indexTypeScriptRepo('/repo', { forceReindex: true });

    expect(getCachedIndex).not.toHaveBeenCalled();
    expect(result.fromCache).toBe(false);
  });
});
