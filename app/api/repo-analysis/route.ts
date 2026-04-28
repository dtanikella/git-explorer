import { NextRequest, NextResponse } from 'next/server';
import { analyzeRepo } from '@/app/services/analysis/controller';
import { AnalysisError, UnsupportedLanguageError } from '@/lib/analysis/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
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
