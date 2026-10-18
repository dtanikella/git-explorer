import type { CardContent } from '@/lib/default/card';

interface InfoCardProps {
  content: CardContent;
  /** the band hue of a folder or file, for its kind pill; ignored for a symbol */
  hue: number | null;
}

/**
 * The card docked in the top right of the default view, describing the hovered folder, file or symbol.
 *
 * @remarks
 * Presentation only: every field comes from {@link CardContent}. It ignores the pointer, so it never blocks hover on
 * the diagram beneath it.
 *
 * @param content - From `cardContent`.
 * @param hue - Band hue, used for the pill of a folder or file.
 */
export default function InfoCard({ content, hue }: InfoCardProps) {
  const pillColor = content.pill.color ?? `hsl(${hue ?? 0}, 58%, 40%)`;
  const total = content.kindMix.reduce((sum, k) => sum + k.count, 0);
  return (
    <div data-testid="info-card" className="absolute top-3 right-3 z-10 w-[300px] rounded-lg border border-gray-200 bg-white p-3 shadow-lg pointer-events-none">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-[11px] text-gray-500">{content.breadcrumb}</span>
        <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white" style={{ backgroundColor: pillColor }}>
          {content.pill.label}
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
    </div>
  );
}
