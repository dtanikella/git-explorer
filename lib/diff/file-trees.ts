import { loadLanguage } from '@/lib/tree-sitter/language';
import { createParser } from '@/lib/tree-sitter/parser';
import type { TreeWrapper } from '@/lib/tree-sitter/tree';
import type { ChangedFile } from './git-diff';
import type { DifftasticFileResult } from './difftastic';

export interface ParsedFilePair {
  path: string;
  status: 'added' | 'deleted' | 'modified';
  oldTree?: TreeWrapper;
  newTree?: TreeWrapper;
  oldSource?: string;
  newSource?: string;
  difft?: DifftasticFileResult;
  parseErrors: { side: 'old' | 'new'; hasError: boolean }[];
}

/**
 * Build tree-sitter parse trees for each side of a changed file.
 * Added files get a new tree, deleted files get an old tree,
 * and modified files get both.
 */
export function buildFileTrees(file: ChangedFile): ParsedFilePair {
  const languageName = file.ext === '.tsx' ? 'tsx' : 'typescript';
  const language = loadLanguage(languageName);
  const parser = createParser(language, languageName);

  const pair: ParsedFilePair = {
    path: file.path,
    status: file.status,
    parseErrors: [],
  };

  if (file.status === 'added' || file.status === 'modified') {
    if (file.newSource !== undefined) {
      const result = parser.parse(file.newSource);
      pair.newTree = result.tree;
      pair.newSource = file.newSource;
      pair.parseErrors.push({ side: 'new', hasError: result.hasErrors });
    }
  }

  if (file.status === 'deleted' || file.status === 'modified') {
    if (file.oldSource !== undefined) {
      const result = parser.parse(file.oldSource);
      pair.oldTree = result.tree;
      pair.oldSource = file.oldSource;
      pair.parseErrors.push({ side: 'old', hasError: result.hasErrors });
    }
  }

  if (file.difft) {
    pair.difft = file.difft;
  }

  return pair;
}