/**
 * Analyze a repo's CALLS edges to produce statistics for tuning
 * scaledValue parameters (node radius and collide radius).
 *
 * Usage: npx tsx scripts/analyze-scaling.ts /path/to/repo
 */
import { analyzeTsRepo } from '../app/services/analysis/ts/controller';
import { EdgeKind, SyntaxType } from '../lib/analysis/types';

const repoPath = process.argv[2];
if (!repoPath) {
  console.error('Usage: npx tsx scripts/analyze-scaling.ts /path/to/repo');
  process.exit(1);
}

function percentile(sorted: number[], p: number): number {
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function printStats(label: string, values: number[]) {
  if (values.length === 0) {
    console.log(`\n${label}: (no data)`);
    return;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const mean = sum / sorted.length;
  console.log(`\n=== ${label} (n=${sorted.length}) ===`);
  console.log(`  min:    ${sorted[0]}`);
  console.log(`  p10:    ${percentile(sorted, 10).toFixed(1)}`);
  console.log(`  p25:    ${percentile(sorted, 25).toFixed(1)}`);
  console.log(`  median: ${percentile(sorted, 50).toFixed(1)}`);
  console.log(`  p75:    ${percentile(sorted, 75).toFixed(1)}`);
  console.log(`  p90:    ${percentile(sorted, 90).toFixed(1)}`);
  console.log(`  p95:    ${percentile(sorted, 95).toFixed(1)}`);
  console.log(`  p99:    ${percentile(sorted, 99).toFixed(1)}`);
  console.log(`  max:    ${sorted[sorted.length - 1]}`);
  console.log(`  mean:   ${mean.toFixed(2)}`);
  console.log(`  stdev:  ${Math.sqrt(sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / sorted.length).toFixed(2)}`);

  // Distribution histogram (bucket by powers of 2)
  const buckets = new Map<string, number>();
  for (const v of sorted) {
    let label: string;
    if (v === 0) label = '0';
    else if (v === 1) label = '1';
    else if (v <= 3) label = '2-3';
    else if (v <= 7) label = '4-7';
    else if (v <= 15) label = '8-15';
    else if (v <= 31) label = '16-31';
    else if (v <= 63) label = '32-63';
    else if (v <= 127) label = '64-127';
    else label = '128+';
    buckets.set(label, (buckets.get(label) ?? 0) + 1);
  }
  console.log('  distribution:');
  for (const [bucket, count] of buckets) {
    const pct = ((count / sorted.length) * 100).toFixed(1);
    const bar = '█'.repeat(Math.ceil(count / sorted.length * 40));
    console.log(`    ${bucket.padStart(7)}: ${String(count).padStart(5)} (${pct.padStart(5)}%) ${bar}`);
  }
}

async function main() {
  console.log(`Analyzing: ${repoPath}`);
  const result = await analyzeTsRepo(repoPath, { hideTestFiles: true });

  // Filter to FUNCTION/METHOD nodes only (Modules view)
  const moduleNodes = result.nodes.filter(
    n => n.syntaxType === SyntaxType.FUNCTION || n.syntaxType === SyntaxType.METHOD
  );
  const callsEdges = result.edges.filter(
    e => e.kind === EdgeKind.CALLS && !e.isExternal
  );

  console.log(`\nTotal nodes: ${result.nodes.length}`);
  console.log(`Module nodes (FUNCTION+METHOD): ${moduleNodes.length}`);
  console.log(`Total edges: ${result.edges.length}`);
  console.log(`CALLS edges (non-external): ${callsEdges.length}`);

  // Outbound CALLS per node
  const outboundCounts = new Map<string, number>();
  for (const e of callsEdges) {
    outboundCounts.set(e.fromSymbol, (outboundCounts.get(e.fromSymbol) ?? 0) + 1);
  }
  const outboundValues = moduleNodes.map(n => outboundCounts.get(n.scipSymbol) ?? 0);

  // Inbound references per node
  const inboundValues = moduleNodes.map(n => n.referencedAt.length);

  printStats('Outbound CALLS per node (→ node radius)', outboundValues);
  printStats('Inbound references per node (→ collide radius)', inboundValues);

  // Show top 10 by outbound
  const topOutbound = moduleNodes
    .map(n => ({ name: n.name, file: n.filePath, count: outboundCounts.get(n.scipSymbol) ?? 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  console.log('\n=== Top 10 by outbound CALLS ===');
  for (const { name, file, count } of topOutbound) {
    console.log(`  ${count.toString().padStart(4)} calls  ${name}  (${file})`);
  }

  // Show top 10 by inbound
  const topInbound = moduleNodes
    .map(n => ({ name: n.name, file: n.filePath, count: n.referencedAt.length }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  console.log('\n=== Top 10 by inbound references ===');
  for (const { name, file, count } of topInbound) {
    console.log(`  ${count.toString().padStart(4)} refs   ${name}  (${file})`);
  }

  // Lookup specific nodes if LOOKUP env var is set
  const lookupNames = process.env.LOOKUP?.split(',').map(s => s.trim());
  if (lookupNames && lookupNames.length > 0) {
    console.log('\n=== Lookup ===');
    for (const name of lookupNames) {
      const matches = moduleNodes.filter(n => n.name === name);
      if (matches.length === 0) { console.log(`  ${name}: NOT FOUND`); continue; }
      for (const n of matches) {
        const out = outboundCounts.get(n.scipSymbol) ?? 0;
        const inb = n.referencedAt.length;
        console.log(`  ${name}  |  outbound: ${out}  |  inbound: ${inb}  |  ${n.filePath}`);
      }
    }
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
