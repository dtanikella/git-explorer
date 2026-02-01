import { buildTreeFromFiles } from '@/lib/git/tree-builder';

describe('buildTreeFromFiles', () => {
  it('builds hierarchical tree from flat file list', () => {
    const files = [
      {
        filePath: 'src/App.tsx',
        totalCommitCount: 10,
        recentCommitCount: 5,
        frequencyScore: 0.5,
      },
      {
        filePath: 'src/utils.ts',
        totalCommitCount: 5,
        recentCommitCount: 2,
        frequencyScore: 0.2,
      },
      {
        filePath: 'README.md',
        totalCommitCount: 3,
        recentCommitCount: 1,
        frequencyScore: 0.1,
      },
    ];

    const result = buildTreeFromFiles(files);

    expect(result.name).toBe('root');
    expect(result.path).toBe('');
    expect(result.isFile).toBe(false);
    expect(result.children).toHaveLength(2); // src and README.md

    const srcNode = result.children!.find(c => c.name === 'src');
    expect(srcNode).toBeDefined();
    expect(srcNode!.path).toBe('src');
    expect(srcNode!.isFile).toBe(false);
    expect(srcNode!.children).toHaveLength(2);

    const appNode = srcNode!.children!.find(c => c.name === 'App.tsx');
    expect(appNode).toBeDefined();
    expect(appNode!.isFile).toBe(true);
    expect(appNode!.value).toBe(10);
    expect(appNode!.fileData).toEqual(files[0]);

    const utilsNode = srcNode!.children!.find(c => c.name === 'utils.ts');
    expect(utilsNode).toBeDefined();
    expect(utilsNode!.isFile).toBe(true);
    expect(utilsNode!.value).toBe(5);

    const readmeNode = result.children!.find(c => c.name === 'README.md');
    expect(readmeNode).toBeDefined();
    expect(readmeNode!.isFile).toBe(true);
    expect(readmeNode!.value).toBe(3);
  });

  it('aggregates values in parent nodes', () => {
    const files = [
      {
        filePath: 'src/components/Button.tsx',
        totalCommitCount: 5,
        recentCommitCount: 2,
        frequencyScore: 0.4,
      },
      {
        filePath: 'src/utils/helpers.ts',
        totalCommitCount: 3,
        recentCommitCount: 1,
        frequencyScore: 0.2,
      },
    ];

    const result = buildTreeFromFiles(files);

    const srcNode = result.children!.find(c => c.name === 'src');
    expect(srcNode!.value).toBe(8); // 5 + 3

    const componentsNode = srcNode!.children!.find(c => c.name === 'components');
    expect(componentsNode!.value).toBe(5);

    const utilsNode = srcNode!.children!.find(c => c.name === 'utils');
    expect(utilsNode!.value).toBe(3);
  });

  it('handles deep nesting', () => {
    const files = [
      {
        filePath: 'a/b/c/d/file.txt',
        totalCommitCount: 1,
        recentCommitCount: 1,
        frequencyScore: 1,
      },
    ];

    const result = buildTreeFromFiles(files);

    let current = result;
    for (const part of ['a', 'b', 'c', 'd', 'file.txt']) {
      const child = current.children!.find(c => c.name === part);
      expect(child).toBeDefined();
      current = child!;
    }
    expect(current.isFile).toBe(true);
    expect(current.value).toBe(1);
  });

  it('handles empty file list', () => {
    const result = buildTreeFromFiles([]);

    expect(result.name).toBe('root');
    expect(result.children).toEqual([]);
    expect(result.value).toBe(0);
  });
});