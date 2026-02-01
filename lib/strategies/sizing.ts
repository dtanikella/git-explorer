import { SizingStrategy } from '../types';

/**
 * Sizing strategy that uses actual file/folder size in bytes
 */
export const fileSizeStrategy: SizingStrategy = (node) => {
  return node.size;
};

/**
 * Sizing strategy that gives all nodes the same size (1)
 */
export const uniformStrategy: SizingStrategy = (node) => {
  return 1;
};