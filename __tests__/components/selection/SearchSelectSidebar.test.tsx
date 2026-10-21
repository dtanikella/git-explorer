import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SearchSelectSidebar from '@/app/components/selection/SearchSelectSidebar';
import type { SelectionContextValue } from '@/app/contexts/SelectionContext';

// --- Mocks ---

const mockToggleNode = jest.fn();
const mockToggleNodes = jest.fn();
const mockClearSelection = jest.fn();
const mockToggleExpansionGroup = jest.fn();
const mockToggleExpandedNode = jest.fn();
const mockToggleLock = jest.fn();
const mockLockAll = jest.fn();
const mockClearUnlocked = jest.fn();
const mockSetExpandedNodes = jest.fn();
const mockOnSearchNode = jest.fn();

let mockContextValue: SelectionContextValue;

jest.mock('@/app/contexts/SelectionContext', () => ({
  useSelection: (): SelectionContextValue => mockContextValue,
  // SelectionProvider is not tested here, only the sidebar consumer
}));

jest.mock('@/app/components/selection/SelectionToolbar', () => {
  return function MockSelectionToolbar({
    searchQuery,
    onSearchQueryChange,
    searchNotFound,
    onSearchSubmit,
  }: any) {
    // Check if there are locks in the context
    const { state } = require('@/app/contexts/SelectionContext').useSelection();
    const hasLocks = state?.lockedNodeIds?.size > 0;
    return (
      <div data-testid="selection-toolbar">
        <input
          type="text"
          value={searchQuery || ''}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          placeholder="Search node..."
          data-testid="search-input"
        />
        <button onClick={() => onSearchSubmit()} data-testid="search-button">Search</button>
        {searchNotFound && <span data-testid="not-found">Not found</span>}
        {hasLocks && <span data-testid="clear-unlocked">Clear unlocked</span>}
      </div>
    );
  };
});

jest.mock('@/app/components/selection/SelectionTree', () => {
  return function MockSelectionTree({ tree }: any) {
    return (
      <div data-testid="selection-tree">
        {tree?.children?.map((child: any) => (
          <div key={child.id} data-testid={`tree-item-${child.id}`}>{child.name || child.id}</div>
        ))}
      </div>
    );
  };
});

jest.mock('@/app/components/selection/ExpansionGroups', () => {
  return function MockExpansionGroups({ nodes: _nodes }: any) {
    return (
      <div data-testid="expansion-groups">
        <div data-testid="expansion-group-same-file">same-file</div>
        <div data-testid="expansion-group-callers">callers</div>
        <div data-testid="expansion-group-callees">callees</div>
      </div>
    );
  };
});

function makeExpGroup(type: string, candidates: { nodeId: string; sourceNodeIds: string[] }[], enabled = false): any {
  return { type, enabled, candidates, disabledIds: new Set<string>() };
}

const mockNodes = [
  { scipSymbol: 'sym:a', name: 'funcA', filePath: 'src/utils/a.ts' },
  { scipSymbol: 'sym:b', name: 'funcB', filePath: 'src/utils/a.ts' },
  { scipSymbol: 'sym:c', name: 'funcC', filePath: 'src/services/b.ts' },
  { scipSymbol: 'sym-login', name: 'login', filePath: 'src/auth/login.ts' },
];

function buildDefaultMockContext(): SelectionContextValue {
  return {
    state: {
      explicitNodeIds: new Set(['sym:a']),
      lockedNodeIds: new Set<string>(),
      expansions: new Map([
        ['same-file', makeExpGroup('same-file', [{ nodeId: 'sym:b', sourceNodeIds: ['sym:a'] }])],
        ['callers', makeExpGroup('callers', [])],
        ['callees', makeExpGroup('callees', [{ nodeId: 'sym:c', sourceNodeIds: ['sym:a'] }])],
      ]),
      selectedNodeIds: new Set(['sym:a']),
    },
    activeNodeIds: new Set(['sym:a']),
    hasSelection: true,
    toggleNode: mockToggleNode,
    toggleNodes: mockToggleNodes,
    toggleLock: mockToggleLock,
    lockAll: mockLockAll,
    clearUnlocked: mockClearUnlocked,
    clearSelection: mockClearSelection,
    toggleExpansionGroup: mockToggleExpansionGroup,
    toggleExpandedNode: mockToggleExpandedNode,
    setExpandedNodes: mockSetExpandedNodes,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockContextValue = buildDefaultMockContext();
});

describe('SearchSelectSidebar', () => {
  it('renders the sidebar with header', () => {
    render(<SearchSelectSidebar nodes={mockNodes as any} onSearchNode={mockOnSearchNode} />);
    expect(screen.getByTestId('search-select-sidebar')).toBeInTheDocument();
  });

  it('renders the SelectionToolbar', () => {
    render(<SearchSelectSidebar nodes={mockNodes as any} onSearchNode={mockOnSearchNode} />);
    expect(screen.getByTestId('selection-toolbar')).toBeInTheDocument();
  });

  it('renders the SelectionTree', () => {
    render(<SearchSelectSidebar nodes={mockNodes as any} onSearchNode={mockOnSearchNode} />);
    expect(screen.getByTestId('selection-tree')).toBeInTheDocument();
  });

  it('renders ExpansionGroups', () => {
    render(<SearchSelectSidebar nodes={mockNodes as any} onSearchNode={mockOnSearchNode} />);
    expect(screen.getByTestId('expansion-groups')).toBeInTheDocument();
    expect(screen.getByTestId('expansion-group-same-file')).toBeInTheDocument();
    expect(screen.getByTestId('expansion-group-callers')).toBeInTheDocument();
    expect(screen.getByTestId('expansion-group-callees')).toBeInTheDocument();
  });

  it('shows ClearUnlocked button when there are locked nodes', () => {
    mockContextValue = {
      ...buildDefaultMockContext(),
      state: {
        ...buildDefaultMockContext().state,
        lockedNodeIds: new Set(['sym:a']),
      },
    };
    render(<SearchSelectSidebar nodes={mockNodes as any} onSearchNode={mockOnSearchNode} />);
    expect(screen.getByText('Clear unlocked')).toBeInTheDocument();
  });

  it('calls onSearchNode when search is submitted', () => {
    mockOnSearchNode.mockReturnValue(true);
    render(<SearchSelectSidebar nodes={mockNodes as any} onSearchNode={mockOnSearchNode} />);
    const input = screen.getByTestId('search-input');
    fireEvent.change(input, { target: { value: 'funcA' } });
    fireEvent.click(screen.getByTestId('search-button'));
    expect(mockOnSearchNode).toHaveBeenCalledWith('funcA');
  });

  it('shows Not found when the node search finds nothing', () => {
    mockOnSearchNode.mockReturnValue(false);
    render(<SearchSelectSidebar nodes={mockNodes as any} onSearchNode={mockOnSearchNode} />);
    const input = screen.getByTestId('search-input');
    fireEvent.change(input, { target: { value: 'xyz' } });
    fireEvent.click(screen.getByTestId('search-button'));
    expect(screen.getByTestId('not-found')).toBeInTheDocument();
  });

  it('clears search not-found state when query changes', () => {
    mockOnSearchNode.mockReturnValue(false);
    render(<SearchSelectSidebar nodes={mockNodes as any} onSearchNode={mockOnSearchNode} />);
    const input = screen.getByTestId('search-input');
    fireEvent.change(input, { target: { value: 'xyz' } });
    fireEvent.click(screen.getByTestId('search-button'));
    expect(screen.getByTestId('not-found')).toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'newquery' } });
    expect(screen.queryByTestId('not-found')).not.toBeInTheDocument();
  });
});