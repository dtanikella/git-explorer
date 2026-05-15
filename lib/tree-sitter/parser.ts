import TreeSitterParser from 'tree-sitter';
import { TreeSitterParseError, ParseResult } from './types';
import { TreeWrapper } from './tree';

type Language = InstanceType<typeof TreeSitterParser>['getLanguage'] extends () => infer R ? R : never;

export class ParserWrapper {
  private readonly _parser: TreeSitterParser;
  private readonly _languageName: string;

  constructor(language: Language, languageName: string) {
    this._parser = new TreeSitterParser();
    this._parser.setLanguage(language);
    this._languageName = languageName;
  }

  parse(source: string): ParseResult {
    const tree = this._parser.parse(source);
    if (!tree) {
      const snippet = source.length > 100 ? source.slice(0, 100) + '...' : source;
      throw new TreeSitterParseError(
        'Parsing returned null (timeout or catastrophic failure)',
        snippet,
        this._languageName,
      );
    }

    const wrapper = new TreeWrapper(tree, this._languageName);
    return {
      tree: wrapper,
      hasErrors: tree.rootNode.hasError,
      language: this._languageName,
    };
  }

  setTimeoutMicros(timeout: number): void {
    this._parser.setTimeoutMicros(timeout);
  }

  getLanguage(): Language {
    return this._parser.getLanguage();
  }
}

export function createParser(language: Language, languageName: string): ParserWrapper {
  return new ParserWrapper(language, languageName);
}
