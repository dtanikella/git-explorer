import { getCommits, getCoChangeGraph } from '../../lib/git/analyzer';
import { createTimeRangeConfig } from '../../lib/utils/date-helpers';
import { TimeRangePreset, CoChangeGraph } from '../../lib/git/types';

export async function analyzeRepository(repoPath: string, timeRange: TimeRangePreset = '2w') {
  const timeConfig = createTimeRangeConfig(timeRange);
  const commits = await getCommits(repoPath, timeConfig);

  // Build file commit counts and file types
  const fileCommitCounts = new Map<string, number>();
  const fileTypes = new Map<string, string>();
  const coCommitCounts = new Map<string, number>();

  // Helper to get file extension
  function getFileType(filePath: string): string {
    const parts = filePath.split('.');
    return parts.length > 1 ? parts[parts.length - 1] : 'other';
  }

  for (const commit of commits) {
    // Count file commits
    for (const file of commit.files) {
      fileCommitCounts.set(file, (fileCommitCounts.get(file) || 0) + 1);
      if (!fileTypes.has(file)) {
        fileTypes.set(file, getFileType(file));
      }
    }
    // Count co-commits (unordered pairs)
    const files = Array.from(new Set(commit.files));
    for (let i = 0; i < files.length; i++) {
      for (let j = i + 1; j < files.length; j++) {
        const [a, b] = files[i] < files[j] ? [files[i], files[j]] : [files[j], files[i]];
        const key = `${a}|||${b}`;
        coCommitCounts.set(key, (coCommitCounts.get(key) || 0) + 1);
      }
    }
  }

  // Build nodes
  const nodes = Array.from(fileCommitCounts.entries()).map(([file, count]) => ({
    id: file,
    filename: file.split('/').pop() || file,
    radius: count,
  }));

  // Build links
  const links = Array.from(coCommitCounts.entries()).map(([key, value]) => {
    const [source, target] = key.split('|||');
    return { source, target, value };
  });

  return { nodes, links };
}
