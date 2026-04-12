/**
 * Debug script: find JSX component usages that are NOT represented as call edges.
 *
 * Usage:
 *   npx tsx scripts/debug-jsx-edges.ts [repoPath]
 *
 * If no repoPath is given, defaults to the git-explorer repo itself.
 */
import * as ts from 'typescript';
import * as path from 'path';
import { analyzeTypeScriptRepo } from '../lib/ts/analyzer';
import { CallEdge } from '../lib/ts/types';

const repoPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(__dirname, '..');

console.log(`Analyzing: ${repoPath}\n`);

// ── Step 1: Run the analyzer and collect call edges ──
const { nodes, edges } = analyzeTypeScriptRepo(repoPath);

const callEdges = edges.filter((e): e is CallEdge => e.type === 'call');
const nodeMap = new Map(nodes.map((n) => [n.id, n]));

console.log(`=== Analyzer output ===`);
console.log(`Nodes: ${nodes.length}  Edges: ${edges.length}  Call edges: ${callEdges.length}\n`);

// All call edges targeting a PascalCase name (likely JSX component calls)
console.log(`--- Call edges to PascalCase targets (likely JSX component calls) ---`);
for (const e of callEdges) {
  const targetNode = nodeMap.get(e.target);
  if (targetNode && 'name' in targetNode && /^[A-Z]/.test(targetNode.name)) {
    const sourceNode = nodeMap.get(e.source);
    const srcLabel = sourceNode && 'name' in sourceNode ? sourceNode.name : e.source;
    console.log(`  ${srcLabel} → ${targetNode.name}  (${e.callScope})  [${e.source} → ${e.target}]`);
  }
}

// ── Step 2: Independently scan .tsx files for JSX component usage ──
console.log(`\n=== Independent JSX scan ===`);

const configPath = ts.findConfigFile(repoPath, ts.sys.fileExists, 'tsconfig.json')!;
const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
const parsedConfig = ts.parseJsonConfigFileContent(
  configFile.config,
  ts.sys,
  path.dirname(configPath)
);
const program = ts.createProgram(parsedConfig.fileNames, {
  ...parsedConfig.options,
  noEmit: true,
});

interface JsxUsage {
  file: string;
  tagName: string;
  line: number;
}

const jsxUsages: JsxUsage[] = [];

for (const sourceFile of program.getSourceFiles()) {
  if (sourceFile.isDeclarationFile) continue;
  if (!sourceFile.fileName.startsWith(repoPath)) continue;
  if (!sourceFile.fileName.endsWith('.tsx')) continue;
  if (sourceFile.fileName.includes('__tests__') || sourceFile.fileName.includes('.test.')) continue;

  const relPath = path.relative(repoPath, sourceFile.fileName);

  function walk(node: ts.Node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = node.tagName.getText(sourceFile);
      if (tagName[0] && tagName[0] === tagName[0].toUpperCase()) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        jsxUsages.push({ file: relPath, tagName, line: line + 1 });
      }
    }
    ts.forEachChild(node, walk);
  }
  ts.forEachChild(sourceFile, walk);
}

console.log(`Found ${jsxUsages.length} JSX component usages in .tsx files:\n`);

// ── Step 3: For each JSX usage, check if ANY call edge targets that component name ──
//            (source-independent search to avoid false negatives from enclosing-fn mismatch)

interface MissingUsage extends JsxUsage {
  reason: string;
}

const missing: MissingUsage[] = [];
const found: JsxUsage[] = [];

