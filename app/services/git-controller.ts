import { getCommits, getCoChangeGraph } from '../../lib/git/analyzer';
import { createTimeRangeConfig } from '../../lib/utils/date-helpers';
import { TimeRangePreset, CoChangeGraph } from '../../lib/git/types';

export async function analyzeRepository(repoPath: string, timeRange: TimeRangePreset = '2w') {
  const timeConfig = createTimeRangeConfig(timeRange);
  const commits = await getCommits(repoPath, timeConfig);

  const graphData = buildForceDirectedGraphData(commits);
  const packingData = buildPackingGraphData(commits);


  return {
    ...graphData,
    packingData: packingData,
  };
}

function buildForceDirectedGraphData(commits: Array<{ files: string[] }>) {
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

// Build a hierarchical tree structure for circle packing, similar to flare-2.json
export function buildPackingGraphData(commits: Array<{ files: string[] }>) {
  // Helper to insert a file path into the tree
  function insertPath(root: any, path: string, value: number) {
    const parts = path.split('/');
    let node = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      let child = node.children.find((c: any) => c.name === part);
      if (!child) {
        child = { name: part, children: [] };
        node.children.push(child);
      }
      node = child;
    }
    // At leaf, set value
    if (!node.value) node.value = 0;
    node.value += value;
  }

  // Count commits per file
  const fileCommitCounts = new Map<string, number>();
  for (const commit of commits) {
    for (const file of commit.files) {
      fileCommitCounts.set(file, (fileCommitCounts.get(file) || 0) + 1);
    }
  }

  // Build tree
  const tree = { name: 'root', children: [] };
  for (const [file, count] of fileCommitCounts.entries()) {
    insertPath(tree, file, count);
  }

  // Recursively clean up tree: remove empty children, sum values for folders
  function finalize(node: any) {
    if (node.children && node.children.length > 0) {
      node.children = node.children.map(finalize);
      node.value = node.children.reduce((sum: number, c: any) => sum + (c.value || 0), 0);
      // Remove children if all are leaves with value
      if (node.children.every((c: any) => !c.children || c.children.length === 0)) {
        node.children = node.children.filter((c: any) => c.value);
      }
    }
    return node;
  }
  return finalize(tree);
}

export function buildMultiLineGraphData(commits: Array<{ date: string, files: Array<{ file: string, additions: number, deletions: number }> }>) {
  const result: Record<string, Array<{ timestamp: string, linesChanged: number }>> = {};
  for (const commit of commits) {
    const { date, files } = commit;
    for (const fileStat of files) {
      const { file, additions, deletions } = fileStat;
      const linesChanged = additions + deletions;
      if (!result[file]) {
        result[file] = [];
      }
      result[file].push({ timestamp: date, linesChanged });
    }
  }
  return result;
}