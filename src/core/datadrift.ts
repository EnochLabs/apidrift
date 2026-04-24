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
  // Welford's online variance tracking
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
export function extractNumericPaths(
  obj: unknown,
  prefix = "",
  result: Record<string, number> = {}
): Record<string, number> {
  if (obj === null || obj === undefined) return result;

  if (typeof obj === "number" && isFinite(obj)) {
    result[prefix] = obj;
    return result;
  }

  if (Array.isArray(obj)) {
    // For arrays, compute aggregate stats from numeric values
    const nums = obj.filter((v) => typeof v === "number" && isFinite(v)) as number[];
    if (nums.length > 0) {
      const arrKey = prefix + "[]";
      result[arrKey + ".mean"] = nums.reduce((a, b) => a + b, 0) / nums.length;
      result[arrKey + ".min"] = Math.min(...nums);
      result[arrKey + ".max"] = Math.max(...nums);
      result[arrKey + ".count"] = nums.length;
    }
    // Also recurse into object items
    obj.forEach((item, i) => {
      if (typeof item === "object" && item !== null) {
        extractNumericPaths(item, `${prefix}[${i}]`, result);
      }
    });
    return result;
  }

  if (typeof obj === "object") {
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const newPrefix = prefix ? `${prefix}.${key}` : key;
      extractNumericPaths(value, newPrefix, result);
    }
  }

  return result;
}

/**
 * Update Welford's online algorithm for streaming mean/variance
 */
export function updateSample(sample: NumericSample, value: number): NumericSample {
  const count = sample.count + 1;
  const delta = value - sample.mean;
  const mean = sample.mean + delta / count;
  const delta2 = value - mean;
  const m2 = sample.m2 + delta * delta2;

  return {
    min: Math.min(sample.min, value),
    max: Math.max(sample.max, value),
    mean,
    count,
    sum: sample.sum + value,
    m2,
  };
}

export function createSample(value: number): NumericSample {
  return { min: value, max: value, mean: value, count: 1, sum: value, m2: 0 };
}

export function sampleStddev(sample: NumericSample): number {
  if (sample.count < 2) return 0;
  return Math.sqrt(sample.m2 / (sample.count - 1));
}

/**
 * Compare current numeric values against baseline stats.
 * Returns alerts for significant deviations.
 */
export function detectDataDrift(
  endpoint: string,
  current: Record<string, number>,
  baseline: Record<string, FieldStats>
): DataDriftResult {
  const alerts: DataDriftAlert[] = [];

  for (const [path, value] of Object.entries(current)) {
    const stats = baseline[path];
    if (!stats || stats.samples.count < 3) continue; // Need enough samples

    const { mean } = stats.samples;
    if (mean === 0) continue; // Avoid division by zero

    const changePercent = ((value - mean) / Math.abs(mean)) * 100;
    const stddev = sampleStddev(stats.samples);
    const zScore = stddev > 0 ? Math.abs(value - mean) / stddev : 0;

    // Spike detection (> 2.5 standard deviations from mean)
    if (zScore > 2.5 && stats.samples.count >= 5) {
      alerts.push({
        path,
        kind: value > mean ? "SPIKE" : "DROP",
        severity: zScore > 4 ? "HIGH" : zScore > 3 ? "MEDIUM" : "LOW",
        baseline: parseFloat(mean.toFixed(4)),
        current: value,
        changePercent: parseFloat(changePercent.toFixed(1)),
        description: `${path}: ${value > mean ? "spike" : "drop"} detected (${changePercent > 0 ? "+" : ""}${changePercent.toFixed(1)}% from baseline μ=${mean.toFixed(2)})`,
      });
      continue;
    }

    // Mean shift detection (>40% change, enough samples)
    if (Math.abs(changePercent) > 40 && stats.samples.count >= 3) {
      alerts.push({
        path,
        kind: "MEAN_SHIFT",
        severity: Math.abs(changePercent) > 100 ? "HIGH" : "MEDIUM",
        baseline: parseFloat(mean.toFixed(4)),
        current: value,
        changePercent: parseFloat(changePercent.toFixed(1)),
        description: `${path}: mean shift ${changePercent > 0 ? "+" : ""}${changePercent.toFixed(1)}% (baseline ${mean.toFixed(2)} → current ${value})`,
      });
      continue;
    }

    // Range exceeded (outside min-max envelope)
    const rangeMargin = (stats.samples.max - stats.samples.min) * 0.1;
    if (
      value < stats.samples.min - rangeMargin ||
      value > stats.samples.max + rangeMargin
    ) {
      alerts.push({
        path,
        kind: "RANGE_EXCEEDED",
        severity: "LOW",
        baseline: parseFloat(mean.toFixed(4)),
        current: value,
        changePercent: parseFloat(changePercent.toFixed(1)),
        description: `${path}: value ${value} outside historical range [${stats.samples.min.toFixed(2)}, ${stats.samples.max.toFixed(2)}]`,
      });
    }
  }

  return {
    endpoint,
    alerts,
    hasAlerts: alerts.length > 0,
  };
}
