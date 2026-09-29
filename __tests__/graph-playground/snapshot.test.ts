/**
 * @jest-environment node
 */
import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';

const playground = path.join(__dirname, '..', '..', 'graph-playground');

interface Snapshot {
  version: number;
  metadata: { repoName: string; commit: string; generatedAt: string; tool: string };
  nodes: Array<{ id: string; name: string; type: string; file: string; test: boolean; xfile: boolean; refsIn: number; refsOut: number }>;
  edges: Array<{ kind: string; from: number; to: number; external: boolean }>;
  externals: Array<{ name: string; pkg: string }>;
  areas: Array<{ id: string; name: string; parent: string | null; color: string | null; contains: number[] }>;
}

function loadSnapshot(): Snapshot {
  const sandbox: { window: { GRAPH_SNAPSHOT?: Snapshot } } = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(playground, 'data.js'), 'utf-8'), sandbox);
  return sandbox.window.GRAPH_SNAPSHOT as Snapshot;
}

describe('graph-playground snapshot contract', () => {
  const snap = loadSnapshot();

  it('provides the five keys a bench snapshot must have', () => {
    expect(snap.version).toBe(1);
    expect(Object.keys(snap)).toEqual(expect.arrayContaining(['metadata', 'nodes', 'edges', 'externals', 'areas']));
    expect(snap.metadata.tool).toBe('scripts/dump-analysis.ts');
    expect(snap.nodes.length).toBeGreaterThan(0);
    expect(snap.edges.length).toBeGreaterThan(0);
  });

  it('has unique node ids and well-formed nodes', () => {
    expect(new Set(snap.nodes.map((n) => n.id)).size).toBe(snap.nodes.length);
    for (const n of snap.nodes) {
      expect(typeof n.type).toBe('string');
      expect(typeof n.test).toBe('boolean');
      expect(typeof n.xfile).toBe('boolean');
      expect(n.refsIn).toBeGreaterThanOrEqual(0);
      expect(n.refsOut).toBeGreaterThanOrEqual(0);
    }
  });

  it('references only existing nodes / externals from edges', () => {
    for (const e of snap.edges) {
      expect(snap.nodes[e.from]).toBeDefined();
      expect(e.external ? snap.externals[e.to] : snap.nodes[e.to]).toBeDefined();
    }
  });

  it('has a consistent area tree over existing nodes', () => {
    const ids = new Set(snap.areas.map((a) => a.id));
    expect(ids.size).toBe(snap.areas.length);
    for (const a of snap.areas) {
      if (a.parent) expect(ids.has(a.parent)).toBe(true);
      for (const i of a.contains) expect(snap.nodes[i]).toBeDefined();
    }
  });
});

describe('graph-playground index.html', () => {
  const html = fs.readFileSync(path.join(playground, 'index.html'), 'utf-8');

  it('runs standalone: loads only d3 (CDN) and the sibling data.js, no bundler entry', () => {
    const scripts = [...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map((m) => m[1]);
    expect(scripts).toEqual(['https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js', 'data.js']);
  });

  it('records the snapshot regen command and the three decisions in the bench', () => {
    expect(html).toContain('npx tsx scripts/dump-analysis.ts');
    expect(html).toContain('Decision 1');
    expect(html).toContain('Decision 2');
    expect(html).toContain('Decision 3');
  });
});
