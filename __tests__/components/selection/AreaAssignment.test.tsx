import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AreaAssignment from '@/app/components/selection/AreaAssignment';
import { AreaProvider } from '@/app/contexts/AreaContext';
import type { Area } from '@/lib/areas/types';

const mockAreas: Area[] = [
  {
    id: 'auth',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    name: 'Auth Service',
    type: 'business_domain',
    contains: ['sym-login', 'sym-logout', 'sym-validate'],
    parent: null,
    children: [],
    clusterStrength: 0,
  },
  {
    id: 'payments',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    name: 'Payments',
    type: 'business_domain',
    contains: ['sym-charge', 'sym-refund'],
    parent: null,
    children: [],
    clusterStrength: 0,
  },
];

function renderWithProvider(
  effectiveNodeIds: string[],
  areas: Area[] = mockAreas,
  repoPath = '/tmp/test-repo',
) {
  return render(
    <AreaProvider areas={areas}>
      <AreaAssignment effectiveNodeIds={effectiveNodeIds} repoPath={repoPath} />
    </AreaProvider>,
  );
}

describe('AreaAssignment', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as typeof fetch;
  });

  describe('area picker dropdown', () => {
    it('renders dropdown with existing areas and + New Area option', () => {
      renderWithProvider(['sym-login']);
      const select = screen.getByTestId('area-picker');
      expect(select).toBeInTheDocument();
      const options = within(select).getAllByRole('option');
      const optionTexts = options.map((o) => o.textContent);
      expect(optionTexts).toContain('Auth Service');
      expect(optionTexts).toContain('Payments');
      expect(optionTexts).toContain('+ New Area');
    });

    it('shows only + New Area when no areas exist', () => {
      renderWithProvider(['sym-login'], []);
      const select = screen.getByTestId('area-picker');
      const options = within(select).getAllByRole('option');
      expect(options.filter((o) => o.textContent !== 'Select an area…')).toHaveLength(1);
      expect(options.map((o) => o.textContent)).toContain('+ New Area');
    });
  });

  describe('common area badges', () => {
    it('shows common area badge when all nodes share an area', () => {
      renderWithProvider(['sym-login', 'sym-logout']);
      expect(screen.getByTestId('common-area-badge-auth')).toHaveTextContent('Auth Service');
    });

    it('does not show badge when nodes do not share an area', () => {
      renderWithProvider(['sym-login', 'sym-charge']);
      expect(screen.queryByTestId('common-area-badge-auth')).not.toBeInTheDocument();
      expect(screen.queryByTestId('common-area-badge-payments')).not.toBeInTheDocument();
    });

    it('shows no badges section when no common areas', () => {
      renderWithProvider(['sym-login', 'sym-charge']);
      expect(screen.queryByText('Common areas:')).not.toBeInTheDocument();
    });
  });

  describe('saving assignments', () => {
    it('posts merged deduped area members and shows success when adding to an existing area', async () => {
      fetchMock.mockResolvedValue({
        json: async () => ({ success: true }),
      });

      renderWithProvider(['sym-login', 'sym-refund']);

      const user = userEvent.setup();
      await user.selectOptions(screen.getByTestId('area-picker'), 'payments');
      await user.click(screen.getByTestId('area-action-button'));

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      const [url, request] = fetchMock.mock.calls[0];
      expect(url).toBe('/api/areas');
      expect(request).toMatchObject({ method: 'POST' });
      const body = JSON.parse(request.body as string);
      expect(body).toMatchObject({
        action: 'save',
        repoPath: '/tmp/test-repo',
        data: { version: 1 },
      });
      expect(body.data.areas).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'payments',
            contains: expect.arrayContaining(['sym-charge', 'sym-refund', 'sym-login']),
          }),
        ]),
      );
      expect(
        body.data.areas.find((area: Area) => area.id === 'payments').contains.filter((id: string) => id === 'sym-refund'),
      ).toHaveLength(1);
      expect(await screen.findByTestId('save-success')).toBeInTheDocument();
    });

    it('creates a new area, updates provider state, and shows success after save', async () => {
      fetchMock.mockResolvedValue({
        json: async () => ({ success: true }),
      });
      jest.spyOn(Math, 'random').mockReturnValue(0.123456789);

      renderWithProvider(['sym-login']);

      const user = userEvent.setup();
      await user.selectOptions(screen.getByTestId('area-picker'), '__new__');
      await user.type(screen.getByTestId('new-area-name'), 'Config Pipeline');
      await user.selectOptions(screen.getByTestId('new-area-parent'), 'auth');
      await user.selectOptions(screen.getByTestId('new-area-children'), ['payments']);
      await user.click(screen.getByTestId('area-action-button'));

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      const [, request] = fetchMock.mock.calls[0];
      const body = JSON.parse(request.body as string);
      expect(body.data.areas).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'config-pipeline-1f9a',
            name: 'Config Pipeline',
            type: 'business_domain',
            contains: ['sym-login'],
            parent: 'auth',
            children: ['payments'],
          }),
          expect.objectContaining({
            id: 'auth',
            children: expect.arrayContaining(['config-pipeline-1f9a']),
          }),
          expect.objectContaining({
            id: 'payments',
            parent: 'config-pipeline-1f9a',
          }),
        ]),
      );
      expect(await screen.findByTestId('save-success')).toBeInTheDocument();
      await waitFor(() => {
        const options = within(screen.getByTestId('area-picker')).getAllByRole('option');
        expect(options.map((o) => o.textContent)).toContain('Config Pipeline');
      });

      jest.spyOn(Math, 'random').mockRestore();
    });

    it('shows an error when saving fails', async () => {
      fetchMock.mockResolvedValue({
        json: async () => ({ success: false, error: 'No write access' }),
      });

      renderWithProvider(['sym-login']);

      const user = userEvent.setup();
      await user.selectOptions(screen.getByTestId('area-picker'), 'auth');
      await user.click(screen.getByTestId('area-action-button'));

      expect(await screen.findByTestId('save-error')).toHaveTextContent('No write access');
    });
  });

  describe('new area validation', () => {
    it('prevents selecting the same area as both parent and child', async () => {
      renderWithProvider(['sym-login']);

      const user = userEvent.setup();
      await user.selectOptions(screen.getByTestId('area-picker'), '__new__');
      await user.selectOptions(screen.getByTestId('new-area-parent'), 'auth');

      const childOptions = within(screen.getByTestId('new-area-children')).getAllByRole('option');
      expect(childOptions.map((option) => option.getAttribute('value'))).not.toContain('auth');
      expect(childOptions.map((option) => option.getAttribute('value'))).toContain('payments');
    });
  });

  describe('disabled state', () => {
    it('disables Add to Area button when effectiveNodeIds is empty', () => {
      renderWithProvider([]);
      const button = screen.getByTestId('area-action-button');
      expect(button).toBeDisabled();
    });

    it('disables Create Area when name is empty', async () => {
      const user = userEvent.setup();
      renderWithProvider(['sym-a']);
      await user.selectOptions(screen.getByTestId('area-picker'), '__new__');
      // Don't type a name
      expect(screen.getByTestId('area-action-button')).toBeDisabled();
    });
  });
});
