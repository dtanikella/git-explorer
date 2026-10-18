import { SyntaxType } from '@/lib/analysis/types';
import type { AnalysisResult } from '@/lib/analysis/types';
import { buildDirectoryHubs, folderHubId } from '@/lib/analysis/directory-hubs';
import type { HierarchyNode } from './types';

/** Member and reference kinds that are not top-level declarations (DS-4). */
const EXCLUDED_KINDS: ReadonlySet<SyntaxType> = new Set([
  SyntaxType.METHOD,
  SyntaxType.GETTER,
  SyntaxType.SETTER,
  SyntaxType.CONSTRUCTOR,
  SyntaxType.DECORATOR,
]);

/** A SCIP local symbol, the `<file>#local N` form. */
const isLocalSymbol = (scipSymbol: string) => /#local \d+$/.test(scipSymbol) || scipSymbol.startsWith('local ');

/**
 * Turns an analysis result into the hierarchy the default view draws.
 *
 * @remarks
 * Keeps only top-level declarations: not local symbols, and not members or decorators (DS-4).
 * Repeated `scipSymbol`s are dropped, first one wins. Files and folders do not exist in the
 * analysis result, so they are derived from each symbol's `filePath` with `buildDirectoryHubs`
 * (DS-2), which also supplies the root folder hub (GM-6). A file with no kept symbol gets no node.
 * Within a folder, subfolders come before files, and otherwise children keep first-seen order, so the output is
 * deterministic. No layout or rendering here.
 *
 * @param result - The analysis result.
 * @param rootName - Label for the synthetic root.
 * @returns The root of the hierarchy.
 */
export function buildHierarchy(result: AnalysisResult, rootName = '/'): HierarchyNode {
  const seen = new Set<string>();
  const symbols = result.nodes.filter((n) => {
    if (isLocalSymbol(n.scipSymbol) || EXCLUDED_KINDS.has(n.syntaxType) || seen.has(n.scipSymbol)) return false;
    seen.add(n.scipSymbol);
    return true;
  });

  const { hubs, links } = buildDirectoryHubs(symbols.map((n) => ({ id: n.scipSymbol, filePath: n.filePath })));

  const byId = new Map<string, HierarchyNode>();
  for (const hub of hubs) {
    byId.set(hub.id, {
      id: hub.id,
      tier: hub.kind === 'FILE' ? 'file' : hub.path === '' ? 'root' : 'folder',
      name: hub.path === '' ? rootName : hub.name,
      path: hub.path,
      depth: 0,
      children: [],
    });
  }
  for (const n of symbols) {
    byId.set(n.scipSymbol, {
      id: n.scipSymbol,
      tier: 'symbol',
      name: n.name,
      path: n.filePath,
      depth: 0,
      symbol: { syntaxType: n.syntaxType, params: n.params, returnTypeText: n.returnTypeText },
      children: [],
    });
  }

  // every link runs child -> parent
  for (const link of links) byId.get(link.target)?.children.push(byId.get(link.source)!);

  const root = byId.get(folderHubId(''));
  if (!root) {
    return { id: folderHubId(''), tier: 'root', name: rootName, path: '', depth: 0, children: [] };
  }
  const setDepth = (node: HierarchyNode, depth: number) => {
    node.depth = depth;
    // a stable sort, so subfolders and files each keep their first-seen order
    if (node.tier === 'root' || node.tier === 'folder') node.children.sort((a, b) => Number(a.tier !== 'folder') - Number(b.tier !== 'folder'));
    node.children.forEach((c) => setDepth(c, depth + 1));
  };
  setDepth(root, 0);
  return root;
}
