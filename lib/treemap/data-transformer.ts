import { TreeNode } from '../git/types';
import { frequencyToColor } from './color-scale';

export function applyColors(tree: TreeNode): TreeNode {
  function traverse(node: TreeNode): void {
    if (node.isFile && node.fileData) {
      node.color = frequencyToColor(node.fileData.frequencyScore);
    }

    if (node.children) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  const result = { ...tree }; // Shallow copy
  traverse(result);
  return result;
}