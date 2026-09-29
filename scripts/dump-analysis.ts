/**
 * Freeze a repository analysis into a snapshot for the Graph Tuning Bench.
 *
 * Runs the same pipeline the app uses (SCIP index → tree-sitter → graph
 * assembly) and writes `graph-playground/data.js`, a plain script that sets
 * `window.GRAPH_SNAPSHOT`. The bench loads it with a `<script>` tag, so it
 * opens straight from `file://` with no backend and no build step.
 *
 * Usage:
 *   npx tsx scripts/dump-analysis.ts [repoPath] [outFile]
 *
 * Defaults: `repoPath` = current directory, `outFile` = graph-playground/data.js.
 * Areas are read from `<repoPath>/.git-explorer/areas.json` when present.
 *
 * Test files are indexed too (the app's tsconfig excludes `__tests__`, so a temporary
 * tsconfig without that exclusion is used) and flagged per node, which is what the
 * bench's "exclude tests" toggle filters on. The repo's `.git-explorer/` SCIP cache is
 * backed up first and restored afterwards, so running this leaves tracked files untouched.
 *
 * Swapping the snapshot = re-running this script (or dropping in any file that
 * satisfies the contract written into the header of the generated data.js and
 * into the bench's notes panel).
 */
import * as fs from 'fs';
import * as path from 'path';
import { execFile, execFileSync } from 'child_process';
import { promisify } from 'util';
import { analyzeTsRepo } from '../app/services/analysis/ts/controller';
import { saveCachedIndex } from '../lib/scip/cache';
import type { AnalysisEdge, AnalysisNode } from '../lib/analysis/types';

interface AreaRecord {
  id: string;
  name: string;
  parent: string | null;
  color?: string;
  contains: string[];
}

const SNAPSHOT_VERSION = 1;

const CONTRACT_HEADER = `/*
 * Graph Tuning Bench snapshot (contract v${SNAPSHOT_VERSION}) — GENERATED, do not hand-edit.
 * Regenerate:  npx tsx scripts/dump-analysis.ts [repoPath] [outFile]
 *
 * window.GRAPH_SNAPSHOT = {
 *   version:  ${SNAPSHOT_VERSION},
 *   metadata: { repoName, repoPath, commit, generatedAt, language, tool, analysisDurationMs },
 *   nodes:    [{ id, name, type, file, line, exported, test, xfile, refsIn, refsOut }],
 *             id       unique SCIP symbol (areas reference it)
 *             type     SyntaxType string (FUNCTION, METHOD, CLASS, VARIABLE, ...)
 *             test     node lives in a test file
 *             xfile    referenced from / references another file (hasCrossFileReference)
 *             refsIn   referencedAt.length      refsOut  outboundRefs.length
 *   edges:    [{ kind, from, to, external }]
 *             kind     EdgeKind string (CALLS, INSTANTIATES, USES_TYPE, EXTENDS, ...)
 *             from     index into nodes
 *             to       index into nodes, or into externals when external is true
 *   externals: [{ name, pkg }]       targets outside the repo (display name, package)
 *   areas:    [{ id, name, parent, color, contains }]
 *             parent   area id or null;  color CSS hex or null;  contains = node indices
 * }
 *
 * A replacement snapshot only has to provide those five keys; the bench derives every
 * count, toggle and tree from them.
 */
`;

function packageOf(symbol: string): string {
  // "scip-typescript npm <package> <version> <descriptors>"
  const parts = symbol.split(' ');
  return parts.length > 3 ? parts[2] : 'unknown';
}

function hasCrossFileReference(node: AnalysisNode): boolean {
  return (
    node.referencedAt.some((ref) => ref.filePath !== node.filePath) ||
    node.outboundRefs.some((ref) => ref.filePath !== node.filePath)
  );
}

function readAreas(repoPath: string, indexOf: Map<string, number>): AreaRecord[] {
  const file = path.join(repoPath, '.git-explorer', 'areas.json');
  if (!fs.existsSync(file)) return [];
  const parsed = JSON.parse(fs.readFileSync(file, 'utf-8')) as {
    areas?: Array<{ id: string; name: string; parent: string | null; color?: string; contains: string[] }>;
  };
  return (parsed.areas ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    parent: a.parent ?? null,
    color: a.color,
    contains: a.contains.filter((s) => indexOf.has(s)),
  }));
}

/**
 * Index the repo with scip-typescript using a temporary tsconfig that no longer
 * excludes test directories, then register the result as the SCIP cache so that
 * `analyzeTsRepo` picks it up instead of re-indexing with the default tsconfig.
 */
async function indexIncludingTests(repoPath: string): Promise<void> {
  const tsconfigPath = path.join(repoPath, 'tsconfig.json');
  const tmpConfig = path.join(repoPath, 'tsconfig.bench-tests.json');
  const cacheDir = path.join(repoPath, '.git-explorer');
  const outPath = path.join(cacheDir, 'index.scip');
  const scipBin = path.join(process.cwd(), 'node_modules', '@sourcegraph', 'scip-typescript', 'dist', 'src', 'main.js');

  const base = JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8')) as { exclude?: string[] };
  const exclude = (base.exclude ?? []).filter((e) => !/(^|\/)(__tests__|tests?)(\/|$)/.test(e));
  fs.writeFileSync(tmpConfig, JSON.stringify({ extends: './tsconfig.json', exclude }));
  try {
    fs.mkdirSync(cacheDir, { recursive: true });
    await promisify(execFile)(process.execPath, [scipBin, 'index', '--output', outPath, 'tsconfig.bench-tests.json'], {
      cwd: repoPath,
      timeout: 180_000,
      maxBuffer: 64 * 1024 * 1024,
    });
    await saveCachedIndex(repoPath, outPath);
  } finally {
    fs.rmSync(tmpConfig, { force: true });
  }
}

