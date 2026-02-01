import { render, screen } from '@testing-library/react';
import { Tooltip } from '../../app/components/Tooltip';
import { FileNode } from '../../lib/types';

// Mock @visx/tooltip
jest.mock('@visx/tooltip', () => ({
  TooltipWithBounds: ({ children }: any) => <div data-testid="tooltip">{children}</div>,
}));

const mockFileNode: FileNode = {
  path: '/test/file.ts',
  name: 'file.ts',
  type: 'file',
  size: 100,
  extension: '.ts',
  metadata: {},
};

const mockFolderNode: FileNode = {
  path: '/test/folder',
  name: 'folder',
  type: 'folder',
  size: 200,
  extension: '',
  metadata: {},
  children: [mockFileNode],
};

describe('Tooltip', () => {
  it('renders tooltip with correct content for files', () => {
    render(<Tooltip node={mockFileNode} rootPath="/test" />);

    expect(screen.getByTestId('tooltip')).toBeInTheDocument();
    expect(screen.getAllByText('file.ts')).toHaveLength(2); // name and relative path
    expect(screen.getByText('100 bytes • .ts')).toBeInTheDocument();
  });

  it('renders tooltip with correct content for folders', () => {
    render(<Tooltip node={mockFolderNode} rootPath="/test" />);

    expect(screen.getByTestId('tooltip')).toBeInTheDocument();
    expect(screen.getAllByText('folder')).toHaveLength(2); // name and relative path
    expect(screen.getByText('200 bytes • 1 children')).toBeInTheDocument();
  });
});