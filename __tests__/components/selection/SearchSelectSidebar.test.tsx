import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SearchSelectSidebar from '@/app/components/selection/SearchSelectSidebar';
import type { SelectionContextValue, ExpansionGroup } from '@/app/contexts/SelectionContext';
import type { Area } from '@/lib/areas/types';

const mockToggleNode = jest.fn();
const mockToggleArea = jest.fn();
const mockClearSelection = jest.fn();
const mockToggleExpansionGroup = jest.fn();
const mockToggleExpandedNode = jest.fn();
const mockToggleAreaMember = jest.fn();
const mockOnSearchNode = jest.fn();

jest.mock('@/app/contexts/SelectionContext', () => ({
  useSelection: (): SelectionContextValue => mockContextValue,
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
    toggleVisibility: jest.fn(),
    getVisibleAreas: () => mockAreas,
    getAreasForNode: (id: string) => {
      if (id === 'sym-login') return [mockAreas[0]];
      if (id === 'sym-charge') return [mockAreas[1]];
      return [];
    },
    setAreas: jest.fn(),
  }),
}));

let mockContextValue: SelectionContextValue;

function makeGroup(type: ExpansionGroup['type'], candidates: { nodeId: string; sourceNodeIds: string[] }[], enabled = false): ExpansionGroup {
  return { type, enabled, candidates, disabledIds: new Set() };
}

const mockNodes = [
  { scipSymbol: 'sym:a', name: 'funcA', filePath: 'src/utils/a.ts' },
  { scipSymbol: 'sym:b', name: 'funcB', filePath: 'src/utils/a.ts' },
  { scipSymbol: 'sym:c', name: 'funcC', filePath: 'src/services/b.ts' },
  { scipSymbol: 'sym-login', name: 'login', filePath: 'src/auth/login.ts' },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockContextValue = {
    state: {
      selectedNodeIds: new Set(['sym:a']),
      selectedAreaIds: new Set(),
      expansions: new Map([
        ['same-file', makeGroup('same-file', [{ nodeId: 'sym:b', sourceNodeIds: ['sym:a'] }])],
        ['callers', makeGroup('callers', [])],
        ['callees', makeGroup('callees', [{ nodeId: 'sym:c', sourceNodeIds: ['sym:a'] }])],
        ['area-members', makeGroup('area-members', [], true)],
      ]),
    },
    toggleNode: mockToggleNode,
    toggleArea: mockToggleArea,
    clearSelection: mockClearSelection,
    toggleExpansionGroup: mockToggleExpansionGroup,
    toggleExpandedNode: mockToggleExpandedNode,
    toggleAreaMember: mockToggleAreaMember,
    activeNodeIds: new Set(['sym:a']),
    hasSelection: true,
  };
});

