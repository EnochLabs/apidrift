import { track } from "../core/tracker.js";
let _isPatched = false;
// Keep a reference to the original fetch so unpatchFetch can truly restore it
let _originalFetch = null;
// Keep a reference to the patched target so unpatchFetch can restore it
let _patchedTarget = null;
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
export function patchFetch(options = {}) {
    if (_isPatched)
        return;
    // Resolve the target — default to globalThis
    const target = options.target ?? globalThis;
    if (typeof target.fetch !== "function") {
        // fetch is not available on the target; silently skip
        return;
    }
    const originalFetch = target.fetch.bind(target);
    const contentTypes = options.contentTypes ?? defaultContentTypes;
    const patchedFetch = async function (input, init) {
        const response = await originalFetch(input, init);
        try {
            const url = typeof input === "string"
                ? input
                : input instanceof URL
                    ? input.toString()
                    : input.url;
            // Apply filter if provided
            if (options.filter && !options.filter(url)) {
                return response;
            }
            const contentType = response.headers.get("content-type") ?? "";
            const isJson = contentTypes.some((ct) => contentType.includes(ct));
            if (isJson && response.ok) {
                // Clone so we don't consume the body
                const cloned = response.clone();
                cloned
                    .json()
                    .then((body) => {
                    track(url, body, options);
                })
                    .catch(() => {
                    // Silently ignore parse errors
                });
            }
        }
        catch {
            // Never crash the app — apidrift is an observer, not a blocker
        }
        return response;
    };
    // Store references so unpatchFetch can truly restore the original
    _originalFetch = originalFetch;
    _patchedTarget = target;
    target.fetch = patchedFetch;
    _isPatched = true;
}
/**
 * Restore the original fetch function on the patched target.
 *
 * Previously this only reset the internal `_isPatched` flag but did NOT
 * restore the original function on the target object — meaning the patched
 * fetch would remain active indefinitely. This is now fixed.
 */
export function unpatchFetch() {
    if (!_isPatched)
        return;
    if (_patchedTarget && _originalFetch) {
        _patchedTarget.fetch = _originalFetch;
    }
    _originalFetch = null;
    _patchedTarget = null;
    _isPatched = false;
}
export function isFetchPatched() {
    return _isPatched;
}
//# sourceMappingURL=fetch.js.map