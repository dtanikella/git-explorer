import { render, screen } from '@testing-library/react';
import GraphToolbar from '@/app/components/graph/GraphToolbar';

describe('GraphToolbar', () => {
  const props = {
    hideTestFiles: true,
    onHideTestFilesChange: jest.fn(),
    selectedView: 'modules',
    onViewChange: jest.fn(),
    viewOptions: {
      modules: { label: 'Modules', config: {} as never },
    },
    disabled: false,
  };

  it('links to the standalone Graph Tuning Bench served from public/', () => {
    render(<GraphToolbar {...props} />);

    const link = screen.getByRole('link', { name: /tuning bench/i });
    expect(link).toHaveAttribute('href', '/graph-playground/index.html');
    expect(link).toHaveAttribute('target', '_blank');
  });
});
