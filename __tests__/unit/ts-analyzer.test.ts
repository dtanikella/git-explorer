import { analyzeTypeScriptRepo } from '@/lib/ts/analyzer';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

function createTempRepo(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-analyzer-test-'));
  fs.writeFileSync(
    path.join(dir, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: { target: 'ES2020', module: 'commonjs', strict: true },
      include: ['**/*.ts', '**/*.tsx'],
    })
  );
  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = path.join(dir, filePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
  }
  return dir;
}

function cleanupTempRepo(dir: string) {
  fs.rmSync(dir, { recursive: true, force: true });
}

describe('analyzeTypeScriptRepo', () => {
  let repoDir: string;

  afterEach(() => {
    if (repoDir) cleanupTempRepo(repoDir);
  });

  it('creates FileNode and FolderNode for a single file', () => {
    repoDir = createTempRepo({
      'src/index.ts': 'export const x = 1;',
    });
    const result = analyzeTypeScriptRepo(repoDir);

    const folders = result.nodes.filter((n) => n.kind === 'FOLDER');
    const files = result.nodes.filter((n) => n.kind === 'FILE');
    expect(folders.length).toBeGreaterThanOrEqual(1);
    expect(files).toHaveLength(1);
    expect(files[0].kind === 'FILE' && files[0].name).toBe('index.ts');
    expect(files[0].kind === 'FILE' && files[0].fileType).toBe('ts');
  });

  it('creates FunctionNode for exported function declarations', () => {
    repoDir = createTempRepo({
      'src/utils.ts': `
        export function add(a: number, b: number): number {
          return a + b;
        }
      `,
    });
    const result = analyzeTypeScriptRepo(repoDir);

    const fns = result.nodes.filter((n) => n.kind === 'FUNCTION');
    expect(fns).toHaveLength(1);
    expect(fns[0].kind === 'FUNCTION' && fns[0].name).toBe('add');
    expect(fns[0].kind === 'FUNCTION' && fns[0].params).toEqual([
      { name: 'a', type: 'number' },
      { name: 'b', type: 'number' },
    ]);
    expect(fns[0].kind === 'FUNCTION' && fns[0].returnType).toBe('number');
  });

  it('creates ClassNode for class declarations', () => {
    repoDir = createTempRepo({
      'src/service.ts': `
        export class MyService {
          constructor(private name: string) {}
          greet(): string { return this.name; }
        }
      `,
    });
    const result = analyzeTypeScriptRepo(repoDir);

    const classes = result.nodes.filter((n) => n.kind === 'CLASS');
    expect(classes).toHaveLength(1);
    expect(classes[0].kind === 'CLASS' && classes[0].name).toBe('MyService');
    expect(classes[0].kind === 'CLASS' && classes[0].constructorParams).toEqual([
      { name: 'name', type: 'string' },
    ]);
  });

  it('creates InterfaceNode for interface declarations', () => {
    repoDir = createTempRepo({
      'src/types.ts': `
        export interface Config {
          host: string;
          port: number;
          start(): void;
        }
      `,
    });
    const result = analyzeTypeScriptRepo(repoDir);

    const ifaces = result.nodes.filter((n) => n.kind === 'INTERFACE');
    expect(ifaces).toHaveLength(1);
    expect(ifaces[0].kind === 'INTERFACE' && ifaces[0].name).toBe('Config');
    expect(ifaces[0].kind === 'INTERFACE' && ifaces[0].isExported).toBe(true);
    expect(ifaces[0].kind === 'INTERFACE' && ifaces[0].propertyCount).toBe(2);
    expect(ifaces[0].kind === 'INTERFACE' && ifaces[0].methodCount).toBe(1);
  });

  it('does not create ImportNode or ImportEdge for local imports', () => {
    repoDir = createTempRepo({
      'src/index.ts': `
        import { helper } from './utils';
        export const x = 1;
      `,
      'src/utils.ts': `
        export function helper() { return 1; }
      `,
    });
    const result = analyzeTypeScriptRepo(repoDir);

    const localImports = result.nodes.filter((n) => n.kind === 'IMPORT' && n.name === './utils');
    expect(localImports.length).toBe(0);

    const importEdges = result.edges.filter((e) => e.type === 'import');
    expect(importEdges.length).toBe(0);
  });

  it('creates CallEdge for intra-file function calls', () => {
    repoDir = createTempRepo({
      'src/math.ts': `
        function double(x: number): number { return x * 2; }
        export function quadruple(x: number): number { return double(double(x)); }
      `,
    });
    const result = analyzeTypeScriptRepo(repoDir);

    const callEdges = result.edges.filter((e) => e.type === 'call');
    expect(callEdges.length).toBeGreaterThanOrEqual(1);

    const quadFn = result.nodes.find(
      (n) => n.kind === 'FUNCTION' && n.name === 'quadruple'
    );
    const doubleFn = result.nodes.find(
      (n) => n.kind === 'FUNCTION' && n.name === 'double'
    );
    expect(quadFn).toBeDefined();
    expect(doubleFn).toBeDefined();
    const callEdge = callEdges.find(
      (e) => e.source === quadFn!.id && e.target === doubleFn!.id
    );
    expect(callEdge).toBeDefined();
  });

  it('creates FunctionNode and CallEdge for arrow functions', () => {
    repoDir = createTempRepo({
      'src/arrows.ts': `
        const greet = (name: string): string => 'Hello ' + name;
        export const run = (): string => greet('world');
      `,
    });
    const result = analyzeTypeScriptRepo(repoDir);

    const fns = result.nodes.filter((n) => n.kind === 'FUNCTION');
    expect(fns.length).toBeGreaterThanOrEqual(2);

    const greetFn = result.nodes.find((n) => n.kind === 'FUNCTION' && n.name === 'greet');
    const runFn = result.nodes.find((n) => n.kind === 'FUNCTION' && n.name === 'run');
    expect(greetFn).toBeDefined();
    expect(runFn).toBeDefined();

    const callEdges = result.edges.filter((e) => e.type === 'call');
    expect(callEdges.length).toBeGreaterThanOrEqual(1);
    const callEdge = callEdges.find(
      (e) => e.source === runFn!.id && e.target === greetFn!.id
    );
    expect(callEdge).toBeDefined();
  });

  it('does not create ExportEdge for re-exports', () => {
    repoDir = createTempRepo({
      'src/math.ts': `export function add(a: number, b: number): number { return a + b; }`,
      'src/index.ts': `export { add } from './math';`,
    });
    const result = analyzeTypeScriptRepo(repoDir);

    const reexportEdges = result.edges.filter(
      (e) => e.type === 'export' && (e as any).isReexport === true
    );
    expect(reexportEdges.length).toBe(0);
  });

  it('populates parent, children, and siblings on all nodes', () => {
    repoDir = createTempRepo({
      'src/a.ts': 'export const a = 1;',
      'src/b.ts': 'export const b = 2;',
    });
    const result = analyzeTypeScriptRepo(repoDir);

    const srcFolder = result.nodes.find(
      (n) => n.kind === 'FOLDER' && n.name === 'src'
    );
    expect(srcFolder).toBeDefined();
    expect(srcFolder!.children.length).toBe(2);

    const fileA = result.nodes.find(
      (n) => n.kind === 'FILE' && n.name === 'a.ts'
    );
    expect(fileA).toBeDefined();
    expect(fileA!.parent).toBe(srcFolder!.id);
    expect(fileA!.siblings).toHaveLength(1);
  });

  it('handles tsx files with correct fileType', () => {
    repoDir = createTempRepo({
      'src/App.tsx': `
        export const App = () => <div>Hello</div>;
      `,
    });
    const result = analyzeTypeScriptRepo(repoDir);
    const tsxFile = result.nodes.find((n) => n.kind === 'FILE' && n.name === 'App.tsx');
    expect(tsxFile).toBeDefined();
    expect(tsxFile!.kind === 'FILE' && tsxFile!.fileType).toBe('tsx');
  });

  it('handles ClassNode with extends and implements', () => {
    repoDir = createTempRepo({
      'src/service.ts': `
        class BaseService {}
        interface Runnable { run(): void; }
        export class AppService extends BaseService implements Runnable {
          run(): void {}
        }
      `,
    });
    const result = analyzeTypeScriptRepo(repoDir);
    const appService = result.nodes.find(
      (n) => n.kind === 'CLASS' && n.name === 'AppService'
    );
    expect(appService).toBeDefined();
    expect(appService!.kind === 'CLASS' && appService!.extends).toBe('BaseService');
    expect(appService!.kind === 'CLASS' && appService!.implements).toContain('Runnable');
  });

  it('handles InterfaceNode with extends', () => {
    repoDir = createTempRepo({
      'src/types.ts': `
        interface Base { id: string; }
        export interface Extended extends Base { name: string; }
      `,
    });
    const result = analyzeTypeScriptRepo(repoDir);
    const extended = result.nodes.find(
      (n) => n.kind === 'INTERFACE' && n.name === 'Extended'
    );
    expect(extended).toBeDefined();
    expect(extended!.kind === 'INTERFACE' && extended!.extends).toContain('Base');
  });

  it('sets inTestFile on FileNode and child nodes inside a test file', () => {
    repoDir = createTempRepo({
      'src/utils.test.ts': `
        export function testHelper(): void {}
      `,
      'src/regular.ts': `
        export function normalFn(): void {}
      `,
    });
    const result = analyzeTypeScriptRepo(repoDir, { hideTestFiles: false });

    const testFile = result.nodes.find(
      (n) => n.kind === 'FILE' && n.name === 'utils.test.ts'
    );
    expect(testFile).toBeDefined();
    expect(testFile!.inTestFile).toBe(true);

    const testHelper = result.nodes.find(
      (n) => n.kind === 'FUNCTION' && n.name === 'testHelper'
    );
    expect(testHelper).toBeDefined();
    expect(testHelper!.inTestFile).toBe(true);

    const normalFile = result.nodes.find(
      (n) => n.kind === 'FILE' && n.name === 'regular.ts'
    );
    expect(normalFile).toBeDefined();
    expect(normalFile!.inTestFile).toBeFalsy();

    const normalFn = result.nodes.find(
      (n) => n.kind === 'FUNCTION' && n.name === 'normalFn'
    );
    expect(normalFn).toBeDefined();
    expect(normalFn!.inTestFile).toBeFalsy();
  });

  it('emits contains edges from folders to child folders and files', () => {
    repoDir = createTempRepo({
      'src/utils/helpers.ts': 'export const x = 1;',
    });
    const result = analyzeTypeScriptRepo(repoDir);

    const containsEdges = result.edges.filter((e) => e.type === 'contains');
    expect(containsEdges.length).toBeGreaterThanOrEqual(3); // root→src, src→utils, utils→helpers.ts

    const utilsFolder = result.nodes.find(
      (n) => n.kind === 'FOLDER' && n.name === 'utils'
    );
    const helpersFile = result.nodes.find(
      (n) => n.kind === 'FILE' && n.name === 'helpers.ts'
    );
    expect(utilsFolder).toBeDefined();
    expect(helpersFile).toBeDefined();

    const folderToFile = containsEdges.find(
      (e) => e.source === utilsFolder!.id && e.target === helpersFile!.id
    );
    expect(folderToFile).toBeDefined();
  });

  it('does not emit ImportNode or resolution edges for local imports', () => {
    repoDir = createTempRepo({
      'src/index.ts': `
        import { helper } from './utils';
        export const x = helper();
      `,
      'src/other.ts': `
        import { helper } from './utils';
        export const y = helper();
      `,
      'src/utils.ts': `
        export function helper(): number { return 1; }
      `,
    });
    const result = analyzeTypeScriptRepo(repoDir);

    const importNode = result.nodes.find(
      (n) => n.kind === 'IMPORT' && n.name === './utils'
    );
    expect(importNode).toBeUndefined();

    const importEdges = result.edges.filter((e) => e.type === 'import');
    expect(importEdges.length).toBe(0);
  });

  it('emits call edges with callScope same-file for intra-file calls', () => {
    repoDir = createTempRepo({
      'src/math.ts': `
        export function add(a: number, b: number): number { return a + b; }
        export function double(x: number): number { return add(x, x); }
      `,
    });
    const result = analyzeTypeScriptRepo(repoDir);

    const callEdges = result.edges.filter((e) => e.type === 'call');
    expect(callEdges.length).toBeGreaterThan(0);

    for (const edge of callEdges) {
      expect((edge as import('@/lib/ts/types').CallEdge).callScope).toBe('same-file');
    }
  });
});

