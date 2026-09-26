import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import NodeBrowserPane from '@/app/components/areas/NodeBrowserPane';
import type { AnalysisNode } from '@/lib/analysis/types';

const mockNodes: AnalysisNode[] = [
  {
    syntaxType: 0,
    name: 'login',
    filePath: 'src/auth/login.ts',
    startLine: 1,
    startCol: 0,
    isAsync: false,
    isExported: true,
    params: [],
    returnTypeText: null,
    scipSymbol: 'sym-login',
    isDefinition: true,
    inTestFile: false,
    referencedAt: [],
    outboundRefs: [],
  },
  {
    syntaxType: 0,
    name: 'logout',
    filePath: 'src/auth/logout.ts',
    startLine: 1,
    startCol: 0,
    isAsync: false,
    isExported: true,
    params: [],
    returnTypeText: null,
    scipSymbol: 'sym-logout',
    isDefinition: true,
    inTestFile: false,
    referencedAt: [],
    outboundRefs: [],
  },
  {
    syntaxType: 0,
    name: 'charge',
    filePath: 'src/payments/charge.ts',
    startLine: 1,
    startCol: 0,
    isAsync: false,
    isExported: true,
    params: [],
    returnTypeText: null,
    scipSymbol: 'sym-charge',
    isDefinition: true,
    inTestFile: false,
    referencedAt: [],
    outboundRefs: [],
  },
];

describe('NodeBrowserPane', () => {
  it('organizes nodes by directory and file', () => {
    render(<NodeBrowserPane nodes={mockNodes} />);
    expect(screen.getByText('src')).toBeInTheDocument();
    expect(screen.getByText('auth')).toBeInTheDocument();
    expect(screen.getByText('login.ts')).toBeInTheDocument();
    expect(screen.getByText('logout.ts')).toBeInTheDocument();
    expect(screen.getByText('payments')).toBeInTheDocument();
    expect(screen.getByText('charge.ts')).toBeInTheDocument();
  });

  it('collapses a directory row to hide what is under it', () => {
    render(<NodeBrowserPane nodes={mockNodes} />);
    fireEvent.click(screen.getByTestId('dir-row-dir:src/auth'));
    expect(screen.queryByText('login.ts')).not.toBeInTheDocument();
    expect(screen.getByText('charge.ts')).toBeInTheDocument();
  });

  it('type chips filter to the chosen types and hide everything else', () => {
    const typed = [
      { ...mockNodes[0], scipSymbol: 'sym-a', name: 'a', filePath: 'src/a.ts', syntaxType: 'FUNCTION' },
      { ...mockNodes[0], scipSymbol: 'sym-b', name: 'b', filePath: 'src/b.ts', syntaxType: 'CLASS' },
      { ...mockNodes[0], scipSymbol: 'sym-v', name: 'v', filePath: 'src/b.ts', syntaxType: 'VARIABLE' },
    ] as unknown as AnalysisNode[];
    render(<NodeBrowserPane nodes={typed} />);
    expect(screen.getByTestId('node-item-sym-v')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('node-type-chip-CLASS'));
    expect(screen.getByTestId('node-item-sym-b')).toBeInTheDocument();
    expect(screen.queryByTestId('node-item-sym-v')).not.toBeInTheDocument();
    expect(screen.queryByTestId('node-item-sym-a')).not.toBeInTheDocument();
    expect(screen.queryByText('a.ts')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('node-type-chip-VARIABLE'));
    expect(screen.getByTestId('node-item-sym-v')).toBeInTheDocument();
    expect(screen.queryByTestId('node-item-sym-a')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('node-type-clear'));
    expect(screen.getByTestId('node-item-sym-a')).toBeInTheDocument();
  });

  it('filter nodes by search query', () => {
    render(<NodeBrowserPane nodes={mockNodes} />);
    const searchInput = screen.getByTestId('node-search-input');
    fireEvent.change(searchInput, { target: { value: 'login' } });
    expect(screen.getByText('login')).toBeInTheDocument();
    expect(screen.queryByText('charge')).not.toBeInTheDocument();
  });

  it('shows "unassigned only" toggle', () => {
    render(<NodeBrowserPane nodes={mockNodes} />);
    expect(screen.getByTestId('unassigned-toggle')).toBeInTheDocument();
  });

  it('provides a search input', () => {
    render(<NodeBrowserPane nodes={mockNodes} />);
    expect(screen.getByTestId('node-search-input')).toBeInTheDocument();
  });

  it('shows node count', () => {
    render(<NodeBrowserPane nodes={mockNodes} />);
    expect(screen.getByText(/3 nodes/)).toBeInTheDocument();
  });
});