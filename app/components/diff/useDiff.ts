'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { GitRefsResponse, DiffResponse } from '@/lib/diff/types';

export interface DiffState {
  refs: { branches: string[]; tags: string[]; defaultBranch: string | null; currentBranch: string | null } | null;
  base: string;
  compare: string;
  result: DiffResponse | null;
  loading: boolean;
  error: string | null;
  shaValidation: { input: string; valid: boolean; resolved: string | null } | null;
}

export interface UseDiffReturn extends DiffState {
  setBase: (ref: string) => void;
  setCompare: (ref: string) => void;
  validateSha: (sha: string) => Promise<void>;
}

/**
 * Hook that manages diff state: fetches refs, runs the diff pipeline, handles request cancellation.
 * State survives tab switches (held in page.tsx) but not page reload.
 */
export function useDiff(repoPath: string): UseDiffReturn {
  const [refs, setRefs] = useState<DiffState['refs']>(null);
  const [base, setBase] = useState('');
  const [compare, setCompare] = useState('');
  const [result, setResult] = useState<DiffResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shaValidation, setShaValidation] = useState<DiffState['shaValidation']>(null);
  const requestIdRef = useRef(0);

  // Fetch refs when repoPath changes; reset state via cleanup of previous effect
  useEffect(() => {
    // The cleanup of the previous run resets everything
    // On first run (or when repoPath is valid), start fetching
    if (!repoPath) return;

    let cancelled = false;

    fetch(`/api/git-refs?repoPath=${encodeURIComponent(repoPath)}`)
      .then((res) => res.json())
      .then((data: GitRefsResponse) => {
        if (cancelled) return;
        if (data.success) {
          setRefs(data.data);
          if (data.data.defaultBranch) setBase(data.data.defaultBranch);
          if (data.data.currentBranch) setCompare(data.data.currentBranch);
        } else {
          setError(data.error);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to fetch refs');
      });

    return () => {
      cancelled = true;
      setRefs(null);
      setBase('');
      setCompare('');
      setResult(null);
      setError(null);
    };
  }, [repoPath]);

  // Validate a pasted SHA against the repo
  const validateSha = useCallback(async (sha: string) => {
    if (!repoPath || !sha) {
      setShaValidation(null);
      return;
    }
    try {
      const res = await fetch(
        `/api/git-refs?repoPath=${encodeURIComponent(repoPath)}&sha=${encodeURIComponent(sha)}`,
      );
      const data: GitRefsResponse = await res.json();
      if (data.success && data.data.sha) {
        setShaValidation(data.data.sha);
      }
    } catch {
      setShaValidation({ input: sha, valid: false, resolved: null });
    }
  }, [repoPath]);

  // Run diff when base or compare changes
  useEffect(() => {
    if (!repoPath || !base || !compare) return;

    const id = ++requestIdRef.current;

    Promise.resolve()
      .then(() => {
        setLoading(true);
        setError(null);
      })
      .then(() => fetch('/api/diff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoPath, base, compare, hideTestFiles: true }),
      }))
      .then((res) => res.json())
      .then((data: DiffResponse) => {
        if (id !== requestIdRef.current) return;
        setResult(data);
        if (!data.success) {
          setError(data.error);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (id !== requestIdRef.current) return;
        setError(err.message || 'Network error');
        setLoading(false);
      });
  }, [repoPath, base, compare]);

  const handleSetBase = useCallback((ref: string) => {
    setBase(ref);
    setShaValidation(null);
  }, []);

  const handleSetCompare = useCallback((ref: string) => {
    setCompare(ref);
    setShaValidation(null);
  }, []);

  return {
    refs,
    base,
    compare,
    result,
    loading,
    error,
    shaValidation,
    setBase: handleSetBase,
    setCompare: handleSetCompare,
    validateSha,
  };
}