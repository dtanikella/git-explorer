import { applyColors } from '@/lib/treemap/data-transformer';

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