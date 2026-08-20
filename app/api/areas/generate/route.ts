import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { analyzeRepo } from '@/app/services/analysis/controller';
import { buildCommunityGraph } from '@/lib/analysis/communities/graph';
import { buildHierarchy } from '@/lib/analysis/communities/hierarchy';
import { detectCommunities } from '@/lib/analysis/communities/detect';
import { communitiesToAreas } from '@/lib/analysis/communities/toAreas';
import { validateAreaFile, type AreaFile } from '@/lib/areas/types';

// ── Resolution sweep (Phase-2 judgment call, documented) ──
// A small fixed set is used for the hierarchy dendrogram (§1.3). More levels
// deepen the parent-link tree (each level's communities become areas/anchors)
// at a linear cost per level; these three span coarse→fine and keep the parent
// chain shallow enough to read. Retuning is a one-line edit (auto-tuning of the
// knob is explicitly deferred).
export const HIERARCHY_RESOLUTIONS = [0.6, 1.0, 1.8];

// Same persistence paths as the existing `/api/areas` route (not edited here;
// this regenerate route reuses the same on-disk layout so output is just
// another `areas.json`).
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

/**
 * Load the previously-saved areas (for ID continuity across regenerations).
 * Missing/invalid files yield an empty previous set — generation still works,
 * it just mints fresh ids.
 */
function loadPreviousAreas(filePath: string): AreaFile {
  if (!fs.existsSync(filePath)) {
    return { version: 1, areas: [] };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const validation = validateAreaFile(parsed);
    if (!validation.valid) {
      console.error('generate/areas: previous areas file invalid, treating as empty', validation.errors);
      return { version: 1, areas: [] };
    }
    return parsed as AreaFile;
  } catch {
    return { version: 1, areas: [] };
  }
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

  const { repoPath } = body;
  const pathError = validateRepoPath(repoPath);
  if (pathError) {
    return NextResponse.json({ success: false, error: pathError }, { status: 400 });
  }

  const hideTestFiles: boolean = body.hideTestFiles !== undefined ? Boolean(body.hideTestFiles) : true;
  const filePath = getAreasFilePath(repoPath as string);
  const previousAreas = loadPreviousAreas(filePath);

  // Detection is expensive over a real call graph; surface failures as a 500
  // WITHOUT touching the existing areas.json (persisted only after success).
  try {
    const analysis = await analyzeRepo(repoPath as string, { hideTestFiles });

    const graph = buildCommunityGraph(analysis.nodes, analysis.edges);
    const hierarchy = buildHierarchy(graph, HIERARCHY_RESOLUTIONS);
    const partition =
      hierarchy.length > 0
        ? hierarchy[hierarchy.length - 1].partition // finest level (all levels are emitted by toAreas)
        : detectCommunities(graph, HIERARCHY_RESOLUTIONS[HIERARCHY_RESOLUTIONS.length - 1]);

    const areas = communitiesToAreas(partition, hierarchy, previousAreas.areas);
    const data: AreaFile = { version: 1, areas };

    const validation = validateAreaFile(data);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: `Generated areas failed validation: ${validation.errors.join(', ')}` },
        { status: 500 },
      );
    }

    // Persist through the same layout the existing save action uses.
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Area generation API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate areas' },
      { status: 500 },
    );
  }
}