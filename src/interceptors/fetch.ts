import { track, TrackOptions } from "../core/tracker.js";

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

let _isPatched = false;
// Keep a reference to the original fetch so unpatchFetch can truly restore it
let _originalFetch: FetchLike | null = null;
// Keep a reference to the patched target so unpatchFetch can restore it
let _patchedTarget: FetchTarget | null = null;

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

const defaultContentTypes = ["application/json", "application/ld+json"];

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
export function patchFetch(options: InterceptOptions = {}): void {
  if (_isPatched) return;

  // Resolve the target — default to globalThis
  const target: FetchTarget = options.target ?? (globalThis as unknown as FetchTarget);

  if (typeof target.fetch !== "function") {
    // fetch is not available on the target; silently skip
    return;
  }

  const originalFetch = target.fetch.bind(target);
  const contentTypes = options.contentTypes ?? defaultContentTypes;

  const patchedFetch: FetchLike = async function (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    const response = await originalFetch(input, init);
    try {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
          ? input.toString()
          : (input as Request).url;

      // Apply filter if provided
      if (options.filter && !options.filter(url)) {
        return response;
      }

      const contentType = response.headers.get("content-type") ?? "";
      const isJson = contentTypes.some((ct) => contentType.includes(ct));

      if (isJson && response.ok) {
        // Clone so we don't consume the body
        const cloned = response.clone();
        cloned.json().then((body: unknown) => {
          track(url, body, options);
        }).catch(() => {
          // Silently ignore parse errors
        });
      }
    } catch {
      // Never crash the app — apidrift is an observer, not a blocker
    }
    return response;
  };

  // Store references so unpatchFetch can truly restore the original
  _originalFetch = originalFetch;
  _patchedTarget = target;
  target.fetch = patchedFetch as typeof fetch;
  _isPatched = true;
}

/**
 * Restore the original fetch function on the patched target.
 *
 * Previously this only reset the internal `_isPatched` flag but did NOT
 * restore the original function on the target object — meaning the patched
 * fetch would remain active indefinitely. This is now fixed.
 */
export function unpatchFetch(): void {
  if (!_isPatched) return;
  if (_patchedTarget && _originalFetch) {
    _patchedTarget.fetch = _originalFetch as typeof fetch;
  }
  _originalFetch = null;
  _patchedTarget = null;
  _isPatched = false;
}

export function isFetchPatched(): boolean {
  return _isPatched;
}
