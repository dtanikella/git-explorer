import * as fs from 'fs/promises';
import * as path from 'path';
import type { Dirent } from 'fs';
import { loadLanguage } from '@/lib/tree-sitter/language';
import { createParser } from '@/lib/tree-sitter/parser';
import type { TreeWrapper } from '@/lib/tree-sitter/tree';
import type { AnalysisResult } from '@/lib/analysis/types';
import { isTestFile } from '@/app/services/analysis/test-file-detector';
import { extractRubyNodes } from './node-extractor';
import { extractRubyEdges } from './edge-extractor';
import { assembleResult } from '@/app/services/analysis/shared/graph-assembler';

export interface RubyAnalysisOptions {
  hideTestFiles: boolean;
}

export async function analyzeRubyRepo(
  repoPath: string,
  options: RubyAnalysisOptions,
): Promise<AnalysisResult> {
  const startTime = Date.now();

  // Stage 1: Tree-sitter parsing (no SCIP stage for Ruby)
  const rubyLang = loadLanguage('ruby');
  const rubyParser = createParser(rubyLang, 'ruby');

  const parsedFiles = new Map<string, { tree: TreeWrapper; source: string }>();

  // Collect all .rb files in the repo
  const rbFiles = await collectRubyFiles(repoPath);
  for (const filePath of rbFiles) {
    if (options.hideTestFiles && isTestFile(filePath)) continue;

    const absolutePath = path.join(repoPath, filePath);
    let source: string;
    try {
      source = await fs.readFile(absolutePath, 'utf-8');
    } catch {
      continue; // skip files that can't be read
    }

    const result = rubyParser.parse(source);
    parsedFiles.set(filePath, { tree: result.tree, source });
  }

  // Stage 2: Node extraction
  const { nodes, nodeMap } = extractRubyNodes({
    parsedFiles,
    repoPath,
  });

  // Mark test file nodes
  if (!options.hideTestFiles) {
    for (const node of nodes) {
      node.inTestFile = isTestFile(node.filePath);
    }
  }

  // Stage 3: Edge extraction
  const edges = extractRubyEdges({
    parsedFiles,
    nodeMap,
    repoPath,
  });

  // Stage 4: Assemble result
  return assembleResult({
    nodes,
    edges,
    repoPath,
    language: 'ruby',
    startTime,
  });
}

/**
 * Recursively collect all .rb files under a directory, returning relative paths.
 */
async function collectRubyFiles(repoPath: string): Promise<string[]> {
  const files: string[] = [];
  const rootDir = path.resolve(repoPath);

  const walk = async (dirPath: string, relativePrefix: string): Promise<void> => {
    let entries: Dirent[];
    try {
      entries = await fs.readdir(dirPath, { withFileTypes: true });
    } catch {
      return; // skip unreadable directories
    }

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = relativePrefix ? `${relativePrefix}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        if (entry.name === '.' || entry.name === '..') continue;
        // Skip common non-source directories
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
        await walk(fullPath, relativePath);
      } else if (entry.name.endsWith('.rb')) {
        files.push(relativePath);
      } else if (entry.name === 'Gemfile') {
        files.push(relativePath);
      }
    }
  };

  await walk(rootDir, '');
  return files;
}