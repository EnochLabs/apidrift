import { TrackOptions } from "../core/tracker.js";
/**
 * A minimal duck-typed interface for any fetch-compatible function.
 * This lets us accept both the native globalThis.fetch and any polyfill
 * that is attached to a custom object rather than globalThis.
 */
export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
/**
 * A container object that exposes a `fetch` property — used by the
 * `target` option to support polyfill environments where fetch is not
 * on globalThis.
 *
 * @example
 *   import nodeFetch from "node-fetch";
 *   const myFetchHost = { fetch: nodeFetch };
 *   patchFetch({ target: myFetchHost });
 *   // Now myFetchHost.fetch is tracked
 */
export interface FetchTarget {
    fetch: FetchLike;
}
export interface InterceptOptions extends TrackOptions {
    /** Only intercept URLs matching this pattern */
    filter?: (url: string) => boolean;
    /** Content types to track (default: application/json) */
    contentTypes?: string[];
    /**
     * Target object whose `fetch` property will be patched.
     *
     * Defaults to `globalThis` which works for Node.js 18+ and all modern
     * browsers. Pass a custom object when fetch comes from a polyfill that is
     * not attached to globalThis — e.g. `{ target: myAxiosLikeFetchHost }`.
     *
     * @example
     *   // Node.js < 18 with a polyfill:
     *   import nodeFetch from "node-fetch";
     *   const fetchHost = { fetch: nodeFetch as unknown as typeof fetch };
     *   patchFetch({ target: fetchHost });
     */
    target?: FetchTarget;
}
/**
 * Patch a fetch function to automatically track API drift.
 *
 * By default patches `globalThis.fetch` (works in Node.js 18+ and browsers).
 * Pass `options.target` to patch a custom fetch instance instead — useful for
 * older Node.js versions or bundler environments where fetch is a polyfill
 * attached to a different object.
 *
 * Safe to call multiple times — only patches once per target.
 */
export declare function patchFetch(options?: InterceptOptions): void;
/**
 * Restore the original fetch function on the patched target.
 *
 * Previously this only reset the internal `_isPatched` flag but did NOT
 * restore the original function on the target object — meaning the patched
 * fetch would remain active indefinitely. This is now fixed.
 */
export declare function unpatchFetch(): void;
export declare function isFetchPatched(): boolean;
//# sourceMappingURL=fetch.d.ts.map