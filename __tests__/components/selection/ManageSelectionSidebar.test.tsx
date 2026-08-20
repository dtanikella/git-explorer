import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import ManageSelectionSidebar from '@/app/components/selection/ManageSelectionSidebar';
import type { SelectionContextValue } from '@/app/contexts/SelectionContext';
import type { Area, AreaRuntimeState } from '@/lib/areas/types';

const mockSetAreas = jest.fn();
const mockGetAreasForNode = jest.fn();
const fetchMock = jest.fn();

interface MockAreaStore {
  areas: Area[];
  runtimeState: Map<string, AreaRuntimeState>;
  nodeToAreas: Map<string, Area[]>;
  toggleVisibility: jest.Mock;
  getVisibleAreas: () => Area[];
  getAreasForNode: jest.Mock;
  setAreas: jest.Mock;
}

const mockAreas: Area[] = [
  {
    id: 'auth',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    name: 'Auth Service',
    type: 'business_domain',
    contains: ['sym-login', 'sym-logout'],
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

let mockSelectionValue: SelectionContextValue = {
  state: {
    selectedNodeIds: new Set(),
    selectedAreaIds: new Set(),
    expansions: new Map(),
  },
  toggleNode: jest.fn(),
  toggleArea: jest.fn(),
  clearSelection: jest.fn(),
  toggleExpansionGroup: jest.fn(),
  toggleExpandedNode: jest.fn(),
  toggleAreaMember: jest.fn(),
  activeNodeIds: new Set<string>(['sym-login', 'sym-logout']),
  hasSelection: true,
};

let mockAreaStoreValue: MockAreaStore = {
  areas: mockAreas,
  runtimeState: new Map([
    ['auth', { visible: true, color: '#3b82f6' }],
    ['payments', { visible: true, color: '#10b981' }],
  ]),
  nodeToAreas: new Map(),
  toggleVisibility: jest.fn(),
  getVisibleAreas: () => mockAreas,
  getAreasForNode: mockGetAreasForNode,
  setAreas: mockSetAreas,
};

jest.mock('@/app/contexts/SelectionContext', () => ({
  useSelection: () => mockSelectionValue,
}));

jest.mock('@/app/contexts/AreaContext', () => ({
  useAreaStore: () => mockAreaStoreValue,
}));

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = fetchMock as typeof fetch;
  mockSelectionValue = {
    state: {
      selectedNodeIds: new Set(),
      selectedAreaIds: new Set(),
      expansions: new Map(),
    },
    toggleNode: jest.fn(),
    toggleArea: jest.fn(),
    clearSelection: jest.fn(),
    toggleExpansionGroup: jest.fn(),
    toggleExpandedNode: jest.fn(),
    toggleAreaMember: jest.fn(),
    activeNodeIds: new Set<string>(['sym-login', 'sym-logout']),
    hasSelection: true,
  };
  mockAreaStoreValue = {
    areas: mockAreas,
    runtimeState: new Map([
      ['auth', { visible: true, color: '#3b82f6' }],
      ['payments', { visible: true, color: '#10b981' }],
    ]),
    nodeToAreas: new Map(),
    toggleVisibility: jest.fn(),
    getVisibleAreas: () => mockAreas,
    getAreasForNode: mockGetAreasForNode,
    setAreas: mockSetAreas,
  };
  mockGetAreasForNode.mockImplementation((id: string) => {
    return mockAreas.filter((a) => a.contains.includes(id));
  });
});

