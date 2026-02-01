import React from 'react';
import { render, screen } from '@testing-library/react';
import { TreemapChart } from '@/app/components/TreemapChart';
import { TreeNode } from '@/lib/git/types';

// Mock @visx/hierarchy
jest.mock('@visx/hierarchy', () => ({
  Treemap: jest.fn(),
  treemapSquarify: jest.fn(),
}));

const mockTreemap = require('@visx/hierarchy').Treemap;

// Mock implementation that calls children with mock descendants
mockTreemap.mockImplementation(({ children, root, ...props }) => {
  const mockDescendants = [
    {
      depth: 1,
      x0: 0,
      y0: 0,
      x1: 400,
      y1: 300,
      data: {
        name: 'src',
        path: 'src',
        value: 60,
        isFile: false,
        children: [],
      },
    },
    {
      depth: 2,
      x0: 0,
      y0: 0,
      x1: 200,
      y1: 150,
      data: {
        name: 'App.tsx',
        path: 'src/App.tsx',
        value: 30,
        isFile: true,
        color: '#006400',
        fileData: {
          filePath: 'src/App.tsx',
          totalCommitCount: 30,
          recentCommitCount: 20,
          frequencyScore: 0.8,
        },
      },
    },
    {
      depth: 2,
      x0: 200,
      y0: 0,
      x1: 400,
      y1: 150,
      data: {
        name: 'utils.ts',
        path: 'src/utils.ts',
        value: 30,
        isFile: true,
        color: '#E5E5E5',
        fileData: {
          filePath: 'src/utils.ts',
          totalCommitCount: 30,
          recentCommitCount: 5,
          frequencyScore: 0.2,
        },
      },
    },
    {
      depth: 1,
      x0: 0,
      y0: 300,
      x1: 400,
      y1: 600,
      data: {
        name: 'README.md',
        path: 'README.md',
        value: 40,
        isFile: true,
        color: '#1a5d1a',
        fileData: {
          filePath: 'README.md',
          totalCommitCount: 40,
          recentCommitCount: 25,
          frequencyScore: 1.0,
        },
      },
    },
  ];

  const mockTreemapObj = {
    descendants: () => mockDescendants,
  };

  return children(mockTreemapObj);
});

// Mock @visx/scale
jest.mock('@visx/scale', () => ({
  scaleLinear: jest.fn(() => ({
    domain: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
  })),
}));

describe('TreemapChart', () => {
  const mockTreeData: TreeNode = {
    name: 'root',
    path: '',
    value: 100,
    isFile: false,
    children: [
      {
        name: 'src',
        path: 'src',
        value: 60,
        isFile: false,
        children: [
          {
            name: 'App.tsx',
            path: 'src/App.tsx',
            value: 30,
            isFile: true,
            color: '#006400',
            fileData: {
              filePath: 'src/App.tsx',
              totalCommitCount: 30,
              recentCommitCount: 20,
              frequencyScore: 0.8,
            },
          },
          {
            name: 'utils.ts',
            path: 'src/utils.ts',
            value: 30,
            isFile: true,
            color: '#E5E5E5',
            fileData: {
              filePath: 'src/utils.ts',
              totalCommitCount: 30,
              recentCommitCount: 5,
              frequencyScore: 0.2,
            },
          },
        ],
      },
      {
        name: 'README.md',
        path: 'README.md',
        value: 40,
        isFile: true,
        color: '#1a5d1a',
        fileData: {
          filePath: 'README.md',
          totalCommitCount: 40,
          recentCommitCount: 25,
          frequencyScore: 1.0,
        },
      },
    ],
  };

  it('renders SVG element with correct dimensions', () => {
    render(<TreemapChart data={mockTreeData} width={800} height={600} />);

    const svg = screen.getByRole('img', { name: 'Git repository commit activity treemap visualization' });
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('width', '800');
    expect(svg).toHaveAttribute('height', '600');
  });

  it('renders rect elements for file nodes', () => {
    render(<TreemapChart data={mockTreeData} width={800} height={600} />);

    // Should render rects for all nodes (folders and files)
    const rects = document.querySelectorAll('rect');
    expect(rects).toHaveLength(4); // src folder, App.tsx, utils.ts, README.md
  });

  it('renders text labels for sufficiently large nodes', () => {
    render(<TreemapChart data={mockTreeData} width={800} height={600} />);

    // Should render text for nodes with width/height > 30px
    const texts = screen.getAllByText(/src|App\.tsx|utils\.ts|README\.md/);
    expect(texts.length).toBeGreaterThan(0);
  });

  it('applies correct colors to rect elements', () => {
    render(<TreemapChart data={mockTreeData} width={800} height={600} />);

    const rects = document.querySelectorAll('rect');
    // Check that rects have fill attributes (colors)
    rects.forEach(rect => {
      expect(rect).toHaveAttribute('fill');
    });
  });

  it('handles empty data gracefully', () => {
    const emptyData: TreeNode = {
      name: 'root',
      path: '',
      value: 0,
      isFile: false,
      children: [],
    };

    render(<TreemapChart data={emptyData} width={800} height={600} />);

    // Should render SVG but with "No data" message
    expect(screen.getByText('No data to display')).toBeInTheDocument();
  });

  it('includes accessibility attributes', () => {
    render(<TreemapChart data={mockTreeData} width={800} height={600} />);

    const svg = screen.getByRole('img', { name: 'Git repository commit activity treemap visualization' });
    expect(svg).toHaveAttribute('role', 'img');
    expect(svg).toHaveAttribute('aria-label');

    const rects = document.querySelectorAll('rect');
    rects.forEach(rect => {
      expect(rect).toHaveAttribute('aria-label');
    });
  });
});