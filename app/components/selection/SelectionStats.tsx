'use client';

import { useMemo } from 'react';
import { useSelection } from '@/app/contexts/SelectionContext';
import { useAreaStore } from '@/app/contexts/AreaContext';
import { computeAreaEdgeStats } from '@/lib/selection/stats';
import type { AnalysisEdge } from '@/lib/analysis/types';

interface SelectionStatsProps {
  edges: AnalysisEdge[];
}

/**
 * Displays areas ranked by the number of edges leaving them.
 *
 * @remarks
 * Shows a proportional bar and member count for each area.
 * Areas that contain selected nodes but have no leaving edges
 * are shown with a zero count. If there are no selected nodes
 * or no relevant areas, an empty state is rendered.
 *
 * @param edges - All analysis edges for computing leaving-edge counts.
 */
export default function SelectionStats({ edges }: SelectionStatsProps) {
  const { state, activeNodeIds } = useSelection();
  const { areas, runtimeState } = useAreaStore();

  const stats = useMemo(
    () => computeAreaEdgeStats(activeNodeIds, edges, areas),
    [activeNodeIds, edges, areas],
  );

  const maxCount = useMemo(
    () => (stats.length > 0 ? Math.max(...stats.map((s) => s.leavingCount)) : 1),
    [stats],
  );

  if (stats.length === 0) {
    return (
      <div style={{ fontSize: 11, color: '#9ca3af', padding: '8px 0', textAlign: 'center' }}>
        Select nodes to see area edge statistics
      </div>
    );
  }

  const handleCopy = (text: string) => {
    navigator.clipboard?.writeText(text);
  };

  return (
    <div>
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6, fontWeight: 500 }}>
        Useful stats
      </div>
      {stats.map((stat) => {
        const area = areas.find((a) => a.id === stat.areaId);
        const color = runtimeState.get(stat.areaId)?.color ?? '#6b7280';
        const barWidth = maxCount > 0 ? (stat.leavingCount / maxCount) * 100 : 0;

        return (
          <div
            key={stat.areaId}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '3px 0',
              fontSize: 11,
            }}
          >
            <span
              style={{
                display: 'inline-block',
                background: `${color}26`,
                color,
                fontSize: 9,
                padding: '1px 6px',
                borderRadius: 8,
                fontWeight: 500,
                minWidth: 60,
                textAlign: 'center',
                cursor: 'pointer',
              }}
              title={`${stat.areaName} — ${stat.leavingCount} edges leaving`}
              onClick={() => handleCopy(stat.areaName)}
            >
              {stat.areaName}
            </span>
            <div
              style={{
                flex: 1,
                height: 8,
                background: '#e5e7eb',
                borderRadius: 4,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${barWidth}%`,
                  height: '100%',
                  background: color,
                  borderRadius: 4,
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
            <span style={{ color: '#9ca3af', fontSize: 10, minWidth: 20, textAlign: 'right' }}>
              {stat.leavingCount}
            </span>
          </div>
        );
      })}
    </div>
  );
}