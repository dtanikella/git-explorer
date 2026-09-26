'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { copyToClipboard } from '@/lib/selection/clipboard';

/**
 * Copies text and remembers which control did it for a moment, so the
 * control can show a "copied" state.
 *
 * @returns The key of the control that last copied, and a `copy(key, text)` function.
 */
export function useCopyFeedback() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = useCallback((key: string, text: string) => {
    void copyToClipboard(text).then((ok) => {
      if (!ok) return;
      setCopiedKey(key);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopiedKey(null), 1500);
    });
  }, []);

  return { copiedKey, copy };
}
