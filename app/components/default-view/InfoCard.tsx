import type { EdgeKind } from '@/lib/analysis/types';
import type { CardContent, ConnectionsView } from '@/lib/default/card';
import type { Direction } from '@/lib/default/types';

/** What the card needs to be pinned to a symbol and show its connections. */
export interface PinnedCard {
  view: ConnectionsView;
  /** the selected category row, if any */
  kind: EdgeKind | null;
  /** the pinned symbol has too many edges to draw all of them, so a category has to be picked */
  tooMany: boolean;
  onDirection: (direction: Direction) => void;
  /** select a category row, or `null` to clear it */
  onKind: (kind: EdgeKind | null) => void;
  /** preview a row while the pointer is over it, or `null` when it leaves */
  onPreview: (kind: EdgeKind | null) => void;
  /** pin a connected symbol */
  onPick: (id: string) => void;
  onClose: () => void;
}

interface InfoCardProps {
  content: CardContent;
  /** the band hue of a folder or file, for its kind pill; ignored for a symbol */
  hue: number | null;
  /** set while a symbol is pinned */
  pinned?: PinnedCard;
}

/**
 * The card docked in the top right of the default view, describing the hovered folder, file or symbol.
 *
 * @remarks
 * Presentation only: every field comes from {@link CardContent}. It ignores the pointer, so it never blocks hover on
 * the diagram beneath it. Once a symbol is pinned it takes the pointer, gets a blue outline and a × button, and
 * adds the connections section: an `Out | In` toggle and the edge kinds ranked by count, one expandable to names.
 *
 * @param content - From `cardContent`.
 * @param hue - Band hue, used for the pill of a folder or file.
 * @param pinned - Connections and handlers while a symbol is pinned.
 */
export default function InfoCard({ content, hue, pinned }: InfoCardProps) {
  const pillColor = content.pill.color ?? `hsl(${hue ?? 0}, 58%, 40%)`;
  const total = content.kindMix.reduce((sum, k) => sum + k.count, 0);
  return (
    <div
      data-testid="info-card"
      data-pinned={pinned ? 'true' : undefined}
      className={`absolute top-3 right-3 z-10 w-[300px] rounded-lg border bg-white p-3 shadow-lg ${pinned ? 'border-[#2563eb] ring-2 ring-[#2563eb]/25' : 'border-gray-200 pointer-events-none'}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-[11px] text-gray-500">{content.breadcrumb}</span>
        <span className="flex shrink-0 items-center gap-1.5">
          <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white" style={{ backgroundColor: pillColor }}>
            {content.pill.label}
          </span>
          {pinned && (
            <button type="button" aria-label="Unpin" data-testid="unpin" onClick={pinned.onClose} className="rounded px-1 text-sm leading-none text-gray-500 hover:bg-gray-100 hover:text-gray-900">
              ×
            </button>
          )}
        </span>
      </div>
      <div className="mt-2 text-center text-[21px] leading-tight text-gray-900 break-words" style={{ fontWeight: 650 }}>
        {content.name}
      </div>
      {content.signature && (
        <pre className="mt-3 whitespace-pre-wrap break-words rounded bg-gray-100 p-2 font-mono text-xs text-gray-800">{content.signature}</pre>
      )}
      {content.position && <div className="mt-2 text-center text-xs text-gray-500">{content.position}</div>}
      {content.tiles.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {content.tiles.map((t) => (
            <div key={t.label} className="rounded bg-gray-100 px-2 py-1 text-center">
              <div className="text-base font-semibold text-gray-900">{t.value}</div>
              <div className="text-[10px] uppercase tracking-wide text-gray-500">{t.label}</div>
            </div>
          ))}
        </div>
      )}
      {total > 0 && (
        <>
          <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-gray-100">
            {content.kindMix.map((k) => (
              <div key={k.kind} title={`${k.kind}: ${k.count}`} style={{ width: `${(k.count / total) * 100}%`, backgroundColor: k.color }} />
            ))}
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-600">
            {content.kindMix.map((k) => (
              <li key={k.kind} className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: k.color }} />
                {k.kind} {k.count}
              </li>
            ))}
          </ul>
        </>
      )}
      {pinned && <Connections pinned={pinned} />}
    </div>
  );
}

/** The connections section of a pinned card: direction toggle, ranked kind rows, the active row's names, the footer. */
function Connections({ pinned }: { pinned: PinnedCard }) {
  const { view, kind: active } = pinned;
  const directions: Direction[] = ['out', 'in'];
  return (
    <div data-testid="connections" className="mt-3 border-t border-gray-200 pt-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Connections</span>
        <div className="flex overflow-hidden rounded border border-gray-300 text-[11px]" role="group" aria-label="Direction">
          {directions.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={view.direction === d}
              onClick={() => pinned.onDirection(d)}
              className={`px-2 py-0.5 ${view.direction === d ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
            >
              {d === 'out' ? 'Out' : 'In'} {view.counts[d]}
            </button>
          ))}
        </div>
      </div>
      {view.rows.length === 0 && <div className="mt-2 text-xs text-gray-500">No connections in this direction.</div>}
      {pinned.tooMany && <div className="mt-2 text-xs text-amber-700">Too many to draw, pick a category.</div>}
      <ul className="mt-1">
        {view.rows.map((r) => {
          const selected = r.kind === active;
          return (
            <li key={r.kind}>
              <button
                type="button"
                data-testid="connection-row"
                aria-expanded={selected}
                onClick={() => pinned.onKind(selected ? null : r.kind)}
                onMouseEnter={() => pinned.onPreview(r.kind)}
                onMouseLeave={() => pinned.onPreview(null)}
                className={`mt-1 flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs ${selected ? 'bg-[#eff6ff] outline outline-1 outline-[#2563eb]' : 'hover:bg-gray-100'}`}
              >
                <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: r.color }} />
                <span className="flex-1 text-gray-900">{r.label}</span>
                <span className="text-gray-600">{r.count}</span>
                <span className="text-gray-400 transition-transform" style={{ transform: selected ? 'rotate(90deg)' : undefined }}>
                  ▶
                </span>
              </button>
              {selected && (
                <ul className="mb-1 ml-6 mt-1 text-xs">
                  {r.names.map((n) => (
                    <li key={n.id}>
                      <button type="button" data-testid="connection-name" onClick={() => pinned.onPick(n.id)} className="flex w-full items-baseline justify-between gap-2 rounded px-1 py-0.5 text-left hover:bg-gray-100">
                        <span className="min-w-0 truncate text-gray-900">{n.name}</span>
                        <span className="max-w-[45%] shrink-0 truncate text-[10px] text-gray-400">{n.file}</span>
                      </button>
                    </li>
                  ))}
                  {r.more > 0 && <li className="px-1 py-0.5 text-gray-500">+ {r.more} more</li>}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
      {view.undrawn > 0 && (
        <div className="mt-2 flex justify-between text-[11px] text-gray-500">
          <span>+ {view.undrawn} external / unresolved</span>
          <span>not drawn</span>
        </div>
      )}
      <div className="mt-2 text-right text-[10px] text-gray-400">Esc clears category, again unpins</div>
    </div>
  );
}
