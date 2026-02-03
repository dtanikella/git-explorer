import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { analyzeRepository } from '../../services/git-controller';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { repoPath, timeRange } = body;

    // Basic validation
    if (!repoPath || typeof repoPath !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Repository path is required' },
        { status: 400 }
      );
    }

    // Default timeRange to '2w' if not provided or invalid
    const validRanges = ['2w', '1m', '3m', '6m', '1y'];
    const finalTimeRange = validRanges.includes(timeRange) ? timeRange : '2w';

    // Repository validation
    try {
      await fs.access(repoPath);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Repository path does not exist' },
        { status: 404 }
      );
    }

    const gitPath = path.join(repoPath, '.git');
    try {
      await fs.access(gitPath);
    } catch {
      return NextResponse.json(
        { success: false, error: 'The selected folder is not a git repository' },
        { status: 400 }
      );
    }

    // Perform git analysis using service
    const startTime = Date.now();
    let graphData;
    try {
      graphData = await analyzeRepository(repoPath, finalTimeRange);
    } catch (gitError: any) {
      console.error('API: Git operation failed:', gitError);
      if (gitError.message && (
        gitError.message.includes('git') && 
        (gitError.message.includes('not found') || 
         gitError.message.includes('not installed') ||
         gitError.message.includes('command not found'))
      )) {
        return NextResponse.json(
          { success: false, error: 'Git is required. Please install git and try again.' },
          { status: 500 }
        );
      }
      throw gitError;
    }

    const analysisDuration = Date.now() - startTime;

    // Handle case where no nodes (no commits/files)
    if (!graphData.nodes || graphData.nodes.length === 0) {
      return NextResponse.json({
        success: true,
        data: graphData,
        metadata: {
          totalFilesAnalyzed: 0,
          filesDisplayed: 0,
          timeRange: finalTimeRange,
          analysisDurationMs: analysisDuration,
          totalCommits: 0,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: graphData,
      metadata: {
        totalFilesAnalyzed: graphData.nodes.length,
        filesDisplayed: graphData.nodes.length,
        timeRange: finalTimeRange,
        analysisDurationMs: analysisDuration,
        totalCommits: graphData.links.length,
      },
    });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

