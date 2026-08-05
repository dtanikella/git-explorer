'use client';

import { createContext, useContext, useState, useMemo, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Area, AreaRuntimeState } from '@/lib/areas/types';
import { buildNodeToAreas } from '@/lib/areas/lookup';

export interface AreaStoreValue {
  areas: Area[];
  runtimeState: Map<string, AreaRuntimeState>;
  nodeToAreas: Map<string, Area[]>;
  setAreas(areas: Area[]): void;
  toggleVisibility(areaId: string): void;
  getVisibleAreas(): Area[];
  getAreasForNode(scipSymbol: string): Area[];
}

const AreaContext = createContext<AreaStoreValue | null>(null);

export function useAreaStore(): AreaStoreValue {
  const ctx = useContext(AreaContext);
  if (!ctx) throw new Error('useAreaStore must be used within an AreaProvider');
  return ctx;
}

function hashToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  // Generate HSL with good saturation and lightness for overlay visibility
  const hue = Math.abs(hash % 360);
  const sat = 60 + Math.abs((hash >> 8) % 20); // 60-80%
  const lit = 40 + Math.abs((hash >> 16) % 15); // 40-55%
  // Convert HSL to hex
  const h = hue, s = sat / 100, l = lit / 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function buildInitialRuntimeState(areas: Area[]): Map<string, AreaRuntimeState> {
  const map = new Map<string, AreaRuntimeState>();
  for (const area of areas) {
    map.set(area.id, {
      visible: true,
      color: hashToColor(area.id),
    });
  }
  return map;
}

interface AreaProviderProps {
  areas: Area[];
  children: ReactNode;
}

export function AreaProvider({ areas: initialAreas, children }: AreaProviderProps) {
  const [areas, setAreasState] = useState<Area[]>(initialAreas);
  const [runtimeState, setRuntimeState] = useState<Map<string, AreaRuntimeState>>(() =>
    buildInitialRuntimeState(areas),
  );

  useEffect(() => {
    setAreasState(initialAreas);
  }, [initialAreas]);

  // Rebuild runtime state when areas change (new areas get defaults)
  useEffect(() => {
    setRuntimeState((prev) => {
      const next = new Map<string, AreaRuntimeState>();
      for (const area of areas) {
        const existing = prev.get(area.id);
        next.set(area.id, existing ?? { visible: true, color: hashToColor(area.id) });
      }
      return next;
    });
  }, [areas]);

  const nodeToAreas = useMemo(() => buildNodeToAreas(areas), [areas]);

  const setAreas = useCallback((newAreas: Area[]) => {
    setAreasState(newAreas);
  }, []);

  const toggleVisibility = useCallback((areaId: string) => {
    setRuntimeState((prev) => {
      const next = new Map(prev);
      const state = next.get(areaId);
      if (state) {
        next.set(areaId, { ...state, visible: !state.visible });
      }
      return next;
    });
  }, []);

  const getVisibleAreas = useCallback((): Area[] => {
    return areas.filter((a) => runtimeState.get(a.id)?.visible === true);
  }, [areas, runtimeState]);

  const getAreasForNode = useCallback((scipSymbol: string): Area[] => {
    return nodeToAreas.get(scipSymbol) ?? [];
  }, [nodeToAreas]);

  const value = useMemo<AreaStoreValue>(() => ({
    areas,
    runtimeState,
    nodeToAreas,
    setAreas,
    toggleVisibility,
    getVisibleAreas,
    getAreasForNode,
  }), [areas, runtimeState, nodeToAreas, setAreas, toggleVisibility, getVisibleAreas, getAreasForNode]);

  return (
    <AreaContext.Provider value={value}>
      {children}
    </AreaContext.Provider>
  );
}