describe('US1: Simplified Edge View', () => {
  let repoDir: string;

  afterEach(() => {
    if (repoDir) cleanupTempRepo(repoDir);
  });

  // T002
  it('[T002] returns zero import-type edges for local imports', () => {
    repoDir = createTempRepo({
      'src/index.ts': `
        import { helper } from './utils';
        export const x = 1;
      `,
      'src/utils.ts': `export function helper() { return 1; }`,
    });
    const result = analyzeTypeScriptRepo(repoDir);
    expect(result.edges.filter((e) => e.type === 'import').length).toBe(0);
  });

  // T003
  it('[T003] returns zero export-type edges', () => {
    repoDir = createTempRepo({
      'src/utils.ts': `
        export function helper() { return 1; }
        export class MyClass {}
        export interface MyInterface { id: string; }
      `,
    });
    const result = analyzeTypeScriptRepo(repoDir);
    expect(result.edges.filter((e) => e.type === 'export').length).toBe(0);
  });

  // T004
  it('[T004] returns zero IMPORT-kind nodes for local imports', () => {
    repoDir = createTempRepo({
      'src/index.ts': `
        import { helper } from './utils';
        export const x = 1;
      `,
      'src/utils.ts': `export function helper() { return 1; }`,
    });
    const result = analyzeTypeScriptRepo(repoDir);
    expect(result.nodes.filter((n) => n.kind === 'IMPORT').length).toBe(0);
  });

  // T005
  it('[T005] edges contain only contains, call, and uses types', () => {
    repoDir = createTempRepo({
      'src/index.ts': `
        import { helper } from './utils';
        export const x = 1;
      `,
      'src/utils.ts': `
        export function helper(): number { return 1; }
        function double(x: number): number { return x * 2; }
        export function quadruple(x: number): number { return double(double(x)); }
      `,
    });
    const result = analyzeTypeScriptRepo(repoDir);
    expect(result.edges.every((e) => e.type === 'contains' || e.type === 'call' || e.type === 'uses')).toBe(true);
  });

  // T005b
  it('[T005b] still emits call edges after edge simplification', () => {
    repoDir = createTempRepo({
      'src/math.ts': `
        function double(x: number): number { return x * 2; }
        export function quadruple(x: number): number { return double(double(x)); }
      `,
    });
    const result = analyzeTypeScriptRepo(repoDir);
    expect(result.edges.filter((e) => e.type === 'call').length).toBeGreaterThan(0);
  });
});

