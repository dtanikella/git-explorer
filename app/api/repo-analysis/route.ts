import { NextRequest, NextResponse } from 'next/server';
import { analyzeRepo } from '@/app/services/analysis/controller';
import { AnalysisError, UnsupportedLanguageError } from '@/lib/analysis/types';

/**
 * `POST /api/repo-analysis`: Analyzes a repository and returns the
 * analysis result graph.
 *
 * @remarks
 * Responds 200 with the analysis result on success, 400 when the request
 * body is malformed or the path is invalid, 400 when the language is
 * unsupported, and 500 on unexpected errors.
 *
 * @param request - JSON body with `repoPath` (string, required) and
 *   optional `hideTestFiles` (boolean).
 * @returns A JSON response with `{ success, data }` on success, or
 *   `{ success: false, error }` on failure.
 * @see commit 4dff751
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON in request body' },
      { status: 400 },
    );
  }

  try {
    const { repoPath, hideTestFiles } = body;

    if (!repoPath || typeof repoPath !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Repository path is required' },
        { status: 400 },
      );
    }

    const hideTestFilesOption: boolean = hideTestFiles !== undefined ? Boolean(hideTestFiles) : true;

    const data = await analyzeRepo(repoPath, { hideTestFiles: hideTestFilesOption });

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    if (error instanceof UnsupportedLanguageError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 },
      );
    }

    if (error instanceof AnalysisError) {
      const status = error.message.includes('does not exist') ? 404 : 500;
      return NextResponse.json(
        { success: false, error: error.message },
        { status },
      );
    }

    console.error('Repo Analysis API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
