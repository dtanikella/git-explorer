import TreeSitterParser from 'tree-sitter';
import { TreeSitterQueryError } from './types';
import { NodeWrapper } from './node';

type Language = ReturnType<InstanceType<typeof TreeSitterParser>['getLanguage']>;

export interface QueryMatch {
  pattern: number;
  captures: QueryCapture[];
}

export interface QueryCapture {
  name: string;
  node: NodeWrapper;
}

export class QueryWrapper {
  private readonly _query: TreeSitterParser.Query;
  private readonly _languageName: string;

  constructor(query: TreeSitterParser.Query, languageName: string) {
    this._query = query;
    this._languageName = languageName;
  }

  matches(node: NodeWrapper): QueryMatch[] {
    const rawMatches = this._query.matches(node.raw);
    return rawMatches.map(m => ({
      pattern: m.pattern,
      captures: m.captures.map(c => ({
        name: c.name,
        node: new NodeWrapper(c.node),
      })),
    }));
  }

  captures(node: NodeWrapper): QueryCapture[] {
    const rawCaptures = this._query.captures(node.raw);
    return rawCaptures.map(c => ({
      name: c.name,
      node: new NodeWrapper(c.node),
    }));
  }
}

export function createQuery(language: Language, pattern: string, languageName = 'typescript'): QueryWrapper {
  let query: TreeSitterParser.Query;
  try {
    query = new TreeSitterParser.Query(language, pattern);
  } catch (err) {
    throw new TreeSitterQueryError(
      `Invalid query pattern: ${(err as Error).message}`,
      pattern,
      languageName,
    );
  }
  return new QueryWrapper(query, languageName);
}
