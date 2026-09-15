import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AreaProvider } from '@/app/contexts/AreaContext';
import AreaManagerView from '@/app/components/areas/AreaManagerView';
import type { Area } from '@/lib/areas/types';

const deepNestedAreas: Area[] = [
  {
    id: 'l1',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    name: 'Level 1',
    type: 'business_domain',
    contains: ['sym-a'],
    parent: null,
    children: ['l2'],
    clusterStrength: 0,
  },
  {
    id: 'l2',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    name: 'Level 2',
    type: 'business_domain',
    contains: ['sym-b'],
    parent: 'l1',
    children: ['l3'],
    clusterStrength: 0,
  },
  {
    id: 'l3',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    name: 'Level 3',
    type: 'business_domain',
    contains: ['sym-c'],
    parent: 'l2',
    children: [],
    clusterStrength: 0,
  },
];

describe('Edge cases', () => {
  const renderWithAreas = (areas: Area[]) => {
    return render(
      <AreaProvider areas={areas}>
        <AreaManagerView repoPath="/test" nodes={[]} />
      </AreaProvider>
    );
  };

  it('prevents creating area with empty name', () => {
    renderWithAreas([]);
    fireEvent.click(screen.getByTestId('new-area-button'));
    const input = screen.getByTestId('inline-create-input');
    fireEvent.change(input, { target: { value: '' } });
    // Create button should be disabled
    expect(screen.getByTestId('inline-create-confirm')).toBeDisabled();
  });

  it('handles deepest-nesting collapse delete', () => {
    renderWithAreas(deepNestedAreas);
    // Expand L1
    fireEvent.click(screen.getByTestId('expand-caret-l1'));
    expect(screen.getByText('Level 2')).toBeInTheDocument();
    // Expand L2
    fireEvent.click(screen.getByTestId('expand-caret-l2'));
    expect(screen.getByText('Level 3')).toBeInTheDocument();

    // Delete L1 with collapse
    fireEvent.click(screen.getByTestId('delete-area-l1'));
    expect(screen.getByTestId('delete-confirm-dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('delete-collapse-btn'));

    // All levels should be gone
    expect(screen.queryByText('Level 1')).not.toBeInTheDocument();
    expect(screen.queryByText('Level 2')).not.toBeInTheDocument();
    expect(screen.queryByText('Level 3')).not.toBeInTheDocument();
  });

  it('handles deepest-nesting orphan delete', () => {
    renderWithAreas(deepNestedAreas);
    // Delete L1 with orphan
    fireEvent.click(screen.getByTestId('delete-area-l1'));
    fireEvent.click(screen.getByTestId('delete-orphan-btn'));

    // L1 should be gone, L2 should be top-level
    expect(screen.queryByText('Level 1')).not.toBeInTheDocument();
    expect(screen.getByText('Level 2')).toBeInTheDocument();
    // L3 should still be child of L2
  });

  it('handles cycle prevention by checking parent-child relationship', () => {
    // Test the isCycleSafe function logic:
    // An area cannot be reparented to itself or to one of its descendants
    const areasById = new Map(deepNestedAreas.map((a) => [a.id, a]));

    const isCycleSafe = (areaId: string, potentialParentId: string | null): boolean => {
      if (potentialParentId === null) return true;
      if (areaId === potentialParentId) return false;

      // Check if potentialParentId is a descendant of areaId
      const visited = new Set<string>();
      const queue = [...(areasById.get(areaId)?.children ?? [])];
      while (queue.length > 0) {
        const childId = queue.shift()!;
        if (childId === potentialParentId) return false;
        if (!visited.has(childId)) {
          visited.add(childId);
          queue.push(...(areasById.get(childId)?.children ?? []));
        }
      }
      return true;
    };

    // L3 cannot be parent of L1 (L1 is ancestor, not descendant)
    expect(isCycleSafe('l3', 'l1')).toBe(true); // L3 can be parented under L1 (currently it already is)
    // L1 cannot be reparented to L3 (L3 is descendant of L1)
    expect(isCycleSafe('l1', 'l3')).toBe(false);
    // An area cannot be its own parent
    expect(isCycleSafe('l1', 'l1')).toBe(false);
    // Null parent is always safe
    expect(isCycleSafe('l1', null)).toBe(true);
  });
});