import { readdir, stat } from 'fs/promises';
import { join, extname, basename } from 'path';
import { FileNode, FileTree } from './types';

export async function buildTree(dirPath: string): Promise<FileTree> {
  const stats = await stat(dirPath);
  const name = basename(dirPath);

  if (!stats.isDirectory()) {
    throw new Error('Path must be a directory');
  }

  const entries = await readdir(dirPath, { withFileTypes: true });
  const children = await Promise.all(
    entries
      .filter(e => !e.name.startsWith('.'))  // Skip hidden files
      .map(e => buildTreeNode(join(dirPath, e.name)))
  );

  return {
    path: dirPath,
    name,
    type: 'folder',
    size: children.reduce((sum, c) => sum + c.size, 0),
    extension: '',
    children,
    metadata: {},
  };
}

async function buildTreeNode(filePath: string): Promise<FileNode> {
  const stats = await stat(filePath);
  const name = basename(filePath);

  if (stats.isDirectory()) {
    const entries = await readdir(filePath, { withFileTypes: true });
    const children = await Promise.all(
      entries
        .filter(e => !e.name.startsWith('.'))  // Skip hidden files
        .map(e => buildTreeNode(join(filePath, e.name)))
    );

    return {
      path: filePath,
      name,
      type: 'folder',
      size: children.reduce((sum, c) => sum + c.size, 0),
      extension: '',
      children,
      metadata: {},
    };
  } else {
    return {
      path: filePath,
      name,
      type: 'file',
      size: stats.size,
      extension: extname(name),
      metadata: {},
    };
  }
}