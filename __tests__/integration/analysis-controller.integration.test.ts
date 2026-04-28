/**
 * @jest-environment node
 */
import * as path from 'path';
import * as fs from 'fs/promises';
import { analyzeRepo } from '@/app/services/analysis/controller';
import { SyntaxType, EdgeKind } from '@/lib/analysis/types';

const FIXTURE_PATH = path.resolve(__dirname, '../fixtures/analysis-test-project');
const CACHE_DIR = path.join(FIXTURE_PATH, '.git-explorer');

describe('Analysis controller integration', () => {
  afterAll(async () => {
    await fs.rm(CACHE_DIR, { recursive: true, force: true });
  });

  it('analyzes the fixture project and produces nodes and edges', async () => {
    const result = await analyzeRepo(FIXTURE_PATH, { hideTestFiles: true });

    // Metadata
    expect(result.metadata.language).toBe('typescript');
    expect(result.metadata.repoPath).toBe(FIXTURE_PATH);
    expect(result.metadata.nodeCount).toBeGreaterThan(0);
    expect(result.metadata.edgeCount).toBeGreaterThan(0);
    expect(result.metadata.analysisDurationMs).toBeGreaterThanOrEqual(0);
    expect(result.metadata.missingNodeTypes.length).toBeGreaterThan(0);
    expect(result.metadata.missingEdgeKinds.length).toBeGreaterThan(0);

    // Nodes — verify we found key declarations
    const nodeNames = result.nodes.map(n => n.name);
    expect(nodeNames).toContain('add');
    expect(nodeNames).toContain('fetchData');
    expect(nodeNames).toContain('main');
    expect(nodeNames).toContain('User');
    expect(nodeNames).toContain('Serializable');

    // Verify syntax types
    const addNode = result.nodes.find(n => n.name === 'add');
    expect(addNode?.syntaxType).toBe(SyntaxType.FUNCTION);
    expect(addNode?.isExported).toBe(true);
    expect(addNode?.isAsync).toBe(false);

    const fetchNode = result.nodes.find(n => n.name === 'fetchData');
    expect(fetchNode?.isAsync).toBe(true);

    const userNode = result.nodes.find(n => n.name === 'User');
    expect(userNode?.syntaxType).toBe(SyntaxType.CLASS);

    const serNode = result.nodes.find(n => n.name === 'Serializable');
    expect(serNode?.syntaxType).toBe(SyntaxType.INTERFACE);

    // Edges — verify we found cross-file calls
    const callEdges = result.edges.filter(e => e.kind === EdgeKind.CALLS);
    expect(callEdges.length).toBeGreaterThan(0);

    // Verify at least one edge connects index.ts → utils.ts
    const crossFileCall = callEdges.find(
      e => e.fromFile?.includes('index') && e.toFile?.includes('utils'),
    );
    expect(crossFileCall).toBeDefined();

    // SCIP symbols should be populated
    const nodesWithSymbols = result.nodes.filter(n => n.scipSymbol !== '');
    expect(nodesWithSymbols.length).toBeGreaterThan(0);
  }, 60000);

  it('throws UnsupportedLanguageError for non-TS repos', async () => {
    const tmpDir = path.join(FIXTURE_PATH, '..', 'empty-repo-test');
    await fs.mkdir(tmpDir, { recursive: true });

    try {
      await expect(analyzeRepo(tmpDir)).rejects.toThrow('No supported language detected');
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});
