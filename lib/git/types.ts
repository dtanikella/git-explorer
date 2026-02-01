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

export interface TreeNode {
  name: string;
  path: string;
  value: number;
  children?: TreeNode[];
  isFile: boolean;
  color?: string;
  fileData?: FileCommitData;
}
