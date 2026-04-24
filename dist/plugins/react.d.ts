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
import type { DriftResult } from "../core/diff.js";
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
export declare function useApiDrift<T = unknown>(url: string, options?: UseApiDriftOptions): UseApiDriftResult<T>;
/**
 * Higher-order function: wrap any async fetcher with drift tracking.
 *
 * @example
 * const getUser = withDriftTracking('/api/user', () => api.getUser())
 * const { data, drift } = await getUser()
 */
export declare function withDriftTracking<T>(endpoint: string, fetcher: () => Promise<T>, options?: UseApiDriftOptions): () => Promise<{
    data: T;
    drift: DriftResult | null;
}>;
//# sourceMappingURL=react.d.ts.map