describe('US2: Hide Test Files', () => {
  let repoDir: string;

  afterEach(() => {
    if (repoDir) cleanupTempRepo(repoDir);
  });

  // T013
  it('[T013] hideTestFiles:true returns zero FILE nodes matching test patterns', () => {
    repoDir = createTempRepo({
      'src/utils.ts': `export function helper(): void {}`,
      'src/utils.test.ts': `export function testHelper(): void {}`,
      '__tests__/unit/foo.test.ts': `export function fooTest(): void {}`,
      'src/service.spec.ts': `export function specHelper(): void {}`,
    });
    const result = analyzeTypeScriptRepo(repoDir, { hideTestFiles: true });
    const testFileNodes = result.nodes.filter(
      (n) =>
        n.kind === 'FILE' &&
        (n.id.includes('.test.') || n.id.includes('.spec.') || n.id.includes('__tests__'))
    );
    expect(testFileNodes.length).toBe(0);
  });

  // T014
  it('[T014] hideTestFiles:true returns zero FUNCTION/CLASS/INTERFACE nodes with inTestFile:true', () => {
    repoDir = createTempRepo({
      'src/utils.ts': `export function helper(): void {}`,
      'src/utils.test.ts': `
        export function testHelper(): void {}
        export class TestClass {}
        export interface TestInterface { id: string; }
      `,
    });
    const result = analyzeTypeScriptRepo(repoDir, { hideTestFiles: true });
    const testSymbolNodes = result.nodes.filter(
      (n) =>
        (n.kind === 'FUNCTION' || n.kind === 'CLASS' || n.kind === 'INTERFACE') &&
        n.inTestFile === true
    );
    expect(testSymbolNodes.length).toBe(0);
  });

  // T015
  it('[T015] hideTestFiles:true prunes folders that contain only test files', () => {
    repoDir = createTempRepo({
      'src/utils.ts': `export function helper(): void {}`,
      'test-only/only.test.ts': `export function onlyTest(): void {}`,
    });
    const result = analyzeTypeScriptRepo(repoDir, { hideTestFiles: true });
    // The 'test-only' folder should be pruned since its only child was a test file
    const testOnlyFolder = result.nodes.find(
      (n) => n.kind === 'FOLDER' && n.name === 'test-only'
    );
    expect(testOnlyFolder).toBeUndefined();
  });

  // T016
  it('[T016] hideTestFiles:false includes test file nodes', () => {
    repoDir = createTempRepo({
      'src/utils.ts': `export function helper(): void {}`,
      'src/utils.test.ts': `export function testHelper(): void {}`,
      '__tests__/unit/foo.test.ts': `export function fooTest(): void {}`,
    });
    const result = analyzeTypeScriptRepo(repoDir, { hideTestFiles: false });
    const testFileNodes = result.nodes.filter(
      (n) =>
        n.kind === 'FILE' &&
        (n.id.includes('.test.') || n.id.includes('.spec.') || n.id.includes('__tests__'))
    );
    expect(testFileNodes.length).toBeGreaterThan(0);
  });
});