function line(value: unknown): string {
  return JSON.stringify(value);
}

async function main(): Promise<void> {
  const repoPath = path.resolve(process.argv[2] ?? process.cwd());
  const outFile = path.resolve(process.argv[3] ?? path.join(process.cwd(), 'graph-playground', 'data.js'));

  console.log(`Analyzing ${repoPath}`);
  const cacheFiles = ['index.scip', 'cache-meta.json'].map((f) => path.join(repoPath, '.git-explorer', f));
  const backups = cacheFiles.map((f) => (fs.existsSync(f) ? fs.readFileSync(f) : null));
  let result;
  try {
    await indexIncludingTests(repoPath);
    // Test files are kept and flagged so the bench can offer an exclude-tests toggle.
    result = await analyzeTsRepo(repoPath, { hideTestFiles: false });
  } finally {
    cacheFiles.forEach((f, i) => {
      const saved = backups[i];
      if (saved) fs.writeFileSync(f, saved);
      else fs.rmSync(f, { force: true });
    });
  }

  const nodeIndex = new Map<string, number>();
  result.nodes.forEach((n, i) => nodeIndex.set(n.scipSymbol, i));

  const externalIndex = new Map<string, number>();
  const externals: Array<{ name: string; pkg: string }> = [];
  const externalIdx = (e: AnalysisEdge): number => {
    let i = externalIndex.get(e.toSymbol);
    if (i === undefined) {
      i = externals.length;
      externalIndex.set(e.toSymbol, i);
      externals.push({ name: e.toName, pkg: packageOf(e.toSymbol) });
    }
    return i;
  };

  const nodes = result.nodes.map((n) => ({
    id: n.scipSymbol,
    name: n.name,
    type: n.syntaxType,
    file: n.filePath,
    line: n.startLine,
    exported: n.isExported,
    test: n.inTestFile,
    xfile: hasCrossFileReference(n),
    refsIn: n.referencedAt.length,
    refsOut: n.outboundRefs.length,
  }));

  const edges: Array<{ kind: string; from: number; to: number; external: boolean }> = [];
  let skipped = 0;
  for (const e of result.edges) {
    const from = nodeIndex.get(e.fromSymbol);
    if (from === undefined) {
      skipped++;
      continue;
    }
    if (e.isExternal) {
      edges.push({ kind: e.kind, from, to: externalIdx(e), external: true });
      continue;
    }
    const to = nodeIndex.get(e.toSymbol);
    if (to === undefined) {
      skipped++;
      continue;
    }
    edges.push({ kind: e.kind, from, to, external: false });
  }

  const areas = readAreas(repoPath, nodeIndex).map((a) => ({
    id: a.id,
    name: a.name,
    parent: a.parent,
    color: a.color ?? null,
    contains: a.contains.map((s) => nodeIndex.get(s) as number),
  }));

  let commit = 'unknown';
  try {
    commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: repoPath }).toString().trim();
  } catch {
    // not a git checkout: leave as unknown
  }

  const metadata = {
    repoName: path.basename(repoPath),
    repoPath: path.basename(repoPath),
    commit,
    generatedAt: new Date().toISOString(),
    language: result.metadata.language,
    tool: 'scripts/dump-analysis.ts',
    analysisDurationMs: result.metadata.analysisDurationMs,
  };

  const body = [
    CONTRACT_HEADER,
    'window.GRAPH_SNAPSHOT = {',
    `  "version": ${SNAPSHOT_VERSION},`,
    `  "metadata": ${line(metadata)},`,
    '  "nodes": [',
    nodes.map((n) => `    ${line(n)}`).join(',\n'),
    '  ],',
    '  "edges": [',
    edges.map((e) => `    ${line(e)}`).join(',\n'),
    '  ],',
    '  "externals": [',
    externals.map((x) => `    ${line(x)}`).join(',\n'),
    '  ],',
    '  "areas": [',
    areas.map((a) => `    ${line(a)}`).join(',\n'),
    '  ]',
    '};',
    '',
  ].join('\n');

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, body);

  const count = (xs: string[]): Record<string, number> =>
    xs.reduce<Record<string, number>>((m, x) => ((m[x] = (m[x] ?? 0) + 1), m), {});
  console.log(`Wrote ${path.relative(process.cwd(), outFile)} (${(body.length / 1024).toFixed(0)} KB)`);
  console.log(`  nodes ${nodes.length}`, count(nodes.map((n) => n.type)));
  console.log(`  edges ${edges.length}`, count(edges.map((e) => e.kind)));
  console.log(`  internal ${edges.filter((e) => !e.external).length} / external ${edges.filter((e) => e.external).length} (${externals.length} external targets)`);
  console.log(`  areas ${areas.length}${skipped ? `  (skipped ${skipped} edges with unresolved endpoints)` : ''}`);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
