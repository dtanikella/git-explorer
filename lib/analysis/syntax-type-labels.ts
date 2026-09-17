/**
 * Compact labels/colors for SyntaxType, for UI surfaces (like Area Manager)
 * that list nodes of many different kinds side by side and need a quick way
 * to tell them apart. Independent of graph-config.ts's own node styling,
 * which is scoped to the graph views and intentionally not extended here.
 */

import { SyntaxType } from './types';

export const SYNTAX_TYPE_LABELS: Record<SyntaxType, string> = {
  [SyntaxType.FUNCTION]: 'fn',
  [SyntaxType.METHOD]: 'method',
  [SyntaxType.CLASS]: 'class',
  [SyntaxType.INTERFACE]: 'interface',
  [SyntaxType.TYPE_ALIAS]: 'type',
  [SyntaxType.MODULE]: 'module',
  [SyntaxType.ENUM]: 'enum',
  [SyntaxType.VARIABLE]: 'var',
  [SyntaxType.NAMESPACE]: 'namespace',
  [SyntaxType.DECORATOR]: 'decorator',
  [SyntaxType.GETTER]: 'getter',
  [SyntaxType.SETTER]: 'setter',
  [SyntaxType.CONSTRUCTOR]: 'constructor',
};

export const SYNTAX_TYPE_BADGE_COLORS: Record<SyntaxType, string> = {
  [SyntaxType.FUNCTION]: '#3b82f6',
  [SyntaxType.METHOD]: '#60a5fa',
  [SyntaxType.CLASS]: '#8b5cf6',
  [SyntaxType.INTERFACE]: '#10b981',
  [SyntaxType.TYPE_ALIAS]: '#f59e0b',
  [SyntaxType.MODULE]: '#ec4899',
  [SyntaxType.ENUM]: '#14b8a6',
  [SyntaxType.VARIABLE]: '#6b7280',
  [SyntaxType.NAMESPACE]: '#db2777',
  [SyntaxType.DECORATOR]: '#a855f7',
  [SyntaxType.GETTER]: '#0ea5e9',
  [SyntaxType.SETTER]: '#0284c7',
  [SyntaxType.CONSTRUCTOR]: '#7c3aed',
};