describe('Cross-File Edges', () => {
  let repoDir: string;

  afterEach(() => {
    if (repoDir) cleanupTempRepo(repoDir);
  });

  it('emits cross-file call edge for named import function call', () => {
    repoDir = createTempRepo({
      'src/utils.ts': `export function helper(): number { return 1; }`,
      'src/index.ts': `
        import { helper } from './utils';
        export function main(): number { return helper(); }
      `,
    });
    const result = analyzeTypeScriptRepo(repoDir);

    const mainFn = result.nodes.find((n) => n.kind === 'FUNCTION' && n.name === 'main');
    const helperFn = result.nodes.find((n) => n.kind === 'FUNCTION' && n.name === 'helper');
    expect(mainFn).toBeDefined();
    expect(helperFn).toBeDefined();

    const callEdge = result.edges.find(
      (e) => e.type === 'call' && e.source === mainFn!.id && e.target === helperFn!.id
    );
    expect(callEdge).toBeDefined();
    expect((callEdge as import('@/lib/ts/types').CallEdge).callScope).toBe('cross-file');
  });

  it('emits cross-file call edge for renamed import', () => {
    repoDir = createTempRepo({
      'src/utils.ts': `export function helper(): number { return 1; }`,
      'src/index.ts': `
        import { helper as h } from './utils';
        export function main(): number { return h(); }
      `,
    });
    const result = analyzeTypeScriptRepo(repoDir);

    const mainFn = result.nodes.find((n) => n.kind === 'FUNCTION' && n.name === 'main');
    const helperFn = result.nodes.find((n) => n.kind === 'FUNCTION' && n.name === 'helper');
    expect(mainFn).toBeDefined();
    expect(helperFn).toBeDefined();

    const callEdge = result.edges.find(
      (e) => e.type === 'call' && e.source === mainFn!.id && e.target === helperFn!.id
    );
    expect(callEdge).toBeDefined();
  });

  it('emits uses edge for cross-file type reference in function param', () => {
    repoDir = createTempRepo({
      'src/types.ts': `export interface Config { host: string; port: number; }`,
      'src/index.ts': `
        import { Config } from './types';
        export function init(config: Config): void {}
      `,
    });
    const result = analyzeTypeScriptRepo(repoDir);

    const initFn = result.nodes.find((n) => n.kind === 'FUNCTION' && n.name === 'init');
    const configIface = result.nodes.find((n) => n.kind === 'INTERFACE' && n.name === 'Config');
    expect(initFn).toBeDefined();
    expect(configIface).toBeDefined();

    const usesEdge = result.edges.find(
      (e) => e.type === 'uses' && e.source === initFn!.id && e.target === configIface!.id
    );
    expect(usesEdge).toBeDefined();
    expect((usesEdge as import('@/lib/ts/types').UsesEdge).usageKind).toBe('type-reference');
  });

  it('emits uses edge for cross-file return type reference', () => {
    repoDir = createTempRepo({
      'src/types.ts': `export interface Result { value: number; }`,
      'src/index.ts': `
        import { Result } from './types';
        export function compute(): Result { return { value: 42 }; }
      `,
    });
    const result = analyzeTypeScriptRepo(repoDir);

    const computeFn = result.nodes.find((n) => n.kind === 'FUNCTION' && n.name === 'compute');
    const resultIface = result.nodes.find((n) => n.kind === 'INTERFACE' && n.name === 'Result');
    expect(computeFn).toBeDefined();
    expect(resultIface).toBeDefined();

    const usesEdge = result.edges.find(
      (e) => e.type === 'uses' && e.source === computeFn!.id && e.target === resultIface!.id
    );
    expect(usesEdge).toBeDefined();
  });

  it('emits uses edge with usageKind extends for cross-file class extends', () => {
    repoDir = createTempRepo({
      'src/base.ts': `export class BaseService { start(): void {} }`,
      'src/app.ts': `
        import { BaseService } from './base';
        export class AppService extends BaseService {}
      `,
    });
    const result = analyzeTypeScriptRepo(repoDir);

    const appService = result.nodes.find((n) => n.kind === 'CLASS' && n.name === 'AppService');
    const baseService = result.nodes.find((n) => n.kind === 'CLASS' && n.name === 'BaseService');
    expect(appService).toBeDefined();
    expect(baseService).toBeDefined();

    const usesEdge = result.edges.find(
      (e) => e.type === 'uses' && e.source === appService!.id && e.target === baseService!.id
    );
    expect(usesEdge).toBeDefined();
    expect((usesEdge as import('@/lib/ts/types').UsesEdge).usageKind).toBe('extends');
  });

  it('emits uses edge with usageKind implements for cross-file class implements', () => {
    repoDir = createTempRepo({
      'src/types.ts': `export interface Runnable { run(): void; }`,
      'src/app.ts': `
        import { Runnable } from './types';
        export class AppService implements Runnable { run(): void {} }
      `,
    });
    const result = analyzeTypeScriptRepo(repoDir);

    const appService = result.nodes.find((n) => n.kind === 'CLASS' && n.name === 'AppService');
    const runnable = result.nodes.find((n) => n.kind === 'INTERFACE' && n.name === 'Runnable');
    expect(appService).toBeDefined();
    expect(runnable).toBeDefined();

    const usesEdge = result.edges.find(
      (e) => e.type === 'uses' && e.source === appService!.id && e.target === runnable!.id
    );
    expect(usesEdge).toBeDefined();
    expect((usesEdge as import('@/lib/ts/types').UsesEdge).usageKind).toBe('implements');
  });

  it('emits uses edge for cross-file interface extends', () => {
    repoDir = createTempRepo({
      'src/base.ts': `export interface Base { id: string; }`,
      'src/extended.ts': `
        import { Base } from './base';
        export interface Extended extends Base { name: string; }
      `,
    });
    const result = analyzeTypeScriptRepo(repoDir);

    const extended = result.nodes.find((n) => n.kind === 'INTERFACE' && n.name === 'Extended');
    const base = result.nodes.find((n) => n.kind === 'INTERFACE' && n.name === 'Base');
    expect(extended).toBeDefined();
    expect(base).toBeDefined();

    const usesEdge = result.edges.find(
      (e) => e.type === 'uses' && e.source === extended!.id && e.target === base!.id
    );
    expect(usesEdge).toBeDefined();
    expect((usesEdge as import('@/lib/ts/types').UsesEdge).usageKind).toBe('extends');
  });

  it('emits cross-file call edge for namespace import', () => {
    repoDir = createTempRepo({
      'src/utils.ts': `export function helper(): number { return 1; }`,
      'src/index.ts': `
        import * as utils from './utils';
        export function main(): number { return utils.helper(); }
      `,
    });
    const result = analyzeTypeScriptRepo(repoDir);

    const mainFn = result.nodes.find((n) => n.kind === 'FUNCTION' && n.name === 'main');
    const helperFn = result.nodes.find((n) => n.kind === 'FUNCTION' && n.name === 'helper');
    expect(mainFn).toBeDefined();
    expect(helperFn).toBeDefined();

    const callEdge = result.edges.find(
      (e) => e.type === 'call' && e.source === mainFn!.id && e.target === helperFn!.id
    );
    expect(callEdge).toBeDefined();
    expect((callEdge as import('@/lib/ts/types').CallEdge).callScope).toBe('cross-file');
  });

  it('deduplicates uses edges per source+target+usageKind', () => {
    repoDir = createTempRepo({
      'src/types.ts': `export interface Config { host: string; port: number; }`,
      'src/index.ts': `
        import { Config } from './types';
        export function init(config: Config): Config { return config; }
      `,
    });
    const result = analyzeTypeScriptRepo(repoDir);

    const initFn = result.nodes.find((n) => n.kind === 'FUNCTION' && n.name === 'init');
    const configIface = result.nodes.find((n) => n.kind === 'INTERFACE' && n.name === 'Config');

    const usesEdges = result.edges.filter(
      (e) => e.type === 'uses' && e.source === initFn!.id && e.target === configIface!.id
    );
    // param type + return type should be deduplicated to one type-reference edge
    expect(usesEdges).toHaveLength(1);
  });
});

