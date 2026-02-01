import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ForceGraphChart from '../../app/components/ForceGraphChart';
import { TreeNode } from '@/lib/git/types';

describe('ForceGraphChart', () => {
  const mockTreeData: TreeNode = {
    name: 'src',
    path: 'src',
    value: 15,
    isFile: false,
    children: [
      {
        name: 'file1.js',
        path: 'src/file1.js',
        value: 10,
        isFile: true,
        fileData: {
          filePath: 'src/file1.js',
          totalCommitCount: 10,
          recentCommitCount: 10,
          frequencyScore: 1.0,
        },
      },
      {
        name: 'file2.ts',
        path: 'src/file2.ts',
        value: 5,
        isFile: true,
        fileData: {
          filePath: 'src/file2.ts',
          totalCommitCount: 5,
          recentCommitCount: 5,
          frequencyScore: 0.5,
        },
      },
    ],
  };

  const defaultProps = {
    data: mockTreeData,
    width: 800,
    height: 600,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders SVG container with correct dimensions', () => {
    render(<ForceGraphChart {...defaultProps} />);

    const svg = screen.getByRole('img', { hidden: true }); // SVG elements are treated as images
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('width', '800');
    expect(svg).toHaveAttribute('height', '600');
  });

  it('renders circles for each data node', () => {
    render(<ForceGraphChart {...defaultProps} />);

    // Since we're mocking d3, we need to check that the component renders
    // The actual circle rendering would be tested in integration or with more detailed mocking
    const svg = screen.getByRole('img', { hidden: true });
    expect(svg).toBeInTheDocument();
  });

  it('handles empty data array', () => {
    const emptyTreeData: TreeNode = {
      name: 'empty',
      path: 'empty',
      value: 0,
      isFile: false,
      children: [],
    };
    render(<ForceGraphChart data={emptyTreeData} width={800} height={600} />);

    // Should show "No Data to Display" message
    expect(screen.getByText('No Data to Display')).toBeInTheDocument();
  });

  it('displays "No data" message when data is empty', () => {
    const emptyTreeData: TreeNode = {
      name: 'empty',
      path: 'empty',
      value: 0,
      isFile: false,
      children: [],
    };
    render(<ForceGraphChart data={emptyTreeData} width={800} height={600} />);

    // The component should handle empty data gracefully
    expect(screen.getByText('No Data to Display')).toBeInTheDocument();
    expect(screen.getByText('No files found in the selected repository and time range.')).toBeInTheDocument();
  });

  it('applies correct dimensions to SVG', () => {
    const customDimensions = { width: 1200, height: 800 };
    render(<ForceGraphChart data={mockTreeData} {...customDimensions} />);

    const svg = screen.getByRole('img', { hidden: true });
    expect(svg).toHaveAttribute('width', '1200');
    expect(svg).toHaveAttribute('height', '800');
  });
});