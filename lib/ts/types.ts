// --- Shared Helpers ---

export interface Param {
  name: string;
  type: string;
}

// --- Node Types ---

export type NodeKind = 'FOLDER' | 'FILE' | 'FUNCTION' | 'CLASS' | 'INTERFACE' | 'IMPORT';

export interface TsNodeBase {
  id: string;
  kind: NodeKind;
  parent: string | null;
  children: string[];
  siblings: string[];
  inTestFile?: boolean;
}

export interface FolderNode extends TsNodeBase {
  kind: 'FOLDER';
  name: string;
  path: string;
  depth: number;
}

export interface FileNode extends TsNodeBase {
  kind: 'FILE';
  name: string;
  path: string;
  fileType: 'ts' | 'tsx';
}

export interface FunctionNode extends TsNodeBase {
  kind: 'FUNCTION';
  name: string;
  params: Param[];
  returnType: string | null;
}

export interface ClassNode extends TsNodeBase {
  kind: 'CLASS';
  name: string;
  extends: string | null;
  implements: string[];
  decorators: string[];
  constructorParams: Param[];
}

export interface InterfaceNode extends TsNodeBase {
  kind: 'INTERFACE';
  name: string;
  isExported: boolean;
  propertyCount: number;
  methodCount: number;
  extends: string[];
}

export interface ImportNode extends TsNodeBase {
  kind: 'IMPORT';
  name: string;
  source: 'local' | 'package';
}

export type TsNode = FolderNode | FileNode | FunctionNode | ClassNode | InterfaceNode | ImportNode;

// --- Edge Types ---

export interface TsEdgeBase {
  id: string;
  type: 'import' | 'export' | 'call' | 'contains';
  source: string;
  target: string;
}

export interface ImportEdge extends TsEdgeBase {
  type: 'import';
}

export interface ExportEdge extends TsEdgeBase {
  type: 'export';
  isReexport: boolean;
}

export interface CallEdge extends TsEdgeBase {
  type: 'call';
  callScope: 'same-file' | 'cross-file' | 'external';
}

export interface ContainsEdge extends TsEdgeBase {
  type: 'contains';
  containsScope: 'folder' | 'file';
}

export type TsEdge = ImportEdge | ExportEdge | CallEdge | ContainsEdge;

// --- Graph Data ---

export interface TsGraphData {
  nodes: TsNode[];
  edges: TsEdge[];
}

// --- Force Rule Types ---

export interface NodeForceRule {
  id: string;
  label: string;
  enabled: boolean;
  match: (node: TsNode) => boolean;
  forces?: {
    charge?: number;
    collideRadius?: number;
    centerStrength?: number;
    fx?: number | null;
    fy?: number | null;
    zone?: 'top' | 'bottom' | 'left' | 'right' | 'center' | null;
  };
  style?: {
    color?: string;
    radius?: number;
  };
}

export interface EdgeForceRule {
  id: string;
  label: string;
  enabled: boolean;
  match: (edge: TsEdge) => boolean;
  forces?: {
    linkStrength?: number;
    linkDistance?: number;
  };
  style?: {
    color?: string;
    width?: number;
  };
}

// --- Resolved Types (output of rule evaluation) ---

export interface ResolvedNodeForces {
  charge: number;
  collideRadius: number;
  centerStrength: number;
  fx: number | null;
  fy: number | null;
  zone: 'top' | 'bottom' | 'left' | 'right' | 'center' | null;
}

export interface ResolvedNodeStyle {
  color: string;
  radius: number;
}

export interface ResolvedEdgeForces {
  linkStrength: number;
  linkDistance: number;
}

export interface ResolvedEdgeStyle {
  color: string;
  width: number;
}
