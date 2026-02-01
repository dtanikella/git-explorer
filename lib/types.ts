// Core data types for repository visualization

export interface FileNode {
  /** Absolute path to the file or folder */
  path: string;

  /** Name of the file or folder (basename) */
  name: string;

  /** Type discriminator */
  type: 'file' | 'folder';

  /** Size in bytes. For files: actual size. For folders: sum of children sizes */
  size: number;

  /** File extension including dot (e.g., ".ts"). Empty string for folders */
  extension: string;

  /** Child nodes. Only present for folders */
  children?: FileNode[];

  /** Extensible metadata bucket for future properties (git stats, etc.) */
  metadata: Record<string, unknown>;
}

/** The root node of the repository structure */
export type FileTree = FileNode & { type: 'folder'; children: FileNode[] };

/** A function that determines the numeric value used for circle radius calculation */
export type SizingStrategy = (node: FileNode) => number;

/** A function that determines the fill color for a circle */
export type ColoringStrategy = (node: FileNode) => string;

// API types

/** Request: Scan Repository */
export interface ScanRequest {
  /** Absolute path to the repository root */
  path: string;
}

/** Response: File Tree (Success) */
export interface ScanSuccessResponse {
  success: true;
  data: FileTree;
  stats: {
    totalFiles: number;
    totalFolders: number;
    totalSize: number;
  };
}

/** Response: Error */
export interface ScanErrorResponse {
  success: false;
  error: {
    code: 'PATH_NOT_FOUND' | 'NOT_A_DIRECTORY' | 'PERMISSION_DENIED' | 'EMPTY_PATH' | 'INTERNAL_ERROR';
    message: string;
  };
}

/** Union type for API responses */
export type ScanResponse = ScanSuccessResponse | ScanErrorResponse;