import { NextRequest, NextResponse } from 'next/server';
import { buildTree } from '../../../lib/file-tree';
import { FileNode } from '../../../lib/types';

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  stats?: {
    totalFiles: number;
    totalFolders: number;
    totalSize: number;
  };
  error?: {
    code: string;
    message: string;
  };
}

function calculateStats(tree: FileNode): { totalFiles: number; totalFolders: number; totalSize: number } {
  let totalFiles = 0;
  let totalFolders = 0;

  function traverse(node: FileNode) {
    if (node.type === 'file') {
      totalFiles++;
    } else if (node.type === 'folder') {
      totalFolders++;
      if (node.children) {
        node.children.forEach(traverse);
      }
    }
  }

  traverse(tree);

  return {
    totalFiles,
    totalFolders,
    totalSize: tree.size,
  };
}

function getErrorResponse(error: Error): ApiResponse {
  const errorMessage = error.message.toLowerCase();

  if (errorMessage.includes('enoent') || errorMessage.includes('no such file')) {
    return {
      success: false,
      error: {
        code: 'PATH_NOT_FOUND',
        message: 'Path does not exist',
      },
    };
  }

  if (errorMessage.includes('enotdir') || errorMessage.includes('not a directory')) {
    return {
      success: false,
      error: {
        code: 'NOT_A_DIRECTORY',
        message: 'Path must be a directory',
      },
    };
  }

  if (errorMessage.includes('eaccess') || errorMessage.includes('permission denied')) {
    return {
      success: false,
      error: {
        code: 'PERMISSION_DENIED',
        message: 'Cannot read path: permission denied',
      },
    };
  }

  return {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  };
}

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  try {
    const body = await request.json();
    const { path } = body;

    // Validate path
    if (!path || typeof path !== 'string' || path.trim() === '') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'EMPTY_PATH',
            message: 'Please enter a path',
          },
        },
        { status: 400 }
      );
    }

    // Build the file tree
    const tree = await buildTree(path.trim());

    // Calculate statistics
    const stats = calculateStats(tree);

    return NextResponse.json({
      success: true,
      data: tree,
      stats,
    });
  } catch (error) {
    const errorResponse = getErrorResponse(error as Error);
    const status = errorResponse.error?.code === 'INTERNAL_ERROR' ? 500 : 400;

    return NextResponse.json(errorResponse, { status });
  }
}