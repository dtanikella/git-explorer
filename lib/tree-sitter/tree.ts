import type TreeSitterParser from 'tree-sitter';
import { NodeWrapper } from './node';

type Tree = TreeSitterParser.Tree;
type TreeCursor = TreeSitterParser.TreeCursor;

export class TreeWrapper {
  readonly rootNode: NodeWrapper;

  constructor(
    private readonly _tree: Tree,
    readonly language: string,
  ) {
    this.rootNode = new NodeWrapper(_tree.rootNode);
  }

  walk(): TreeCursor {
    return this._tree.walk();
  }

  /** Access the underlying tree-sitter Tree for advanced use. */
  get raw(): Tree { return this._tree; }
}
