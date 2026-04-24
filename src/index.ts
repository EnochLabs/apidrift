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

// Core
export { track, compare, normalizeEndpoint } from "./core/tracker.js";
export { diffSchemas } from "./core/diff.js";
export { extractSchema, extractTopLevelSchema } from "./core/schema.js";

// Storage
export {
  loadStore, saveSnapshot, getSnapshot, listSnapshots,
  clearSnapshot, clearAllSnapshots,
} from "./core/storage.js";

// History / timeline
export { appendHistory, getHistory, getAllHistory, clearHistory, schemaChecksum } from "./core/history.js";

// Contracts
export {
  lockContract, enforceContract, hasContract, getContract,
  loadContracts, saveContracts,
} from "./core/contract.js";

// Data drift
export { detectDataDrift, extractNumericPaths } from "./core/datadrift.js";
export { updateDataBaseline, getDataBaseline } from "./core/datadrift-storage.js";

// Reporting
export { reportDrift, ciReport } from "./core/reporter.js";

// Type generation
export { generateInterface, generateTypesFromSnapshots } from "./utils/typegen.js";

// Interceptors
export { patchFetch } from "./interceptors/fetch.js";
export { patchAxios } from "./interceptors/axios.js";

// Types
export type { TrackOptions } from "./core/tracker.js";
export type { DriftResult, DriftChange, ChangeImpact, ChangeKind } from "./core/diff.js";
export type { SchemaNode, SchemaType, Schema } from "./core/schema.js";
export type { Snapshot, SnapshotStore } from "./core/storage.js";
export type { HistoryEntry, EndpointHistory, HistoryStore } from "./core/history.js";
export type { Contract, ContractField, ContractResult, ContractViolation } from "./core/contract.js";
export type { DataDriftAlert, DataDriftResult, NumericSample, FieldStats } from "./core/datadrift.js";
export type { InterceptOptions } from "./interceptors/fetch.js";
