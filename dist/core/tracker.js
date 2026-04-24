"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeEndpoint = normalizeEndpoint;
exports.track = track;
exports.compare = compare;
const schema_js_1 = require("./schema.js");
const diff_js_1 = require("./diff.js");
const storage_js_1 = require("./storage.js");
const reporter_js_1 = require("./reporter.js");
const history_js_1 = require("./history.js");
const contract_js_1 = require("./contract.js");
const datadrift_js_1 = require("./datadrift.js");
const datadrift_storage_js_1 = require("./datadrift-storage.js");
const datadrift_js_2 = require("./datadrift.js");
/**
 * Normalize a URL to a stable snapshot key.
 * Strips query params, trailing slashes, and common auth tokens.
 */
function normalizeEndpoint(url) {
    try {
        const parsed = new URL(url);
        return (parsed.origin + parsed.pathname).replace(/\/$/, "");
    }
    catch {
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
function track(url, body, options = {}) {
    const endpoint = options.endpointKey ?? normalizeEndpoint(url);
    const newSchema = (0, schema_js_1.extractTopLevelSchema)(body);
    const existing = (0, storage_js_1.getSnapshot)(endpoint);
    // Merge metadata from existing schema to enable smart inference across calls
    if (existing) {
        for (const key of Object.keys(newSchema)) {
            if (existing.schema[key]) {
                (0, schema_js_1.mergeMetadata)(newSchema[key], existing.schema[key]);
            }
        }
        // Also handle root if non-object
        if (newSchema._root && existing.schema._root) {
            (0, schema_js_1.mergeMetadata)(newSchema._root, existing.schema._root);
        }
    }
    // ── First time seeing this endpoint ──────────────────────────────────────
    if (!existing) {
        (0, storage_js_1.saveSnapshot)(endpoint, newSchema);
        (0, history_js_1.appendHistory)(endpoint, newSchema, [], 1);
        // Seed data drift baseline even on first sight
        if (options.dataDrift !== false) {
            (0, datadrift_storage_js_1.updateDataBaseline)(endpoint, body);
        }
        if (!options.silent)
            (0, reporter_js_1.reportFirstSeen)(endpoint);
        return null;
    }
    // ── Schema diff ───────────────────────────────────────────────────────────
    const result = (0, diff_js_1.diffSchemas)(endpoint, existing.schema, newSchema);
    if (result.hasChanges) {
        (0, storage_js_1.saveSnapshot)(endpoint, newSchema);
        (0, history_js_1.appendHistory)(endpoint, newSchema, result.changes, existing.responseCount + 1);
        if (!options.silent)
            (0, reporter_js_1.reportDrift)(result);
        options.onDrift?.(result);
        if (result.hasBreaking)
            options.onBreaking?.(result);
    }
    else {
        // No schema change — still update response count
        (0, storage_js_1.saveSnapshot)(endpoint, newSchema);
        if (!options.silent)
            (0, reporter_js_1.reportNoDrift)(endpoint);
    }
    // ── Contract enforcement ──────────────────────────────────────────────────
    if ((0, contract_js_1.hasContract)(endpoint)) {
        const contractResult = (0, contract_js_1.enforceContract)(endpoint, newSchema);
        if (!contractResult.passed && !options.silent) {
            const c = {
                reset: "\x1b[0m", bold: "\x1b[1m", red: "\x1b[31m",
                yellow: "\x1b[33m", gray: "\x1b[90m", cyan: "\x1b[36m",
            };
            console.log(`\n${c.bold}${c.red}🔒 Contract Violated${c.reset}  ${c.gray}${endpoint}${c.reset}`);
            for (const v of contractResult.violations) {
                console.log(`   ${c.red}✖${c.reset}  ${c.gray}${v.description}${c.reset}`);
            }
            console.log("");
        }
    }
    // ── Data drift detection ──────────────────────────────────────────────────
    if (options.dataDrift !== false) {
        const baselineBefore = (0, datadrift_storage_js_1.getDataBaseline)(endpoint);
        const currentNums = (0, datadrift_js_2.extractNumericPaths)(body);
        if (Object.keys(baselineBefore).length > 0 && Object.keys(currentNums).length > 0) {
            const dataDriftResult = (0, datadrift_js_1.detectDataDrift)(endpoint, currentNums, baselineBefore);
            if (dataDriftResult.hasAlerts && !options.silent) {
                const c = {
                    reset: "\x1b[0m", bold: "\x1b[1m", yellow: "\x1b[33m",
                    red: "\x1b[31m", cyan: "\x1b[36m", gray: "\x1b[90m",
                };
                console.log(`\n${c.bold}${c.yellow}📊 Data Drift Detected${c.reset}  ${c.gray}${endpoint}${c.reset}`);
                for (const alert of dataDriftResult.alerts) {
                    const icon = alert.severity === "HIGH" ? c.red + "●" : c.yellow + "◐";
                    const pct = alert.changePercent > 0 ? `+${alert.changePercent}%` : `${alert.changePercent}%`;
                    console.log(`   ${icon}${c.reset}  ${c.gray}${alert.description}  ${c.cyan}(${pct})${c.reset}`);
                }
                console.log("");
            }
        }
        // Always update baseline with new values
        (0, datadrift_storage_js_1.updateDataBaseline)(endpoint, body);
    }
    return result.hasChanges ? result : null;
}
/**
 * Manually compare two JSON bodies without touching the snapshot store.
 * Useful for scripted comparisons and testing.
 */
function compare(endpoint, oldBody, newBody) {
    const oldSchema = (0, schema_js_1.extractTopLevelSchema)(oldBody);
    const newSchema = (0, schema_js_1.extractTopLevelSchema)(newBody);
    return (0, diff_js_1.diffSchemas)(endpoint, oldSchema, newSchema);
}
//# sourceMappingURL=tracker.js.map