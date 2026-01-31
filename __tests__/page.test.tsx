import { render, screen } from '@testing-library/react';
import Home from '../app/page';

describe('Homepage', () => {
  it('renders "Hello World" text', () => {
    render(<Home />);
    expect(screen.getByText(/hello world/i)).toBeInTheDocument();
  });
});
