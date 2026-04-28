import { TreeSitterLanguageError } from './types';

type Language = ReturnType<typeof require>;

interface LanguageMapping {
  module: string;
  export?: string;
}

const LANGUAGE_REGISTRY: Record<string, LanguageMapping> = {
  typescript: { module: 'tree-sitter-typescript', export: 'typescript' },
  tsx: { module: 'tree-sitter-typescript', export: 'tsx' },
};

const languageCache = new Map<string, Language>();

export function loadLanguage(name: string): Language {
  const cached = languageCache.get(name);
  if (cached) {
    return cached;
  }

  const mapping = LANGUAGE_REGISTRY[name];
  if (!mapping) {
    throw new TreeSitterLanguageError(
      `Unknown language: "${name}". Available: ${Object.keys(LANGUAGE_REGISTRY).join(', ')}`,
      name,
    );
  }

  let grammar: Language;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(mapping.module);
    grammar = mapping.export ? mod[mapping.export] : mod;
  } catch (err) {
    throw new TreeSitterLanguageError(
      `Failed to load grammar for "${name}": ${(err as Error).message}`,
      name,
      mapping.module,
    );
  }

  if (!grammar) {
    throw new TreeSitterLanguageError(
      `Grammar module "${mapping.module}" has no export "${mapping.export}"`,
      name,
      mapping.module,
    );
  }

  languageCache.set(name, grammar);
  return grammar;
}

export function clearLanguageCache(): void {
  languageCache.clear();
}
