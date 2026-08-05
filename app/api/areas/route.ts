import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { validateAreaFile } from '@/lib/areas/types';
import type { AreaFile } from '@/lib/areas/types';

const AREAS_DIR = '.git-explorer';
const AREAS_FILE = 'areas.json';

function getAreasFilePath(repoPath: string): string {
  return path.join(repoPath, AREAS_DIR, AREAS_FILE);
}

function validateRepoPath(repoPath: unknown): string | null {
  if (!repoPath || typeof repoPath !== 'string') {
    return 'repoPath is required';
  }
  const gitDir = path.join(repoPath, '.git');
  if (!fs.existsSync(gitDir)) {
    return 'Path does not contain a .git directory';
  }
  return null;
}

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

  const { action, repoPath } = body;

  const pathError = validateRepoPath(repoPath);
  if (pathError) {
    return NextResponse.json(
      { success: false, error: pathError },
      { status: 400 },
    );
  }

  const filePath = getAreasFilePath(repoPath as string);

  if (action === 'load') {
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({
        success: true,
        data: { version: 1, areas: [] } as AreaFile,
      });
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      const validation = validateAreaFile(parsed);
      if (!validation.valid) {
        return NextResponse.json(
          { success: false, error: `Invalid areas file: ${validation.errors.join(', ')}` },
          { status: 400 },
        );
      }
      return NextResponse.json({ success: true, data: parsed as AreaFile });
    } catch (err) {
      return NextResponse.json(
        { success: false, error: 'Failed to read areas file' },
        { status: 500 },
      );
    }
  }

  if (action === 'save') {
    const data = body.data as AreaFile | undefined;
    if (!data) {
      return NextResponse.json(
        { success: false, error: 'data field is required for save action' },
        { status: 400 },
      );
    }

    const validation = validateAreaFile(data);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: `Invalid area data: ${validation.errors.join(', ')}` },
        { status: 400 },
      );
    }

    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
      return NextResponse.json({ success: true });
    } catch (err) {
      return NextResponse.json(
        { success: false, error: 'Failed to write areas file' },
        { status: 500 },
      );
    }
  }

  return NextResponse.json(
    { success: false, error: `Unknown action: ${action}` },
    { status: 400 },
  );
}
