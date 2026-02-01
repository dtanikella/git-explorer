import simpleGit from 'simple-git';
import { CommitRecord, TimeRangeConfig, FileCommitData } from './types';

export async function getCommits(
  repoPath: string,
  timeRange: TimeRangeConfig
): Promise<CommitRecord[]> {
  const git = simpleGit(repoPath);

  // Use raw output to properly parse files
  const logOutput = await git.raw([
    'log',
    '--name-only',
    `--since=${timeRange.startDate.toISOString()}`,
    `--until=${timeRange.endDate.toISOString()}`,
    '--pretty=format:%H|%aI',
  ]);

  const commits: CommitRecord[] = [];
  const lines = logOutput.split('\n');
  let currentCommit: CommitRecord | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check if this is a commit line (contains |)
    if (trimmed.includes('|')) {
      // Save previous commit
      if (currentCommit) {
        commits.push(currentCommit);
      }
      // Start new commit
      const [sha, dateStr] = trimmed.split('|');
      currentCommit = {
        sha,
        date: new Date(dateStr),
        files: [],
      };
    } else if (currentCommit) {
      // This is a file name
      currentCommit.files.push(trimmed);
    }
  }

  // Don't forget the last commit
  if (currentCommit) {
    commits.push(currentCommit);
  }

  return commits;
}

export function countCommitsByFile(
  commits: CommitRecord[],
  timeRange: TimeRangeConfig
): FileCommitData[] {
  const fileMap = new Map<string, Set<string>>();

  // Group commits by file, tracking unique SHAs
  for (const commit of commits) {
    for (const file of commit.files) {
      if (!fileMap.has(file)) {
        fileMap.set(file, new Set());
      }
      fileMap.get(file)!.add(commit.sha);
    }
  }

  // Convert to FileCommitData
  const result: FileCommitData[] = [];
  for (const [filePath, shaSet] of fileMap) {
    const totalCommitCount = shaSet.size;
    const recentCommitCount = Array.from(shaSet).filter(sha => {
      const commit = commits.find(c => c.sha === sha);
      return commit && commit.date >= timeRange.midpoint;
    }).length;

    result.push({
      filePath,
      totalCommitCount,
      recentCommitCount,
      frequencyScore: 0, // Will be calculated later
    });
  }

  return result;
}

export function filterTopFiles(files: FileCommitData[]): FileCommitData[] {
  return files
    .sort((a, b) => {
      // Sort by totalCommitCount descending
      if (a.totalCommitCount !== b.totalCommitCount) {
        return b.totalCommitCount - a.totalCommitCount;
      }
      // Tiebreaker: alphabetical by filePath
      return a.filePath.localeCompare(b.filePath);
    })
    .slice(0, 100);
}

export function calculateFrequencyScores(files: FileCommitData[]): FileCommitData[] {
  if (files.length === 0) return files;

  const maxRecent = Math.max(...files.map(f => f.recentCommitCount));
  if (maxRecent === 0) {
    return files.map(f => ({ ...f, frequencyScore: 0 }));
  }

  return files.map(f => ({
    ...f,
    frequencyScore: f.recentCommitCount / maxRecent,
  }));
}