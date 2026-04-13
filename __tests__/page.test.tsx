import { render, screen } from '@testing-library/react';
import Home from '../app/page';

// sigma uses WebGL at import time which is unavailable in jsdom
jest.mock('sigma', () => ({ __esModule: true, default: jest.fn() }));

describe('Homepage', () => {
  it('renders repository selector', () => {
    render(<Home />);
    expect(screen.getByRole('button', { name: 'Select directory' })).toBeInTheDocument();
  });
});
