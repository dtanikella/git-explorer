import type TreeSitterParser from 'tree-sitter';

type SyntaxNode = TreeSitterParser.SyntaxNode;
type Point = { row: number; column: number };

export class NodeWrapper {
  constructor(private readonly _node: SyntaxNode) {}

  // Identity
  get type(): string { return this._node.type; }
  get text(): string { return this._node.text; }
  get isNamed(): boolean { return this._node.isNamed; }

  // Position
  get startPosition(): Point { return this._node.startPosition; }
  get endPosition(): Point { return this._node.endPosition; }
  get startIndex(): number { return this._node.startIndex; }
  get endIndex(): number { return this._node.endIndex; }

  // State flags
  get isError(): boolean { return this._node.type === 'ERROR'; }
  get hasError(): boolean { return this._node.hasError; }
  get isMissing(): boolean { return this._node.isMissing; }

  // Navigation — tree structure
  get parent(): NodeWrapper | null {
    return this._node.parent ? new NodeWrapper(this._node.parent) : null;
  }

  get children(): NodeWrapper[] {
    return this._node.children.map(c => new NodeWrapper(c));
  }

  get namedChildren(): NodeWrapper[] {
    return this._node.namedChildren.map(c => new NodeWrapper(c));
  }

  get firstChild(): NodeWrapper | null {
    return this._node.firstChild ? new NodeWrapper(this._node.firstChild) : null;
  }

  get lastChild(): NodeWrapper | null {
    return this._node.lastChild ? new NodeWrapper(this._node.lastChild) : null;
  }

  get firstNamedChild(): NodeWrapper | null {
    return this._node.firstNamedChild ? new NodeWrapper(this._node.firstNamedChild) : null;
  }

  get lastNamedChild(): NodeWrapper | null {
    return this._node.lastNamedChild ? new NodeWrapper(this._node.lastNamedChild) : null;
  }

  get childCount(): number { return this._node.childCount; }
  get namedChildCount(): number { return this._node.namedChildCount; }

  // Navigation — siblings
  get nextSibling(): NodeWrapper | null {
    return this._node.nextSibling ? new NodeWrapper(this._node.nextSibling) : null;
  }

  get previousSibling(): NodeWrapper | null {
    return this._node.previousSibling ? new NodeWrapper(this._node.previousSibling) : null;
  }

  get nextNamedSibling(): NodeWrapper | null {
    return this._node.nextNamedSibling ? new NodeWrapper(this._node.nextNamedSibling) : null;
  }

  get previousNamedSibling(): NodeWrapper | null {
    return this._node.previousNamedSibling ? new NodeWrapper(this._node.previousNamedSibling) : null;
  }

  // Navigation — field-based
  childForFieldName(fieldName: string): NodeWrapper | null {
    const child = this._node.childForFieldName(fieldName);
    return child ? new NodeWrapper(child) : null;
  }

  // Search
  descendantsOfType(type: string | string[]): NodeWrapper[] {
    const types = Array.isArray(type) ? type : [type];
    const results: NodeWrapper[] = [];
    const walk = (node: SyntaxNode) => {
      if (types.includes(node.type)) {
        results.push(new NodeWrapper(node));
      }
      for (const child of node.children) {
        walk(child);
      }
    };
    walk(this._node);
    return results;
  }

  /** Access the underlying tree-sitter SyntaxNode for advanced use. */
  get raw(): SyntaxNode { return this._node; }
}
