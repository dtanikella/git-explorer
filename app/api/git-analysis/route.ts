import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { getCommits, countCommitsByFile, filterTopFiles, calculateFrequencyScores } from '@/lib/git/analyzer';
import { buildTreeFromFiles } from '@/lib/git/tree-builder';
import { applyColors } from '@/lib/treemap/data-transformer';
import { createTimeRangeConfig } from '@/lib/utils/date-helpers';
import { TimeRangePreset } from '@/lib/git/types';

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

    if (!timeRange || !['2w', '1m', '3m', '6m', '1y'].includes(timeRange)) {
      return NextResponse.json(
        { success: false, error: 'Invalid time range' },
        { status: 400 }
      );
    }

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

    // Perform git analysis
    const startTime = Date.now();
    const timeConfig = createTimeRangeConfig(timeRange as TimeRangePreset);

    let commits: any[];
    try {
      commits = await getCommits(repoPath, timeConfig);
    } catch (gitError: any) {
      console.error('API: Git operation failed:', gitError);
      
      // Check if it's a git binary not found error
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
      
      // Re-throw other git errors
      throw gitError;
    }

    // Handle case where no commits found in the selected time range
    if (commits.length === 0) {
      const analysisDuration = Date.now() - startTime;
      return NextResponse.json({
        success: true,
        data: {
          name: 'root',
          path: '',
          value: 0,
          isFile: false,
          children: []
        },
        metadata: {
          totalFilesAnalyzed: 0,
          filesDisplayed: 0,
          timeRange: timeConfig.label,
          analysisDurationMs: analysisDuration,
          totalCommits: 0,
        },
      });
    }

    const fileCommitData = countCommitsByFile(commits, timeConfig);
    const topFiles = filterTopFiles(fileCommitData);
    const scoredFiles = calculateFrequencyScores(topFiles);
    const treeData = buildTreeFromFiles(scoredFiles);
    const coloredTree = applyColors(treeData);

    const analysisDuration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      data: coloredTree,
      metadata: {
        totalFilesAnalyzed: fileCommitData.length,
        filesDisplayed: topFiles.length,
        timeRange: timeConfig.label,
        analysisDurationMs: analysisDuration,
        totalCommits: commits.length,
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

