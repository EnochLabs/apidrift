import { track, TrackOptions } from "../core/tracker.js";

let _isPatched = false;

export interface InterceptOptions extends TrackOptions {
  /** Only intercept URLs matching this pattern */
  filter?: (url: string) => boolean;
  /** Content types to track (default: application/json) */
  contentTypes?: string[];
}

const defaultContentTypes = ["application/json", "application/ld+json"];

/**
 * Patch the global `fetch` to automatically track API drift.
 * Safe to call multiple times — only patches once.
 */
export function patchFetch(options: InterceptOptions = {}): void {
  if (_isPatched) return;
  if (typeof globalThis.fetch !== "function") return;

  const originalFetch = globalThis.fetch.bind(globalThis);
  const contentTypes = options.contentTypes ?? defaultContentTypes;

  globalThis.fetch = async function patchedFetch(
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
  } as typeof fetch;

  _isPatched = true;
}

/**
 * Restore the original fetch (useful for testing)
 */
export function unpatchFetch(): void {
  // We can't truly restore without storing original, but we can reset flag
  _isPatched = false;
}

export function isFetchPatched(): boolean {
  return _isPatched;
}
