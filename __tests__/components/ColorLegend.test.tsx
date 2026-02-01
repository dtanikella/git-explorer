import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ColorLegend } from '../../app/components/ColorLegend';

describe('ColorLegend', () => {
  it('renders gradient mode by default', () => {
    render(<ColorLegend />);

    expect(screen.getByText('Activity Level')).toBeInTheDocument();
    expect(screen.getByText('Least active')).toBeInTheDocument();
    expect(screen.getByText('Most active')).toBeInTheDocument();
  });

  it('renders discrete mode with provided colors', () => {
    const discreteColors = [
      { label: 'Ruby (.rb)', color: '#E0115F' },
      { label: 'React (.tsx)', color: '#ADD8E6' },
      { label: 'Other/Test', color: '#808080' }
    ];

    render(<ColorLegend mode="discrete" discreteColors={discreteColors} />);

    expect(screen.getByText('File Types')).toBeInTheDocument();
    expect(screen.getByText('Ruby (.rb)')).toBeInTheDocument();
    expect(screen.getByText('React (.tsx)')).toBeInTheDocument();
    expect(screen.getByText('Other/Test')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<ColorLegend className="custom-class" />);

    expect(container.firstChild).toHaveClass('custom-class');
  });
});