'use client';

import { useState, useRef, useEffect } from 'react';
import type { UseDiffReturn } from './useDiff';
import type { DiffCounts } from '@/lib/diff/types';

interface CompareBarProps {
  diffState: UseDiffReturn;
}

/**
 * Compare bar for the diff tab: two pill dropdowns for base/compare refs,
 * a status line, and counts (added, modified, deleted).
 * Collapses responsively at breakpoints 900px, 760px, 640px.
 */
export default function CompareBar({ diffState }: CompareBarProps) {
  const {
    refs,
    base,
    compare,
    result,
    loading,
    error,
    shaValidation,
    setBase,
    setCompare,
    validateSha,
  } = diffState;

  const [barWidth, setBarWidth] = useState(0);
  const barRef = useRef<HTMLDivElement | null>(null);
  const [openPicker, setOpenPicker] = useState<'base' | 'compare' | null>(null);
  const [baseInput, setBaseInput] = useState(base);
  const [compareInput, setCompareInput] = useState(compare);

  const inputTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Update inputs when base/compare changes externally
  useEffect(() => {
    setBaseInput(base);
  }, [base]);

  useEffect(() => {
    setCompareInput(compare);
  }, [compare]);

  // ResizeObserver for collapse thresholds
  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setBarWidth(entry.contentRect.width);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Close picker on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setOpenPicker(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const showBaseLabel = barWidth >= 640;
  const showCompareLabel = barWidth >= 640;
  const showStatusLine = barWidth >= 900;
  const showFullCounts = barWidth >= 760;

  const statusText = loading ? 'Diffing…' :
    error ? `⚠ ${error}` :
    result?.success && result.state === 'ok' ? `✓ ${result.changedFiles} TS files changed` :
    result?.success && result.state === 'no-changes' ? 'No TypeScript changes between these refs' :
    '';

  const statusClass = loading ? 'text-gray-500' :
    error ? 'text-red-600' :
    result?.success && result.state === 'ok' ? 'text-green-700' :
    result?.success && result.state === 'no-changes' ? 'text-gray-700' :
    '';

  const counts: DiffCounts | null =
    result?.success && (result.state === 'ok' || result.state === 'no-changes')
      ? result.counts
      : null;

  return (
    <div
      ref={barRef}
      className="flex items-center px-2 py-1 border border-gray-200 rounded-md bg-gray-50"
      style={{ height: 40, minHeight: 40 }}
    >
      {/* Base picker */}
      <div className="relative" key="base">
        <button
          disabled={loading}
          onClick={(e) => {
            e.stopPropagation();
            setOpenPicker(openPicker === 'base' ? null : 'base');
          }}
          className={`flex items-center h-[30px] px-2 border border-gray-300 rounded bg-white text-sm ${
            loading ? 'bg-gray-100 cursor-not-allowed' : 'hover:bg-gray-50'
          }`}
        >
          {showBaseLabel && <span className="text-gray-500 mr-1">base:</span>}
          <span className="font-semibold text-gray-900 max-w-[120px] truncate">
            {base || 'select…'}
          </span>
          <svg className="ml-[6px] text-gray-500" width="9" height="9" viewBox="0 0 9 9" fill="currentColor">
            <path d="M0 3 L9 3 L4.5 8 Z" />
          </svg>
        </button>

        {openPicker === 'base' && (
          <div className="absolute top-full left-0 mt-1 w-[240px] bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-[300px] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-2 border-b border-gray-200">
              <input
                type="text"
                placeholder="Paste a SHA…"
                value={baseInput}
                onChange={(e) => {
                  const v = e.target.value;
                  setBaseInput(v);
                  if (inputTimeoutRef.current) clearTimeout(inputTimeoutRef.current);
                  inputTimeoutRef.current = setTimeout(() => {
                    validateSha(v);
                  }, 300);
                }}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:border-blue-400"
              />
              {shaValidation && shaValidation.input === baseInput && !shaValidation.valid && (
                <div className="text-red-600 text-xs mt-1">Not a commit in this repo</div>
              )}
            </div>
            {refs && (
              <>
                {refs.branches.length > 0 && (
                  <div className="border-b border-gray-100">
                    <div className="px-3 py-1 text-xs text-gray-400 font-medium uppercase tracking-wide">Branches</div>
                    {refs.branches.map((b) => (
                      <button
                        key={b}
                        onClick={(e) => {
                          e.stopPropagation();
                          setBase(b);
                          setOpenPicker(null);
                        }}
                        className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 ${
                          base === b ? 'bg-blue-50 font-semibold' : ''
                        }`}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                )}
                {refs.tags.length > 0 && (
                  <div>
                    <div className="px-3 py-1 text-xs text-gray-400 font-medium uppercase tracking-wide">Tags</div>
                    {refs.tags.map((t) => (
                      <button
                        key={t}
                        onClick={(e) => {
                          e.stopPropagation();
                          setBase(t);
                          setOpenPicker(null);
                        }}
                        className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 ${
                          base === t ? 'bg-blue-50 font-semibold' : ''
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Arrow */}
      <svg className="text-gray-500 -mx-2 shrink-0" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M5 13 L11 8 L5 3" />
      </svg>

      {/* Compare picker */}
      <div className="relative" key="compare">
        <button
          disabled={loading}
          onClick={(e) => {
            e.stopPropagation();
            setOpenPicker(openPicker === 'compare' ? null : 'compare');
          }}
          className={`flex items-center h-[30px] px-2 border border-gray-300 rounded bg-white text-sm ${
            loading ? 'bg-gray-100 cursor-not-allowed' : 'hover:bg-gray-50'
          }`}
        >
          {showCompareLabel && <span className="text-gray-500 mr-1">compare:</span>}
          <span className="font-semibold text-gray-900 max-w-[120px] truncate">
            {compare || 'select…'}
          </span>
          <svg className="ml-[6px] text-gray-500" width="9" height="9" viewBox="0 0 9 9" fill="currentColor">
            <path d="M0 3 L9 3 L4.5 8 Z" />
          </svg>
        </button>

        {openPicker === 'compare' && (
          <div className="absolute top-full left-0 mt-1 w-[240px] bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-[300px] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-2 border-b border-gray-200">
              <input
                type="text"
                placeholder="Paste a SHA…"
                value={compareInput}
                onChange={(e) => {
                  const v = e.target.value;
                  setCompareInput(v);
                  if (inputTimeoutRef.current) clearTimeout(inputTimeoutRef.current);
                  inputTimeoutRef.current = setTimeout(() => {
                    validateSha(v);
                  }, 300);
                }}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:border-blue-400"
              />
              {shaValidation && shaValidation.input === compareInput && !shaValidation.valid && (
                <div className="text-red-600 text-xs mt-1">Not a commit in this repo</div>
              )}
            </div>
            {refs && (
              <>
                {refs.branches.length > 0 && (
                  <div className="border-b border-gray-100">
                    <div className="px-3 py-1 text-xs text-gray-400 font-medium uppercase tracking-wide">Branches</div>
                    {refs.branches.map((b) => (
                      <button
                        key={b}
                        onClick={(e) => {
                          e.stopPropagation();
                          setCompare(b);
                          setOpenPicker(null);
                        }}
                        className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 ${
                          compare === b ? 'bg-blue-50 font-semibold' : ''
                        }`}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                )}
                {refs.tags.length > 0 && (
                  <div>
                    <div className="px-3 py-1 text-xs text-gray-400 font-medium uppercase tracking-wide">Tags</div>
                    {refs.tags.map((t) => (
                      <button
                        key={t}
                        onClick={(e) => {
                          e.stopPropagation();
                          setCompare(t);
                          setOpenPicker(null);
                        }}
                        className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 ${
                          compare === t ? 'bg-blue-50 font-semibold' : ''
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Status line — always visible for loading/error/no-changes; ok status hides below 900px */}
      {statusText && (loading || error || (result?.success && result.state === 'no-changes') || showStatusLine) && (
        <span className={`text-sm ${statusClass} ml-2 truncate`}>{statusText}</span>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Counts — only when ok, never during loading/error */}
      {result?.success && result.state === 'ok' && counts && (
        <div className="flex items-center gap-4 text-sm text-gray-700 tabular-nums shrink-0">
          {counts.added > 0 && (
            <span className="flex items-center">
              <span className="w-[10px] h-[10px] rounded-full mr-[6px]" style={{ backgroundColor: '#22a559' }} />
              {showFullCounts ? `${counts.added} added` : counts.added}
            </span>
          )}
          {counts.modified > 0 && (
            <span className="flex items-center">
              <span className="w-[10px] h-[10px] rounded-full mr-[6px]" style={{ backgroundColor: '#3b82f6' }} />
              {showFullCounts ? `${counts.modified} modified` : counts.modified}
            </span>
          )}
          {counts.deleted > 0 && (
            <span className="flex items-center">
              <span className="w-[10px] h-[10px] rounded-full mr-[6px]" style={{ backgroundColor: '#e5484d' }} />
              {showFullCounts ? `${counts.deleted} deleted` : counts.deleted}
            </span>
          )}
        </div>
      )}
    </div>
  );
}