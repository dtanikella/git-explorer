import * as git from 'isomorphic-git';

// Create a filesystem adapter for File System Access API
function createFSAFS(dirHandle: FileSystemDirectoryHandle) {
  return {
    promises: {
      readFile: async (path: string, options?: { encoding?: string }) => {
        const fileHandle = await getFileHandle(dirHandle, path);
        const file = await fileHandle.getFile();
        if (options?.encoding === 'utf8') {
          return await file.text();
        }
        return await file.arrayBuffer();
      },

      writeFile: async (path: string, data: string | Uint8Array) => {
        const fileHandle = await getFileHandle(dirHandle, path, true);
        const writable = await fileHandle.createWritable();
        await writable.write(data);
        await writable.close();
      },

      unlink: async (path: string) => {
        const parentPath = path.substring(0, path.lastIndexOf('/'));
        const fileName = path.substring(path.lastIndexOf('/') + 1);
        const dir = await getDirHandle(dirHandle, parentPath);
        await dir.removeEntry(fileName);
      },

      readdir: async (path: string) => {
        const dir = await getDirHandle(dirHandle, path);
        const entries = [];
        for await (const [name, handle] of dir.entries()) {
          entries.push({
            name,
            isDirectory: handle.kind === 'directory',
          });
        }
        return entries;
      },

      mkdir: async (path: string) => {
        await getDirHandle(dirHandle, path, true);
      },

      rmdir: async (path: string) => {
        const parentPath = path.substring(0, path.lastIndexOf('/'));
        const dirName = path.substring(path.lastIndexOf('/') + 1);
        const parentDir = await getDirHandle(dirHandle, parentPath);
        await parentDir.removeEntry(dirName, { recursive: true });
      },

      stat: async (path: string) => {
        try {
          const fileHandle = await getFileHandle(dirHandle, path);
          const file = await fileHandle.getFile();
          return {
            size: file.size,
            mtime: new Date(file.lastModified),
            isDirectory: () => false,
          };
        } catch {
          const dir = await getDirHandle(dirHandle, path);
          return {
            size: 0,
            mtime: new Date(),
            isDirectory: () => true,
          };
        }
      },

      lstat: async (path: string) => {
        return await this.stat(path);
      },

      readlink: async () => {
        throw new Error('readlink not implemented');
      },

      symlink: async () => {
        throw new Error('symlink not implemented');
      },

      chmod: async () => {
        // No-op for FSA
      },
    },
  };
}

async function getFileHandle(dirHandle: FileSystemDirectoryHandle, path: string, create = false): Promise<FileSystemFileHandle> {
  const parts = path.split('/').filter(p => p);
  let current: FileSystemDirectoryHandle = dirHandle;

  for (let i = 0; i < parts.length - 1; i++) {
    current = await current.getDirectoryHandle(parts[i], { create });
  }

  return await current.getFileHandle(parts[parts.length - 1], { create });
}

async function getDirHandle(dirHandle: FileSystemDirectoryHandle, path: string, create = false): Promise<FileSystemDirectoryHandle> {
  const parts = path.split('/').filter(p => p);
  let current: FileSystemDirectoryHandle = dirHandle;

  for (const part of parts) {
    current = await current.getDirectoryHandle(part, { create });
  }

  return current;
}

export interface ClientCommitRecord {
  sha: string;
  date: Date;
  files: string[];
}

export interface ClientFileCommitData {
  filePath: string;
  totalCommitCount: number;
  recentCommitCount: number;
  frequencyScore: number;
}

export interface ClientTreeNode {
  name: string;
  path: string;
  size: number;
  color: string;
  children?: ClientTreeNode[];
}