describe('ManageSelectionSidebar', () => {
  it('renders common assigned areas', () => {
    render(<ManageSelectionSidebar effectiveNodeIds={['sym-login', 'sym-logout']} repoPath="/tmp/test" />);
    expect(screen.getByText('Manage Selection')).toBeInTheDocument();
    expect(screen.getByText('Auth Service')).toBeInTheDocument();
  });

  it('stages removal when clicking × on a common area', () => {
    render(<ManageSelectionSidebar effectiveNodeIds={['sym-login', 'sym-logout']} repoPath="/tmp/test" />);
    fireEvent.click(screen.getByTestId('remove-area-auth'));
    expect(screen.getByText('Undo')).toBeInTheDocument();
    expect(screen.getByTestId('save-selection')).toBeEnabled();
  });

  it('stages an add for an existing area', () => {
    render(<ManageSelectionSidebar effectiveNodeIds={['sym-login', 'sym-logout']} repoPath="/tmp/test" />);
    const select = screen.getByTestId('assign-area-picker');
    fireEvent.change(select, { target: { value: 'payments' } });
    fireEvent.click(screen.getByTestId('stage-add'));
    expect(screen.getByText('Staged additions')).toBeInTheDocument();
    expect(screen.getByText('Payments')).toBeInTheDocument();
  });

  it('saves staged additions by merging node ids into existing area', async () => {
    fetchMock.mockResolvedValue({
      json: async () => ({ success: true }),
    });

    render(<ManageSelectionSidebar effectiveNodeIds={['sym-login', 'sym-logout']} repoPath="/tmp/test" />);
    const select = screen.getByTestId('assign-area-picker');
    fireEvent.change(select, { target: { value: 'payments' } });
    fireEvent.click(screen.getByTestId('stage-add'));
    fireEvent.click(screen.getByTestId('save-selection'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/areas');
    const body = JSON.parse(request.body as string);
    expect(body).toMatchObject({
      action: 'save',
      repoPath: '/tmp/test',
      data: { version: 1 },
    });
    const payments = body.data.areas.find((a: Area) => a.id === 'payments');
    expect(payments.contains).toEqual(expect.arrayContaining(['sym-charge', 'sym-login', 'sym-logout']));
    expect(payments.contains.filter((id: string) => id === 'sym-login')).toHaveLength(1);
    await waitFor(() => expect(screen.getByTestId('save-success')).toBeInTheDocument());
  });

  it('saves staged removals by removing node ids from area', async () => {
    fetchMock.mockResolvedValue({
      json: async () => ({ success: true }),
    });

    render(<ManageSelectionSidebar effectiveNodeIds={['sym-login', 'sym-logout']} repoPath="/tmp/test" />);
    fireEvent.click(screen.getByTestId('remove-area-auth'));
    fireEvent.click(screen.getByTestId('save-selection'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, request] = fetchMock.mock.calls[0];
    const body = JSON.parse(request.body as string);
    const auth = body.data.areas.find((a: Area) => a.id === 'auth');
    expect(auth.contains).toHaveLength(0);
  });

  it('stages creation of a new area and saves it', async () => {
    fetchMock.mockResolvedValue({
      json: async () => ({ success: true }),
    });
    jest.spyOn(Math, 'random').mockReturnValue(0.123456789);

    render(<ManageSelectionSidebar effectiveNodeIds={['sym-login', 'sym-logout']} repoPath="/tmp/test" />);
    const select = screen.getByTestId('assign-area-picker');
    fireEvent.change(select, { target: { value: '__new__' } });
    fireEvent.change(screen.getByTestId('new-area-name'), { target: { value: 'Config Pipeline' } });
    fireEvent.change(screen.getByTestId('new-area-parent'), { target: { value: 'auth' } });
    fireEvent.click(screen.getByTestId('stage-add'));

    expect(screen.getByText('Create: Config Pipeline')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('save-selection'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, request] = fetchMock.mock.calls[0];
    const body = JSON.parse(request.body as string);
    expect(body.data.areas).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'config-pipeline-1f9a',
          name: 'Config Pipeline',
          type: 'business_domain',
          contains: ['sym-login', 'sym-logout'],
          parent: 'auth',
          children: [],
        }),
        expect.objectContaining({
          id: 'auth',
          children: expect.arrayContaining(['config-pipeline-1f9a']),
        }),
      ]),
    );

    jest.spyOn(Math, 'random').mockRestore();
  });

  it('clears staged changes when Clear is clicked', () => {
    render(<ManageSelectionSidebar effectiveNodeIds={['sym-login', 'sym-logout']} repoPath="/tmp/test" />);
    fireEvent.click(screen.getByTestId('remove-area-auth'));
    expect(screen.getByText('Undo')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('clear-pending'));
    expect(screen.queryByText('Undo')).not.toBeInTheDocument();
  });

  it('shows an error when saving fails', async () => {
    fetchMock.mockResolvedValue({
      json: async () => ({ success: false, error: 'No write access' }),
    });

    render(<ManageSelectionSidebar effectiveNodeIds={['sym-login', 'sym-logout']} repoPath="/tmp/test" />);
    fireEvent.click(screen.getByTestId('remove-area-auth'));
    fireEvent.click(screen.getByTestId('save-selection'));

    expect(await screen.findByTestId('save-error')).toHaveTextContent('No write access');
  });

  describe('Regenerate Areas action', () => {
    it('POSTs to /api/areas/generate, shows a loading state, then applies the returned areas', async () => {
      const regeneratedAreas: Area[] = [
        { ...mockAreas[0], name: 'Generated Auth', contains: ['sym-login'] },
        { ...mockAreas[1], name: 'Generated Payments' },
      ];
      let releaseResolve: (value: unknown) => void = () => {};
      const pending = new Promise((resolve) => { releaseResolve = resolve; });
      fetchMock.mockReturnValueOnce(
        pending.then(() => ({
          json: async () => ({ success: true, data: { version: 1, areas: regeneratedAreas } }),
        })),
      );

      render(<ManageSelectionSidebar effectiveNodeIds={['sym-login', 'sym-logout']} repoPath="/tmp/test" />);
      fireEvent.click(screen.getByTestId('regenerate-areas'));

      // Loading state is surfaced while the request is in flight.
      expect(screen.getByText('Regenerating…')).toBeInTheDocument();
      const [url, request] = fetchMock.mock.calls[0];
      expect(url).toBe('/api/areas/generate');
      expect(JSON.parse((request as Request).body as string)).toMatchObject({ repoPath: '/tmp/test' });

      await act(async () => { releaseResolve(null); });
      expect(await screen.findByTestId('regenerate-success')).toBeInTheDocument();
      expect(mockSetAreas).toHaveBeenCalledWith(regeneratedAreas);
    });

    it('shows an error and never applies the areas when regeneration fails', async () => {
      fetchMock.mockResolvedValue({
        json: async () => ({ success: false, error: 'Analysis failed' }),
      });

      render(<ManageSelectionSidebar effectiveNodeIds={['sym-login', 'sym-logout']} repoPath="/tmp/test" />);
      fireEvent.click(screen.getByTestId('regenerate-areas'));

      expect(await screen.findByTestId('regenerate-error')).toHaveTextContent('Analysis failed');
      expect(mockSetAreas).not.toHaveBeenCalled();
      expect(screen.queryByTestId('regenerate-success')).not.toBeInTheDocument();
    });
  });

  it('returns null when there is no selection', () => {
    mockSelectionValue = {
      ...mockSelectionValue,
      activeNodeIds: new Set<string>(),
      hasSelection: false,
    };
    const { container } = render(<ManageSelectionSidebar effectiveNodeIds={[]} repoPath="/tmp/test" />);
    expect(container.firstChild).toBeNull();
  });
});
