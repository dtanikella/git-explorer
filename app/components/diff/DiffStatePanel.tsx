'use client';

import type { DiffErrorCode } from '@/lib/diff/types';

const INSTALL_COMMANDS: Record<string, string[]> = {
  DIFFT_MISSING: ['brew install difftastic', 'cargo install difftastic'],
  DIFFT_TOO_OLD: ['brew upgrade difftastic', 'cargo install difftastic --force'],
};

interface DiffStatePanelProps {
  state: 'empty' | 'loading' | 'no-changes' | 'error';
  /** Whether there is a previous result to show dimmed */
  hasPreviousResult?: boolean;
  /** Error code (DIFFT_MISSING, DIFFT_TOO_OLD, etc.) */
  errorCode?: DiffErrorCode;
  /** Error message */
  errorMessage?: string;
}

/**
 * Renders the canvas-level state for the diff tab.
 * Each state matches spec §5 and is shown below the compare bar.
 */
export default function DiffStatePanel({
  state,
  hasPreviousResult,
  errorCode,
  errorMessage,
}: DiffStatePanelProps) {
  // Loading: keep previous graph at 50% opacity or blank
  if (state === 'loading') {
    if (hasPreviousResult) {
      return null; // The parent component renders the existing canvas with opacity
    }
    return null; // No previous result — blank canvas
  }

  // Empty state
  if (state === 'empty') {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-400 border border-dashed border-gray-300 rounded-lg">
        Choose a branch to compare.
      </div>
    );
  }

  // No changes state
  if (state === 'no-changes') {
    return null; // The graph canvas renders with all nodes unchanged (50% saturation via step 16)
  }

  // Error state
  if (state === 'error') {
    if (errorCode === 'DIFFT_MISSING' || errorCode === 'DIFFT_TOO_OLD') {
      const commands = (errorCode === 'DIFFT_MISSING' ? INSTALL_COMMANDS.DIFFT_MISSING : INSTALL_COMMANDS.DIFFT_TOO_OLD);
      return (
        <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-8">
          <div className="text-red-500 text-sm">{errorMessage || 'Difftastic is required for diff analysis.'}</div>
          <div className="font-mono text-sm text-gray-600">
            {commands.map((cmd, i) => (
              <div key={i} className="mb-1">$ {cmd}</div>
            ))}
          </div>
        </div>
      );
    }
    return (
      <div className="w-full h-full flex items-center justify-center text-red-500 text-sm">
        {errorMessage || 'An error occurred during diff analysis.'}
      </div>
    );
  }

  return null;
}