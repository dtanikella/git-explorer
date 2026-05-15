import * as fs from 'fs/promises';
import * as path from 'path';
import { indexTypeScriptRepo } from '@/lib/scip/ts/indexer';
import { readScipIndex } from '@/lib/scip/reader';
import { loadLanguage } from '@/lib/tree-sitter/language';
import { createParser } from '@/lib/tree-sitter/parser';
import type { TreeWrapper } from '@/lib/tree-sitter/tree';
import type { AnalysisResult } from '@/lib/analysis/types';
import { isTestFile } from '@/app/services/analysis/test-file-detector';
import { extractNodes } from './node-extractor';
import { extractEdges } from './edge-extractor';
import { assembleResult } from './graph-assembler';

export interface TsAnalysisOptions {
  hideTestFiles: boolean;
}

export async function analyzeTsRepo(
  repoPath: string,
  options: TsAnalysisOptions,
): Promise<AnalysisResult> {
  const startTime = Date.now();

  // Stage 1: SCIP indexing
  const indexResult = await indexTypeScriptRepo(repoPath);
  const scipIndex = await readScipIndex(indexResult.indexPath);

  // Stage 2: Tree-sitter parsing
  const tsLang = loadLanguage('typescript');
  const tsxLang = loadLanguage('tsx');
  const tsParser = createParser(tsLang, 'typescript');
  const tsxParser = createParser(tsxLang, 'tsx');

  const parsedFiles = new Map<string, { tree: TreeWrapper; source: string }>();

  for (const doc of scipIndex.documents) {
    const filePath = doc.relativePath;

    if (options.hideTestFiles && isTestFile(filePath)) continue;

    const absolutePath = path.join(repoPath, filePath);
    let source: string;
    try {
      source = await fs.readFile(absolutePath, 'utf-8');
    } catch {
      continue; // skip files that can't be read
    }

    const parser = filePath.endsWith('.tsx') ? tsxParser : tsParser;
    const result = parser.parse(source);
    parsedFiles.set(filePath, { tree: result.tree, source });
  }

  // Stage 3: Node extraction
  const { nodes, nodeMap } = extractNodes({
    parsedFiles,
    scipDocuments: scipIndex.documents,
    repoPath,
  });

  // Mark test file nodes
  if (!options.hideTestFiles) {
    for (const node of nodes) {
      node.inTestFile = isTestFile(node.filePath);
    }
  }

  // Stage 4: Edge extraction (populates referencedAt/outboundRefs inline)
  const edges = extractEdges({
    parsedFiles,
    scipDocuments: scipIndex.documents,
    nodeMap,
    repoPath,
  });

  // Stage 5: Assemble result
  return assembleResult({
    nodes,
    edges,
    repoPath,
    language: 'typescript',
    startTime,
  });
}
