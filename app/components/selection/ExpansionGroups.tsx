'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSelection } from '@/app/contexts/SelectionContext';
import { useAreaStore } from '@/app/contexts/AreaContext';
import type { AnalysisNode } from '@/lib/analysis/types';
import { collectRelationIds, EXPANSION_TYPES } from '@/lib/selection/candidates';
import type { ExpansionType, SourceKey, SourceRelation } from '@/lib/selection/candidates';
import { formatCopyText } from '@/lib/selection/format';
import { TreeIconButton, CopyIcon, CheckIcon } from './TreeIconButton';
import { useCopyFeedback } from './useCopyFeedback';

interface ExpansionGroupsProps {
  nodes: AnalysisNode[];
}

const GROUP_LABELS: Record<ExpansionType, string> = {
  'same-file': 'Same file',
  'callers': 'Callers',
  'callees': 'Callees',
};

const GROUP_HINTS: Record<ExpansionType, string> = {
  'same-file': 'Nodes in the same files. For an area or folder: every file in it.',
  'callers': 'Nodes that call it. For an area or folder: callers from outside it.',
  'callees': 'Nodes it calls. For an area or folder: callees outside it.',
};

/**
 * Renders the same-file, callers and callees group: three switches, each with
 * an include/exclude tree grouped by source and then file.
 *
 * @remarks
 * The group is scoped by an "Applies to" line. By default it covers everything
 * selected; focusing a row (the funnel on a node, area, folder or file row)
 * switches the toggles, counts and trees to that row alone. Rows with any
 * expansion on stay listed as chips that re-focus them. Excluded nodes are
 * shared by both scopes. The group scrolls into view when a row is focused.
 *
 * @param nodes - Analysis nodes for display and copying.
 */
