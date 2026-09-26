'use client';

import { useMemo } from 'react';
import { useSelection } from '@/app/contexts/SelectionContext';
import { useAreaStore } from '@/app/contexts/AreaContext';
import { computeAreaEdgeStats, getAreaMemberIds } from '@/lib/selection/stats';
import { formatCopyText } from '@/lib/selection/format';
import type { AnalysisEdge, AnalysisNode } from '@/lib/analysis/types';
import { TreeIconButton, CopyIcon, CheckIcon } from './TreeIconButton';
import { useCopyFeedback } from './useCopyFeedback';

interface SelectionStatsProps {
  nodes: AnalysisNode[];
  edges: AnalysisEdge[];
}

const COPY_AREAS_KEY = '__areas__';

/**
 * Bottom-half "Useful stats" panel: areas in the effective selection ranked
 * by edges leaving the area.
 *
 * @remarks
 * The header summarizes the effective selection (nodes, files, areas). Rows
 * stack from the bottom up, so the highest-ranked area sits at the bottom
 * next to the scroll anchor and the column label reads at the top. Each row
 * shows a proportional bar, the leaving-edge count (tooltip: how many members
 * are selected), and a copy button for the area's members (Alt copies only
 * the selected ones).
 *
 * @param nodes - All analysis nodes, used for file counts and copying members.
 * @param edges - All analysis edges for computing leaving-edge counts.
 */
export default function SelectionStats({ nodes, edges }: SelectionStatsProps) {
  const { activeNodeIds } = useSelection();
  const { areas, runtimeState } = useAreaStore();
  const { copiedKey, copy } = useCopyFeedback();

  const stats = useMemo(
    () => computeAreaEdgeStats(activeNodeIds, edges, areas),
    [activeNodeIds, edges, areas],
  );

  const areaMemberIds = useMemo(() => getAreaMemberIds(areas), [areas]);

  const fileCount = useMemo(() => {
    const files = new Set<string>();
    for (const n of nodes) {
      if (activeNodeIds.has(n.scipSymbol)) files.add(n.filePath);
    }
    return files.size;
  }, [nodes, activeNodeIds]);

  const maxCount = Math.max(1, ...stats.map((s) => s.leavingCount));

  const copyAreaMembers = (areaId: string, onlySelected: boolean) => {
    const members = areaMemberIds.get(areaId);
    if (!members) return;
    const picked = nodes.filter(
      (n) => members.has(n.scipSymbol) && (!onlySelected || activeNodeIds.has(n.scipSymbol)),
    );
    copy(areaId, formatCopyText(picked));
  };

  const copyAreaList = () => {
    copy(COPY_AREAS_KEY, stats.map((s) => `${s.areaName} — ${s.leavingCount} edges out`).join('\n'));
  };

  return (
    <div
      data-testid="selection-stats-panel"
      style={{
        flex: '0 0 50%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        borderTop: '1px solid #e5e7eb',
        background: '#fff',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px',
          borderBottom: '1px solid #f3f4f6',
        }}
      >
        <b>Useful stats</b>
        <span style={{ fontSize: 10, color: '#9ca3af' }}>
          {activeNodeIds.size} nodes · {fileCount} files · {stats.length} areas
        </span>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column-reverse',
          gap: 6,
          padding: '8px 12px 12px',
        }}
      >
        {stats.length === 0 ? (
          <div style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', padding: '8px 0' }}>
            Select nodes to see their areas.
          </div>
        ) : (
          <>
            {stats.map((stat) => {
              const color = runtimeState.get(stat.areaId)?.color ?? '#6b7280';
              const copied = copiedKey === stat.areaId;
              return (
                <div key={stat.areaId} style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 'none', fontSize: 11 }}>
                  <span style={{ width: 96, flex: 'none', minWidth: 0 }}>
                    <span
                      title={stat.areaName}
                      style={{
                        display: 'inline-block',
                        maxWidth: '100%',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        verticalAlign: 'top',
                        background: `${color}26`,
                        color,
                        fontSize: 10,
                        padding: '2px 8px',
                        borderRadius: 9,
                        fontWeight: 500,
                      }}
                    >
                      {stat.areaName}
                    </span>
                  </span>
                  <div style={{ flex: 1, height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${(stat.leavingCount / maxCount) * 100}%`,
                        height: '100%',
                        background: color,
                        borderRadius: 4,
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                  <span
                    title={`${stat.selectedCount} selected in this area`}
                    style={{ width: 28, flex: 'none', textAlign: 'right', fontSize: 10, color: '#9ca3af' }}
                  >
                    {stat.leavingCount}
                  </span>
                  <TreeIconButton
                    label={copied ? 'Copied!' : 'Copy members (Alt: only selected)'}
                    tone={copied ? 'success' : 'default'}
                    onClick={(e) => copyAreaMembers(stat.areaId, e.altKey)}
                  >
                    {copied ? <CheckIcon /> : <CopyIcon />}
                  </TreeIconButton>
                </div>
              );
            })}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flex: 'none',
                fontSize: 11,
                color: '#6b7280',
                fontWeight: 500,
              }}
            >
              <span>Areas in selection</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 400 }}>edges out</span>
                <TreeIconButton
                  label={copiedKey === COPY_AREAS_KEY ? 'Copied!' : 'Copy area list'}
                  tone={copiedKey === COPY_AREAS_KEY ? 'success' : 'default'}
                  onClick={copyAreaList}
                >
                  {copiedKey === COPY_AREAS_KEY ? <CheckIcon /> : <CopyIcon />}
                </TreeIconButton>
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
