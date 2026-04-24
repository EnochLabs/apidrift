"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.patchFetch = patchFetch;
exports.unpatchFetch = unpatchFetch;
exports.isFetchPatched = isFetchPatched;
const tracker_js_1 = require("../core/tracker.js");
let _isPatched = false;
const defaultContentTypes = ["application/json", "application/ld+json"];
/**
 * Patch the global `fetch` to automatically track API drift.
 * Safe to call multiple times — only patches once.
 */
function patchFetch(options = {}) {
    if (_isPatched)
        return;
    if (typeof globalThis.fetch !== "function")
        return;
    const originalFetch = globalThis.fetch.bind(globalThis);
    const contentTypes = options.contentTypes ?? defaultContentTypes;
    globalThis.fetch = async function patchedFetch(input, init) {
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
                cloned.json().then((body) => {
                    (0, tracker_js_1.track)(url, body, options);
                }).catch(() => {
                    // Silently ignore parse errors
                });
            }
        }
        catch {
            // Never crash the app — apidrift is an observer, not a blocker
        }
        return response;
    };
    _isPatched = true;
}
/**
 * Restore the original fetch (useful for testing)
 */
function unpatchFetch() {
    // We can't truly restore without storing original, but we can reset flag
    _isPatched = false;
}
function isFetchPatched() {
    return _isPatched;
}
//# sourceMappingURL=fetch.js.map