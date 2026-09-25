import { NextRequest, NextResponse } from 'next/server';
import { runDiffPipeline } from '@/lib/diff/pipeline';

/**
 * `POST /api/diff`: Runs the diff pipeline for a repository commit.
 *
 * @remarks
 * Accepts a repo path and optional commit SHA (HEAD if omitted). Executes
 * the full diff pipeline and returns file-level diff results. Responds 200
 * on success, 400 on bad request, and 500 on unexpected errors.
 *
 * @param request - JSON body with `repoPath` (string, required) and optional
 *   `commitSha` (string).
 * @returns A JSON response with the diff pipeline result.
 * @see {@link runDiffPipeline}
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, state: 'error', code: 'BAD_REQUEST', error: 'Invalid JSON' },
      { status: 400 },
    );
  }

  const { repoPath, base, compare, hideTestFiles } = body;

  if (!repoPath || typeof repoPath !== 'string') {
    return NextResponse.json(
      { success: false, state: 'error', code: 'BAD_REQUEST', error: 'repoPath is required' },
      { status: 400 },
    );
  }

  if (!base || typeof base !== 'string') {
    return NextResponse.json(
      { success: false, state: 'error', code: 'BAD_REQUEST', error: 'base ref is required' },
      { status: 400 },
    );
  }

  if (!compare || typeof compare !== 'string') {
    return NextResponse.json(
      { success: false, state: 'error', code: 'BAD_REQUEST', error: 'compare ref is required' },
      { status: 400 },
    );
  }

  const hideTestFilesOption: boolean = hideTestFiles !== undefined
    ? Boolean(hideTestFiles)
    : true;

  const result = await runDiffPipeline({
    repoPath,
    base,
    compare,
    hideTestFiles: hideTestFilesOption,
  });

  // Map error codes to HTTP status codes
  let status = 200;
  if (!result.success) {
    switch (result.code) {
      case 'BAD_REQUEST':
        status = 400;
        break;
      case 'BAD_REF':
        status = 404;
        break;
      case 'DIFFT_MISSING':
      case 'DIFFT_TOO_OLD':
        status = 503;
        break;
      case 'ANALYSIS_FAILED':
        status = 500;
        break;
      default:
        status = 500;
    }
  }

  return NextResponse.json(result, { status });
}