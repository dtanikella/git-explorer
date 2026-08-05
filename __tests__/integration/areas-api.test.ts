/**
 * @jest-environment node
 */
import { POST } from '@/app/api/areas/route';
import { NextRequest } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

function makeRequest(body: object): NextRequest {
  return new NextRequest('http://localhost/api/areas', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/areas', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'areas-test-'));
    // Create a fake .git directory so validation passes
    fs.mkdirSync(path.join(tmpDir, '.git'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('load returns empty areas when file does not exist', async () => {
    const res = await POST(makeRequest({ action: 'load', repoPath: tmpDir }));
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data).toEqual({ version: 1, areas: [] });
  });

  it('save writes the file and load reads it back', async () => {
    const areaData = {
      version: 1,
      areas: [{
        id: 'test', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
        name: 'Test', type: 'utils', contains: ['sym1'], parent: null, children: [], clusterStrength: 0,
      }],
    };

    const saveRes = await POST(makeRequest({ action: 'save', repoPath: tmpDir, data: areaData }));
    const saveJson = await saveRes.json();
    expect(saveJson.success).toBe(true);

    const loadRes = await POST(makeRequest({ action: 'load', repoPath: tmpDir }));
    const loadJson = await loadRes.json();
    expect(loadJson.success).toBe(true);
    expect(loadJson.data.areas).toHaveLength(1);
    expect(loadJson.data.areas[0].id).toBe('test');
  });

  it('rejects repoPath without .git directory', async () => {
    const noGitDir = fs.mkdtempSync(path.join(os.tmpdir(), 'no-git-'));
    const res = await POST(makeRequest({ action: 'load', repoPath: noGitDir }));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
    fs.rmSync(noGitDir, { recursive: true, force: true });
  });

  it('rejects invalid action', async () => {
    const res = await POST(makeRequest({ action: 'invalid', repoPath: tmpDir }));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
  });
});
