import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SearchSelectSidebar from '@/app/components/selection/SearchSelectSidebar';
import type { SelectionContextValue } from '@/app/contexts/SelectionContext';
import type { Area } from '@/lib/areas/types';

// --- Mocks ---

const mockToggleNode = jest.fn();
const mockToggleNodes = jest.fn();
const mockToggleArea = jest.fn();
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

const mockAreas: Area[] = [
  {
    id: 'auth',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    name: 'Auth Service',
    type: 'business_domain',
    contains: ['sym-login'],
    parent: null,
    children: [],
    clusterStrength: 0,
  },
  {
    id: 'payments',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    name: 'Payments',
    type: 'business_domain',
    contains: ['sym-charge'],
    parent: null,
    children: [],
    clusterStrength: 0,
  },
];

jest.mock('@/app/contexts/AreaContext', () => ({
  useAreaStore: () => ({
    areas: mockAreas,
    runtimeState: new Map([
      ['auth', { visible: true, color: '#3b82f6' }],
      ['payments', { visible: true, color: '#10b981' }],
    ]),
    nodeToAreas: new Map([
      ['sym-login', [mockAreas[0]]],
      ['sym-charge', [mockAreas[1]]],
    ]),
    getVisibleAreas: () => mockAreas,
    getAreasForNode: (id: string) => {
      if (id === 'sym-login') return [mockAreas[0]];
      if (id === 'sym-charge') return [mockAreas[1]];
      return [];
    },
    setAreas: jest.fn(),
  }),
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
    const hasLocks = state?.lockedNodeIds?.size > 0 || state?.lockedAreaIds?.size > 0;
    return (
      <div data-testid="selection-toolbar">
        <input
          type="text"
          value={searchQuery || ''}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          placeholder="Search node or area..."
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
  return function MockSelectionTree({ tree, mode }: any) {
    return (
      <div data-testid="selection-tree" data-mode={mode}>
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

jest.mock('@/app/components/selection/SelectionStats', () => {
  return function MockSelectionStats() {
    return <div data-testid="selection-stats" />;
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
      selectedAreaIds: new Set(),
      excludedNodeIds: new Set(),
      lockedNodeIds: new Set<string>(),
      lockedAreaIds: new Set<string>(),
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
    toggleArea: mockToggleArea,
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
    render(<SearchSelectSidebar nodes={mockNodes as any} onSearchNode={mockOnSearchNode} repoPath="/tmp/test" />);
    expect(screen.getByTestId('search-select-sidebar')).toBeInTheDocument();
  });

  it('renders the SelectionToolbar', () => {
    render(<SearchSelectSidebar nodes={mockNodes as any} onSearchNode={mockOnSearchNode} repoPath="/tmp/test" />);
    expect(screen.getByTestId('selection-toolbar')).toBeInTheDocument();
  });

  it('renders the SelectionTree in "area" mode as default browse view', () => {
    render(<SearchSelectSidebar nodes={mockNodes as any} onSearchNode={mockOnSearchNode} repoPath="/tmp/test" />);
    expect(screen.getByTestId('selection-tree')).toBeInTheDocument();
  });

  it('renders ExpansionGroups', () => {
    render(<SearchSelectSidebar nodes={mockNodes as any} onSearchNode={mockOnSearchNode} repoPath="/tmp/test" />);
    expect(screen.getByTestId('expansion-groups')).toBeInTheDocument();
    expect(screen.getByTestId('expansion-group-same-file')).toBeInTheDocument();
    expect(screen.getByTestId('expansion-group-callers')).toBeInTheDocument();
    expect(screen.getByTestId('expansion-group-callees')).toBeInTheDocument();
    // No area-members group
    expect(screen.queryByTestId('expansion-group-area-members')).not.toBeInTheDocument();
  });

  it('renders SelectionStats', () => {
    render(<SearchSelectSidebar nodes={mockNodes as any} onSearchNode={mockOnSearchNode} repoPath="/tmp/test" />);
    expect(screen.getByTestId('selection-stats')).toBeInTheDocument();
  });

  it('shows ClearUnlocked button when there are locked nodes', () => {
    mockContextValue = {
      ...buildDefaultMockContext(),
      state: {
        ...buildDefaultMockContext().state,
        lockedNodeIds: new Set(['sym:a']),
      },
    };
    render(<SearchSelectSidebar nodes={mockNodes as any} onSearchNode={mockOnSearchNode} repoPath="/tmp/test" />);
    expect(screen.getByText('Clear unlocked')).toBeInTheDocument();
  });

  it('hides area-members expansion group', () => {
    // Even if the context somehow has area-members, the sidebar should not show it
    mockContextValue = {
      ...buildDefaultMockContext(),
      state: {
        ...buildDefaultMockContext().state,
        expansions: new Map([
          ['same-file', makeExpGroup('same-file', [{ nodeId: 'sym:b', sourceNodeIds: ['sym:a'] }])],
          ['area-members', makeExpGroup('area-members', [])],
        ]),
      },
    };
    render(<SearchSelectSidebar nodes={mockNodes as any} onSearchNode={mockOnSearchNode} repoPath="/tmp/test" />);
    expect(screen.queryByTestId('expansion-group-area-members')).not.toBeInTheDocument();
  });

  it('calls onSearchNode when search is submitted', () => {
    mockOnSearchNode.mockReturnValue(true);
    render(<SearchSelectSidebar nodes={mockNodes as any} onSearchNode={mockOnSearchNode} repoPath="/tmp/test" />);
    const input = screen.getByTestId('search-input');
    fireEvent.change(input, { target: { value: 'funcA' } });
    fireEvent.click(screen.getByTestId('search-button'));
    expect(mockOnSearchNode).toHaveBeenCalledWith('funcA');
  });

  it('falls back to area search when node search returns false', () => {
    mockOnSearchNode.mockReturnValue(false);
    render(<SearchSelectSidebar nodes={mockNodes as any} onSearchNode={mockOnSearchNode} repoPath="/tmp/test" />);
    const input = screen.getByTestId('search-input');
    fireEvent.change(input, { target: { value: 'Auth' } });
    fireEvent.click(screen.getByTestId('search-button'));
    expect(mockOnSearchNode).toHaveBeenCalledWith('Auth');
    expect(mockToggleArea).toHaveBeenCalledWith('auth');
  });

  it('shows Not found when neither node nor area matches', () => {
    mockOnSearchNode.mockReturnValue(false);
    render(<SearchSelectSidebar nodes={mockNodes as any} onSearchNode={mockOnSearchNode} repoPath="/tmp/test" />);
    const input = screen.getByTestId('search-input');
    fireEvent.change(input, { target: { value: 'xyz' } });
    fireEvent.click(screen.getByTestId('search-button'));
    expect(screen.getByTestId('not-found')).toBeInTheDocument();
  });

  it('does not show area-members toggle (by area is now the browse view, not a toggle)', () => {
    render(<SearchSelectSidebar nodes={mockNodes as any} onSearchNode={mockOnSearchNode} repoPath="/tmp/test" />);
    // The old "Area Members" label should not appear
    expect(screen.queryByText('Area Members')).not.toBeInTheDocument();
  });

  it('clears search not-found state when query changes', () => {
    mockOnSearchNode.mockReturnValue(false);
    render(<SearchSelectSidebar nodes={mockNodes as any} onSearchNode={mockOnSearchNode} repoPath="/tmp/test" />);
    const input = screen.getByTestId('search-input');
    fireEvent.change(input, { target: { value: 'xyz' } });
    fireEvent.click(screen.getByTestId('search-button'));
    expect(screen.getByTestId('not-found')).toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'newquery' } });
    expect(screen.queryByTestId('not-found')).not.toBeInTheDocument();
  });
});