'use client';

import { useState, useCallback } from 'react';
import { useSelection } from '@/app/contexts/SelectionContext';
import { useAreaStore } from '@/app/contexts/AreaContext';
import type { AnalysisNode } from '@/lib/analysis/types';
import type { TreeNode } from '@/lib/selection/trees';
import { useCopyFeedback } from './useCopyFeedback';
import { TreeIconButton, LockIcon, UnlockIcon, CopyIcon, CheckIcon, FilterIcon } from './TreeIconButton';
import { nodeSourceKey, areaSourceKey, pathSourceKey } from '@/lib/selection/candidates';
import type { SourceKey } from '@/lib/selection/candidates';

interface SelectionTreeProps {
  /** The root tree node to render. */
  tree: TreeNode;
  /** Mode: area-tree or file-tree. */
  mode: 'area' | 'file';
  /** The set of currently expanded node ids. */
  expanded: Set<string>;
  /** Callback to toggle expansion of a node. */
  onToggleExpand: (id: string) => void;
}

/**
 * Renders a checkable tree with tri-state selection, expand/collapse,
 * shift-range selection, padlock controls, and copy buttons.
 *
 * @remarks
 * Integrated with {@link useSelection} for all selection state and
 * {@link useAreaStore} for area display data.
 */
export default function SelectionTree({ tree, mode, expanded, onToggleExpand }: SelectionTreeProps) {
  const { state, toggleNode, toggleNodes, toggleLock, toggleFocus } = useSelection();
  const { runtimeState } = useAreaStore();

  const [lastClickedId, setLastClickedId] = useState<string | null>(null);
  const { copiedKey: copiedId, copy } = useCopyFeedback();

  /**
   * Computes the tri-state of a node: 'checked', 'indeterminate', or 'unchecked'.
   * For area nodes: checks against selectedNodeIds for all descendant members.
   * For file nodes: checks against selectedNodeIds for all file members.
   */
  const getCheckState = useCallback(
    (node: TreeNode): 'checked' | 'indeterminate' | 'unchecked' => {
      const allMembers = collectAllMembers(node);
      if (allMembers.length === 0) return 'unchecked';

      let selectedCount = 0;
      for (const member of allMembers) {
        if (state.selectedNodeIds.has(member.scipSymbol)) selectedCount++;
      }

      if (selectedCount === allMembers.length) return 'checked';
      if (selectedCount > 0) return 'indeterminate';
      return 'unchecked';
    },
    [state.selectedNodeIds],
  );

  /**
   * Collects all analysis nodes under a tree node (recursive).
   */
  const collectAllMembers = useCallback((node: TreeNode): AnalysisNode[] => {
    const result: AnalysisNode[] = [];
    if (node.members) {
      for (const m of node.members) result.push(m);
    }
    if (node.children) {
      for (const child of node.children) {
        const childMembers = collectAllMembers(child);
        for (const m of childMembers) result.push(m);
      }
    }
    return result;
  }, []);

  const isNodeLocked = useCallback(
    (node: TreeNode): boolean => {
      const allMembers = collectAllMembers(node);
      return allMembers.length > 0 && allMembers.every((m) => state.lockedNodeIds.has(m.scipSymbol));
    },
    [state.lockedNodeIds, collectAllMembers],
  );

  const handleNodeCheck = useCallback(
    (nodeId: string, e: React.MouseEvent) => {
      // Shift-range selection
      if (e.shiftKey && lastClickedId) {
        // Collect all flat checkable items between lastClickedId and nodeId
        const allItems = flattenTree(tree);
        const startIdx = allItems.findIndex((n) => n.id === lastClickedId);
        const endIdx = allItems.findIndex((n) => n.id === nodeId);
        if (startIdx !== -1 && endIdx !== -1) {
          const [from, to] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
          const rangeItems = allItems.slice(from, to + 1);
          const allMembers = rangeItems.flatMap((item) => collectAllMembers(item));
          const ids = [...new Set(allMembers.map((m) => m.scipSymbol))];
          // Check if the last clicked is selected — if so, select all; otherwise deselect all
          const targetState = state.explicitNodeIds.has(allItems[startIdx].id) || state.selectedNodeIds.has(allItems[startIdx].id);
          toggleNodes(ids, targetState);
        }
      } else {
        // Single node toggle: toggle each member
        const node = flattenTree(tree).find((n) => n.id === nodeId);
        if (node) {
          const members = collectAllMembers(node);
          if (members.length > 0) {
            const allSelected = members.every((m) => state.selectedNodeIds.has(m.scipSymbol));
            for (const m of members) {
              if (allSelected && !state.lockedNodeIds.has(m.scipSymbol)) {
                toggleNode(m.scipSymbol);
              } else if (!allSelected) {
                toggleNode(m.scipSymbol);
              }
            }
          }
        }
      }
      setLastClickedId(nodeId);
    },
    [lastClickedId, tree, collectAllMembers, toggleNode, toggleNodes, state.selectedNodeIds, state.lockedNodeIds, state.explicitNodeIds],
  );

  const handleLock = useCallback(
    (node: TreeNode, e: React.MouseEvent) => {
      e.stopPropagation();
      const members = collectAllMembers(node);
      const nodeIds = members.map((m) => m.scipSymbol);
      if (nodeIds.length === 0) return;
      // If all are locked, unlock all; otherwise lock all
      const allLocked = nodeIds.every((id) => state.lockedNodeIds.has(id));
      if (allLocked) {
        for (const id of nodeIds) toggleLock({ kind: 'node', id });
      } else {
        toggleLock({ kind: 'nodes', ids: nodeIds });
      }
    },
    [collectAllMembers, state.lockedNodeIds, toggleLock],
  );

  const handleCopy = useCallback(
    (node: TreeNode, e: React.MouseEvent) => {
      e.stopPropagation();
      const members = collectAllMembers(node);
      if (members.length === 0) return;
      const text = members
        .map((m) => `${m.filePath}#${m.name}`)
        .filter((v, i, a) => a.indexOf(v) === i)
        .sort()
        .join('\n');
      copy(node.id, text);
    },
    [collectAllMembers, copy],
  );

  /** Funnel that scopes the expansion group to a row; visible while the row is focused or has an expansion on. */
  const renderFilterButton = (key: SourceKey | null) => {
    if (!key) return null;
    const isFocused = state.focusKey === key;
    const isOn = isFocused || (state.rowExpansions?.get(key)?.size ?? 0) > 0;
    return (
      <TreeIconButton
        label={isFocused ? 'Back to all selected' : 'Set same file, callers, callees for just this row'}
        tone={isOn ? 'filter' : 'default'}
        reveal={isOn ? 'always' : 'hover'}
        onClick={(e) => {
          e.stopPropagation();
          toggleFocus(key);
        }}
      >
        <FilterIcon />
      </TreeIconButton>
    );
  };

  const renderMemberNode = (node: AnalysisNode, depth: number) => {
    const isSelected = state.selectedNodeIds.has(node.scipSymbol);
    const isLocked = state.lockedNodeIds.has(node.scipSymbol);

    return (
      <div
        key={node.scipSymbol}
        data-testid={`tree-row-${node.scipSymbol}`}
        className="group"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '2px 0',
          paddingLeft: depth * 16,
          fontSize: 11,
        }}
      >
        <input
          type="checkbox"
          checked={isSelected}
          readOnly
          style={{ margin: 0, cursor: 'pointer' }}
        />
        <span
          onClick={() => toggleNode(node.scipSymbol)}
          style={{
            cursor: 'pointer',
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            opacity: isLocked ? 0.7 : 1,
          }}
          title={`${node.filePath}#${node.name}`}
        >
          {node.name}
        </span>
        {renderFilterButton(nodeSourceKey(node.scipSymbol))}
        {isLocked && (
          <TreeIconButton
            label="Unlock"
            tone="active"
            onClick={() => toggleLock({ kind: 'node', id: node.scipSymbol })}
          >
            <LockIcon />
          </TreeIconButton>
        )}
      </div>
    );
  };

  const renderNode = (node: TreeNode, depth: number): React.ReactNode => {
    const checkState = getCheckState(node);
    const isLocked = isNodeLocked(node);
    const isExpanded = expanded.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const hasMembers = collectAllMembers(node).length > 0;
    const isExpandable = !!hasChildren || !!(node.members && node.members.length > 0);
    const areaColor = node.areaId ? runtimeState.get(node.areaId)?.color : undefined;

    return (
      <div key={node.id}>
        <div
          data-testid={`tree-row-${node.id}`}
          className="group"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '3px 0',
            paddingLeft: depth * 16,
            fontSize: 12,
          }}
        >
          {/* Expand/collapse */}
          <span
            onClick={() => isExpandable && onToggleExpand(node.id)}
            style={{
              cursor: isExpandable ? 'pointer' : 'default',
              fontSize: 8,
              userSelect: 'none',
              width: 10,
              textAlign: 'center',
              flexShrink: 0,
              color: isExpandable ? '#374151' : '#d1d5db',
            }}
          >
            {isExpandable ? (isExpanded ? '▼' : '▶') : ''}
          </span>

          {/* Checkbox */}
          <input
            type="checkbox"
            checked={checkState === 'checked'}
            ref={(el) => { if (el) el.indeterminate = checkState === 'indeterminate'; }}
            readOnly
            onClick={(e) => handleNodeCheck(node.id, e)}
            style={{ margin: 0, cursor: 'pointer', flexShrink: 0 }}
          />

          {/* Label */}
          <span
            style={{
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontWeight: hasChildren ? 600 : 400,
              opacity: isLocked ? 0.7 : 1,
            }}
            onClick={(e) => handleNodeCheck(node.id, e)}
          >
            {areaColor ? (
              <span
                style={{
                  display: 'inline-block',
                  background: `${areaColor}26`,
                  color: areaColor,
                  fontSize: 10,
                  padding: '2px 8px',
                  borderRadius: 9,
                  fontWeight: 500,
                }}
              >
                {node.name}
              </span>
            ) : (
              node.name
            )}
          </span>

          {/* Per-row expansion filter */}
          {renderFilterButton(
            node.areaId ? areaSourceKey(node.areaId) : node.path ? pathSourceKey(node.path) : null,
          )}

          {/* Padlock */}
          {hasMembers && (
            <TreeIconButton
              label={isLocked ? 'Unlock all' : 'Lock all'}
              tone={isLocked ? 'active' : 'default'}
              onClick={(e) => handleLock(node, e)}
            >
              {isLocked ? <LockIcon /> : <UnlockIcon />}
            </TreeIconButton>
          )}

          {/* Copy */}
          {hasMembers && (
            <TreeIconButton
              label={copiedId === node.id ? 'Copied!' : 'Copy as path#symbol'}
              tone={copiedId === node.id ? 'success' : 'default'}
              onClick={(e) => handleCopy(node, e)}
            >
              {copiedId === node.id ? <CheckIcon /> : <CopyIcon />}
            </TreeIconButton>
          )}
        </div>

        {/* Expanded children */}
        {isExpanded && (
          <>
            {node.children?.map((child) => renderNode(child, depth + 1))}
            {mode === 'area' && node.members?.map((m) => renderMemberNode(m, depth + 1))}
            {mode === 'file' && node.members?.map((m) => renderMemberNode(m, depth + 1))}
          </>
        )}
      </div>
    );
  };

  return (
    <div>
      {tree.children?.map((child) => renderNode(child, 0))}
    </div>
  );
}

/**
 * Flattens a tree node and all its descendants into a list.
 */
function flattenTree(node: TreeNode): TreeNode[] {
  const result: TreeNode[] = [node];
  if (node.children) {
    for (const child of node.children) {
      result.push(...flattenTree(child));
    }
  }
  return result;
}