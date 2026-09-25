import { writeFileSync, mkdtempSync, rmSync } from 'fs';
import { execFile, execFileSync } from 'child_process';
import { createRequire } from 'module';
import { tmpdir } from 'os';
import { join } from 'path';

// --------------- difftastic JSON types ---------------

export interface DifftasticChunkSpan {
  start: number;
  end: number;
  content: string;
  highlight: string;
}

export interface DifftasticSide {
  line_number: number;
  changes: DifftasticChunkSpan[];
}

export interface DifftasticFileResult {
  status: 'changed' | 'created' | 'deleted' | 'unchanged';
  language: string;
  path: string;
  aligned_lines: [number | null, number | null][];
  chunks: { lhs?: DifftasticSide; rhs?: DifftasticSide }[][];
}

// --------------- error class ---------------

/** Thrown when difft is missing or older than the minimum version. */
export class DifftUnavailableError extends Error {
  readonly code: 'DIFFT_MISSING' | 'DIFFT_TOO_OLD';

  constructor(message: string, code: 'DIFFT_MISSING' | 'DIFFT_TOO_OLD') {
    super(message);
    this.name = 'DifftUnavailableError';
    this.code = code;
    Object.setPrototypeOf(this, DifftUnavailableError.prototype);
  }
}

// --------------- requirement loading ---------------

interface DifftRequirement {
  minVersion: string;
  install: string[];
}

const _nativeRequire = createRequire(join(process.cwd(), 'package.json'));

function getRequirement(): DifftRequirement {
  return _nativeRequire('./lib/diff/difft-requirement.json') as DifftRequirement;
}

// --------------- version check ---------------

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (pa[i] > pb[i]) return 1;
    if (pa[i] < pb[i]) return -1;
  }
  return 0;
}

function checkDifftasticAvailable(): void {
  const req = getRequirement();
  const difftPath = process.env.DIFFT_PATH || 'difft';

  let version: string;
  try {
    const out = execFileSync(difftPath, ['--version'], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const match = out.trim().match(/Difftastic\s+(\d+\.\d+\.\d+)/);
    if (!match) throw new Error('Unrecognized version output');
    version = match[1];
  } catch {
    throw new DifftUnavailableError(
      `difftastic >= ${req.minVersion} not found on PATH. Install with: ${req.install.join(' or ')}`,
      'DIFFT_MISSING',
    );
  }

  if (compareVersions(version, req.minVersion) < 0) {
    throw new DifftUnavailableError(
      `difftastic >= ${req.minVersion} not found on PATH. Install with: ${req.install.join(' or ')}`,
      'DIFFT_TOO_OLD',
    );
  }
}

// --------------- run difftastic ---------------

/**
 * Diff two versions of one file with difftastic.
 * @param oldSource exact blob text at the base commit
 * @param newSource exact blob text at the compare commit
 * @param ext extension used for temp files so difft picks the correct grammar
 * @throws DifftUnavailableError when difft is missing or below 0.71.0
 */
export function runDifftastic(
  oldSource: string,
  newSource: string,
  ext: '.ts' | '.tsx',
): Promise<DifftasticFileResult> {
  checkDifftasticAvailable();

  const difftPath = process.env.DIFFT_PATH || 'difft';
  const tmpDir = mkdtempSync(join(tmpdir(), 'git-explorer-difft-'));
  const oldFile = join(tmpDir, `old${ext}`);
  const newFile = join(tmpDir, `new${ext}`);

  writeFileSync(oldFile, oldSource, 'utf8');
  writeFileSync(newFile, newSource, 'utf8');

  return new Promise((resolve, reject) => {
    execFile(
      difftPath,
      ['--display', 'json', oldFile, newFile],
      {
        env: { ...process.env, DFT_UNSTABLE: 'yes' },
        encoding: 'utf8',
        maxBuffer: 50 * 1024 * 1024,
      },
      (err, stdout, stderr) => {
        // Cleanup temp files
        try {
          rmSync(tmpDir, { recursive: true, force: true });
        } catch {
          // best effort cleanup
        }

        if (err) {
          reject(
            new DifftUnavailableError(
              `difftastic exited with error: ${stderr || err.message}`,
              'DIFFT_MISSING',
            ),
          );
          return;
        }

        try {
          // difftastic outputs one JSON object per file pair
          const result = JSON.parse(stdout.trim());
          const fileResult: DifftasticFileResult = Array.isArray(result)
            ? result[0]
            : result;
          resolve(fileResult);
        } catch {
          reject(new Error(`Failed to parse difftastic JSON output: ${stdout.slice(0, 200)}`));
        }
      },
    );
  });
}