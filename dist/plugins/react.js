"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.useApiDrift = useApiDrift;
exports.withDriftTracking = withDriftTracking;
const tracker_js_1 = require("../core/tracker.js");
function loadReact() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = globalThis.React ?? (() => {
        try {
            // Dynamic require — only works in CJS / bundler environments
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            return globalThis.__apidrift_require?.("react");
        }
        catch {
            return null;
        }
    })();
    if (!r?.useState) {
        throw new Error("[apidrift] React not found. Install react and ensure it is accessible globally, " +
            "or use the programmatic track() API instead.");
    }
    return r;
}
/**
 * React hook — fetches a URL and automatically tracks schema drift.
 * Re-fetches whenever `options.deps` changes.
 */
function useApiDrift(url, options = {}) {
    const React = loadReact();
    const [data, setData] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const [drift, setDrift] = React.useState(null);
    React.useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch(url);
                const body = (await res.json());
                if (cancelled)
                    return;
                setData(body);
                const result = (0, tracker_js_1.track)(url, body, {
                    silent: options.silent,
                    onDrift: (r) => {
                        setDrift(r);
                        options.onDrift?.(r);
                    },
                });
                if (result?.hasChanges)
                    setDrift(result);
            }
            catch (e) {
                if (!cancelled)
                    setError(e);
            }
            finally {
                if (!cancelled)
                    setLoading(false);
            }
        })();
        return () => { cancelled = true; };
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
function withDriftTracking(endpoint, fetcher, options = {}) {
    return async () => {
        const data = await fetcher();
        const drift = (0, tracker_js_1.track)(endpoint, data, { silent: options.silent });
        return { data, drift };
    };
}
//# sourceMappingURL=react.js.map