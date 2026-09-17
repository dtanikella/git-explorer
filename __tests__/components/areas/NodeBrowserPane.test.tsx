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
  it('renders all nodes grouped by file path', () => {
    render(<NodeBrowserPane nodes={mockNodes} />);
    expect(screen.getByText('src/auth/login.ts')).toBeInTheDocument();
    expect(screen.getByText('src/auth/logout.ts')).toBeInTheDocument();
    expect(screen.getByText('src/payments/charge.ts')).toBeInTheDocument();
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