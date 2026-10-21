import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import SymbolSearch from '@/app/components/default-view/SymbolSearch';
import { SyntaxType } from '@/lib/analysis/types';
import type { HierarchyNode } from '@/lib/default/types';

const sym = (name: string, path: string, type = SyntaxType.FUNCTION): HierarchyNode => ({
  id: `${path}#${name}`, tier: 'symbol', name, path, depth: 4, children: [], symbol: { syntaxType: type, params: [], returnTypeText: null },
});
const symbols = [
  sym('buildHierarchy', 'lib/default/adapter.ts'),
  sym('buildDirectoryHubs', 'lib/graph/hubs.ts'),
  sym('AreaPair', 'lib/areas/types.ts', SyntaxType.INTERFACE),
];

const setup = () => {
  const onPick = jest.fn();
  render(<SymbolSearch symbols={symbols} onPick={onPick} />);
  return { onPick, input: screen.getByRole('combobox', { name: 'Search symbols' }) };
};

describe('SymbolSearch', () => {
  it('shows a hint on focus and nothing is picked', async () => {
    const { input, onPick } = setup();
    await userEvent.click(input);
    expect(screen.getByText(/Search 3 symbols/)).toBeInTheDocument();
    expect(onPick).not.toHaveBeenCalled();
  });

  it('lists ranked fuzzy matches with kind and path', async () => {
    const { input } = setup();
    await userEvent.type(input, 'bldh');
    const rows = screen.getAllByTestId('search-result');
    // buildDirectoryHubs also contains b-l-d-h in order, so it is a weaker second match
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('buildHierarchy');
    expect(rows[1]).toHaveTextContent('buildDirectoryHubs');
    expect(rows[0]).toHaveTextContent('function');
    expect(rows[0]).toHaveTextContent('lib/default/adapter.ts');
    expect(screen.getByText('2 matches')).toBeInTheDocument();
  });

  it('highlights the matched letters of the name', async () => {
    const { input } = setup();
    await userEvent.type(input, 'hier');
    expect(screen.getByTestId('search-result').querySelector('mark')).toHaveTextContent('Hier');
  });

  it('says when nothing matches', async () => {
    const { input } = setup();
    await userEvent.type(input, 'zzzz');
    expect(screen.getByText('No symbols match.')).toBeInTheDocument();
  });

  it('moves the active row with the arrows, wrapping, and picks it with Enter', async () => {
    const { input, onPick } = setup();
    await userEvent.type(input, 'build');
    const rows = screen.getAllByTestId('search-result');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getAllByTestId('search-result')[1]).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getAllByTestId('search-result')[0]).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{ArrowUp}{Enter}');
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith('lib/graph/hubs.ts#buildDirectoryHubs');
  });

  it('picks the top result with Enter and closes the list', async () => {
    const { input, onPick } = setup();
    await userEvent.type(input, 'hubs');
    await userEvent.keyboard('{Enter}');
    expect(onPick).toHaveBeenCalledWith('lib/graph/hubs.ts#buildDirectoryHubs');
    expect(screen.queryByTestId('search-results')).not.toBeInTheDocument();
  });

  it('picks a row on mouse down, before the input could blur', async () => {
    const { input, onPick } = setup();
    await userEvent.type(input, 'area');
    fireEvent.mouseDown(screen.getByTestId('search-result'));
    expect(onPick).toHaveBeenCalledWith('lib/areas/types.ts#AreaPair');
    expect(input).not.toHaveFocus();
  });

  it('clears the text on the first Esc and closes on the second', async () => {
    const { input } = setup();
    await userEvent.type(input, 'area');
    await userEvent.keyboard('{Escape}');
    expect(input).toHaveValue('');
    expect(screen.getByTestId('search-results')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByTestId('search-results')).not.toBeInTheDocument();
    expect(input).not.toHaveFocus();
  });

  it('closes when the pointer goes down outside', async () => {
    const { input } = setup();
    await userEvent.click(input);
    expect(screen.getByTestId('search-results')).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByTestId('search-results')).not.toBeInTheDocument();
  });

  it('focuses the box on / outside a text field, and not on / typed into it', async () => {
    const { input } = setup();
    expect(input).not.toHaveFocus();
    await userEvent.keyboard('/');
    expect(input).toHaveFocus();
    expect(input).toHaveValue('');
    await userEvent.keyboard('a/b');
    expect(input).toHaveValue('a/b');
  });

  it('keeps the text after a pick so reopening shows the same results', async () => {
    const { input } = setup();
    await userEvent.type(input, 'hubs');
    await userEvent.keyboard('{Enter}');
    expect(input).toHaveValue('hubs');
    await userEvent.click(input);
    expect(screen.getAllByTestId('search-result')).toHaveLength(1);
  });

  it('reports how many matches are not listed', async () => {
    const many = Array.from({ length: 12 }, (_, i) => sym(`item${i}`, 'a.ts'));
    render(<SymbolSearch symbols={many} onPick={jest.fn()} />);
    await userEvent.type(screen.getByRole('combobox'), 'item');
    expect(screen.getAllByTestId('search-result')).toHaveLength(8);
    expect(screen.getByText('top 8 of 12')).toBeInTheDocument();
  });
});
