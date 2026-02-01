import { render, screen } from '@testing-library/react';
import Home from '../app/page';

describe('Homepage', () => {
  it('renders repository selector', () => {
    render(<Home />);
    expect(screen.getByRole('button', { name: 'Select repository directory' })).toBeInTheDocument();
  });
});
