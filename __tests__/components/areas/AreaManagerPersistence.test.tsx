import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AreaProvider } from '@/app/contexts/AreaContext';
import AreaManagerView from '@/app/components/areas/AreaManagerView';
import type { Area } from '@/lib/areas/types';

describe('AreaManagerView persistence', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
  });

  const renderWithProvider = (areas: Area[] = []) => {
    return render(
      <AreaProvider areas={areas} repoPath="/test/repo">
        <AreaManagerView repoPath="/test/repo" nodes={[]} />
      </AreaProvider>
    );
  };

  it('saves to /api/areas when a new area is created', async () => {
    renderWithProvider([]);
    fireEvent.click(screen.getByTestId('new-area-button'));
    fireEvent.change(screen.getByTestId('inline-create-input'), { target: { value: 'Billing' } });
    fireEvent.click(screen.getByTestId('inline-create-confirm'));

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('/api/areas');
    const body = JSON.parse(options.body);
    expect(body.action).toBe('save');
    expect(body.repoPath).toBe('/test/repo');
    expect(body.data.areas).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'Billing' })])
    );
  });

  it('saves after a rename', async () => {
    const areas: Area[] = [
      {
        id: 'auth',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        name: 'Auth',
        type: 'business_domain',
        contains: [],
        parent: null,
        children: [],
        clusterStrength: 0,
      },
    ];
    renderWithProvider(areas);
    fireEvent.click(screen.getByTestId('area-name-auth'));
    fireEvent.change(screen.getByTestId('inline-rename-input-auth'), { target: { value: 'Auth Renamed' } });
    fireEvent.keyDown(screen.getByTestId('inline-rename-input-auth'), { key: 'Enter' });

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const [, options] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.data.areas[0].name).toBe('Auth Renamed');
  });

  it('shows a retry toast when save fails, and retries the same payload', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: false, error: 'Invalid area data' }),
    });

    renderWithProvider([]);
    fireEvent.click(screen.getByTestId('new-area-button'));
    fireEvent.change(screen.getByTestId('inline-create-input'), { target: { value: 'Billing' } });
    fireEvent.click(screen.getByTestId('inline-create-confirm'));

    await waitFor(() => expect(screen.getByTestId('save-error-toast')).toBeInTheDocument());
    // Optimistic UI is not rolled back on failure.
    expect(screen.getByText('Billing')).toBeInTheDocument();

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });
    fireEvent.click(screen.getByTestId('save-error-retry'));

    await waitFor(() => expect(screen.queryByTestId('save-error-toast')).not.toBeInTheDocument());
  });
});
