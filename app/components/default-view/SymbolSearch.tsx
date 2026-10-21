'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { kindLabel } from '@/lib/default/card';
import { nodeStyle } from '@/lib/default/config';
import { highlightRuns, searchSymbols } from '@/lib/default/search';
import type { HierarchyNode } from '@/lib/default/types';

interface SymbolSearchProps {
  /** every symbol the view draws */
  symbols: readonly HierarchyNode[];
  /** called with the id of the symbol the user chose */
  onPick: (id: string) => void;
}

/** Results listed at once; the footer says how many more matched. */
const MAX_LISTED = 8;

/**
 * A fuzzy symbol search docked in the top left of the default view.
 *
 * @remarks
 * Typing lists the best matches (see `searchSymbols`) with the matched letters highlighted. Up and Down move the active
 * row, Enter or a click chooses it, Esc clears the text and then closes the list, and `/` anywhere outside a text field
 * focuses the box. Choosing a result calls `onPick` and closes the list but keeps the text. Presentation and keyboard
 * handling only: what picking does to the graph is the caller's business.
 *
 * @param symbols - Every symbol the view draws.
 * @param onPick - Receives the chosen symbol's id.
 */
export default function SymbolSearch({ symbols, onPick }: SymbolSearchProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const results = useMemo(() => searchSymbols(symbols, query), [symbols, query]);
  const listed = results.slice(0, MAX_LISTED);

  // `/` focuses the box from anywhere that is not a text field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // A press outside the box closes the list.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const choose = (id: string) => {
    setOpen(false);
    inputRef.current?.blur();
    onPick(id);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (listed.length === 0) return;
      setOpen(true);
      setActive((a) => (a + (e.key === 'ArrowDown' ? 1 : -1) + listed.length) % listed.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (listed[active]) choose(listed[active].node.id);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (query) {
        setQuery('');
        setActive(0);
      } else {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
  };

  const hasQuery = query.trim() !== '';
  const activeId = open && listed[active] ? `${listId}-${active}` : undefined;

  return (
    <div ref={rootRef} data-testid="symbol-search" className="absolute top-3 left-3 z-20 w-[300px] text-xs">
      <div className="flex h-9 items-center gap-2 rounded-lg border border-gray-300 bg-white px-2 shadow-sm focus-within:border-[#2563eb] focus-within:ring-2 focus-within:ring-[#2563eb]/20">
        <span aria-hidden className="text-base leading-none text-gray-500">
          ⌕
        </span>
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label="Search symbols"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={activeId}
          aria-autocomplete="list"
          autoComplete="off"
          spellCheck={false}
          placeholder="Search symbols…"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 bg-transparent text-[13px] text-gray-900 outline-none placeholder:text-gray-400"
        />
        {hasQuery && <span className="whitespace-nowrap text-[11px] text-gray-500">{results.length} {results.length === 1 ? 'match' : 'matches'}</span>}
        <kbd className="rounded border border-b-2 border-gray-300 px-1 font-mono text-[10px] text-gray-500">/</kbd>
      </div>
      {open && (
        <div id={listId} role="listbox" data-testid="search-results" className="mt-1 max-h-[430px] overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {!hasQuery && (
            <div className="p-2.5 text-gray-500">
              Search {symbols.length} symbols by name or path.
              <br />
              Try <b>area</b>, <b>bldh</b>, or <b>lib sel</b>.
            </div>
          )}
          {hasQuery && results.length === 0 && <div className="p-2.5 text-gray-500">No symbols match.</div>}
          {listed.map((r, i) => (
            <div
              key={r.node.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              data-testid="search-result"
              // mousedown, not click: the input must not blur (and the list close) before the pick lands
              onMouseDown={(e) => {
                e.preventDefault();
                choose(r.node.id);
              }}
              onMouseMove={() => setActive(i)}
              className={`cursor-pointer border-b border-gray-100 px-2.5 py-1.5 ${i === active ? 'bg-[#eff6ff]' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate font-mono text-xs text-gray-900">
                  {highlightRuns(r.node.name, r.namePositions).map((run, j) =>
                    run.match ? (
                      <mark key={j} className="rounded-sm bg-amber-200 text-inherit">
                        {run.text}
                      </mark>
                    ) : (
                      <span key={j}>{run.text}</span>
                    )
                  )}
                </span>
                <span
                  className="shrink-0 rounded-full px-1.5 text-[9px] font-semibold uppercase leading-[15px] tracking-wide text-white"
                  style={{ backgroundColor: nodeStyle({ tier: 'symbol', depth: r.node.depth, syntaxType: r.node.symbol?.syntaxType }).color }}
                >
                  {kindLabel(r.node)}
                </span>
              </div>
              {/* rtl so a long path is cut from the left, keeping the file name visible */}
              <div className="truncate text-left text-[11px] text-gray-400" style={{ direction: 'rtl' }}>
                <bdo dir="ltr">{r.node.path}</bdo>
              </div>
            </div>
          ))}
          {hasQuery && results.length > 0 && (
            <div className="flex justify-between gap-2 bg-gray-50 px-2.5 py-1 text-[11px] text-gray-500">
              <span>{results.length > MAX_LISTED ? `top ${MAX_LISTED} of ${results.length}` : `${results.length} of ${symbols.length}`}</span>
              <span>↑↓ move · Enter pin · Esc close</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
