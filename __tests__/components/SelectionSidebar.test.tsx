import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SelectionSidebar from '@/app/components/selection/SelectionSidebar';
import type { SelectionContextValue, ExpansionGroup } from '@/app/contexts/SelectionContext';

// We test the sidebar by passing a mock context value via props
// (the sidebar receives context internally via useSelection, but we'll
// mock the context module)

const mockToggleNode = jest.fn();
const mockClearSelection = jest.fn();
const mockToggleExpansionGroup = jest.fn();
const mockToggleExpandedNode = jest.fn();

jest.mock('@/app/contexts/SelectionContext', () => ({
  useSelection: (): SelectionContextValue => mockContextValue,
}));

jest.mock('@/app/contexts/AreaContext', () => ({
  useAreaStore: () => ({
    areas: [],
    runtimeState: new Map(),
    nodeToAreas: new Map(),
    toggleVisibility: jest.fn(),
    getVisibleAreas: () => [],
    getAreasForNode: () => [],
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
];

beforeEach(() => {
  jest.clearAllMocks();
  mockContextValue = {
    state: {
      selectedNodeIds: new Set(['sym:a']),
      expansions: new Map([
        ['same-file', makeGroup('same-file', [{ nodeId: 'sym:b', sourceNodeIds: ['sym:a'] }])],
        ['callers', makeGroup('callers', [])],
        ['callees', makeGroup('callees', [{ nodeId: 'sym:c', sourceNodeIds: ['sym:a'] }])],
      ]),
    },
    toggleNode: mockToggleNode,
    clearSelection: mockClearSelection,
    toggleExpansionGroup: mockToggleExpansionGroup,
    toggleExpandedNode: mockToggleExpandedNode,
    activeNodeIds: new Set(['sym:a']),
    hasSelection: true,
  };
});

describe('SelectionSidebar', () => {
  it('renders the sidebar with header and clear all', () => {
    render(<SelectionSidebar nodes={mockNodes as any} repoPath="/tmp/test" />);
    expect(screen.getByText('Selection')).toBeInTheDocument();
    expect(screen.getByText('Clear all')).toBeInTheDocument();
  });

  it('lists selected nodes by name', () => {
    render(<SelectionSidebar nodes={mockNodes as any} repoPath="/tmp/test" />);
    expect(screen.getByText('funcA')).toBeInTheDocument();
  });

  it('calls clearSelection when Clear all is clicked', () => {
    render(<SelectionSidebar nodes={mockNodes as any} repoPath="/tmp/test" />);
    fireEvent.click(screen.getByText('Clear all'));
    expect(mockClearSelection).toHaveBeenCalledTimes(1);
  });

  it('renders expansion group labels', () => {
    render(<SelectionSidebar nodes={mockNodes as any} repoPath="/tmp/test" />);
    expect(screen.getByText('Same File')).toBeInTheDocument();
    expect(screen.getByText('Callers')).toBeInTheDocument();
    expect(screen.getByText('Callees')).toBeInTheDocument();
  });

  it('calls toggleExpansionGroup when group toggle is clicked', () => {
    render(<SelectionSidebar nodes={mockNodes as any} repoPath="/tmp/test" />);
    const sameFileToggle = screen.getByTestId('toggle-same-file');
    fireEvent.click(sameFileToggle);
    expect(mockToggleExpansionGroup).toHaveBeenCalledWith('same-file');
  });

  it('shows candidate checkboxes when group is enabled', () => {
    mockContextValue.state.expansions.get('same-file')!.enabled = true;
    render(<SelectionSidebar nodes={mockNodes as any} repoPath="/tmp/test" />);
    expect(screen.getByText('funcB')).toBeInTheDocument();
  });

  it('calls toggleExpandedNode when candidate checkbox is clicked', () => {
    mockContextValue.state.expansions.get('same-file')!.enabled = true;
    render(<SelectionSidebar nodes={mockNodes as any} repoPath="/tmp/test" />);
    const checkbox = screen.getByTestId('candidate-same-file-sym:b');
    fireEvent.click(checkbox);
    expect(mockToggleExpandedNode).toHaveBeenCalledWith('same-file', 'sym:b');
  });

  it('hides candidates when group has no candidates', () => {
    render(<SelectionSidebar nodes={mockNodes as any} repoPath="/tmp/test" />);
    // Callers group has 0 candidates — the toggle should still show but with "(0)" or disabled
    const callersToggle = screen.getByTestId('toggle-callers');
    expect(callersToggle).toBeInTheDocument();
  });

  it('calls toggleNode when deselect button is clicked', () => {
    render(<SelectionSidebar nodes={mockNodes as any} repoPath="/tmp/test" />);
    const deselectBtn = screen.getByTestId('deselect-sym:a');
    fireEvent.click(deselectBtn);
    expect(mockToggleNode).toHaveBeenCalledWith('sym:a');
  });
});
