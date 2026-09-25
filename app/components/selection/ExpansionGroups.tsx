'use client';

import { useState, useMemo } from 'react';
import { useSelection } from '@/app/contexts/SelectionContext';
import { useAreaStore } from '@/app/contexts/AreaContext';
import type { AnalysisNode } from '@/lib/analysis/types';
import type { ExpansionGroup } from '@/lib/selection/candidates';

interface ExpansionGroupsProps {
  nodes: AnalysisNode[];
}

const GROUP_LABELS: Record<string, string> = {
  'same-file': 'Same File',
  'callers': 'Callers',
  'callees': 'Callees',
};

const GROUP_ORDER = ['same-file', 'callers', 'callees'] as const;

/**
 * Renders expansion group toggles (same-file, callers, callees) with
 * include/exclude trees grouped by source node.
 *
 * @remarks
 * Each expansion group has a master toggle and an expandable list of
 * candidates grouped by their source (selected node/area). Supports
 * include-all, exclude-all, and individual toggling.
 *
 * @param nodes - Analysis nodes for display.
 */
export default function ExpansionGroups({ nodes }: ExpansionGroupsProps) {
  const { state, toggleExpansionGroup, toggleExpandedNode, setExpandedNodes } = useSelection();
  const { nodeToAreas, runtimeState } = useAreaStore();
  const { expansions } = state;

  const nodesBySymbol = useMemo(() => {
    const map = new Map<string, AnalysisNode>();
    for (const n of nodes) map.set(n.scipSymbol, n);
    return map;
  }, [nodes]);

  // Track which source-group subgroups are collapsed
  const [collapsedSources, setCollapsedSources] = useState<Set<string>>(new Set());

  const toggleCollapse = (key: string) => {
    setCollapsedSources((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const renderCandidate = (
    nodeId: string,
    group: ExpansionGroup,
    type: string,
    sourceIsArea: boolean,
  ) => {
    const node = nodesBySymbol.get(nodeId);
    if (!node) return null;
    const isDisabled = group.disabledIds.has(nodeId);
    const nodeAreas = nodeToAreas.get(nodeId) ?? [];

    return (
      <label
        key={nodeId}
        data-testid={`candidate-${type}-${nodeId}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '2px 0',
          cursor: 'pointer',
          opacity: isDisabled ? 0.5 : 1,
          fontSize: 11,
        }}
        onClick={(e) => {
          e.preventDefault();
          toggleExpandedNode(type as any, nodeId);
        }}
      >
        <input
          type="checkbox"
          checked={!isDisabled}
          readOnly
          style={{ margin: 0, cursor: 'pointer' }}
        />
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          <span>{node.name}</span>
          <span style={{ fontSize: 10, color: '#9ca3af' }} title={node.filePath}>
            {truncatePath(node.filePath)}
          </span>
          {sourceIsArea && nodeAreas.map((area) => {
            const color = runtimeState.get(area.id)?.color ?? '#6b7280';
            return (
              <span
                key={area.id}
                style={{
                  display: 'inline-block',
                  background: `${color}26`,
                  color,
                  fontSize: 9,
                  padding: '1px 5px',
                  borderRadius: 8,
                  fontWeight: 500,
                }}
              >
                {area.name}
              </span>
            );
          })}
        </span>
      </label>
    );
  };

  return (
    <div>
      {GROUP_ORDER.map((type) => {
        const group = expansions.get(type);
        if (!group) return null;
        const candidateCount = group.candidates.length;

        // Group candidates by source selected node/area
        const bySource = new Map<string, typeof group.candidates>();
        for (const candidate of group.candidates) {
          for (const srcId of candidate.sourceNodeIds) {
            if (!bySource.has(srcId)) bySource.set(srcId, []);
            bySource.get(srcId)!.push(candidate);
          }
        }

        return (
          <div key={type} style={{ marginBottom: 8 }}>
            {/* Group header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '4px 0',
              }}
            >
              <span style={{ fontSize: 11, color: '#6b7280' }}>
                <span>{GROUP_LABELS[type]}</span>{' '}
                <span>({candidateCount})</span>
              </span>
              <button
                data-testid={`toggle-${type}`}
                onClick={() => toggleExpansionGroup(type as any)}
                style={{
                  width: 32,
                  height: 18,
                  borderRadius: 9,
                  border: 'none',
                  cursor: candidateCount > 0 ? 'pointer' : 'default',
                  background: group.enabled ? '#3b82f6' : '#d1d5db',
                  position: 'relative',
                  transition: 'background 0.2s',
                  opacity: candidateCount > 0 ? 1 : 0.4,
                }}
                disabled={candidateCount === 0}
              >
                <span
                  style={{
                    position: 'absolute',
                    top: 2,
                    left: group.enabled ? 16 : 2,
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    background: '#fff',
                    transition: 'left 0.2s',
                  }}
                />
              </button>
            </div>

            {/* Candidate list grouped by source */}
            {group.enabled && candidateCount > 0 && (
              <div style={{ paddingLeft: 8 }}>
                {[...bySource.entries()].map(([srcId, candidates]) => {
                  const srcNode = nodesBySymbol.get(srcId);
                  const srcLabel = srcNode ? srcNode.name : srcId;
                  const allDisabled = candidates.every((c) => group.disabledIds.has(c.nodeId));
                  const noneDisabled = candidates.every((c) => !group.disabledIds.has(c.nodeId));
                  const sourceIsArea = !srcNode;

                  // Include/exclude all toggle for this source group
                  const handleSourceToggle = () => {
                    const ids = candidates.map((c) => c.nodeId);
                    const shouldInclude = allDisabled || (!noneDisabled && !allDisabled);
                    setExpandedNodes(type as any, ids, shouldInclude);
                  };

                  return (
                    <div key={srcId} style={{ marginBottom: 4 }}>
                      {/* Source node/area header */}
                      {bySource.size > 1 && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '2px 0',
                            fontSize: 11,
                            color: '#374151',
                            fontWeight: 500,
                          }}
                        >
                          <span
                            onClick={() => toggleCollapse(`${type}:${srcId}`)}
                            style={{
                              cursor: 'pointer',
                              fontSize: 8,
                              userSelect: 'none',
                              width: 10,
                              textAlign: 'center',
                              flexShrink: 0,
                            }}
                          >
                            {collapsedSources.has(`${type}:${srcId}`) ? '▶' : '▼'}
                          </span>
                          <label
                            style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', flex: 1 }}
                            onClick={(e) => {
                              e.preventDefault();
                              handleSourceToggle();
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={!allDisabled}
                              ref={(el) => { if (el) el.indeterminate = !allDisabled && !noneDisabled; }}
                              readOnly
                              style={{ margin: 0, cursor: 'pointer' }}
                            />
                            <span>{srcLabel}</span>
                            <span style={{ fontSize: 10, color: '#9ca3af' }}>({candidates.length})</span>
                          </label>
                        </div>
                      )}

                      {/* Individual candidates */}
                      {!(bySource.size > 1 && collapsedSources.has(`${type}:${srcId}`)) && (
                        <div style={{ paddingLeft: bySource.size > 1 ? 16 : 0 }}>
                          {candidates.map((c) =>
                            renderCandidate(c.nodeId, group, type, sourceIsArea),
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function truncatePath(filePath: string): string {
  const parts = filePath.split('/');
  return parts[parts.length - 1];
}