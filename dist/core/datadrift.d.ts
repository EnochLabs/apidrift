/**
 * Data Drift Detection
 *
 * Goes beyond schema shape — detects when NUMERIC VALUES drift statistically.
 * This is the ML-grade feature that no other API tooling has.
 *
 * e.g. "parasite_density went from avg 1200 → 2100 (+75%)"
 */
export interface NumericSample {
    min: number;
    max: number;
    mean: number;
    count: number;
    sum: number;
    m2: number;
}
export interface FieldStats {
    path: string;
    samples: NumericSample;
    lastValue: number;
}
export interface DataDriftAlert {
    path: string;
    kind: "MEAN_SHIFT" | "RANGE_EXCEEDED" | "SPIKE" | "DROP";
    severity: "LOW" | "MEDIUM" | "HIGH";
    baseline: number;
    current: number;
    changePercent: number;
    description: string;
}
export interface DataDriftResult {
    endpoint: string;
    alerts: DataDriftAlert[];
    hasAlerts: boolean;
}
/**
 * Extract all numeric leaf values from a JSON object, with dot-paths
 */
export declare function extractNumericPaths(obj: unknown, prefix?: string, result?: Record<string, number>): Record<string, number>;
/**
 * Update Welford's online algorithm for streaming mean/variance
 */
export declare function updateSample(sample: NumericSample, value: number): NumericSample;
export declare function createSample(value: number): NumericSample;
export declare function sampleStddev(sample: NumericSample): number;
/**
 * Compare current numeric values against baseline stats.
 * Returns alerts for significant deviations.
 */
export declare function detectDataDrift(endpoint: string, current: Record<string, number>, baseline: Record<string, FieldStats>): DataDriftResult;
//# sourceMappingURL=datadrift.d.ts.map