import { SyntaxType } from '@/lib/analysis/types';
import { nodeStyle } from './config';
import { parentMap } from './hover';
import type { HierarchyNode } from './types';

/** Longest breadcrumb shown before it is cut from the left. */
const MAX_BREADCRUMB = 34;

const KEYWORD: Partial<Record<SyntaxType, string>> = {
  [SyntaxType.FUNCTION]: 'function',
  [SyntaxType.CLASS]: 'class',
  [SyntaxType.INTERFACE]: 'interface',
  [SyntaxType.TYPE_ALIAS]: 'type',
  [SyntaxType.ENUM]: 'enum',
  [SyntaxType.VARIABLE]: 'const',
  [SyntaxType.NAMESPACE]: 'namespace',
};

/**
 * Assembles a symbol's signature from its name, params and return type.
 *
 * @remarks
 * Functions read `function name(a: A, b?: B): R`; other kinds read `<keyword> name`. A missing
 * param type is left off, and a missing return type drops the `: R` part.
 */
export function buildSignature(node: HierarchyNode): string {
  const sym = node.symbol;
  if (!sym) return '';
  const keyword = KEYWORD[sym.syntaxType] ?? sym.syntaxType.toLowerCase();
  if (sym.syntaxType !== SyntaxType.FUNCTION) return `${keyword} ${node.name}`;
  const params = sym.params.map((p) => `${p.name}${p.isOptional ? '?' : ''}${p.typeText ? `: ${p.typeText}` : ''}`).join(', ');
  return `${keyword} ${node.name}(${params})${sym.returnTypeText ? `: ${sym.returnTypeText}` : ''}`;
}

/** Lower-case kind label of a node: the syntax type of a symbol, the tier otherwise. */
export function kindLabel(node: HierarchyNode): string {
  return node.symbol ? node.symbol.syntaxType.toLowerCase() : node.tier;
}

export interface CardTile {
  label: string;
  value: string;
}

export interface KindShare {
  kind: string;
  count: number;
  color: string;
}

/** Everything the docked info card shows for one hovered node. */
export interface CardContent {
  /** ancestors only, joined by `›`, left-truncated with `…`; `repo root` when there are none */
  breadcrumb: string;
  /** the kind pill: text, plus the symbol's own color for a symbol or `null` for a folder or file (the view uses a darker shade of the band hue) */
  pill: { label: string; color: string | null };
  name: string;
  /** folder and file cards: three tiles; symbol cards: none */
  tiles: CardTile[];
  /** symbol-kind mix beneath a folder or file; empty for a symbol */
  kindMix: KindShare[];
  /** symbol cards only */
  signature?: string;
  /** symbol cards only, e.g. `17th of 58 symbols` */
  position?: string;
}

const symbolsUnder = (n: HierarchyNode): HierarchyNode[] => (n.tier === 'symbol' ? [n] : n.children.flatMap(symbolsUnder));
const countTier = (n: HierarchyNode, tier: HierarchyNode['tier']): number => n.children.reduce((sum, c) => sum + (c.tier === tier ? 1 : 0) + countTier(c, tier), 0);

function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
}

function breadcrumbOf(ancestors: string[]): string {
  if (ancestors.length === 0) return 'repo root';
  const full = ancestors.join(' › ');
  return full.length <= MAX_BREADCRUMB ? full : `…${full.slice(full.length - (MAX_BREADCRUMB - 1)).trimStart()}`;
}

function kindMix(symbols: HierarchyNode[]): KindShare[] {
  const counts = new Map<SyntaxType, number>();
  for (const s of symbols) counts.set(s.symbol!.syntaxType, (counts.get(s.symbol!.syntaxType) ?? 0) + 1);
  return [...counts]
    .map(([type, count]) => ({ kind: type.toLowerCase(), count, color: nodeStyle({ tier: 'symbol', depth: 0, syntaxType: type }).color }))
    .sort((a, b) => b.count - a.count || a.kind.localeCompare(b.kind));
}

/**
 * Derives the info card for a hovered folder, file or symbol from the hierarchy alone.
 *
 * @param target - The hovered node.
 * @param root - The hierarchy's root, to find ancestors and siblings.
 */
export function cardContent(target: HierarchyNode, root: HierarchyNode): CardContent {
  const parents = parentMap(root);
  const ancestors: string[] = [];
  for (let p = parents.get(target.id); p && p.tier !== 'root'; p = parents.get(p.id)) ancestors.unshift(p.name);
  const breadcrumb = breadcrumbOf(ancestors);

  if (target.tier === 'symbol') {
    const file = parents.get(target.id);
    const siblings = file?.children ?? [target];
    return {
      breadcrumb,
      pill: { label: kindLabel(target), color: nodeStyle({ tier: 'symbol', depth: target.depth, syntaxType: target.symbol?.syntaxType }).color },
      name: target.name,
      tiles: [],
      kindMix: [],
      signature: buildSignature(target),
      position: `${ordinal(siblings.indexOf(target) + 1)} of ${siblings.length} symbols`,
    };
  }

  const symbols = symbolsUnder(target);
  if (target.tier === 'file') {
    const folder = parents.get(target.id);
    const folderTotal = folder ? symbolsUnder(folder).length : symbols.length;
    const share = folderTotal === 0 ? 0 : Math.round((symbols.length / folderTotal) * 100);
    return {
      breadcrumb,
      pill: { label: 'file', color: null },
      name: target.name,
      tiles: [
        { label: 'symbols', value: String(symbols.length) },
        { label: 'kinds', value: String(new Set(symbols.map((s) => s.symbol!.syntaxType)).size) },
        { label: 'of folder', value: `${share}%` },
      ],
      kindMix: kindMix(symbols),
    };
  }

  return {
    breadcrumb,
    pill: { label: target.tier === 'root' ? 'repo' : 'folder', color: null },
    name: target.name,
    tiles: [
      { label: 'folders', value: String(countTier(target, 'folder')) },
      { label: 'files', value: String(countTier(target, 'file')) },
      { label: 'symbols', value: String(symbols.length) },
    ],
    kindMix: kindMix(symbols),
  };
}
