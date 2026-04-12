import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock d3 to avoid ESM resolution issues; TsGraph only needs chainable DOM helpers
jest.mock('d3', () => {
  const chainable = (): any => {
    const obj: Record<string, any> = {};
    const methods = [
      'append', 'style', 'attr', 'call', 'on', 'remove',
      'selectAll', 'join', 'data', 'html', 'text',
    ];
    methods.forEach((m) => {
      obj[m] = jest.fn(() => obj);
    });
    return obj;
  };

  const simMethods = (): any => {
    const obj: Record<string, any> = {};
    ['force', 'on', 'alpha', 'alphaTarget', 'restart', 'stop', 'tick'].forEach((m) => {
      obj[m] = jest.fn(() => obj);
    });
    return obj;
  };

  const linkForce = (): any => {
    const obj: Record<string, any> = {};
    ['id', 'distance', 'strength'].forEach((m) => { obj[m] = jest.fn(() => obj); });
    return obj;
  };

  const dragBehavior = (): any => {
    const obj: Record<string, any> = {};
    obj.on = jest.fn(() => obj);
    return obj;
  };

  const zoomBehavior = (): any => {
    const obj: Record<string, any> = {};
    obj.scaleExtent = jest.fn(() => obj);
    obj.on = jest.fn(() => obj);
    return obj;
  };

  return {
    select: jest.fn(() => chainable()),
    forceSimulation: jest.fn(() => simMethods()),
    forceLink: jest.fn(() => linkForce()),
    forceManyBody: jest.fn(() => ({ strength: jest.fn().mockReturnThis() })),
    forceCollide: jest.fn(() => ({ radius: jest.fn().mockReturnThis() })),
    forceX: jest.fn(() => ({ x: jest.fn().mockReturnThis(), strength: jest.fn().mockReturnThis() })),
    forceY: jest.fn(() => ({ y: jest.fn().mockReturnThis(), strength: jest.fn().mockReturnThis() })),
    zoom: jest.fn(() => zoomBehavior()),
    drag: jest.fn(() => dragBehavior()),
  };
});

// Mock ForcePanel so it doesn't pull in its own dependencies
jest.mock('@/app/components/ts-graph/ForcePanel', () => {
  return function MockForcePanel() {
    return <div data-testid="force-panel" />;
  };
});

import TsGraph from '@/app/components/ts-graph/TsGraph';

const mockFetch = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, data: { nodes: [], edges: [] } }),
  });
  global.fetch = mockFetch;
});

describe('TsGraph — Hide test files toggle', () => {
  it('T023: renders "Hide test files" checkbox checked by default', async () => {
    render(<TsGraph repoPath="/some/repo" />);

    const checkbox = await waitFor(() =>
      screen.getByRole('checkbox', { name: /hide test files/i })
    );
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).toBeChecked();
  });

  it('T024: unchecking toggle triggers fetch with hideTestFiles: false', async () => {
    render(<TsGraph repoPath="/some/repo" />);

    const checkbox = await waitFor(() =>
      screen.getByRole('checkbox', { name: /hide test files/i })
    );

    await act(async () => {
      fireEvent.click(checkbox);
    });

    const bodies = mockFetch.mock.calls.map((c) => JSON.parse(c[1].body));
    const lastBody = bodies[bodies.length - 1];
    expect(lastBody).toMatchObject({ hideTestFiles: false });
  });

  it('T025: re-checking toggle triggers fetch with hideTestFiles: true', async () => {
    render(<TsGraph repoPath="/some/repo" />);

    // Wait for initial render with checkbox
    await waitFor(() =>
      screen.getByRole('checkbox', { name: /hide test files/i })
    );

    // uncheck — wait for loading cycle to complete before re-querying
    await act(async () => {
      fireEvent.click(screen.getByRole('checkbox', { name: /hide test files/i }));
    });

    // re-check — re-query after the loading state was cleared
    await waitFor(() =>
      screen.getByRole('checkbox', { name: /hide test files/i })
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('checkbox', { name: /hide test files/i }));
    });

    const bodies = mockFetch.mock.calls.map((c) => JSON.parse(c[1].body));
    const lastBody = bodies[bodies.length - 1];
    expect(lastBody).toMatchObject({ hideTestFiles: true });
  });
});
