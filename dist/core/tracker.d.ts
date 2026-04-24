import { DriftResult } from "./diff.js";
export interface TrackOptions {
    /** Override the key used to store snapshots (defaults to normalized URL) */
    endpointKey?: string;
    /** Suppress console output */
    silent?: boolean;
    /** Enable data drift detection (numeric value tracking) */
    dataDrift?: boolean;
    /** Called when any schema drift is detected */
    onDrift?: (result: DriftResult) => void;
    /** Called specifically when breaking changes are detected */
    onBreaking?: (result: DriftResult) => void;
}
/**
 * Normalize a URL to a stable snapshot key.
 * Strips query params, trailing slashes, and common auth tokens.
 */
export declare function normalizeEndpoint(url: string): string;
/**
 * Core tracking function. Pass any URL + parsed JSON body.
 *
 * Internally this:
 * 1. Extracts a lightweight schema from the body
 * 2. Compares against saved snapshot (if any)
 * 3. Reports drift to console
 * 4. Records to history timeline
 * 5. Enforces contract (if locked)
 * 6. Detects data/value drift (if enabled)
 * 7. Saves new snapshot as baseline
 *
 * Returns the DriftResult if changes were found, null otherwise.
 */
export declare function track(url: string, body: unknown, options?: TrackOptions): DriftResult | null;
/**
 * Manually compare two JSON bodies without touching the snapshot store.
 * Useful for scripted comparisons and testing.
 */
export declare function compare(endpoint: string, oldBody: unknown, newBody: unknown): DriftResult;
//# sourceMappingURL=tracker.d.ts.map