for (const usage of jsxUsages) {
  // Check if ANY call edge targets a node named tagName from a source in the same file
  const fileId = `file:${usage.file}`;
  const hasEdge = callEdges.some((e) => {
    // Source must be in this file (file node or fn/class in this file)
    const srcInFile = e.source === fileId || e.source.includes(`:${usage.file}:`);
    if (!srcInFile) return false;
    const target = nodeMap.get(e.target);
    if (target && 'name' in target) {
      const parts = usage.tagName.split('.');
      const lastName = parts[parts.length - 1];
      return target.name === usage.tagName || target.name === lastName;
    }
    return e.target.endsWith(`:${usage.tagName}`);
  });

  if (hasEdge) {
    found.push(usage);
  } else {
    // Diagnose WHY the edge is missing
    const reasons: string[] = [];

    // 1. Does a node for this component exist at all?
    const matchingNodes = nodes.filter(
      (n) => 'name' in n && (n as { name: string }).name === usage.tagName
    );
    if (matchingNodes.length === 0) {
      reasons.push(`NO NODE exists named "${usage.tagName}" — component not detected by analyzer`);

      // Sub-check: is the component defined via a pattern we don't handle?
      // Look for the import in the file to find where it comes from
      const sf = program.getSourceFiles().find(
        (s) => path.relative(repoPath, s.fileName) === usage.file
      );
      if (sf) {
        ts.forEachChild(sf, (node) => {
          if (ts.isImportDeclaration(node) && node.importClause) {
            const clause = node.importClause;
            const specifier = (node.moduleSpecifier as ts.StringLiteral).text;
            const names: string[] = [];
            if (clause.name) names.push(clause.name.text);
            if (clause.namedBindings) {
              if (ts.isNamedImports(clause.namedBindings)) {
                for (const el of clause.namedBindings.elements) names.push(el.name.text);
              }
              if (ts.isNamespaceImport(clause.namedBindings)) names.push(clause.namedBindings.name.text + '.*');
            }
            if (names.includes(usage.tagName)) {
              reasons.push(`  Imported from "${specifier}" as: ${names.join(', ')}`);
              // Resolve to see if the target file defines it
              const resolved = ts.resolveModuleName(specifier, sf.fileName, program.getCompilerOptions(), ts.sys);
              const resolvedFile = resolved.resolvedModule?.resolvedFileName;
              if (resolvedFile) {
                const relResolved = path.relative(repoPath, resolvedFile);
                reasons.push(`  Resolves to: ${relResolved}`);
                // Check what top-level declarations exist in the target file
                const targetSf = program.getSourceFiles().find((s) => s.fileName === resolvedFile);
                if (targetSf) {
                  const decls: string[] = [];
                  ts.forEachChild(targetSf, (child) => {
                    if (ts.isFunctionDeclaration(child) && child.name)
                      decls.push(`fn:${child.name.text}`);
                    if (ts.isClassDeclaration(child) && child.name)
                      decls.push(`class:${child.name.text}`);
                    if (ts.isVariableStatement(child)) {
                      for (const d of child.declarationList.declarations) {
                        if (ts.isIdentifier(d.name)) {
                          const init = d.initializer;
                          if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) {
                            decls.push(`fn(arrow):${d.name.text}`);
                          } else if (init && ts.isCallExpression(init)) {
                            decls.push(`wrapped-call:${d.name.text} = ${init.expression.getText(targetSf)}(...)`);
                          } else if (init) {
                            decls.push(`var:${d.name.text} = ${ts.SyntaxKind[init.kind]}`);
                          }
                        }
                      }
                    }
                    if (ts.isExportAssignment(child)) {
                      decls.push(`export-default: ${child.expression.getText(targetSf).slice(0, 60)}`);
                    }
                  });
                  reasons.push(`  Target file declarations: ${decls.join(', ') || '(none)'}`);
                }
              } else {
                reasons.push(`  Could not resolve module "${specifier}"`);
              }
            }
          }
        });
      }
    } else {
      reasons.push(`Node(s) named "${usage.tagName}" exist: ${matchingNodes.map((n) => `${n.id} (${n.kind})`).join(', ')}`);

      // 2. The target exists but no call edge was created. Why?
      // Check if there's a source node in this file
      const sourceNodesInFile = nodes.filter(
        (n) => n.id === fileId || n.id.includes(`:${usage.file}:`)
      );
      const sourceIds = sourceNodesInFile.map((n) => n.id);
      reasons.push(`Source nodes in file: ${sourceIds.join(', ')}`);

      // Check all call edges from these sources
      const edgesFromFile = callEdges.filter((e) => sourceIds.includes(e.source));
      reasons.push(`Call edges from file nodes: ${edgesFromFile.length}`);
      for (const e of edgesFromFile) {
        const tgt = nodeMap.get(e.target);
        const tgtName = tgt && 'name' in tgt ? tgt.name : e.target;
        reasons.push(`  ${e.source} → ${tgtName} (${e.callScope})`);
      }
    }

    missing.push({ ...usage, reason: reasons.join('\n     ') });
  }
}

console.log(`\n--- Found (edge exists): ${found.length} ---`);
for (const u of found) {
  console.log(`  ✅ ${u.file}:${u.line}  <${u.tagName}>`);
}

console.log(`\n--- MISSING (no edge): ${missing.length} ---`);
for (const u of missing) {
  console.log(`  ❌ ${u.file}:${u.line}  <${u.tagName}>`);
  console.log(`     ${u.reason}`);
  console.log();
}

if (missing.length === 0 && found.length > 0) {
  console.log(`\n✅ All JSX component usages have corresponding call edges in the analyzer output.`);
  console.log(`   If edges are missing in the visualization, the issue is in TsGraph.tsx filtering.`);
}

// ── Step 4: Check visualization filtering ──
console.log(`\n=== Visualization filtering check ===`);
const SYMBOL_KINDS = new Set(['FUNCTION', 'CLASS', 'INTERFACE']);
const symbolIds = new Set(nodes.filter((n) => SYMBOL_KINDS.has(n.kind)).map((n) => n.id));

const visibleEdges = callEdges.filter((e) => symbolIds.has(e.source) && symbolIds.has(e.target));
const filteredOut = callEdges.filter((e) => !(symbolIds.has(e.source) && symbolIds.has(e.target)));

console.log(`Call edges visible in viz (both endpoints are FUNCTION/CLASS/INTERFACE): ${visibleEdges.length}`);
console.log(`Call edges FILTERED OUT by viz: ${filteredOut.length}`);
if (filteredOut.length > 0) {
  console.log(`\n--- Filtered-out call edges ---`);
  for (const e of filteredOut) {
    const src = nodeMap.get(e.source);
    const tgt = nodeMap.get(e.target);
    const srcLabel = src ? `${src.kind}:${'name' in src ? src.name : src.id}` : `MISSING:${e.source}`;
    const tgtLabel = tgt ? `${tgt.kind}:${'name' in tgt ? tgt.name : tgt.id}` : `MISSING:${e.target}`;
    console.log(`  ${srcLabel} → ${tgtLabel}  (${e.callScope})`);
    if (src && !symbolIds.has(e.source)) console.log(`     ⚠ Source ${e.source} is ${src.kind}, not in SYMBOL_KINDS`);
    if (tgt && !symbolIds.has(e.target)) console.log(`     ⚠ Target ${e.target} is ${tgt.kind}, not in SYMBOL_KINDS`);
    if (!src) console.log(`     ⚠ Source node ${e.source} not found in graph`);
    if (!tgt) console.log(`     ⚠ Target node ${e.target} not found in graph`);
  }
}
