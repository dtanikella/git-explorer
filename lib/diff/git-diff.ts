import { execFileSync } from 'child_process';
import { isTestFile } from '@/app/services/analysis/test-file-detector';
import { runDifftastic, type DifftasticFileResult } from './difftastic';

export type ChangedFile = {
  status: 'added' | 'deleted' | 'modified';
  path: string;                  // repo-relative, same on both sides for modified
  ext: '.ts' | '.tsx';
  oldSource?: string;            // absent for added
  newSource?: string;            // absent for deleted
  difft?: DifftasticFileResult;  // filled for modified only
};

function resolveRef(repo: string, ref: string): string {
  const sha = execFileSync('git', ['rev-parse', '--verify', `${ref}^{commit}`], {
    cwd: repo,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
  return sha;
}

function showBlob(repo: string, sha: string, path: string): string {
  const out = execFileSync('git', ['show', `${sha}:${path}`], {
    cwd: repo,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return out;
}

function getExt(path: string): '.ts' | '.tsx' | null {
  if (path.endsWith('.tsx')) return '.tsx';
  if (path.endsWith('.ts')) return '.ts';
  return null;
}

/**
 * List changed TypeScript files between two commits and run difftastic on modified ones.
 * @param repo absolute path of the repo
 * @param base resolved commit SHA
 * @param compare resolved commit SHA
 * @param options.hideTestFiles drop paths where isTestFile(path) is true
 */
export function listChangedTsFiles(
  repo: string,
  base: string,
  compare: string,
  options: { hideTestFiles: boolean },
): Promise<ChangedFile[]> {
  // Resolve both refs
  const baseSha = resolveRef(repo, base);
  const compareSha = resolveRef(repo, compare);

  // Run git diff --name-status --no-renames -z
  const raw = execFileSync(
    'git',
    ['diff', '--name-status', '--no-renames', '-z', baseSha, compareSha],
    { cwd: repo, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
  );

  // Parse NUL-separated output: status\0path\0status\0path\0...
  const tokens = raw.split('\0').filter(Boolean);
  const changedFiles: ChangedFile[] = [];

  for (let i = 0; i + 1 < tokens.length; i += 2) {
    const status = tokens[i];
    const filePath = tokens[i + 1];

    const ext = getExt(filePath);
    if (!ext) continue;

    // Skip test files when hideTestFiles is true
    if (options.hideTestFiles && isTestFile(filePath)) continue;

    const changedStatus = mapGitStatus(status);
    if (!changedStatus) continue; // ignore other statuses

    const entry: ChangedFile = {
      status: changedStatus,
      path: filePath,
      ext,
    };

    if (changedStatus === 'added') {
      entry.newSource = showBlob(repo, compareSha, filePath);
    } else if (changedStatus === 'deleted') {
      entry.oldSource = showBlob(repo, baseSha, filePath);
    } else {
      // modified
      entry.oldSource = showBlob(repo, baseSha, filePath);
      entry.newSource = showBlob(repo, compareSha, filePath);
    }

    changedFiles.push(entry);
  }

  // Run difftastic on modified files
  return Promise.all(
    changedFiles.map(async (file) => {
      if (file.status === 'modified' && file.oldSource !== undefined && file.newSource !== undefined) {
        try {
          file.difft = await runDifftastic(file.oldSource, file.newSource, file.ext);
        } catch {
          // If difftastic fails on a specific file, skip it
        }
      }
      return file;
    }),
  );
}

function mapGitStatus(status: string): 'added' | 'deleted' | 'modified' | null {
  switch (status) {
    case 'A':
      return 'added';
    case 'D':
      return 'deleted';
    case 'M':
    case 'T':
      return 'modified';
    default:
      return null;
  }
}