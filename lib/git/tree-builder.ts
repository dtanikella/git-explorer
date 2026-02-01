import { FileCommitData, TreeNode } from './types';

export function buildTreeFromFiles(files: FileCommitData[]): TreeNode {
  const root: TreeNode = {
    name: 'root',
    path: '',
    value: 0,
    isFile: false,
    children: [],
  };

  const pathMap = new Map<string, TreeNode>();

  for (const file of files) {
    const parts = file.filePath.split('/');
    let currentPath = '';
    let currentNode = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      if (!pathMap.has(currentPath)) {
        const node: TreeNode = {
          name: part,
          path: currentPath,
          value: 0,
          isFile: i === parts.length - 1,
          children: i === parts.length - 1 ? undefined : [],
        };

        if (i === parts.length - 1) {
          node.fileData = file;
          node.color = undefined; // Will be set later
        }

        pathMap.set(currentPath, node);

        if (!currentNode.children) {
          currentNode.children = [];
        }
        currentNode.children.push(node);
      }

      currentNode = pathMap.get(currentPath)!;
    }
  }

  // Aggregate values
  function aggregateValues(node: TreeNode): number {
    if (node.isFile) {
      node.value = node.fileData!.totalCommitCount;
      return node.value;
    }

    let sum = 0;
    if (node.children) {
      for (const child of node.children) {
        sum += aggregateValues(child);
      }
    }
    node.value = sum;
    return sum;
  }

  aggregateValues(root);

  return root;
}