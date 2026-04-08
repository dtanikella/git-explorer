import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { analyzeTypeScriptRepo } from '@/lib/ts/analyzer';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { repoPath } = body;

    if (!repoPath || typeof repoPath !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Repository path is required' },
        { status: 400 }
      );
    }

    try {
      await fs.access(repoPath);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Repository path does not exist' },
        { status: 404 }
      );
    }

    const tsconfigPath = path.join(repoPath, 'tsconfig.json');
    try {
      await fs.access(tsconfigPath);
    } catch {
      return NextResponse.json(
        { success: false, error: 'No tsconfig.json found in the repository' },
        { status: 400 }
      );
    }

    const startTime = Date.now();
    const data = analyzeTypeScriptRepo(repoPath);
    const analysisDurationMs = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      data,
      metadata: {
        nodeCount: data.nodes.length,
        edgeCount: data.edges.length,
        analysisDurationMs,
      },
    });
  } catch (error) {
    console.error('TS Analysis API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