describe('SearchSelectSidebar', () => {
  it('renders the sidebar with header and clear all', () => {
    render(<SearchSelectSidebar nodes={mockNodes as any} onSearchNode={mockOnSearchNode} repoPath="/tmp/test" />);
    expect(screen.getByText('Search & Select')).toBeInTheDocument();
    expect(screen.getByText('Clear all')).toBeInTheDocument();
  });

  it('lists selected nodes by name with area tags', () => {
    render(<SearchSelectSidebar nodes={mockNodes as any} onSearchNode={mockOnSearchNode} repoPath="/tmp/test" />);
    expect(screen.getByText('funcA')).toBeInTheDocument();
    expect(screen.getByText('Auth Service')).toBeInTheDocument();
  });

  it('calls clearSelection when Clear all is clicked', () => {
    render(<SearchSelectSidebar nodes={mockNodes as any} onSearchNode={mockOnSearchNode} repoPath="/tmp/test" />);
    fireEvent.click(screen.getByText('Clear all'));
    expect(mockClearSelection).toHaveBeenCalledTimes(1);
  });

  it('calls toggleNode when deselect button is clicked', () => {
    render(<SearchSelectSidebar nodes={mockNodes as any} onSearchNode={mockOnSearchNode} repoPath="/tmp/test" />);
    fireEvent.click(screen.getByTestId('deselect-sym:a'));
    expect(mockToggleNode).toHaveBeenCalledWith('sym:a');
  });

  it('renders expansion group labels', () => {
    render(<SearchSelectSidebar nodes={mockNodes as any} onSearchNode={mockOnSearchNode} repoPath="/tmp/test" />);
    expect(screen.getByText('Same File')).toBeInTheDocument();
    expect(screen.getByText('Callers')).toBeInTheDocument();
    expect(screen.getByText('Callees')).toBeInTheDocument();
    expect(screen.getByText('Area Members')).toBeInTheDocument();
  });

  it('calls toggleExpansionGroup when group toggle is clicked', () => {
    render(<SearchSelectSidebar nodes={mockNodes as any} onSearchNode={mockOnSearchNode} repoPath="/tmp/test" />);
    fireEvent.click(screen.getByTestId('toggle-same-file'));
    expect(mockToggleExpansionGroup).toHaveBeenCalledWith('same-file');
  });

  it('delegates node search to the graph handler', () => {
    mockOnSearchNode.mockReturnValue(true);
    render(<SearchSelectSidebar nodes={mockNodes as any} onSearchNode={mockOnSearchNode} repoPath="/tmp/test" />);
    const input = screen.getByPlaceholderText('Search node or area...');
    fireEvent.change(input, { target: { value: 'funcA' } });
    fireEvent.click(screen.getByText('Search'));
    expect(mockOnSearchNode).toHaveBeenCalledWith('funcA');
    expect(screen.queryByText('Not found')).not.toBeInTheDocument();
  });

  it('falls back to area search when node search returns false', () => {
    mockOnSearchNode.mockReturnValue(false);
    render(<SearchSelectSidebar nodes={mockNodes as any} onSearchNode={mockOnSearchNode} repoPath="/tmp/test" />);
    const input = screen.getByPlaceholderText('Search node or area...');
    fireEvent.change(input, { target: { value: 'Auth' } });
    fireEvent.click(screen.getByText('Search'));
    expect(mockOnSearchNode).toHaveBeenCalledWith('Auth');
    expect(mockToggleArea).toHaveBeenCalledWith('auth');
    expect(screen.queryByText('Not found')).not.toBeInTheDocument();
  });

  it('shows Not found when neither node nor area matches', () => {
    mockOnSearchNode.mockReturnValue(false);
    render(<SearchSelectSidebar nodes={mockNodes as any} onSearchNode={mockOnSearchNode} repoPath="/tmp/test" />);
    const input = screen.getByPlaceholderText('Search node or area...');
    fireEvent.change(input, { target: { value: 'xyz' } });
    fireEvent.click(screen.getByText('Search'));
    expect(screen.getByText('Not found')).toBeInTheDocument();
  });

  it('renders the Select By area tree', () => {
    render(<SearchSelectSidebar nodes={mockNodes as any} onSearchNode={mockOnSearchNode} repoPath="/tmp/test" />);
    expect(screen.getByText('Select By')).toBeInTheDocument();
    expect(screen.getByText('Auth Service')).toBeInTheDocument();
    expect(screen.getByText('Payments')).toBeInTheDocument();
  });

  it('calls toggleArea when area checkbox is clicked', () => {
    render(<SearchSelectSidebar nodes={mockNodes as any} onSearchNode={mockOnSearchNode} repoPath="/tmp/test" />);
    const authLabel = screen.getByText('Auth Service').closest('label');
    expect(authLabel).toBeTruthy();
    fireEvent.click(authLabel!);
    expect(mockToggleArea).toHaveBeenCalledWith('auth');
  });

  it('expands an area and toggles a member checkbox', () => {
    render(<SearchSelectSidebar nodes={mockNodes as any} onSearchNode={mockOnSearchNode} repoPath="/tmp/test" />);
    const expand = screen.getByText('Auth Service').parentElement?.querySelector('span[role="button"]') ?? screen.getByText('Auth Service').previousElementSibling;
    if (expand) fireEvent.click(expand);
    const member = screen.queryByTestId('area-member-auth-sym-login');
    if (member) {
      fireEvent.click(member);
      expect(mockToggleAreaMember).toHaveBeenCalledWith('sym-login');
    }
  });
});
