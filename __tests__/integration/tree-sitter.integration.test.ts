/**
 * @jest-environment node
 */
import * as fs from 'fs';
import * as path from 'path';
import { loadLanguage, clearLanguageCache } from '@/lib/tree-sitter/language';
import { createParser } from '@/lib/tree-sitter/parser';
import { createQuery } from '@/lib/tree-sitter/query';
import { TreeWrapper } from '@/lib/tree-sitter/tree';
import { NodeWrapper } from '@/lib/tree-sitter/node';

const FIXTURE_DIR = path.resolve(__dirname, '../fixtures/tree-sitter');

describe('tree-sitter integration', () => {
  afterAll(() => {
    clearLanguageCache();
  });

  it('end-to-end: load language → parse file → navigate tree → run query', () => {
    // 1. Load language
    const lang = loadLanguage('typescript');
    expect(lang).toBeDefined();

    // 2. Create parser
    const parser = createParser(lang, 'typescript');

    // 3. Parse fixture file
    const source = fs.readFileSync(path.join(FIXTURE_DIR, 'valid.ts'), 'utf-8');
    const result = parser.parse(source);

    expect(result.tree).toBeInstanceOf(TreeWrapper);
    expect(result.hasErrors).toBe(false);
    expect(result.language).toBe('typescript');

    // 4. Navigate tree
    const root = result.tree.rootNode;
    expect(root).toBeInstanceOf(NodeWrapper);
    expect(root.type).toBe('program');
    expect(root.childCount).toBeGreaterThan(0);

    // Find the function declaration
    const funcs = root.descendantsOfType('function_declaration');
    expect(funcs.length).toBeGreaterThan(0);

    const greetFunc = funcs.find(f => {
      const nameNode = f.childForFieldName('name');
      return nameNode?.text === 'greet';
    });
    expect(greetFunc).toBeDefined();
    expect(greetFunc!.hasError).toBe(false);

    // Find the class declaration
    const classes = root.descendantsOfType('class_declaration');
    expect(classes.length).toBe(1);
    const calcClass = classes[0];
    const className = calcClass.childForFieldName('name');
    expect(className).not.toBeNull();
    expect(className!.text).toBe('Calculator');

    // 5. Run query — find all function/method names
    const query = createQuery(
      lang,
      '(function_declaration name: (identifier) @func.name)',
      'typescript',
    );
    const captures = query.captures(root);
    const funcNames = captures.map(c => c.node.text);
    expect(funcNames).toContain('greet');

    // 6. Verify error detection on broken file
    const brokenSource = fs.readFileSync(path.join(FIXTURE_DIR, 'with-errors.ts'), 'utf-8');
    const brokenResult = parser.parse(brokenSource);
    expect(brokenResult.hasErrors).toBe(true);

    // Walk to find error/missing nodes
    const allNodes: NodeWrapper[] = [];
    function walk(node: NodeWrapper) {
      allNodes.push(node);
      for (const child of node.children) {
        walk(child);
      }
    }
    walk(brokenResult.tree.rootNode);
    const errorNodes = allNodes.filter(n => n.isError || n.isMissing);
    expect(errorNodes.length).toBeGreaterThan(0);
  });

  it('tree cursor traversal works', () => {
    const lang = loadLanguage('typescript');
    const parser = createParser(lang, 'typescript');
    const result = parser.parse('const x = 1;');

    const cursor = result.tree.walk();
    expect(cursor.nodeType).toBe('program');
    expect(cursor.gotoFirstChild()).toBe(true);
    expect(cursor.nodeType).toBeDefined();
  });

  it('tsx grammar parses JSX', () => {
    const lang = loadLanguage('tsx');
    const parser = createParser(lang, 'tsx');
    const result = parser.parse('const App = () => <div>Hello</div>;');

    expect(result.hasErrors).toBe(false);
    const jsxElements = result.tree.rootNode.descendantsOfType('jsx_element');
    expect(jsxElements.length).toBe(1);
  });
});
