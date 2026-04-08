import {
  evaluateNodeForces,
  evaluateNodeStyle,
  evaluateEdgeForces,
  evaluateEdgeStyle,
  NODE_FORCE_DEFAULTS,
  NODE_STYLE_DEFAULTS,
  EDGE_FORCE_DEFAULTS,
  EDGE_STYLE_DEFAULTS,
} from '@/lib/ts/force-rules';
import {
  TsNode,
  FileNode,
  FolderNode,
  NodeForceRule,
  TsEdge,
  ImportEdge,
  EdgeForceRule,
} from '@/lib/ts/types';

const makeFileNode = (overrides?: Partial<FileNode>): FileNode => ({
  id: 'file-1',
  kind: 'FILE',
  parent: 'folder-src',
  children: [],
  siblings: [],
  name: 'index.ts',
  path: '/repo/src/index.ts',
  fileType: 'ts',
  ...overrides,
});

const makeFolderNode = (overrides?: Partial<FolderNode>): FolderNode => ({
  id: 'folder-src',
  kind: 'FOLDER',
  parent: null,
  children: [],
  siblings: [],
  name: 'src',
  path: '/repo/src',
  depth: 1,
  ...overrides,
});

const makeImportEdge = (overrides?: Partial<ImportEdge>): ImportEdge => ({
  id: 'edge-1',
  type: 'import',
  source: 'file-1',
  target: 'import-1',
  ...overrides,
});

describe('evaluateNodeForces', () => {
  it('returns defaults when no rules match', () => {
    const node = makeFileNode();
    const rules: NodeForceRule[] = [
      {
        id: 'r1',
        label: 'Folders only',
        enabled: true,
        match: (n) => n.kind === 'FOLDER',
        forces: { charge: -500 },
      },
    ];
    const result = evaluateNodeForces(node, rules);
    expect(result).toEqual(NODE_FORCE_DEFAULTS);
  });

  it('applies first matching rule per property', () => {
    const node = makeFileNode();
    const rules: NodeForceRule[] = [
      {
        id: 'r1',
        label: 'Files: strong charge',
        enabled: true,
        match: (n) => n.kind === 'FILE',
        forces: { charge: -800 },
      },
      {
        id: 'r2',
        label: 'Files: weak charge',
        enabled: true,
        match: (n) => n.kind === 'FILE',
        forces: { charge: -100, collideRadius: 20 },
      },
    ];
    const result = evaluateNodeForces(node, rules);
    expect(result.charge).toBe(-800);
    expect(result.collideRadius).toBe(20);
  });

  it('skips disabled rules', () => {
    const node = makeFileNode();
    const rules: NodeForceRule[] = [
      {
        id: 'r1',
        label: 'Disabled',
        enabled: false,
        match: (n) => n.kind === 'FILE',
        forces: { charge: -999 },
      },
      {
        id: 'r2',
        label: 'Enabled',
        enabled: true,
        match: (n) => n.kind === 'FILE',
        forces: { charge: -200 },
      },
    ];
    const result = evaluateNodeForces(node, rules);
    expect(result.charge).toBe(-200);
  });
});

describe('evaluateNodeStyle', () => {
  it('returns defaults when no rules match', () => {
    const node = makeFileNode();
    const result = evaluateNodeStyle(node, []);
    expect(result).toEqual(NODE_STYLE_DEFAULTS);
  });

  it('applies first matching rule per style property', () => {
    const node = makeFileNode();
    const rules: NodeForceRule[] = [
      {
        id: 'r1',
        label: 'Color only',
        enabled: true,
        match: (n) => n.kind === 'FILE',
        style: { color: '#ff0000' },
      },
      {
        id: 'r2',
        label: 'Color and radius',
        enabled: true,
        match: (n) => n.kind === 'FILE',
        style: { color: '#0000ff', radius: 12 },
      },
    ];
    const result = evaluateNodeStyle(node, rules);
    expect(result.color).toBe('#ff0000');
    expect(result.radius).toBe(12);
  });
});

describe('evaluateEdgeForces', () => {
  it('returns defaults when no rules match', () => {
    const edge = makeImportEdge();
    const result = evaluateEdgeForces(edge, []);
    expect(result).toEqual(EDGE_FORCE_DEFAULTS);
  });

  it('applies first matching rule per property', () => {
    const edge = makeImportEdge();
    const rules: EdgeForceRule[] = [
      {
        id: 'r1',
        label: 'Imports: short distance',
        enabled: true,
        match: (e) => e.type === 'import',
        forces: { linkDistance: 50 },
      },
      {
        id: 'r2',
        label: 'All edges: strong',
        enabled: true,
        match: () => true,
        forces: { linkStrength: 0.8, linkDistance: 200 },
      },
    ];
    const result = evaluateEdgeForces(edge, rules);
    expect(result.linkDistance).toBe(50);
    expect(result.linkStrength).toBe(0.8);
  });
});

describe('evaluateEdgeStyle', () => {
  it('returns defaults when no rules match', () => {
    const edge = makeImportEdge();
    const result = evaluateEdgeStyle(edge, []);
    expect(result).toEqual(EDGE_STYLE_DEFAULTS);
  });

  it('applies first matching rule per property', () => {
    const edge = makeImportEdge();
    const rules: EdgeForceRule[] = [
      {
        id: 'r1',
        label: 'Import edges: red',
        enabled: true,
        match: (e) => e.type === 'import',
        style: { color: '#ff0000' },
      },
    ];
    const result = evaluateEdgeStyle(edge, rules);
    expect(result.color).toBe('#ff0000');
    expect(result.width).toBe(EDGE_STYLE_DEFAULTS.width);
  });
});
