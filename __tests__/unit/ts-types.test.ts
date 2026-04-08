import {
  TsNode,
  FolderNode,
  FileNode,
  FunctionNode,
  ClassNode,
  InterfaceNode,
  ImportNode,
  TsEdge,
  ImportEdge,
  ExportEdge,
  CallEdge,
  ContainsEdge,
} from '@/lib/ts/types';

describe('TsNode type discrimination', () => {
  it('discriminates FolderNode by kind', () => {
    const node: TsNode = {
      id: 'folder-src',
      kind: 'FOLDER',
      parent: null,
      children: ['file-1'],
      siblings: [],
      name: 'src',
      path: '/repo/src',
      depth: 1,
    };
    expect(node.kind).toBe('FOLDER');
    if (node.kind === 'FOLDER') {
      expect(node.depth).toBe(1);
      expect(node.path).toBe('/repo/src');
    }
  });

  it('discriminates FileNode by kind', () => {
    const node: TsNode = {
      id: 'file-app',
      kind: 'FILE',
      parent: 'folder-src',
      children: [],
      siblings: [],
      name: 'App.tsx',
      path: '/repo/src/App.tsx',
      fileType: 'tsx',
    };
    expect(node.kind).toBe('FILE');
    if (node.kind === 'FILE') {
      expect(node.fileType).toBe('tsx');
    }
  });

  it('discriminates FunctionNode by kind', () => {
    const node: TsNode = {
      id: 'fn-main',
      kind: 'FUNCTION',
      parent: 'file-app',
      children: [],
      siblings: [],
      name: 'main',
      params: [{ name: 'args', type: 'string[]' }],
      returnType: 'void',
    };
    expect(node.kind).toBe('FUNCTION');
    if (node.kind === 'FUNCTION') {
      expect(node.params).toHaveLength(1);
      expect(node.returnType).toBe('void');
    }
  });

  it('discriminates ClassNode by kind', () => {
    const node: TsNode = {
      id: 'class-app',
      kind: 'CLASS',
      parent: 'file-app',
      children: [],
      siblings: [],
      name: 'AppService',
      extends: 'BaseService',
      implements: ['Runnable'],
      decorators: ['Injectable'],
      constructorParams: [{ name: 'config', type: 'Config' }],
    };
    expect(node.kind).toBe('CLASS');
    if (node.kind === 'CLASS') {
      expect(node.extends).toBe('BaseService');
      expect(node.implements).toContain('Runnable');
    }
  });

  it('discriminates InterfaceNode by kind', () => {
    const node: TsNode = {
      id: 'iface-config',
      kind: 'INTERFACE',
      parent: 'file-app',
      children: [],
      siblings: [],
      name: 'Config',
      isExported: true,
      propertyCount: 3,
      methodCount: 1,
      extends: ['BaseConfig'],
    };
    expect(node.kind).toBe('INTERFACE');
    if (node.kind === 'INTERFACE') {
      expect(node.isExported).toBe(true);
      expect(node.propertyCount).toBe(3);
    }
  });

  it('discriminates ImportNode by kind', () => {
    const node: TsNode = {
      id: 'import-react',
      kind: 'IMPORT',
      parent: null,
      children: [],
      siblings: [],
      name: 'react',
      source: 'package',
    };
    expect(node.kind).toBe('IMPORT');
    if (node.kind === 'IMPORT') {
      expect(node.source).toBe('package');
    }
  });
});

describe('TsEdge type discrimination', () => {
  it('discriminates ImportEdge by type', () => {
    const edge: TsEdge = {
      id: 'edge-1',
      type: 'import',
      source: 'file-app',
      target: 'import-react',
    };
    expect(edge.type).toBe('import');
  });

  it('discriminates ExportEdge by type', () => {
    const edge: TsEdge = {
      id: 'edge-2',
      type: 'export',
      source: 'file-app',
      target: 'fn-main',
      isReexport: false,
    };
    expect(edge.type).toBe('export');
    if (edge.type === 'export') {
      expect(edge.isReexport).toBe(false);
    }
  });

  it('discriminates CallEdge by type', () => {
    const edge: TsEdge = {
      id: 'edge-3',
      type: 'call',
      source: 'fn-a',
      target: 'fn-b',
      callScope: 'same-file',
    };
    expect(edge.type).toBe('call');
    expect((edge as CallEdge).callScope).toBe('same-file');
  });

  it('discriminates ContainsEdge by type', () => {
    const edge: TsEdge = {
      id: 'edge-4',
      type: 'contains',
      source: 'folder-src',
      target: 'file-app',
    };
    expect(edge.type).toBe('contains');
  });
});