export default function ExpansionGroups({ nodes }: ExpansionGroupsProps) {
  const {
    state, toggleExpansionGroup, toggleFocus, toggleFocusedExpansion, toggleExpandedNode, setExpandedNodes,
  } = useSelection();
  const { areas, nodeToAreas, runtimeState } = useAreaStore();
  const { copiedKey, copy } = useCopyFeedback();
  const { expansions, focusKey } = state;
  const rowExpansions = state.rowExpansions ?? new Map<SourceKey, Set<ExpansionType>>();

  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focusKey) rootRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [focusKey]);

  const nodesBySymbol = useMemo(() => {
    const map = new Map<string, AnalysisNode>();
    for (const n of nodes) map.set(n.scipSymbol, n);
    return map;
  }, [nodes]);

  const filePaths = useMemo(() => new Set(nodes.map((n) => n.filePath)), [nodes]);

  // Track which source and file subgroups are collapsed
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggleCollapse = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const labelFor = (key: SourceKey): { text: string; color?: string } => {
    const value = key.slice(2);
    if (key.startsWith('a:')) {
      const area = areas.find((a) => a.id === value);
      return { text: area?.name ?? value, color: runtimeState.get(value)?.color ?? '#6b7280' };
    }
    if (key.startsWith('n:')) return { text: nodesBySymbol.get(value)?.name ?? value };
    return { text: filePaths.has(value) ? value : `${value}/` };
  };

  const renderLabel = (key: SourceKey) => {
    const { text, color } = labelFor(key);
    if (!color) return <span>{text}</span>;
    return (
      <span
        style={{
          display: 'inline-block',
          background: `${color}26`,
          color,
          fontSize: 10,
          padding: '1px 7px',
          borderRadius: 9,
          fontWeight: 500,
        }}
      >
        {text}
      </span>
    );
  };

  const chipStyle = (on: boolean): React.CSSProperties => ({
    border: `1px solid ${on ? '#3b82f6' : '#d1d5db'}`,
    background: '#fff',
    borderRadius: 10,
    padding: '1px 8px',
    fontSize: 11,
    color: '#374151',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
  });

  /** A checkbox that is checked when nothing is excluded, indeterminate when some are. */
  const renderCheck = (ids: string[], disabledIds: Set<string>, onChange: (include: boolean) => void) => {
    const included = ids.filter((id) => !disabledIds.has(id)).length;
    const checked = included === ids.length;
    return (
      <input
        type="checkbox"
        checked={checked}
        ref={(el) => { if (el) el.indeterminate = included > 0 && !checked; }}
        onChange={() => onChange(!checked)}
        onClick={(e) => e.stopPropagation()}
        style={{ margin: 0, cursor: 'pointer', flexShrink: 0 }}
      />
    );
  };

  const arrow = (isCollapsed: boolean) => (
    <span style={{ fontSize: 8, width: 10, textAlign: 'center', flexShrink: 0, userSelect: 'none' }}>
      {isCollapsed ? '▶' : '▼'}
    </span>
  );

  const renderNodeRow = (type: ExpansionType, nodeId: string, disabledIds: Set<string>) => {
    const node = nodesBySymbol.get(nodeId);
    if (!node) return null;
    const isDisabled = disabledIds.has(nodeId);
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
          paddingLeft: 16,
          cursor: 'pointer',
          opacity: isDisabled ? 0.5 : 1,
          fontSize: 11,
        }}
        onClick={(e) => {
          e.preventDefault();
          toggleExpandedNode(type, nodeId);
        }}
      >
        <input type="checkbox" checked={!isDisabled} readOnly style={{ margin: 0, cursor: 'pointer' }} />
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          <span>{node.name}</span>
          {nodeAreas.map((area) => {
            const color = runtimeState.get(area.id)?.color ?? '#6b7280';
            return (
              <span
                key={area.id}
                style={{
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

  /** One source's candidates, grouped by file. */
  const renderFiles = (type: ExpansionType, relation: SourceRelation, disabledIds: Set<string>) => {
    const byFile = new Map<string, string[]>();
    for (const id of relation.nodeIds) {
      const path = nodesBySymbol.get(id)?.filePath;
      if (!path) continue;
      if (!byFile.has(path)) byFile.set(path, []);
      byFile.get(path)!.push(id);
    }
    return [...byFile.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([path, ids]) => {
        const key = `${type}:${relation.source.key}:${path}`;
        const isCollapsed = collapsed.has(key);
        return (
          <div key={key}>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 0', paddingLeft: 4, fontSize: 11, color: '#374151' }}
            >
              <span onClick={() => toggleCollapse(key)} style={{ cursor: 'pointer' }}>{arrow(isCollapsed)}</span>
              {renderCheck(ids, disabledIds, (include) => setExpandedNodes(type, ids, include))}
              <span
                title={path}
                style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}
              >
                {path.split('/').pop()}
              </span>
              <span style={{ fontSize: 10, color: '#9ca3af' }}>({ids.length})</span>
            </div>
            {!isCollapsed && ids.map((id) => renderNodeRow(type, id, disabledIds))}
          </div>
        );
      });
  };

  const renderTree = (type: ExpansionType, list: SourceRelation[], disabledIds: Set<string>) => {
    // A single source needs no header of its own
    if (list.length === 1) return renderFiles(type, list[0], disabledIds);
    return list.map((relation) => {
      const key = `${type}:${relation.source.key}`;
      const isCollapsed = collapsed.has(key);
      return (
        <div key={key} style={{ marginBottom: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 0', fontSize: 11, fontWeight: 500 }}>
            <span onClick={() => toggleCollapse(key)} style={{ cursor: 'pointer' }}>{arrow(isCollapsed)}</span>
            {renderCheck(relation.nodeIds, disabledIds, (include) => setExpandedNodes(type, relation.nodeIds, include))}
            {renderLabel(relation.source.key)}
            <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 400 }}>({relation.nodeIds.length})</span>
          </div>
          {!isCollapsed && <div style={{ paddingLeft: 12 }}>{renderFiles(type, relation, disabledIds)}</div>}
        </div>
      );
    });
  };

  const focusedTypes = focusKey ? rowExpansions.get(focusKey) : undefined;

  return (
    <div ref={rootRef} data-testid="expansion-groups">
      {/* Scope */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: '#6b7280', paddingTop: 2 }}>Applies to</span>
        <span style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'flex-end' }}>
          {focusKey ? (
            <span
              data-testid="scope-chip"
              role="button"
              title="Back to all selected"
              onClick={() => toggleFocus(null)}
              style={chipStyle(true)}
            >
              {renderLabel(focusKey)} ×
            </span>
          ) : (
            <span data-testid="scope-chip" style={{ ...chipStyle(true), cursor: 'default' }}>All selected</span>
          )}
          {[...rowExpansions]
            .filter(([key]) => key !== focusKey)
            .map(([key, types]) => (
              <span
                key={key}
                data-testid={`row-chip-${key}`}
                role="button"
                title="Edit this row"
                onClick={() => toggleFocus(key)}
                style={chipStyle(false)}
              >
                {renderLabel(key)}
                <span style={{ fontSize: 10, color: '#9ca3af' }}>
                  {EXPANSION_TYPES.filter((t) => types.has(t)).map((t) => GROUP_LABELS[t].toLowerCase()).join(', ')}
                </span>
              </span>
            ))}
        </span>
      </div>

      {EXPANSION_TYPES.map((type) => {
        const group = expansions.get(type);
        if (!group) return null;
        const disabledIds = group.disabledIds;

        const list = focusKey ? group.active.filter((r) => r.source.key === focusKey) : group.active;
        const ids = collectRelationIds(list);
        const includedCount = ids.filter((id) => !disabledIds.has(id)).length;
        const availableCount = focusKey
          ? group.focused?.nodeIds.length ?? 0
          : collectRelationIds(group.available).length;
        const on = focusKey ? !!focusedTypes?.has(type) : group.enabled;
        const shown = ids.length > 0;
        const rowsOn = focusKey ? 0 : [...rowExpansions.values()].filter((types) => types.has(type)).length;
        const copied = copiedKey === type;

        return (
          <div key={type} style={{ marginBottom: 8 }} data-testid={`expansion-group-${type}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '4px 0' }}>
              <span>
                <span style={{ fontSize: 11, color: '#374151' }}>
                  {GROUP_LABELS[type]} ({shown ? `${includedCount}/${ids.length}` : availableCount})
                </span>
                {rowsOn > 0 && (
                  <span style={{ fontSize: 10, color: '#9ca3af' }}> · {rowsOn} from rows</span>
                )}
                <div style={{ fontSize: 10, color: '#9ca3af' }}>{GROUP_HINTS[type]}</div>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {shown && (
                  <TreeIconButton
                    label={copied ? 'Copied!' : 'Copy as path#symbol'}
                    tone={copied ? 'success' : 'default'}
                    onClick={() => {
                      const picked = ids
                        .filter((id) => !disabledIds.has(id))
                        .map((id) => nodesBySymbol.get(id))
                        .filter((n): n is AnalysisNode => !!n);
                      copy(type, formatCopyText(picked));
                    }}
                  >
                    {copied ? <CheckIcon /> : <CopyIcon />}
                  </TreeIconButton>
                )}
                <button
                  data-testid={`toggle-${type}`}
                  role="switch"
                  aria-checked={on}
                  aria-label={`${GROUP_LABELS[type]} for ${focusKey ? labelFor(focusKey).text : 'all selected'}`}
                  onClick={() => (focusKey ? toggleFocusedExpansion(type) : toggleExpansionGroup(type))}
                  disabled={availableCount === 0 && !on}
                  style={{
                    width: 32,
                    height: 18,
                    borderRadius: 9,
                    border: 'none',
                    cursor: availableCount > 0 || on ? 'pointer' : 'default',
                    background: on ? '#3b82f6' : '#d1d5db',
                    position: 'relative',
                    flexShrink: 0,
                    transition: 'background 0.2s',
                    opacity: availableCount > 0 || on ? 1 : 0.4,
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      top: 2,
                      left: on ? 16 : 2,
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      background: '#fff',
                      transition: 'left 0.2s',
                    }}
                  />
                </button>
              </span>
            </div>

            {shown && (
              <div style={{ maxHeight: 180, overflowY: 'auto', margin: '2px 0 6px' }}>
                <div style={{ display: 'flex', gap: 6, paddingBottom: 4 }}>
                  <button
                    data-testid={`include-all-${type}`}
                    onClick={() => setExpandedNodes(type, ids, true)}
                    style={{ fontSize: 10, padding: '1px 6px', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer' }}
                  >
                    Include all
                  </button>
                  <button
                    data-testid={`exclude-all-${type}`}
                    onClick={() => setExpandedNodes(type, ids, false)}
                    style={{ fontSize: 10, padding: '1px 6px', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer' }}
                  >
                    Exclude all
                  </button>
                </div>
                {renderTree(type, list, disabledIds)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
