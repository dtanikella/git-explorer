/**
 * @jest-environment node
 */
import * as path from 'path';
import * as fs from 'fs/promises';
import { indexTypeScriptRepo } from '@/lib/scip/ts/indexer';
import { readScipIndex } from '@/lib/scip/reader';

const FIXTURE_PATH = path.resolve(__dirname, '../fixtures/scip-test-project');
const CACHE_DIR = path.join(FIXTURE_PATH, '.git-explorer');

describe('SCIP indexer integration', () => {
  afterAll(async () => {
    // Clean up generated cache directory
    await fs.rm(CACHE_DIR, { recursive: true, force: true });
  });

  it('indexes the fixture project and produces a readable index.scip', async () => {
    const result = await indexTypeScriptRepo(FIXTURE_PATH, { forceReindex: true });

    expect(result.fromCache).toBe(false);
    expect(result.indexPath).toContain('index.scip');

    // Verify the file exists
    const stat = await fs.stat(result.indexPath);
    expect(stat.size).toBeGreaterThan(0);

    // Verify it can be deserialized
    const index = await readScipIndex(result.indexPath);
    expect(index.documents).toBeDefined();
    expect(index.documents.length).toBeGreaterThan(0);

    // Verify the documents contain our fixture files
    const relativePaths = index.documents.map((d: { relativePath: string }) => d.relativePath);
    expect(relativePaths).toEqual(
      expect.arrayContaining([
        expect.stringContaining('index.ts'),
        expect.stringContaining('utils.ts'),
      ])
    );
  }, 30000);

  it('returns cached result on second call', async () => {
    const result = await indexTypeScriptRepo(FIXTURE_PATH);

    expect(result.fromCache).toBe(true);
    expect(result.indexPath).toContain('index.scip');
  });
});
