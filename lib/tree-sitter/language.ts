import { createRequire } from 'module';
import * as path from 'path';
import TreeSitterParser from 'tree-sitter';
import { TreeSitterLanguageError } from './types';

// Anchor to real project root — __filename is virtualized by Turbopack
const nativeRequire = createRequire(path.join(process.cwd(), 'package.json'));

type Language = InstanceType<typeof TreeSitterParser>['getLanguage'] extends () => infer R ? R : never;

interface LanguageMapping {
  module: string;
  export?: string;
}

const LANGUAGE_REGISTRY: Record<string, LanguageMapping> = {
  typescript: { module: 'tree-sitter-typescript', export: 'typescript' },
  tsx: { module: 'tree-sitter-typescript', export: 'tsx' },
  ruby: { module: 'tree-sitter-ruby' },
};

const languageCache = new Map<string, Language>();

/**
 * Loads a tree-sitter language by name, caching the native binding for reuse.
 *
 * @remarks
 * Supported languages are registered in a bundled map of language IDs to
 * tree-sitter grammar npm packages. The grammar module is loaded on first
 * access using a project-root-anchored require and cached in a module-level
 * map. Subsequent calls return the cached instance.
 *
 * @param name - The language identifier (e.g., "typescript", "ruby", "tsx").
 * @returns The loaded tree-sitter {@link Language} instance.
 * @throws {@link TreeSitterLanguageError} When the language is unsupported
 *   or the grammar module fails to load.
 */
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
    const mod = nativeRequire(mapping.module);
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

/**
 * Clears all cached language instances, forcing a fresh load on next access.
 *
 * @remarks
 * Primarily useful in tests and when the caller knows a grammar module has
 * been updated at runtime.
 */
export function clearLanguageCache(): void {
  languageCache.clear();
}
