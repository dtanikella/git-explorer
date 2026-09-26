import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SelectionProvider, useSelection } from '@/app/contexts/SelectionContext';
import { AreaProvider } from '@/app/contexts/AreaContext';
import ExpansionGroups from '@/app/components/selection/ExpansionGroups';
import SelectionTree from '@/app/components/selection/SelectionTree';
import { buildFileTree } from '@/lib/selection/trees';
import { SyntaxType, EdgeKind } from '@/lib/analysis/types';
import type { AnalysisNode, AnalysisEdge } from '@/lib/analysis/types';

function makeNode(sym: string, name: string, filePath: string): AnalysisNode {
  return {
    syntaxType: SyntaxType.FUNCTION, name, filePath, startLine: 1, startCol: 0, isAsync: false,
    isExported: true, params: [], returnTypeText: null, scipSymbol: sym, isDefinition: true,
    inTestFile: false, referencedAt: [], outboundRefs: [],
  };
}

function makeEdge(from: string, to: string): AnalysisEdge {
  return {
    kind: EdgeKind.CALLS, fromFile: 'a.ts', fromName: from, fromSymbol: from, toText: to, toFile: 'b.ts',
    toName: to, toSymbol: to, isExternal: false, isAmbiguous: false, edgePosition: { line: 1, col: 0 },
    isOptionalChain: false, isAsync: false,
  };
}

const nodes = [
  makeNode('sym:a', 'funcA', 'src/a.ts'),
  makeNode('sym:b', 'funcB', 'src/a.ts'),
  makeNode('sym:c', 'funcC', 'src/b.ts'),
  makeNode('sym:d', 'funcD', 'src/c.ts'),
];
const edges = [makeEdge('sym:a', 'sym:c'), makeEdge('sym:c', 'sym:d')];
const visible = new Set(nodes.map((n) => n.scipSymbol));

function ActiveIds() {
  const { activeNodeIds } = useSelection();
  return <div data-testid="active">{[...activeNodeIds].sort().join(',')}</div>;
}

function Harness() {
  return (
    <AreaProvider areas={[]} repoPath="">
      <SelectionProvider nodes={nodes} edges={edges} visibleNodeIds={visible} areas={[]}>
        <SelectionTree
          tree={buildFileTree(nodes)}
          mode="file"
          expanded={new Set(['dir:src', 'file:src/b.ts'])}
          onToggleExpand={() => {}}
        />
        <ExpansionGroups nodes={nodes} />
        <ActiveIds />
      </SelectionProvider>
    </AreaProvider>
  );
}

const FUNNEL = 'Set same file, callers, callees for just this row';
const funnelIn = (testId: string) => within(screen.getByTestId(testId)).getByLabelText(new RegExp(`${FUNNEL}|Back to all selected`));

describe('per-row expansion filter', () => {
  it('starts scoped to "All selected"', () => {
    render(<Harness />);
    expect(screen.getByTestId('scope-chip')).toHaveTextContent('All selected');
  });

  it('shows a funnel on file, folder and node rows, revealed on hover', () => {
    render(<Harness />);
    for (const id of ['tree-row-dir:src', 'tree-row-file:src/b.ts', 'tree-row-sym:c']) {
      expect(funnelIn(id).className).toContain('group-hover:opacity-100');
    }
  });

  it('focuses a row: scope, toggles and counts switch to that row alone, and the funnel stays visible', () => {
    render(<Harness />);
    fireEvent.click(funnelIn('tree-row-sym:c'));

    expect(screen.getByTestId('scope-chip')).toHaveTextContent('funcC');
    const funnel = funnelIn('tree-row-sym:c');
    expect(funnel.className).not.toContain('opacity-0');
    expect(funnel.className).toContain('text-blue-600');

    expect(screen.getByTestId('expansion-group-callers')).toHaveTextContent('Callers (1)');
    expect(screen.getByTestId('expansion-group-callees')).toHaveTextContent('Callees (1)');
    expect(screen.getByTestId('toggle-callers')).toHaveAttribute('aria-checked', 'false');
  });

  it('expands the focused row, adds its nodes to the effective selection, and keeps it as a chip', () => {
    render(<Harness />);
    fireEvent.click(funnelIn('tree-row-sym:c'));
    fireEvent.click(screen.getByTestId('toggle-callees'));

    expect(screen.getByTestId('active')).toHaveTextContent('sym:d');
    expect(screen.getByTestId('toggle-callees')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('candidate-callees-sym:d')).toBeInTheDocument();

    // Back to all selected: the toggle reverts to the whole-selection state, the row stays as a chip
    fireEvent.click(screen.getByTestId('scope-chip'));
    expect(screen.getByTestId('scope-chip')).toHaveTextContent('All selected');
    expect(screen.getByTestId('toggle-callees')).toHaveAttribute('aria-checked', 'false');
    const chip = screen.getByTestId('row-chip-n:sym:c');
    expect(chip).toHaveTextContent('funcC');
    expect(chip).toHaveTextContent('callees');
    expect(screen.getByTestId('active')).toHaveTextContent('sym:d');

    // The row's funnel stays blue while it has an expansion on, even unfocused
    expect(funnelIn('tree-row-sym:c').className).toContain('text-blue-600');

    // Clicking the chip focuses the row again
    fireEvent.click(chip);
    expect(screen.getByTestId('scope-chip')).toHaveTextContent('funcC');
  });

  it('a folder row uses every node in it', () => {
    render(<Harness />);
    fireEvent.click(funnelIn('tree-row-dir:src'));
    expect(screen.getByTestId('scope-chip')).toHaveTextContent('src/');
    fireEvent.click(screen.getByTestId('toggle-same-file'));
    expect(screen.getByTestId('active')).toHaveTextContent('sym:a,sym:b,sym:c,sym:d');
  });

  it('excludes and includes everything in the list', () => {
    render(<Harness />);
    fireEvent.click(funnelIn('tree-row-dir:src'));
    fireEvent.click(screen.getByTestId('toggle-same-file'));
    expect(screen.getByTestId('expansion-group-same-file')).toHaveTextContent('Same file (4/4)');

    fireEvent.click(screen.getByTestId('exclude-all-same-file'));
    expect(screen.getByTestId('expansion-group-same-file')).toHaveTextContent('Same file (0/4)');
    expect(screen.getByTestId('active')).toHaveTextContent('');

    fireEvent.click(screen.getByTestId('include-all-same-file'));
    expect(screen.getByTestId('expansion-group-same-file')).toHaveTextContent('Same file (4/4)');
  });

  it('unchecking one node excludes just that node', () => {
    render(<Harness />);
    fireEvent.click(funnelIn('tree-row-dir:src'));
    fireEvent.click(screen.getByTestId('toggle-same-file'));
    fireEvent.click(screen.getByTestId('candidate-same-file-sym:a'));
    expect(screen.getByTestId('active')).toHaveTextContent('sym:b,sym:c,sym:d');
  });

  it('clicking the scope chip of a focused row returns to all selected', () => {
    render(<Harness />);
    fireEvent.click(funnelIn('tree-row-sym:c'));
    fireEvent.click(screen.getByTestId('scope-chip'));
    expect(screen.getByTestId('scope-chip')).toHaveTextContent('All selected');
  });
});
