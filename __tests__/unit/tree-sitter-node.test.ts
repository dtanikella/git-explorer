/**
 * @jest-environment node
 */
import TreeSitterParser from 'tree-sitter';
import * as TypeScriptGrammar from 'tree-sitter-typescript';
import { NodeWrapper } from '@/lib/tree-sitter/node';

function parseSource(source: string): NodeWrapper {
  const parser = new TreeSitterParser();
  parser.setLanguage(TypeScriptGrammar.typescript);
  const tree = parser.parse(source);
  return new NodeWrapper(tree.rootNode);
}

describe('NodeWrapper', () => {
  describe('identity and position', () => {
    it('exposes type and text', () => {
      const root = parseSource('const x = 1;');
      expect(root.type).toBe('program');
      expect(root.text).toContain('const x = 1');
    });

    it('exposes start/end position', () => {
      const root = parseSource('const x = 1;');
      expect(root.startPosition).toEqual({ row: 0, column: 0 });
      expect(root.startIndex).toBe(0);
      expect(root.endIndex).toBeGreaterThan(0);
    });

    it('exposes isNamed', () => {
      const root = parseSource('const x = 1;');
      expect(root.isNamed).toBe(true);
    });
  });

  describe('state flags', () => {
    it('reports no errors on valid source', () => {
      const root = parseSource('const x: number = 42;');
      expect(root.isError).toBe(false);
      expect(root.hasError).toBe(false);
      expect(root.isMissing).toBe(false);
    });

    it('reports hasError on source with syntax errors', () => {
      const root = parseSource('function broken( { return 42 }');
      expect(root.hasError).toBe(true);
    });

    it('finds ERROR nodes in the tree', () => {
      const root = parseSource('function broken( { return 42 }');
      const allNodes: NodeWrapper[] = [];
      function walk(node: NodeWrapper) {
        allNodes.push(node);
        for (const child of node.children) {
          walk(child);
        }
      }
      walk(root);
      const errorNodes = allNodes.filter(n => n.isError || n.isMissing);
      expect(errorNodes.length).toBeGreaterThan(0);
    });
  });

  describe('tree navigation', () => {
    const source = `
function add(a: number, b: number): number {
  return a + b;
}
`;

    it('navigates parent/children', () => {
      const root = parseSource(source);
      expect(root.children.length).toBeGreaterThan(0);
      expect(root.parent).toBeNull();

      const firstChild = root.children[0];
      expect(firstChild.parent).not.toBeNull();
      expect(firstChild.parent!.type).toBe('program');
    });

    it('navigates namedChildren', () => {
      const root = parseSource(source);
      const namedKids = root.namedChildren;
      expect(namedKids.length).toBeGreaterThan(0);
      expect(namedKids[0].isNamed).toBe(true);
    });

    it('navigates firstChild / lastChild', () => {
      const root = parseSource(source);
      expect(root.firstChild).not.toBeNull();
      expect(root.lastChild).not.toBeNull();
    });

    it('navigates firstNamedChild / lastNamedChild', () => {
      const root = parseSource(source);
      expect(root.firstNamedChild).not.toBeNull();
    });

    it('navigates siblings', () => {
      const root = parseSource('const a = 1;\nconst b = 2;');
      const first = root.namedChildren[0];
      const second = root.namedChildren[1];
      expect(first.nextNamedSibling).not.toBeNull();
      expect(first.nextNamedSibling!.type).toBe(second.type);
      expect(second.previousNamedSibling).not.toBeNull();
    });

    it('navigates by field name', () => {
      const root = parseSource(source);
      const funcNode = root.namedChildren[0];
      const nameNode = funcNode.childForFieldName('name');
      expect(nameNode).not.toBeNull();
      expect(nameNode!.text).toBe('add');
    });

    it('exposes childCount and namedChildCount', () => {
      const root = parseSource(source);
      expect(root.childCount).toBeGreaterThan(0);
      expect(root.namedChildCount).toBeGreaterThan(0);
      expect(root.namedChildCount).toBeLessThanOrEqual(root.childCount);
    });
  });

  describe('search', () => {
    it('finds descendants of a specific type', () => {
      const root = parseSource(`
        function foo() { return 1; }
        function bar() { return 2; }
      `);
      const funcs = root.descendantsOfType('function_declaration');
      expect(funcs.length).toBe(2);
      expect(funcs[0].type).toBe('function_declaration');
    });

    it('accepts an array of types', () => {
      const root = parseSource(`
        function foo() { return 1; }
        const x = 42;
      `);
      const nodes = root.descendantsOfType(['function_declaration', 'lexical_declaration']);
      expect(nodes.length).toBe(2);
    });
  });
});
