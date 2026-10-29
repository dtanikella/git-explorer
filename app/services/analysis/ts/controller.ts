import * as fs from 'fs/promises';
import * as path from 'path';
import { indexTypeScriptRepo } from '@/lib/scip/ts/indexer';
import { readScipIndex } from '@/lib/scip/reader';
import { loadLanguage } from '@/lib/tree-sitter/language';
import { createParser } from '@/lib/tree-sitter/parser';
import type { TreeWrapper } from '@/lib/tree-sitter/tree';
import type { AnalysisResult } from '@/lib/analysis/types';
import { isTestFile } from '@/app/services/analysis/test-file-detector';
import { isGeneratedFile } from '@/app/services/analysis/generated-file-detector';
import { extractNodes } from './node-extractor';
import { extractEdges } from './edge-extractor';
import { assembleResult } from '@/app/services/analysis/shared/graph-assembler';

const FILE_READ_CONCURRENCY = 32;

/**
 * Reads files with a bounded number of reads in flight.
 *
 * @param absolutePaths - Files to read.
 * @returns Each file's contents in input order, or null where the read failed.
 */
async function readSources(absolutePaths: string[]): Promise<Array<string | null>> {
  const sources: Array<string | null> = new Array(absolutePaths.length).fill(null);
  let next = 0;
  const worker = async () => {
    while (next < absolutePaths.length) {
      const i = next++;
      try {
        sources[i] = await fs.readFile(absolutePaths[i], 'utf-8');
      } catch {
        // left as null
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(FILE_READ_CONCURRENCY, absolutePaths.length) }, worker));
  return sources;
}

export interface TsAnalysisOptions {
  hideTestFiles: boolean;
}

/**
 * Runs the TypeScript analysis pipeline: SCIP indexing, tree-sitter
 * extraction, and graph assembly.
 *
 * @remarks
 * Orchestrates SCIP index retrieval/creation, tree-sitter-based node
 * and edge extraction, and assembly of the final result. Test-file
 * filtering is applied when `hideTestFiles` is true.
 *
 * @param repoPath - Absolute path to the git repository root.
 * @param options - Options controlling test file filtering.
 * @returns The assembled {@link AnalysisResult}.
 * @see commit 6e57d72
 */
export async function analyzeTsRepo(
  repoPath: string,
  options: TsAnalysisOptions,
): Promise<AnalysisResult> {
  const startTime = Date.now();
  const stageTimingsMs: Record<string, number> = {};
  let stageStart = startTime;
  const endStage = (stage: string) => {
    const now = Date.now();
    stageTimingsMs[stage] = now - stageStart;
    stageStart = now;
  };

  // Stage 1: SCIP indexing
  const indexResult = await indexTypeScriptRepo(repoPath);
  endStage('index');
  const scipIndex = await readScipIndex(indexResult.indexPath);
  endStage('readIndex');

  // Stage 2: Tree-sitter parsing
  const tsLang = loadLanguage('typescript');
  const tsxLang = loadLanguage('tsx');
  const tsParser = createParser(tsLang, 'typescript');
  const tsxParser = createParser(tsxLang, 'tsx');

  const parsedFiles = new Map<string, { tree: TreeWrapper; source: string }>();

  const filePaths = scipIndex.documents
    .map((doc) => doc.relativePath)
    .filter((filePath) => !isGeneratedFile(filePath) && !(options.hideTestFiles && isTestFile(filePath)));
  const sources = await readSources(filePaths.map((filePath) => path.join(repoPath, filePath)));
  endStage('readFiles');

  filePaths.forEach((filePath, i) => {
    const source = sources[i];
    if (source === null) return; // skip files that can't be read

    const parser = filePath.endsWith('.tsx') ? tsxParser : tsParser;
    const result = parser.parse(source);
    parsedFiles.set(filePath, { tree: result.tree, source });
  });
  endStage('parse');

  // Stage 3: Node extraction
  const { nodes, nodeMap } = extractNodes({
    parsedFiles,
    scipDocuments: scipIndex.documents,
    repoPath,
  });
  endStage('nodes');

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
  endStage('edges');

  // Stage 5: Assemble result
  return assembleResult({
    nodes,
    edges,
    repoPath,
    language: 'typescript',
    startTime,
    stageTimingsMs,
  });
}
