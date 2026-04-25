/**
 * apidrift/react
 *
 * React hook for tracking API drift in React applications.
 *
 * @example
 * import { useApiDrift } from 'apidrift/react'
 *
 * function UserProfile() {
 *   const { data, drift, hasBreaking } = useApiDrift<User>('/api/user')
 *   if (hasBreaking) console.warn('Breaking drift!', drift?.changes)
 *   return <div>{data?.name}</div>
 * }
 */

import { track } from "../core/tracker.js";
import type { DriftResult } from "../core/diff.js";

// ── Minimal React type stubs (no hard dep) ────────────────────────────────
type SetState<T> = (value: T | ((prev: T) => T)) => void;
type EffectCleanup = void | (() => void);

interface ReactLike {
  useState<T>(initial: T): [T, SetState<T>];
  useEffect(effect: () => EffectCleanup, deps?: unknown[]): void;
}

function loadReact(): ReactLike {
  const r =
    (globalThis as any).React ??
    (() => {
      try {
        // Dynamic require — only works in CJS / bundler environments

        return (globalThis as any).__apidrift_require?.("react");
      } catch {
        return null;
      }
    })();

  if (!r?.useState) {
    throw new Error(
      "[apidrift] React not found. Install react and ensure it is accessible globally, " +
        "or use the programmatic track() API instead."
    );
  }
  return r as ReactLike;
}

export interface UseApiDriftOptions {
  /** Suppress console output */
  silent?: boolean;
  /** Refetch whenever this value changes (like useEffect deps) */
  deps?: unknown[];
  /** Called when drift is detected */
  onDrift?: (result: DriftResult) => void;
}

export interface UseApiDriftResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  drift: DriftResult | null;
  hasBreaking: boolean;
}

/**
 * React hook — fetches a URL and automatically tracks schema drift.
 * Re-fetches whenever `options.deps` changes.
 */
export function useApiDrift<T = unknown>(
  url: string,
  options: UseApiDriftOptions = {}
): UseApiDriftResult<T> {
  const React = loadReact();

  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<Error | null>(null);
  const [drift, setDrift] = React.useState<DriftResult | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(url);
        const body = (await res.json()) as T;
        if (cancelled) return;

        setData(body);

        const result = track(url, body, {
          silent: options.silent,
          onDrift: (r) => {
            setDrift(r);
            options.onDrift?.(r);
          },
        });
        if (result?.hasChanges) setDrift(result);
      } catch (e) {
        if (!cancelled) setError(e as Error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url, ...(options.deps ?? [])]);

  return { data, loading, error, drift, hasBreaking: drift?.hasBreaking ?? false };
}

/**
 * Higher-order function: wrap any async fetcher with drift tracking.
 *
 * @example
 * const getUser = withDriftTracking('/api/user', () => api.getUser())
 * const { data, drift } = await getUser()
 */
export function withDriftTracking<T>(
  endpoint: string,
  fetcher: () => Promise<T>,
  options: UseApiDriftOptions = {}
): () => Promise<{ data: T; drift: DriftResult | null }> {
  return async () => {
    const data = await fetcher();
    const drift = track(endpoint, data, { silent: options.silent });
    return { data, drift };
  };
}
