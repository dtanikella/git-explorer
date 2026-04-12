/**
 * Debug script: trace why a specific function appears isolated in the viz.
 *
 * Usage:
 *   npx tsx scripts/debug-isolated-fn.ts <repoPath> <functionName>
 *
 * Example:
 *   npx tsx scripts/debug-isolated-fn.ts /path/to/mono-frontend formatMilestone
 */
import * as ts from 'typescript';
import * as path from 'path';
import { analyzeTypeScriptRepo } from '../lib/ts/analyzer';
import { CallEdge, TsNode } from '../lib/ts/types';

const repoPath = path.resolve(process.argv[2] || '.');
const targetName = process.argv[3] || 'formatMilestone';

console.log(`Analyzing: ${repoPath}`);
console.log(`Looking for: ${targetName}\n`);

// ── Step 1: Check analyzer output ──
const { nodes, edges } = analyzeTypeScriptRepo(repoPath);
const nodeMap = new Map(nodes.map((n) => [n.id, n]));

const matchingNodes = nodes.filter(
  (n) => 'name' in n && (n as any).name === targetName
);
console.log(`=== Analyzer Output ===`);
console.log(`Total nodes: ${nodes.length}, Total edges: ${edges.length}`);
console.log(`Nodes named "${targetName}": ${matchingNodes.length}`);
for (const n of matchingNodes) {
  console.log(`  ${n.id} (kind=${n.kind}, parent=${n.parent})`);
}

const relatedEdges = edges.filter(
  (e) =>
    matchingNodes.some((n) => n.id === e.source || n.id === e.target)
);
console.log(`Edges involving "${targetName}": ${relatedEdges.length}`);
for (const e of relatedEdges) {
  const srcNode = nodeMap.get(e.source);
  const tgtNode = nodeMap.get(e.target);
  const srcName = srcNode && 'name' in srcNode ? (srcNode as any).name : e.source;
  const tgtName = tgtNode && 'name' in tgtNode ? (tgtNode as any).name : e.target;
  console.log(`  ${srcName} → ${tgtName} (type=${e.type}, ${e.type === 'call' ? 'scope=' + (e as CallEdge).callScope : ''})`);
}

// ── Step 2: Scan the repo independently for all usages ──
console.log(`\n=== Independent Source Scan ===`);

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

// Find files that import targetName
console.log(`\n--- Files importing "${targetName}" ---`);
for (const sf of program.getSourceFiles()) {
  if (sf.isDeclarationFile || !sf.fileName.startsWith(repoPath)) continue;
  const relPath = path.relative(repoPath, sf.fileName);

  ts.forEachChild(sf, (node) => {
    if (ts.isImportDeclaration(node) && node.importClause) {
      const clause = node.importClause;
      const specifier = (node.moduleSpecifier as ts.StringLiteral).text;
      const names: string[] = [];

      if (clause.name) names.push(clause.name.text);
      if (clause.namedBindings) {
        if (ts.isNamedImports(clause.namedBindings)) {
          for (const el of clause.namedBindings.elements) {
            names.push(el.name.text);
          }
        }
      }

      if (names.includes(targetName)) {
        console.log(`  ${relPath} imports "${targetName}" from "${specifier}"`);

        // Try resolving the specifier
        const resolved = ts.resolveModuleName(
          specifier,
          sf.fileName,
          program.getCompilerOptions(),
          ts.sys
        );
        const resolvedFile = resolved.resolvedModule?.resolvedFileName;
        if (resolvedFile) {
          const resolvedRel = path.relative(repoPath, resolvedFile);
          const isInRepo = resolvedFile.startsWith(repoPath);
          const isNodeModules = resolvedFile.includes('node_modules');
          console.log(`    → resolves to: ${resolvedRel} (inRepo=${isInRepo}, nodeModules=${isNodeModules})`);

          // Check if analyzer has the target file as a node
          const fileId = `file:${resolvedRel}`;
          const hasFileNode = nodeMap.has(fileId);
          console.log(`    → analyzer has file node: ${hasFileNode}`);

          // Check if analyzer has the function node in that file
          const fnId = `fn:${resolvedRel}:${targetName}`;
          const hasFnNode = nodeMap.has(fnId);
          console.log(`    → analyzer has fn node "${fnId}": ${hasFnNode}`);
        } else {
          console.log(`    → UNRESOLVED`);
        }
      }
    }
  });
}

// Find files that call targetName (with context about where the call occurs)
console.log(`\n--- Files calling "${targetName}" ---`);
for (const sf of program.getSourceFiles()) {
  if (sf.isDeclarationFile || !sf.fileName.startsWith(repoPath)) continue;
  if (sf.fileName.includes('__tests__') || sf.fileName.includes('.test.')) continue;
  const relPath = path.relative(repoPath, sf.fileName);

  function findCallsites(node: ts.Node, ancestors: string[]): void {
    if (ts.isCallExpression(node)) {
      const calleeName = node.expression.getText(sf);
      if (calleeName === targetName || calleeName.endsWith('.' + targetName)) {
        const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
        const ancestorStr = ancestors.length > 0 ? ` inside [${ancestors.join(' > ')}]` : '';
        console.log(`  ${relPath}:${line + 1}  ${calleeName}(...)${ancestorStr}`);
      }
    }

    // Track context for debugging
    const newAncestors = [...ancestors];
    if (ts.isFunctionDeclaration(node) && node.name) {
      newAncestors.push(`fn:${node.name.text}`);
    } else if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer &&
      (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer) || ts.isCallExpression(node.initializer))) {
      newAncestors.push(`var:${node.name.text}`);
    } else if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
      // Anonymous arrow/function expression (e.g., callback argument)
      if (ts.isCallExpression(node.parent)) {
        const callee = node.parent.expression.getText(sf);
        newAncestors.push(`callback(${callee})`);
      } else {
        newAncestors.push(`arrow`);
      }
    } else if (ts.isMethodDeclaration(node) && node.name) {
      newAncestors.push(`method:${node.name.getText(sf)}`);
    }

    ts.forEachChild(node, (child) => findCallsites(child, newAncestors));
  }
  ts.forEachChild(sf, (child) => findCallsites(child, []));
}

// Find the definition of targetName
console.log(`\n--- Definition of "${targetName}" ---`);
for (const sf of program.getSourceFiles()) {
  if (sf.isDeclarationFile || !sf.fileName.startsWith(repoPath)) continue;
  const relPath = path.relative(repoPath, sf.fileName);

  ts.forEachChild(sf, (node) => {
    // Function declaration
    if (ts.isFunctionDeclaration(node) && node.name?.text === targetName) {
      const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
      const isExported = !!(ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Export);
      console.log(`  ${relPath}:${line + 1}  function ${targetName}() [exported=${isExported}]`);
    }
    // Variable + arrow/function
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && decl.name.text === targetName && decl.initializer) {
          if (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer)) {
            const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
            const isExported = !!(ts.getCombinedModifierFlags(node as any) & ts.ModifierFlags.Export);
            console.log(`  ${relPath}:${line + 1}  const ${targetName} = () => {} [exported=${isExported}]`);
          }
        }
      }
    }
  });
}
