/**
 * apidrift — zero-config API drift detection
 *
 * @example
 * // Auto-patch fetch (recommended)
 * import "apidrift/register"
 *
 * // Programmatic usage
 * import { track, compare } from "apidrift"
 * track(url, responseBody)
 */
export { track, compare, normalizeEndpoint } from "./core/tracker.js";
export { diffSchemas } from "./core/diff.js";
export { extractSchema, extractTopLevelSchema } from "./core/schema.js";
export { loadStore, saveSnapshot, getSnapshot, listSnapshots, clearSnapshot, clearAllSnapshots, } from "./core/storage.js";
export { appendHistory, getHistory, getAllHistory, clearHistory, schemaChecksum, } from "./core/history.js";
export { lockContract, enforceContract, hasContract, getContract, loadContracts, saveContracts, } from "./core/contract.js";
export { detectDataDrift, extractNumericPaths } from "./core/datadrift.js";
export { updateDataBaseline, getDataBaseline } from "./core/datadrift-storage.js";
export { reportDrift, ciReport } from "./core/reporter.js";
export { generateInterface, generateTypesFromSnapshots } from "./utils/typegen.js";
export { patchFetch } from "./interceptors/fetch.js";
export { patchAxios } from "./interceptors/axios.js";
export type { TrackOptions } from "./core/tracker.js";
export type { DriftResult, DriftChange, ChangeImpact, ChangeKind } from "./core/diff.js";
export type { SchemaNode, SchemaType, Schema } from "./core/schema.js";
export type { Snapshot, SnapshotStore } from "./core/storage.js";
export type { HistoryEntry, EndpointHistory, HistoryStore } from "./core/history.js";
export type { Contract, ContractField, ContractResult, ContractViolation, } from "./core/contract.js";
export type { DataDriftAlert, DataDriftResult, NumericSample, FieldStats, } from "./core/datadrift.js";
export type { InterceptOptions } from "./interceptors/fetch.js";
//# sourceMappingURL=index.d.ts.map