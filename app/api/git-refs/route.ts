import { NextRequest, NextResponse } from 'next/server';
import { execFileSync } from 'child_process';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const repoPath = searchParams.get('repoPath');
  const sha = searchParams.get('sha');

  if (!repoPath) {
    return NextResponse.json(
      { success: false, error: 'repoPath query parameter is required' },
      { status: 400 },
    );
  }

  // Validate repoPath exists and is a git repo
  try {
    execFileSync('git', ['rev-parse', '--git-dir'], {
      cwd: repoPath,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch {
    return NextResponse.json(
      { success: false, error: `Not a git repository: ${repoPath}` },
      { status: 404 },
    );
  }

  try {
    // List branches (alphabetical)
    const branchesRaw = execFileSync(
      'git',
      ['for-each-ref', '--format=%(refname:short)', 'refs/heads'],
      { cwd: repoPath, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    );
    const branches = branchesRaw.trim().split('\n').filter(Boolean);

    // List tags (most recent first)
    const tagsRaw = execFileSync(
      'git',
      ['for-each-ref', '--sort=-creatordate', '--format=%(refname:short)', 'refs/tags'],
      { cwd: repoPath, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    );
    const tags = tagsRaw.trim().split('\n').filter(Boolean);

    // Determine default branch
    let defaultBranch: string | null = null;
    if (branches.includes('main')) {
      defaultBranch = 'main';
    } else if (branches.includes('master')) {
      defaultBranch = 'master';
    } else if (branches.length > 0) {
      defaultBranch = branches[0];
    }

    // Get current branch
    let currentBranch: string | null = null;
    try {
      const branchOut = execFileSync(
        'git',
        ['branch', '--show-current'],
        { cwd: repoPath, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
      );
      currentBranch = branchOut.trim() || null;
    } catch {
      // detached HEAD
    }

    const data: {
      branches: string[];
      tags: string[];
      defaultBranch: string | null;
      currentBranch: string | null;
      sha?: { input: string; valid: boolean; resolved: string | null };
    } = {
      branches,
      tags,
      defaultBranch,
      currentBranch,
    };

    // Optional SHA validation
    if (sha) {
      try {
        const resolved = execFileSync(
          'git',
          ['rev-parse', '--verify', `${sha}^{commit}`],
          { cwd: repoPath, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
        ).trim();
        data.sha = { input: sha, valid: true, resolved };
      } catch {
        data.sha = { input: sha, valid: false, resolved: null };
      }
    }

    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    const error = err as { message?: string };
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to list refs' },
      { status: 500 },
    );
  }
}