import type { EdgeKind, SyntaxType, ParamInfo } from '@/lib/analysis/types';

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

/** Which end of an edge a connection is read from: edges leaving a symbol or edges arriving at it. */
export type Direction = 'out' | 'in';

/** One distinct, drawable edge between two symbol dots. */
export interface DotEdge {
  kind: EdgeKind;
  from: string;
  to: string;
}

/** What one symbol dot is connected to, by edge kind and direction. */
export interface DotConnections {
  /** distinct connected dots per kind, in first-seen order */
  out: Map<EdgeKind, string[]>;
  in: Map<EdgeKind, string[]>;
  /** edges at this dot that cannot be drawn: external, unresolved, or ending at no kept symbol */
  undrawn: number;
}

/** The connections of every symbol dot, built once per analysis result. */
export interface ConnectionModel {
  byDot: Map<string, DotConnections>;
  /** every distinct drawable edge */
  edges: DotEdge[];
}
