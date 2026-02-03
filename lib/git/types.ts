// Co-change graph types for force-directed graph
export interface CoChangeNode {
  id: string;         // file name or path
  group: string;      // filetype (extension)
  radius: number;     // frequency of commits
}

export interface CoChangeLink {
  source: string;     // file A
  target: string;     // file B
  value: number;      // co-commit frequency
}

export interface CoChangeGraph {
  nodes: CoChangeNode[];
  links: CoChangeLink[];
}
// TypeScript interfaces for git treemap feature

export interface RepositoryInput {
  repoPath: string;
  timeRange: TimeRangePreset;
}

export type TimeRangePreset = '2w' | '1m' | '3m' | '6m' | '1y';

export interface TimeRangeConfig {
  startDate: Date;
  endDate: Date;
  midpoint: Date;
  label: string;
  preset: TimeRangePreset;
}

export interface CommitRecord {
  sha: string;
  date: Date;
  files: string[];
}

export interface FileCommitData {
  filePath: string;
  totalCommitCount: number;
  recentCommitCount: number;
  frequencyScore: number;
}

export interface AnalysisMetadata {
  totalFilesAnalyzed: number;
  filesDisplayed: number;
  totalCommits: number;
  timeRange: string;
  analysisDurationMs: number;
}

export interface TreeNode {
  name: string;
  path: string;
  value: number;
  children?: TreeNode[];
  isFile: boolean;
  color?: string;
  fileData?: FileCommitData;
}

export interface GraphNode {
  id: string;
  name?: string;
  path?: string;
  value?: number;
}

export interface GraphLink {
  source: string;
  target: string;
  value: number;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}
