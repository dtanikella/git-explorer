import {
  getCommits,
  countCommitsByFile,
  filterTopFiles,
  calculateFrequencyScores,
} from '@/lib/git/analyzer';
import { TimeRangeConfig } from '@/lib/git/types';

// Mock simple-git
jest.mock('simple-git', () => jest.fn().mockReturnValue({
  log: jest.fn(),
  raw: jest.fn(),
}));

const simpleGit = require('simple-git');

describe('getCommits', () => {
  it('parses git log output correctly', async () => {
    const mockGit = simpleGit('/fake/repo');
    mockGit.raw.mockResolvedValue(
      'abc123|2026-01-20T10:00:00.000Z\nsrc/App.tsx\nsrc/utils.ts\n\ndef456|2026-01-25T10:00:00.000Z\nsrc/App.tsx'
    );

    const timeRange: TimeRangeConfig = {
      startDate: new Date('2026-01-15T00:00:00.000Z'),
      endDate: new Date('2026-01-31T23:59:59.999Z'),
      midpoint: new Date('2026-01-23T12:00:00.000Z'),
      label: 'Last 2 weeks',
      preset: '2w',
    };

    const result = await getCommits('/fake/repo', timeRange);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      sha: 'abc123',
      date: new Date('2026-01-20T10:00:00.000Z'),
      files: ['src/App.tsx', 'src/utils.ts'],
    });
    expect(result[1]).toEqual({
      sha: 'def456',
      date: new Date('2026-01-25T10:00:00.000Z'),
      files: ['src/App.tsx'],
    });
    expect(mockGit.raw).toHaveBeenCalledWith([
      'log',
      '--name-only',
      '--since=2026-01-15T00:00:00.000Z',
      '--until=2026-01-31T23:59:59.999Z',
      '--pretty=format:%H|%aI',
    ]);
  });

  it('filters commits by date range', async () => {
    const mockGit = simpleGit('/fake/repo');
    mockGit.raw.mockResolvedValue(
      'new456|2026-01-20T10:00:00.000Z\nfile.txt'
    );

    const timeRange: TimeRangeConfig = {
      startDate: new Date('2026-01-15T00:00:00.000Z'),
      endDate: new Date('2026-01-31T23:59:59.999Z'),
      midpoint: new Date('2026-01-23T12:00:00.000Z'),
      label: 'Last 2 weeks',
      preset: '2w',
    };

    const result = await getCommits('/fake/repo', timeRange);

    expect(result).toHaveLength(1);
    expect(result[0].sha).toBe('new456');
  });

  it('handles empty repository', async () => {
    const mockGit = simpleGit('/fake/repo');
    mockGit.raw.mockResolvedValue('');

    const timeRange: TimeRangeConfig = {
      startDate: new Date('2026-01-15T00:00:00.000Z'),
      endDate: new Date('2026-01-31T23:59:59.999Z'),
      midpoint: new Date('2026-01-23T12:00:00.000Z'),
      label: 'Last 2 weeks',
      preset: '2w',
    };

    const result = await getCommits('/fake/repo', timeRange);

    expect(result).toHaveLength(0);
  });
});