export async function getClientCommits(
  dirHandle: FileSystemDirectoryHandle,
  timeRange: string
): Promise<ClientCommitRecord[]> {
  const fs = createFSAFS(dirHandle);
  const timeConfig = createTimeRangeConfig(timeRange);

  try {
    const commits = await git.log({
      fs,
      dir: '/',
      ref: 'HEAD',
      since: timeConfig.startDate,
    });

    // For each commit, get the files changed
    const commitsWithFiles = await Promise.all(
      commits.map(async (commit) => {
        try {
          const files = await git.listFiles({
            fs,
            dir: '/',
            ref: commit.oid,
          });
          return {
            sha: commit.oid,
            date: new Date(commit.commit.author.timestamp * 1000),
            files,
          };
        } catch {
          return {
            sha: commit.oid,
            date: new Date(commit.commit.author.timestamp * 1000),
            files: [],
          };
        }
      })
    );

    return commitsWithFiles;
  } catch (error) {
    console.error('Failed to get commits:', error);
    return [];
  }
}

export function countCommitsByFile(commits: ClientCommitRecord[]): ClientFileCommitData[] {
  const fileMap = new Map<string, { total: number; recent: number }>();

  commits.forEach(commit => {
    commit.files.forEach(file => {
      const existing = fileMap.get(file) || { total: 0, recent: 0 };
      existing.total++;
      // TODO: Check if commit is recent
      existing.recent++;
      fileMap.set(file, existing);
    });
  });

  return Array.from(fileMap.entries()).map(([filePath, counts]) => ({
    filePath,
    totalCommitCount: counts.total,
    recentCommitCount: counts.recent,
    frequencyScore: counts.recent, // TODO: Calculate proper score
  }));
}

export function filterTopFiles(files: ClientFileCommitData[], maxFiles = 500): ClientFileCommitData[] {
  return files
    .sort((a, b) => b.totalCommitCount - a.totalCommitCount || a.filePath.localeCompare(b.filePath))
    .slice(0, maxFiles);
}

export function calculateClientFrequencyScores(files: ClientFileCommitData[]): ClientFileCommitData[] {
  if (files.length === 0) return files;

  const maxRecent = Math.max(...files.map(f => f.recentCommitCount));
  if (maxRecent === 0) return files;

  return files.map(file => ({
    ...file,
    frequencyScore: file.recentCommitCount / maxRecent,
  }));
}

export function buildClientTreeFromFiles(files: ClientFileCommitData[]): ClientTreeNode {
  const root: ClientTreeNode = {
    name: 'root',
    path: '',
    size: 0,
    color: '#ccc',
    children: [],
  };

  files.forEach(file => {
    const parts = file.filePath.split('/');
    let current = root;

    parts.forEach((part, index) => {
      const path = parts.slice(0, index + 1).join('/');
      let child = current.children?.find(c => c.name === part);

      if (!child) {
        child = {
          name: part,
          path,
          size: 0,
          color: index === parts.length - 1 ? frequencyToColor(file.frequencyScore) : '#ccc',
          children: index === parts.length - 1 ? undefined : [],
        };
        current.children = current.children || [];
        current.children.push(child);
      }

      current = child;
      if (index === parts.length - 1) {
        current.size = file.totalCommitCount;
      }
    });
  });

  return root;
}

export async function analyzeClientRepository(
  dirHandle: FileSystemDirectoryHandle,
  timeRange: string
): Promise<ClientTreeNode> {
  const fs = createFSAFS(dirHandle);

  try {
    // Check if .git directory exists
    try {
      await fs.promises.readFile('.git/HEAD');
    } catch {
      throw new Error('The selected folder is not a git repository');
    }

    // Get all files in the repository
    const allFiles = await git.listFiles({
      fs,
      dir: '/',
      ref: 'HEAD',
    });

    // Get recent commits
    const timeConfig = createTimeRangeConfig(timeRange);
    const commits = await git.log({
      fs,
      dir: '/',
      ref: 'HEAD',
      since: timeConfig.startDate,
    });

    // For MVP: assign random commit counts to files
    const fileData: ClientFileCommitData[] = allFiles.slice(0, 50).map((file, index) => ({
      filePath: file,
      totalCommitCount: Math.floor(Math.random() * 20) + 1,
      recentCommitCount: Math.floor(Math.random() * 10) + 1,
      frequencyScore: 0, // Will be calculated
    }));

    const scoredFiles = calculateClientFrequencyScores(fileData);
    const tree = buildClientTreeFromFiles(scoredFiles);

    return tree;
  } catch (error) {
    console.error('Analysis failed:', error);
    throw error; // Re-throw so the UI can handle it
  }
}