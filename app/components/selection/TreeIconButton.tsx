'use client';

import type { MouseEvent, ReactNode } from 'react';

interface TreeIconButtonProps {
  label: string;
  onClick: (e: MouseEvent) => void;
  /** Tints the button, e.g. amber for an active lock, green for a completed copy or blue for an active filter. */
  tone?: 'default' | 'active' | 'success' | 'filter';
  /** `hover` hides the button until its row (a `group`) is hovered or the button is focused. */
  reveal?: 'always' | 'hover';
  children: ReactNode;
}

const TONES = {
  default: 'text-gray-400 hover:text-gray-700 hover:bg-gray-200',
  active: 'text-amber-600 bg-amber-100 hover:bg-amber-200',
  success: 'text-emerald-600 bg-emerald-100',
  filter: 'text-blue-600 bg-blue-100 hover:bg-blue-200',
} as const;

/**
 * Small square icon button for tree rows, with hover, press, and keyboard-focus states.
 *
 * @param label - Accessible name, also used as the tooltip.
 * @param onClick - Click handler.
 * @param tone - Visual tone.
 * @param reveal - Whether the button is always visible or only on row hover.
 */
export function TreeIconButton({ label, onClick, tone = 'default', reveal = 'always', children }: TreeIconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded border-0 bg-transparent p-0 transition active:scale-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 ${TONES[tone]} ${reveal === 'hover' ? 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100' : ''}`}
    >
      {children}
    </button>
  );
}

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function LockIcon() {
  return (
    <Svg>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </Svg>
  );
}

export function UnlockIcon() {
  return (
    <Svg>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 7.5-2" />
    </Svg>
  );
}

export function CopyIcon() {
  return (
    <Svg>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
    </Svg>
  );
}

export function FilterIcon() {
  return (
    <Svg>
      <path d="M3 5h18l-7 8v6l-4-2v-4z" />
    </Svg>
  );
}

export function CheckIcon() {
  return (
    <Svg>
      <path d="M5 12.5l4.5 4.5L19 7" />
    </Svg>
  );
}
