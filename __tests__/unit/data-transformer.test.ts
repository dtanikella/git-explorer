import { applyColors, transformTreeToGraph } from '@/lib/treemap/data-transformer';
import { TreeNode } from '@/lib/git/types';

describe('applyColors', () => {
  it('applies colors to file nodes based on frequencyScore', () => {
    const tree = {
      name: 'root',
      path: '',
      value: 15,
      isFile: false,
      children: [
        {
          name: 'src',
          path: 'src',
          value: 15,
          isFile: false,
          children: [
            {
              name: 'App.tsx',
              path: 'src/App.tsx',
              value: 10,
              isFile: true,
              fileData: {
                filePath: 'src/App.tsx',
                totalCommitCount: 10,
                recentCommitCount: 5,
                frequencyScore: 0.5,
              },
            },
            {
              name: 'utils.ts',
              path: 'src/utils.ts',
              value: 5,
              isFile: true,
              fileData: {
                filePath: 'src/utils.ts',
                totalCommitCount: 5,
                recentCommitCount: 1,
                frequencyScore: 0.1,
              },
            },
          ],
        },
      ],
    };

    const result = applyColors(tree);

    const appNode = result.children![0].children![0];
    expect(appNode.color).toBe('#73a573'); // Interpolated color for 0.5

    const utilsNode = result.children![0].children![1];
    expect(utilsNode.color).toBe('#ced8ce'); // Interpolated color for 0.1
  });

  it('does not apply colors to folder nodes', () => {
    const tree = {
      name: 'root',
      path: '',
      value: 10,
      isFile: false,
      children: [
        {
          name: 'src',
          path: 'src',
          value: 10,
          isFile: false,
          children: [
            {
              name: 'App.tsx',
              path: 'src/App.tsx',
              value: 10,
              isFile: true,
              fileData: {
                filePath: 'src/App.tsx',
                totalCommitCount: 10,
                recentCommitCount: 5,
                frequencyScore: 1,
              },
            },
          ],
        },
      ],
    };

    const result = applyColors(tree);

    expect(result.color).toBeUndefined();
    expect(result.children![0].color).toBeUndefined();
    expect(result.children![0].children![0].color).toBeDefined();
  });

  it('handles tree with no file nodes', () => {
    const tree = {
      name: 'root',
      path: '',
      value: 0,
      isFile: false,
      children: [],
    };

    const result = applyColors(tree);

    expect(result.color).toBeUndefined();
  });
});

const createMockTreeNode = (overrides: Partial<TreeNode>): TreeNode => ({
  name: 'root',
  path: '',
  value: 0,
  isFile: false,
  children: [],
  ...overrides,
});

describe('transformTreeToGraph', () => {
  it('extracts only file nodes from tree', () => {
    const tree = createMockTreeNode({
      children: [
        { name: 'src', path: 'src', value: 0, isFile: false, children: [
          { name: 'app.ts', path: 'src/app.ts', value: 10, isFile: true, fileData: { filePath: 'src/app.ts', totalCommitCount: 10, recentCommitCount: 5, frequencyScore: 0.5 } }
        ]},
        { name: 'README.md', path: 'README.md', value: 5, isFile: true, fileData: { filePath: 'README.md', totalCommitCount: 5, recentCommitCount: 1, frequencyScore: 0.1 } }
      ]
    });

    const nodes = transformTreeToGraph(tree);
    expect(nodes).toHaveLength(2);
    expect(nodes.every(n => n.fileName.includes('.'))).toBe(true);
  });

  it('preserves commit counts', () => {
    const tree = createMockTreeNode({
      children: [
        { name: 'a.ts', path: 'a.ts', value: 42, isFile: true, fileData: { filePath: 'a.ts', totalCommitCount: 42, recentCommitCount: 20, frequencyScore: 0.8 } }
      ]
    });

    const nodes = transformTreeToGraph(tree);
    expect(nodes[0].commitCount).toBe(42);
  });

  it('calculates radius using square root scale', () => {
    const tree = createMockTreeNode({
      children: [
        { name: 'low.ts', path: 'low.ts', value: 1, isFile: true, fileData: { filePath: 'low.ts', totalCommitCount: 1, recentCommitCount: 1, frequencyScore: 0.1 } },
        { name: 'high.ts', path: 'high.ts', value: 100, isFile: true, fileData: { filePath: 'high.ts', totalCommitCount: 100, recentCommitCount: 50, frequencyScore: 1.0 } }
      ]
    });

    const nodes = transformTreeToGraph(tree);
    expect(nodes[0].radius).toBe(8);   // Min
    expect(nodes[1].radius).toBe(40);  // Max
  });

  it('applies correct colors based on file type', () => {
    const tree = createMockTreeNode({
      children: [
        { name: 'model.rb', path: 'app/models/model.rb', value: 10, isFile: true, fileData: { filePath: 'app/models/model.rb', totalCommitCount: 10, recentCommitCount: 5, frequencyScore: 0.5 } },
        { name: 'Button.tsx', path: 'components/Button.tsx', value: 10, isFile: true, fileData: { filePath: 'components/Button.tsx', totalCommitCount: 10, recentCommitCount: 5, frequencyScore: 0.5 } },
        { name: 'util.ts', path: 'lib/util.ts', value: 10, isFile: true, fileData: { filePath: 'lib/util.ts', totalCommitCount: 10, recentCommitCount: 5, frequencyScore: 0.5 } }
      ]
    });

    const nodes = transformTreeToGraph(tree);
    expect(nodes.find(n => n.fileName === 'model.rb')?.color).toBe('#E0115F');
    expect(nodes.find(n => n.fileName === 'Button.tsx')?.color).toBe('#ADD8E6');
    expect(nodes.find(n => n.fileName === 'util.ts')?.color).toBe('#808080');
  });

  it('handles tree with no files', () => {
    const tree = createMockTreeNode({
      name: 'root',
      isFile: false,
      children: []
    });

    const nodes = transformTreeToGraph(tree);
    expect(nodes).toEqual([]);
  });

  it('handles tree with single file', () => {
    const tree = createMockTreeNode({
      children: [
        { name: 'solo.ts', path: 'solo.ts', value: 50, isFile: true, fileData: { filePath: 'solo.ts', totalCommitCount: 50, recentCommitCount: 25, frequencyScore: 0.7 } }
      ]
    });

    const nodes = transformTreeToGraph(tree);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].radius).toBe(24); // Mid-point of [8, 40]
  });

  it('handles all files with same commit count', () => {
    const tree = createMockTreeNode({
      children: [
        { name: 'a.ts', path: 'a.ts', value: 10, isFile: true, fileData: { filePath: 'a.ts', totalCommitCount: 10, recentCommitCount: 5, frequencyScore: 0.5 } },
        { name: 'b.ts', path: 'b.ts', value: 10, isFile: true, fileData: { filePath: 'b.ts', totalCommitCount: 10, recentCommitCount: 5, frequencyScore: 0.5 } },
        { name: 'c.ts', path: 'c.ts', value: 10, isFile: true, fileData: { filePath: 'c.ts', totalCommitCount: 10, recentCommitCount: 5, frequencyScore: 0.5 } }
      ]
    });

    const nodes = transformTreeToGraph(tree);
    expect(nodes.every(n => n.radius === 24)).toBe(true);
  });
});