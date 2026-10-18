import type { SyntaxType, ParamInfo } from '@/lib/analysis/types';

/** The four tiers of the default view's hierarchy. */
export type Tier = 'root' | 'folder' | 'file' | 'symbol';

/** The kind of a parent link, named by its child → parent direction. */
export type LinkKind = 'symbol-file' | 'file-folder' | 'folder-folder';

/** Symbol details a tooltip needs; present on `symbol` nodes only. */
export interface SymbolInfo {
  syntaxType: SyntaxType;
  params: ParamInfo[];
  returnTypeText: string | null;
}

/**
 * A node of the hierarchy handed from the adapter to the layout and renderer.
 *
 * @remarks
 * `depth` is the number of hops from the root (root = 0), so it equals the ring index.
 */
export interface HierarchyNode {
  id: string;
  tier: Tier;
  name: string;
  /** file path for files and symbols, folder path for folders (`''` for the root) */
  path: string;
  depth: number;
  symbol?: SymbolInfo;
  children: HierarchyNode[];
}
