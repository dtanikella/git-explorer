import { render, screen } from '@testing-library/react';
import Home from '../app/page';

describe('Homepage', () => {
  it('renders "Git Repository Visualizer" text', () => {
    render(<Home />);
    expect(screen.getByText(/git repository visualizer/i)).toBeInTheDocument();
  });
});
