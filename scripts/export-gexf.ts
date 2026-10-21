/**
 * Export a Graph Tuning Bench snapshot to GEXF 1.3 for Gephi Lite (https://lite.gephi.org).
 *
 * Reads `graph-playground/data.js` (written by `scripts/dump-analysis.ts`) and applies the
 * app's "Vanilla" view filters: FUNCTION / METHOD / CONSTRUCTOR / CLASS nodes, non-external
 * edges only, and only nodes touched by a kept edge. Test-file nodes are dropped unless
 * `--include-tests` is passed (the app's own tsconfig excludes them), and vendored code under
 * `external/` is dropped unless `--include-external` is passed.
 *
 * Usage:
 *   npx tsx scripts/export-gexf.ts [snapshotFile] [outFile] [--include-tests] [--include-external]
 *
 * Defaults: `snapshotFile` = graph-playground/data.js, `outFile` = graph-playground/vanilla.gexf.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';

interface SnapshotNode {
  id: string;
  name: string;
  type: string;
  file: string;
  line: number;
  exported: boolean;
  test: boolean;
  xfile: boolean;
  refsIn: number;
  refsOut: number;
}

interface SnapshotEdge {
  kind: string;
  from: number;
  to: number;
  external: boolean;
}

interface Snapshot {
  metadata: { repoName?: string; commit?: string; generatedAt?: string };
  nodes: SnapshotNode[];
  edges: SnapshotEdge[];
}

const VANILLA_NODE_TYPES = new Set(['FUNCTION', 'METHOD', 'CONSTRUCTOR', 'CLASS']);

const args = process.argv.slice(2);
const includeTests = args.includes('--include-tests');
const includeExternal = args.includes('--include-external');
const [snapshotFile = 'graph-playground/data.js', outFile = 'graph-playground/vanilla.gexf'] = args.filter(
  (a) => !a.startsWith('--'),
);

function loadSnapshot(file: string): Snapshot {
  const sandbox: { window: { GRAPH_SNAPSHOT?: Snapshot } } = { window: {} };
  vm.runInNewContext(fs.readFileSync(file, 'utf-8'), sandbox);
  if (!sandbox.window.GRAPH_SNAPSHOT) throw new Error(`${file} did not set window.GRAPH_SNAPSHOT`);
  return sandbox.window.GRAPH_SNAPSHOT;
}

function xml(value: string | number | boolean): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

const snap = loadSnapshot(snapshotFile);

// Vanilla filters: node type (+ tests), non-external edges between kept nodes.
const keptNode = (i: number): boolean => {
  const n = snap.nodes[i];
  return (
    !!n &&
    VANILLA_NODE_TYPES.has(n.type) &&
    (includeTests || !n.test) &&
    (includeExternal || !n.file.startsWith('external/'))
  );
};
const keptEdges = snap.edges.filter((e) => !e.external && keptNode(e.from) && keptNode(e.to));

// Only nodes touched by a kept edge are rendered; renumber them densely for GEXF ids.
const gexfId = new Map<number, number>();
for (const e of keptEdges) {
  for (const i of [e.from, e.to]) if (!gexfId.has(i)) gexfId.set(i, gexfId.size);
}
const nodeIndices = [...gexfId.keys()].sort((a, b) => gexfId.get(a)! - gexfId.get(b)!);

const NODE_ATTRS: Array<[string, string]> = [
  ['type', 'string'],
  ['file', 'string'],
  ['line', 'integer'],
  ['exported', 'boolean'],
  ['test', 'boolean'],
  ['xfile', 'boolean'],
  ['refsIn', 'integer'],
  ['refsOut', 'integer'],
  ['symbol', 'string'],
];

const lines: string[] = [];
lines.push('<?xml version="1.0" encoding="UTF-8"?>');
lines.push('<gexf xmlns="http://gexf.net/1.3" version="1.3">');
lines.push('  <meta>');
lines.push(`    <creator>git-explorer scripts/export-gexf.ts</creator>`);
lines.push(
  `    <description>${xml(`Vanilla view of ${snap.metadata.repoName ?? 'repo'} @ ${snap.metadata.commit ?? 'unknown'}`)}</description>`,
);
lines.push('  </meta>');
lines.push('  <graph mode="static" defaultedgetype="directed">');
lines.push('    <attributes class="node">');
NODE_ATTRS.forEach(([title, type], i) => lines.push(`      <attribute id="${i}" title="${title}" type="${type}"/>`));
lines.push('    </attributes>');
lines.push('    <attributes class="edge">');
lines.push('      <attribute id="0" title="kind" type="string"/>');
lines.push('    </attributes>');

lines.push('    <nodes>');
for (const i of nodeIndices) {
  const n = snap.nodes[i];
  const values = [
    n.type,
    n.file,
    n.line,
    n.exported,
    n.test,
    n.xfile,
    n.refsIn,
    n.refsOut,
    n.id,
  ];
  lines.push(`      <node id="${gexfId.get(i)}" label="${xml(n.name)}">`);
  lines.push('        <attvalues>');
  values.forEach((v, k) => lines.push(`          <attvalue for="${k}" value="${xml(v)}"/>`));
  lines.push('        </attvalues>');
  lines.push('      </node>');
}
lines.push('    </nodes>');

lines.push('    <edges>');
keptEdges.forEach((e, k) => {
  lines.push(
    `      <edge id="${k}" source="${gexfId.get(e.from)}" target="${gexfId.get(e.to)}" label="${xml(e.kind)}">`,
  );
  lines.push(`        <attvalues><attvalue for="0" value="${xml(e.kind)}"/></attvalues>`);
  lines.push('      </edge>');
});
lines.push('    </edges>');
lines.push('  </graph>');
lines.push('</gexf>');

fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true });
fs.writeFileSync(outFile, lines.join('\n') + '\n');
console.log(
  `Wrote ${outFile}: ${nodeIndices.length} nodes, ${keptEdges.length} edges ` +
    `(from ${snap.nodes.length} nodes / ${snap.edges.length} edges in snapshot)`,
);
