'use client';

import { createContext, useContext, useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import type { Area, AreaRuntimeState } from '@/lib/areas/types';
import { buildNodeToAreas } from '@/lib/areas/lookup';
import { hashToColor, getAreaColor } from '@/lib/areas/color';

export interface AreaStoreValue {
  areas: Area[];
  runtimeState: Map<string, AreaRuntimeState>;
  nodeToAreas: Map<string, Area[]>;
  setAreas(areas: Area[]): void;
  toggleVisibility(areaId: string): void;
  getVisibleAreas(): Area[];
  getAreasForNode(scipSymbol: string): Area[];
  saveError: string | null;
  retrySave(): void;
  setAreaColor(areaId: string, color: string): void;
}

const AreaContext = createContext<AreaStoreValue | null>(null);

/**
 * Returns the area store context value.
 *
 * @remarks
 * Must be called under {@link AreaProvider}. Provides the list of areas,
 * runtime visibility state, node-to-area lookup, and mutation methods.
 *
 * @returns The {@link AreaStoreValue} for the current provider.
 * @throws Error When called outside {@link AreaProvider}.
 * @see PR #38
 * @see PR #39
 */
export function useAreaStore(): AreaStoreValue {
  const ctx = useContext(AreaContext);
  if (!ctx) throw new Error('useAreaStore must be used within an AreaProvider');
  return ctx;
}

function buildInitialRuntimeState(areas: Area[]): Map<string, AreaRuntimeState> {
  const map = new Map<string, AreaRuntimeState>();
  for (const area of areas) {
    map.set(area.id, {
      visible: true,
      color: getAreaColor(area),
    });
  }
  return map;
}

interface AreaProviderProps {
  areas: Area[];
  repoPath: string;
  children: ReactNode;
  onAreasChange?: (areas: Area[]) => void;
}

/**
 * Context provider that manages area state, persistence, and visibility.
 *
 * @remarks
 * Provides area CRUD, visibility toggling, color assignment, and
 * autosave with a serialized queue to prevent concurrent overwrites.
 * Must wrap any component that uses {@link useAreaStore}.
 *
 * @see PR #38
 * @see PR #39
 * @see PR #40
 */
export function AreaProvider({ areas: initialAreas, repoPath, children, onAreasChange }: AreaProviderProps) {
  const [areas, setAreasState] = useState<Area[]>(initialAreas);
  const [runtimeState, setRuntimeState] = useState<Map<string, AreaRuntimeState>>(() =>
    buildInitialRuntimeState(areas),
  );
  const [saveError, setSaveError] = useState<string | null>(null);

  // Serializes writes to /api/areas so autosave-per-edit never fires
  // concurrent overlapping saves; each queued save builds on the prior one.
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const lastFailedPayloadRef = useRef<Area[] | null>(null);
  const repoPathRef = useRef(repoPath);
  useEffect(() => {
    repoPathRef.current = repoPath;
  }, [repoPath]);

  useEffect(() => {
    setAreasState(initialAreas);
  }, [initialAreas]);

  const persist = useCallback((payload: Area[]) => {
    return fetch('/api/areas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'save',
        repoPath: repoPathRef.current,
        data: { version: 1, areas: payload },
      }),
    })
      .then(async (res) => {
        const result = await res.json();
        if (!result.success) throw new Error(result.error || 'Save failed');
        lastFailedPayloadRef.current = null;
        setSaveError(null);
      })
      .catch((err) => {
        lastFailedPayloadRef.current = payload;
        setSaveError(err instanceof Error ? err.message : 'Save failed');
      });
  }, []);

  const queueSave = useCallback(
    (payload: Area[]) => {
      saveQueueRef.current = saveQueueRef.current.then(() => persist(payload));
    },
    [persist],
  );

  const retrySave = useCallback(() => {
    const payload = lastFailedPayloadRef.current;
    if (!payload) return;
    setSaveError(null);
    queueSave(payload);
  }, [queueSave]);

  // Rebuild runtime state when areas change (new areas get defaults)
  useEffect(() => {
    setRuntimeState((prev) => {
      const next = new Map<string, AreaRuntimeState>();
      for (const area of areas) {
        const existing = prev.get(area.id);
        next.set(area.id, existing ?? { visible: true, color: getAreaColor(area) });
      }
      return next;
    });
  }, [areas]);

  const nodeToAreas = useMemo(() => buildNodeToAreas(areas), [areas]);

  const setAreas = useCallback(
    (newAreas: Area[]) => {
      setAreasState(newAreas);
      queueSave(newAreas);
      onAreasChange?.(newAreas);
    },
    [queueSave, onAreasChange],
  );

  const setAreaColor = useCallback((areaId: string, color: string) => {
    const updated = areas.map((a) =>
      a.id === areaId ? { ...a, color } : a,
    );
    setAreasState(updated);
    queueSave(updated);
    onAreasChange?.(updated);
    // Update runtime state immediately for instant preview
    setRuntimeState((prev) => {
      const next = new Map(prev);
      const state = next.get(areaId);
      if (state) {
        next.set(areaId, { ...state, color });
      }
      return next;
    });
  }, [areas, queueSave, onAreasChange]);

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
    saveError,
    retrySave,
    setAreaColor,
  }), [areas, runtimeState, nodeToAreas, setAreas, toggleVisibility, getVisibleAreas, getAreasForNode, saveError, retrySave, setAreaColor]);

  return (
    <AreaContext.Provider value={value}>
      {children}
    </AreaContext.Provider>
  );
}
