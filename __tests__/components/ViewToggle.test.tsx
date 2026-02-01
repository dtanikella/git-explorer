import { render, screen, fireEvent } from '@testing-library/react';
import { ViewToggle } from '@/app/components/ViewToggle';

describe('ViewToggle', () => {
  it('renders both view options', () => {
    render(<ViewToggle selected="heatmap" onViewChange={jest.fn()} />);
    expect(screen.getByText('Heatmap')).toBeInTheDocument();
    expect(screen.getByText('Activity Graph')).toBeInTheDocument();
  });

  it('calls onViewChange when option clicked', () => {
    const onChange = jest.fn();
    render(<ViewToggle selected="heatmap" onViewChange={onChange} />);
    fireEvent.click(screen.getByText('Activity Graph'));
    expect(onChange).toHaveBeenCalledWith('activity-graph');
  });

  it('marks selected option visually', () => {
    const { container } = render(
      <ViewToggle selected="heatmap" onViewChange={jest.fn()} />
    );
    const heatmapLabel = screen.getByText('Heatmap').closest('label');
    expect(heatmapLabel).toHaveClass('selected');
  });

  it('disables interaction when disabled prop is true', () => {
    render(<ViewToggle selected="heatmap" onViewChange={jest.fn()} disabled />);
    const inputs = screen.getAllByRole('radio');
    inputs.forEach(input => expect(input).toBeDisabled());
  });

  it('switches selection when clicking different option', () => {
    const onChange = jest.fn();
    const { rerender } = render(<ViewToggle selected="heatmap" onViewChange={onChange} />);
    fireEvent.click(screen.getByText('Activity Graph'));
    expect(onChange).toHaveBeenCalledWith('activity-graph');

    rerender(<ViewToggle selected="activity-graph" onViewChange={onChange} />);
    const activityLabel = screen.getByText('Activity Graph').closest('label');
    expect(activityLabel).toHaveClass('selected');
  });
});