describe('External Package Call Edges', () => {
  let repoDir: string;

  afterEach(() => {
    if (repoDir) cleanupTempRepo(repoDir);
  });

  it('emits call edge from function to external package (named import)', () => {
    repoDir = createTempRepo({
      'src/index.ts': `
        import { readFileSync } from 'fs';
        export function loadConfig(): string { return readFileSync('config.json', 'utf-8'); }
      `,
    });
    const result = analyzeTypeScriptRepo(repoDir);

    const loadFn = result.nodes.find((n) => n.kind === 'FUNCTION' && n.name === 'loadConfig');
    const fsImport = result.nodes.find((n) => n.kind === 'IMPORT' && n.name === 'fs');
    expect(loadFn).toBeDefined();
    expect(fsImport).toBeDefined();

    const callEdge = result.edges.find(
      (e) => e.type === 'call' && e.source === loadFn!.id && e.target === fsImport!.id
    );
    expect(callEdge).toBeDefined();
    expect((callEdge as import('@/lib/ts/types').CallEdge).callScope).toBe('external');

    // No import-type edges should exist
    const importEdges = result.edges.filter((e) => e.type === 'import');
    expect(importEdges).toHaveLength(0);
  });

  it('emits call edge from function to external package (namespace import)', () => {
    repoDir = createTempRepo({
      'src/index.ts': `
        import * as path from 'path';
        export function getExt(file: string): string { return path.extname(file); }
      `,
    });
    const result = analyzeTypeScriptRepo(repoDir);

    const getExtFn = result.nodes.find((n) => n.kind === 'FUNCTION' && n.name === 'getExt');
    const pathImport = result.nodes.find((n) => n.kind === 'IMPORT' && n.name === 'path');
    expect(getExtFn).toBeDefined();
    expect(pathImport).toBeDefined();

    const callEdge = result.edges.find(
      (e) => e.type === 'call' && e.source === getExtFn!.id && e.target === pathImport!.id
    );
    expect(callEdge).toBeDefined();
    expect((callEdge as import('@/lib/ts/types').CallEdge).callScope).toBe('external');
  });

  it('emits fallback call edge from file when package is imported but not called', () => {
    repoDir = createTempRepo({
      'src/index.ts': `
        import { Config } from 'some-package';
        export const x = 1;
      `,
    });
    const result = analyzeTypeScriptRepo(repoDir);

    const fileNode = result.nodes.find((n) => n.kind === 'FILE' && n.name === 'index.ts');
    const pkgImport = result.nodes.find((n) => n.kind === 'IMPORT' && n.name === 'some-package');
    expect(fileNode).toBeDefined();
    expect(pkgImport).toBeDefined();

    const callEdge = result.edges.find(
      (e) => e.type === 'call' && e.source === fileNode!.id && e.target === pkgImport!.id
    );
    expect(callEdge).toBeDefined();
    expect((callEdge as import('@/lib/ts/types').CallEdge).callScope).toBe('external');
  });

  it('emits call edge from class to external package (method body)', () => {
    repoDir = createTempRepo({
      'src/service.ts': `
        import { readFileSync } from 'fs';
        export class FileService {
          load(): string { return readFileSync('data.json', 'utf-8'); }
        }
      `,
    });
    const result = analyzeTypeScriptRepo(repoDir);

    const classNode = result.nodes.find((n) => n.kind === 'CLASS' && n.name === 'FileService');
    const fsImport = result.nodes.find((n) => n.kind === 'IMPORT' && n.name === 'fs');
    expect(classNode).toBeDefined();
    expect(fsImport).toBeDefined();

    const callEdge = result.edges.find(
      (e) => e.type === 'call' && e.source === classNode!.id && e.target === fsImport!.id
    );
    expect(callEdge).toBeDefined();
    expect((callEdge as import('@/lib/ts/types').CallEdge).callScope).toBe('external');
  });

  it('emits call edge from file for top-level external call', () => {
    repoDir = createTempRepo({
      'src/index.ts': `
        import { readFileSync } from 'fs';
        const data = readFileSync('config.json', 'utf-8');
        export const config = data;
      `,
    });
    const result = analyzeTypeScriptRepo(repoDir);

    const fileNode = result.nodes.find((n) => n.kind === 'FILE' && n.name === 'index.ts');
    const fsImport = result.nodes.find((n) => n.kind === 'IMPORT' && n.name === 'fs');
    expect(fileNode).toBeDefined();
    expect(fsImport).toBeDefined();

    const callEdge = result.edges.find(
      (e) => e.type === 'call' && e.source === fileNode!.id && e.target === fsImport!.id
    );
    expect(callEdge).toBeDefined();
    expect((callEdge as import('@/lib/ts/types').CallEdge).callScope).toBe('external');
  });
});