describe('countCommitsByFile', () => {
  it('counts unique commit SHAs per file', () => {
    const commits = [
      {
        sha: 'abc123',
        date: new Date('2026-01-20T10:00:00.000Z'),
        files: ['src/App.tsx', 'src/utils.ts'],
      },
      {
        sha: 'def456',
        date: new Date('2026-01-25T10:00:00.000Z'),
        files: ['src/App.tsx'],
      },
      {
        sha: 'ghi789',
        date: new Date('2026-01-26T10:00:00.000Z'),
        files: ['src/Button.tsx'],
      },
    ];

    const timeRange: TimeRangeConfig = {
      startDate: new Date('2026-01-15T00:00:00.000Z'),
      endDate: new Date('2026-01-31T23:59:59.999Z'),
      midpoint: new Date('2026-01-23T12:00:00.000Z'),
      label: 'Last 2 weeks',
      preset: '2w',
    };

    const result = countCommitsByFile(commits, timeRange);

    expect(result).toHaveLength(3);
    const appFile = result.find(f => f.filePath === 'src/App.tsx');
    expect(appFile).toEqual({
      filePath: 'src/App.tsx',
      totalCommitCount: 2,
      recentCommitCount: 1, // def456 is after midpoint
      frequencyScore: 0, // Will be set later
    });
    const utilsFile = result.find(f => f.filePath === 'src/utils.ts');
    expect(utilsFile).toEqual({
      filePath: 'src/utils.ts',
      totalCommitCount: 1,
      recentCommitCount: 0, // abc123 is before midpoint
      frequencyScore: 0,
    });
    const buttonFile = result.find(f => f.filePath === 'src/Button.tsx');
    expect(buttonFile).toEqual({
      filePath: 'src/Button.tsx',
      totalCommitCount: 1,
      recentCommitCount: 1,
      frequencyScore: 0,
    });
  });
});

describe('filterTopFiles', () => {
  it('returns top 500 files sorted by commit count', () => {
    const files = [
      { filePath: 'a.txt', totalCommitCount: 10, recentCommitCount: 5, frequencyScore: 0.5 },
      { filePath: 'b.txt', totalCommitCount: 20, recentCommitCount: 10, frequencyScore: 0.5 },
      { filePath: 'c.txt', totalCommitCount: 15, recentCommitCount: 7, frequencyScore: 0.5 },
    ];

    const result = filterTopFiles(files);

    expect(result).toHaveLength(3);
    expect(result[0].filePath).toBe('b.txt'); // 20 commits
    expect(result[1].filePath).toBe('c.txt'); // 15 commits
    expect(result[2].filePath).toBe('a.txt'); // 10 commits
  });

  it('uses alphabetical tiebreaker', () => {
    const files = [
      { filePath: 'z.txt', totalCommitCount: 10, recentCommitCount: 5, frequencyScore: 0.5 },
      { filePath: 'a.txt', totalCommitCount: 10, recentCommitCount: 5, frequencyScore: 0.5 },
    ];

    const result = filterTopFiles(files);

    expect(result[0].filePath).toBe('a.txt');
    expect(result[1].filePath).toBe('z.txt');
  });

  it('handles fewer than 500 files', () => {
    const files = [
      { filePath: 'a.txt', totalCommitCount: 10, recentCommitCount: 5, frequencyScore: 0.5 },
    ];

    const result = filterTopFiles(files);

    expect(result).toHaveLength(1);
  });
});

describe('calculateFrequencyScores', () => {
  it('normalizes recent commit counts to 0-1 range', () => {
    const files = [
      { filePath: 'a.txt', totalCommitCount: 10, recentCommitCount: 0, frequencyScore: 0 },
      { filePath: 'b.txt', totalCommitCount: 20, recentCommitCount: 5, frequencyScore: 0 },
      { filePath: 'c.txt', totalCommitCount: 15, recentCommitCount: 10, frequencyScore: 0 },
    ];

    const result = calculateFrequencyScores(files);

    expect(result[0].frequencyScore).toBe(0); // 0/10 = 0
    expect(result[1].frequencyScore).toBe(0.5); // 5/10 = 0.5
    expect(result[2].frequencyScore).toBe(1); // 10/10 = 1
  });

  it('handles max recent count of 0', () => {
    const files = [
      { filePath: 'a.txt', totalCommitCount: 10, recentCommitCount: 0, frequencyScore: 0 },
      { filePath: 'b.txt', totalCommitCount: 20, recentCommitCount: 0, frequencyScore: 0 },
    ];

    const result = calculateFrequencyScores(files);

    expect(result[0].frequencyScore).toBe(0);
    expect(result[1].frequencyScore).toBe(0);
  });

  it('handles empty array', () => {
    const result = calculateFrequencyScores([]);
    expect(result).toEqual([]);
  });
});