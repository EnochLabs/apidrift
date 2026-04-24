import { TrackOptions } from "../core/tracker.js";
export interface InterceptOptions extends TrackOptions {
    /** Only intercept URLs matching this pattern */
    filter?: (url: string) => boolean;
    /** Content types to track (default: application/json) */
    contentTypes?: string[];
}
/**
 * Patch the global `fetch` to automatically track API drift.
 * Safe to call multiple times — only patches once.
 */
export declare function patchFetch(options?: InterceptOptions): void;
/**
 * Restore the original fetch (useful for testing)
 */
export declare function unpatchFetch(): void;
export declare function isFetchPatched(): boolean;
//# sourceMappingURL=fetch.d.ts.map