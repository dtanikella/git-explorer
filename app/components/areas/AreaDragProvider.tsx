'use client';

import React, { useCallback, useState, createContext, useContext, type ReactNode } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import type { Area } from '@/lib/areas/types';

interface DragData {
  type: 'node' | 'area';
  nodeId?: string;
  nodeIds?: string[];
  areaId?: string;
  area?: Area;
}

export interface DragHandlers {
  onNodeToArea: (nodeId: string, areaId: string) => void;
  onAreaReparent: (areaId: string, newParentId: string | null) => void;
  onNodeDragFromArea?: (nodeId: string, fromAreaId: string, toAreaId: string) => void;
  onNodesToArea?: (nodeIds: string[], areaId: string) => void;
  isCycleSafe: (areaId: string, potentialParentId: string | null) => boolean;
}

export interface AreaDragContextValue {
  activeDrag: DragData | null;
  handlers: DragHandlers;
}

const AreaDragContext = createContext<AreaDragContextValue | null>(null);

export function useAreaDrag(): AreaDragContextValue {
  const ctx = useContext(AreaDragContext);
  if (!ctx) throw new Error('useAreaDrag must be used within an AreaDragProvider');
  return ctx;
}

interface AreaDragProviderProps {
  children: ReactNode;
  handlers: DragHandlers;
}

export function AreaDragProvider({ children, handlers }: AreaDragProviderProps) {
  const [activeDrag, setActiveDrag] = useState<DragData | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as DragData | undefined;
    if (data) {
      setActiveDrag(data);
    }
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDrag(null);

      const { active, over } = event;
      if (!over) return;

      const activeData = active.data.current as DragData | undefined;
      const overData = over.data.current as DragData | undefined;

      if (!activeData) return;

      // Node → Area: drag a node from the browser (or from another area's
      // member row) into an area. A member row carries its source areaId;
      // dropping it on a different area reassigns it there instead of just
      // adding it. A rail drag carries the full multiselect (nodeIds) when
      // the dragged row is part of a multi-row selection.
      if (activeData.type === 'node' && overData?.type === 'area') {
        if (activeData.nodeIds && activeData.nodeIds.length > 1 && handlers.onNodesToArea) {
          handlers.onNodesToArea(activeData.nodeIds, overData.areaId!);
        } else if (activeData.areaId && activeData.areaId !== overData.areaId && handlers.onNodeDragFromArea) {
          handlers.onNodeDragFromArea(activeData.nodeId!, activeData.areaId, overData.areaId!);
        } else {
          handlers.onNodeToArea(activeData.nodeId!, overData.areaId!);
        }
        return;
      }

      // Node → Node (within area member): could be a node from another area
      if (activeData.type === 'node' && overData?.type === 'node') {
        if (overData.areaId) {
          handlers.onNodeToArea(activeData.nodeId!, overData.areaId);
        }
        return;
      }

      // Area → Area: reparenting
      if (activeData.type === 'area' && overData?.type === 'area') {
        const draggedAreaId = activeData.areaId!;
        const targetAreaId = overData.areaId!;

        // Don't reparent to self
        if (draggedAreaId === targetAreaId) return;

        // Check for cycles
        if (handlers.isCycleSafe(draggedAreaId, targetAreaId)) {
          handlers.onAreaReparent(draggedAreaId, targetAreaId);
        }
        return;
      }

      // Area → root (drop on empty area of tree table)
      if (activeData.type === 'area' && !overData) {
        handlers.onAreaReparent(activeData.areaId!, null);
        return;
      }
    },
    [handlers]
  );

  const handleDragCancel = useCallback(() => {
    setActiveDrag(null);
  }, []);

  return (
    <AreaDragContext.Provider value={{ activeDrag, handlers }}>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {children}
        <DragOverlay>
          {activeDrag && (
            <div
              style={{
                padding: '6px 12px',
                background: 'white',
                border: '1px solid #3b82f6',
                borderRadius: 6,
                fontSize: 12,
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                opacity: 0.9,
              }}
            >
              {activeDrag.type === 'node'
                ? activeDrag.nodeIds && activeDrag.nodeIds.length > 1
                  ? `${activeDrag.nodeIds.length} nodes`
                  : `Node: ${activeDrag.nodeId}`
                : `Area: ${activeDrag.area?.name ?? activeDrag.areaId}`}
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </AreaDragContext.Provider>
  );
}