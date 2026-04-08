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

  it('does not create ImportNode or ImportEdge for imports', () => {
    repoDir = createTempRepo({
      'src/index.ts': `
        import { readFile } from 'fs';
        import { helper } from './utils';
        export const x = 1;
      `,
      'src/utils.ts': `
        export function helper() { return 1; }
      `,
    });
    const result = analyzeTypeScriptRepo(repoDir);

    const imports = result.nodes.filter((n) => n.kind === 'IMPORT');
    expect(imports.length).toBe(0);

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
    const result = analyzeTypeScriptRepo(repoDir);

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
  it('[T002] returns zero import-type edges', () => {
    repoDir = createTempRepo({
      'src/index.ts': `
        import { readFile } from 'fs';
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
  it('[T004] returns zero IMPORT-kind nodes', () => {
    repoDir = createTempRepo({
      'src/index.ts': `
        import { readFile } from 'fs';
        import { helper } from './utils';
        export const x = 1;
      `,
      'src/utils.ts': `export function helper() { return 1; }`,
    });
    const result = analyzeTypeScriptRepo(repoDir);
    expect(result.nodes.filter((n) => n.kind === 'IMPORT').length).toBe(0);
  });

  // T005
  it('[T005] edges contain only contains and call types', () => {
    repoDir = createTempRepo({
      'src/index.ts': `
        import { readFile } from 'fs';
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
    expect(result.edges.every((e) => e.type === 'contains' || e.type === 'call')).toBe(true);
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
