import { fireEvent, render, screen } from '@testing-library/react';
import InfoCard from '@/app/components/default-view/InfoCard';
import type { PinnedCard } from '@/app/components/default-view/InfoCard';
import type { CardContent, LocationGroup } from '@/lib/default/card';

const file = (key: string, label: string, ids: string[]): LocationGroup => ({ key, label, kind: 'file', count: ids.length, children: [], symbols: ids.map((id) => ({ id, name: id, file: label })) });
const lib: LocationGroup = { key: 'lib', label: 'lib/', kind: 'folder', count: 3, children: [file('lib/a.ts', 'a.ts', ['one', 'two']), file('lib/b.ts', 'b.ts', ['three'])], symbols: [] };

const content = { breadcrumb: 'x', pill: { label: 'function', color: '#000' }, name: 'pinned', signature: null, position: null, tiles: [], kindMix: [] } as unknown as CardContent;
const pinned: PinnedCard = {
  view: { direction: 'out', counts: { out: 3, in: 0 }, undrawn: 0, rows: [{ kind: 'CALLS' as never, label: 'Calls', color: '#2563eb', count: 3, locations: [lib] }] },
  kind: 'CALLS' as never,
  tooMany: false,
  onDirection: jest.fn(),
  onKind: jest.fn(),
  onPreview: jest.fn(),
  onPick: jest.fn(),
  onClose: jest.fn(),
};

describe('connection locations', () => {
  it('lists the symbols under their folder and file, all open to start with', () => {
    render(<InfoCard content={content} hue={null} pinned={pinned} />);
    expect(screen.getAllByTestId('location-group').map((g) => g.textContent)).toEqual(['▶lib/3', '▶a.ts2', '▶b.ts1']);
    expect(screen.getAllByTestId('connection-name').map((n) => n.textContent)).toEqual(['one', 'two', 'three']);
  });

  it('folds a file shut and a folder shut, and opens them again', () => {
    render(<InfoCard content={content} hue={null} pinned={pinned} />);
    const [folder, a] = screen.getAllByTestId('location-group');
    fireEvent.click(a);
    expect(screen.getAllByTestId('connection-name').map((n) => n.textContent)).toEqual(['three']);
    fireEvent.click(folder);
    expect(screen.queryAllByTestId('connection-name')).toHaveLength(0);
    fireEvent.click(folder);
    expect(screen.getAllByTestId('connection-name').map((n) => n.textContent)).toEqual(['three']);
  });

  it('pins a symbol when its name is clicked, and scrolls rather than stretching the card', () => {
    render(<InfoCard content={content} hue={null} pinned={pinned} />);
    fireEvent.click(screen.getByText('two'));
    expect(pinned.onPick).toHaveBeenCalledWith('two');
    expect(screen.getByTestId('connection-locations').className).toMatch(/max-h-64.*overflow-y-auto/);
  });
});
