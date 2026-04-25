import { extractTopLevelSchema, mergeMetadata, SchemaNode } from "./schema.js";
import { diffSchemas, DriftResult } from "./diff.js";
import { getSnapshot, saveSnapshot } from "./storage.js";
import { reportDrift, reportFirstSeen, reportNoDrift } from "./reporter.js";
import { appendHistory } from "./history.js";
import { enforceContract, hasContract } from "./contract.js";
import { detectDataDrift } from "./datadrift.js";
import { updateDataBaseline, getDataBaseline } from "./datadrift-storage.js";
import { extractNumericPaths } from "./datadrift.js";

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
export function normalizeEndpoint(url: string): string {
  try {
    const parsed = new URL(url);
    return (parsed.origin + parsed.pathname).replace(/\/$/, "");
  } catch {
    return url.split("?")[0].replace(/\/$/, "");
  }
}

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
export function track(
  url: string,
  body: unknown,
  options: TrackOptions = {},
  latency?: number
): DriftResult | null {
  const endpoint = options.endpointKey ?? normalizeEndpoint(url);
  const newSchema = extractTopLevelSchema(body);
  const existing = getSnapshot(endpoint);

  // Merge metadata from existing schema to enable smart inference across calls
  if (existing) {
    for (const key of Object.keys(newSchema)) {
      if (existing.schema[key]) {
        mergeMetadata(newSchema[key], existing.schema[key]);
      }
    }
    // Also handle root if non-object
    if (newSchema._root && existing.schema._root) {
      mergeMetadata(newSchema._root, existing.schema._root);
    }
  }

  // ── First time seeing this endpoint ──────────────────────────────────────
  if (!existing) {
    saveSnapshot(endpoint, newSchema, latency);
    appendHistory(endpoint, newSchema, [], 1);

    // Seed data drift baseline even on first sight
    if (options.dataDrift !== false) {
      updateDataBaseline(endpoint, body);
    }

    if (!options.silent) reportFirstSeen(endpoint);
    return null;
  }

  // ── Schema diff ───────────────────────────────────────────────────────────
  const result = diffSchemas(endpoint, existing.schema, newSchema);

  if (result.hasChanges) {
    saveSnapshot(endpoint, newSchema, latency);
    appendHistory(endpoint, newSchema, result.changes, existing.responseCount + 1);

    if (!options.silent) reportDrift(result);

    // Webhook support
    const webhookUrl = process.env.APIDRIFT_WEBHOOK;
    if (webhookUrl && (result.hasBreaking || process.env.APIDRIFT_VERBOSE)) {
      import("https")
        .then((https) => {
          const url = new URL(webhookUrl);
          const payload = JSON.stringify({
            text: `⚠ API Drift Detected: ${endpoint}\n${result.changes.map((c) => `- ${c.description}`).join("\n")}`,
            endpoint,
            changes: result.changes,
          });
          const req = https.request(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Content-Length": payload.length },
          });
          req.write(payload);
          req.end();
        })
        .catch(() => {});
    }

    options.onDrift?.(result);
    if (result.hasBreaking) options.onBreaking?.(result);
  } else {
    // No schema change — still update response count
    saveSnapshot(endpoint, newSchema, latency);
    if (!options.silent) reportNoDrift(endpoint);
  }

  // ── Contract enforcement ──────────────────────────────────────────────────
  if (hasContract(endpoint)) {
    const contractResult = enforceContract(endpoint, newSchema);
    if (!contractResult.passed && !options.silent) {
      const c = {
        reset: "\x1b[0m",
        bold: "\x1b[1m",
        red: "\x1b[31m",
        yellow: "\x1b[33m",
        gray: "\x1b[90m",
        cyan: "\x1b[36m",
      };
      console.log(
        `\n${c.bold}${c.red}🔒 Contract Violated${c.reset}  ${c.gray}${endpoint}${c.reset}`
      );
      for (const v of contractResult.violations) {
        console.log(`   ${c.red}✖${c.reset}  ${c.gray}${v.description}${c.reset}`);
      }
      console.log("");
    }
  }

  // ── Data drift detection ──────────────────────────────────────────────────
  if (options.dataDrift !== false) {
    const baselineBefore = getDataBaseline(endpoint);
    const currentNums = extractNumericPaths(body);

    if (Object.keys(baselineBefore).length > 0 && Object.keys(currentNums).length > 0) {
      const dataDriftResult = detectDataDrift(endpoint, currentNums, baselineBefore);

      if (dataDriftResult.hasAlerts && !options.silent) {
        const c = {
          reset: "\x1b[0m",
          bold: "\x1b[1m",
          yellow: "\x1b[33m",
          red: "\x1b[31m",
          cyan: "\x1b[36m",
          gray: "\x1b[90m",
        };
        console.log(
          `\n${c.bold}${c.yellow}📊 Data Drift Detected${c.reset}  ${c.gray}${endpoint}${c.reset}`
        );
        for (const alert of dataDriftResult.alerts) {
          const icon = alert.severity === "HIGH" ? c.red + "●" : c.yellow + "◐";
          const pct =
            alert.changePercent > 0 ? `+${alert.changePercent}%` : `${alert.changePercent}%`;
          console.log(
            `   ${icon}${c.reset}  ${c.gray}${alert.description}  ${c.cyan}(${pct})${c.reset}`
          );
        }
        console.log("");
      }
    }

    // Always update baseline with new values
    updateDataBaseline(endpoint, body);
  }

  return result.hasChanges ? result : null;
}

/**
 * Manually compare two JSON bodies without touching the snapshot store.
 * Useful for scripted comparisons and testing.
 */
export function compare(endpoint: string, oldBody: unknown, newBody: unknown): DriftResult {
  const oldSchema = extractTopLevelSchema(oldBody);
  const newSchema = extractTopLevelSchema(newBody);
  return diffSchemas(endpoint, oldSchema, newSchema);
}
