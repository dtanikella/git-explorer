// __tests__/contexts/AreaContext.test.tsx
import { renderHook, act } from '@testing-library/react';
import { AreaProvider, useAreaStore } from '@/app/contexts/AreaContext';
import type { Area } from '@/lib/areas/types';
import type { ReactNode } from 'react';

const mockAreas: Area[] = [
  {
    id: 'auth',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    name: 'Auth',
    type: 'business_domain',
    contains: ['sym-login', 'sym-logout'],
    parent: null,
    children: [],
    clusterStrength: 0,
  },
  {
    id: 'utils',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    name: 'Utils',
    type: 'utils',
    contains: ['sym-helper'],
    parent: null,
    children: [],
    clusterStrength: 0,
  },
];

function wrapper({ children }: { children: ReactNode }) {
  return <AreaProvider areas={mockAreas}>{children}</AreaProvider>;
}

describe('AreaContext', () => {
  it('provides areas and initializes all as visible', () => {
    const { result } = renderHook(() => useAreaStore(), { wrapper });
    expect(result.current.areas).toHaveLength(2);
    const visible = result.current.getVisibleAreas();
    expect(visible).toHaveLength(2);
  });

  it('toggleVisibility hides an area', () => {
    const { result } = renderHook(() => useAreaStore(), { wrapper });
    act(() => { result.current.toggleVisibility('auth'); });
    const visible = result.current.getVisibleAreas();
    expect(visible).toHaveLength(1);
    expect(visible[0].id).toBe('utils');
  });

  it('getAreasForNode returns correct areas for overlapping node', () => {
    const { result } = renderHook(() => useAreaStore(), { wrapper });
    const areas = result.current.getAreasForNode('sym-login');
    expect(areas).toHaveLength(1);
    expect(areas[0].id).toBe('auth');
  });

  it('getAreasForNode returns empty array for unknown node', () => {
    const { result } = renderHook(() => useAreaStore(), { wrapper });
    const areas = result.current.getAreasForNode('sym-unknown');
    expect(areas).toHaveLength(0);
  });

  it('runtimeState has deterministic colors per area id', () => {
    const { result } = renderHook(() => useAreaStore(), { wrapper });
    const state1 = result.current.runtimeState.get('auth')!;
    expect(state1.color).toMatch(/^#[0-9a-f]{6}$/);
    // Re-render should produce same color
    const { result: result2 } = renderHook(() => useAreaStore(), { wrapper });
    expect(result2.current.runtimeState.get('auth')!.color).toBe(state1.color);
  });

  it('setAreas updates areas and rebuilds runtime state', () => {
    const { result } = renderHook(() => useAreaStore(), { wrapper });
    expect(result.current.areas).toHaveLength(2);

    const newArea: Area = {
      id: 'payments',
      created_at: '2026-06-16T00:00:00Z',
      updated_at: '2026-06-16T00:00:00Z',
      name: 'Payments',
      type: 'business_domain',
      contains: ['sym-pay'],
      parent: null,
      children: [],
      clusterStrength: 0,
    };

    act(() => {
      result.current.setAreas([...mockAreas, newArea]);
    });

    expect(result.current.areas).toHaveLength(3);
    expect(result.current.runtimeState.get('payments')).toBeDefined();
    expect(result.current.runtimeState.get('payments')!.visible).toBe(true);
    expect(result.current.runtimeState.get('auth')).toBeDefined();
  });
});
