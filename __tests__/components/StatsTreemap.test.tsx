import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

import StatsTreemap from '@/app/components/stats/StatsTreemap';
import type { AnalysisNode } from '@/lib/analysis/types';
import { SyntaxType } from '@/lib/analysis/types';

function makeNode(name: string, referencedCount: number, outboundCount: number): AnalysisNode {
  return {
    syntaxType: SyntaxType.FUNCTION,
    name,
    filePath: `src/${name}.ts`,
    startLine: 1,
    startCol: 0,
    isAsync: false,
    isExported: true,
    params: [],
    returnTypeText: null,
    scipSymbol: `sym-${name}`,
    isDefinition: true,
    inTestFile: false,
    referencedAt: Array(referencedCount).fill({ filePath: 'x.ts', line: 1, col: 0, scipSymbol: 'ref' }),
    outboundRefs: Array(outboundCount).fill({ filePath: 'y.ts', line: 1, col: 0, scipSymbol: 'out' }),
  };
}

describe('StatsTreemap', () => {
  const nodes = [
    makeNode('big', 10, 5),
    makeNode('medium', 5, 2),
    makeNode('small', 2, 1),
  ];

  it('renders an SVG with rectangles for each node', () => {
    const { container } = render(
      <StatsTreemap nodes={nodes} topN={10} hideTestFiles={false} onNodeSelect={jest.fn()} />
    );
    const rects = container.querySelectorAll('rect');
    expect(rects.length).toBe(3);
  });

  it('calls onNodeSelect with scipSymbol when a rectangle is clicked', () => {
    const onNodeSelect = jest.fn();
    const { container } = render(
      <StatsTreemap nodes={nodes} topN={10} hideTestFiles={false} onNodeSelect={onNodeSelect} />
    );
    const groups = container.querySelectorAll('g[data-symbol]');
    fireEvent.click(groups[0]);
    expect(onNodeSelect).toHaveBeenCalledWith(expect.any(String));
  });

  it('respects topN prop', () => {
    const { container } = render(
      <StatsTreemap nodes={nodes} topN={2} hideTestFiles={false} onNodeSelect={jest.fn()} />
    );
    const rects = container.querySelectorAll('rect');
    expect(rects.length).toBe(2);
  });
});
