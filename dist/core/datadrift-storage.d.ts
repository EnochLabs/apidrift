import { FieldStats } from "./datadrift.js";
export interface DataDriftStore {
    version: string;
    fields: Record<string, Record<string, FieldStats>>;
}
export declare function loadDataDriftStore(): DataDriftStore;
/**
 * Update baseline stats for an endpoint with a new response body.
 * Returns the current field stats for drift comparison.
 */
export declare function updateDataBaseline(endpoint: string, body: unknown): Record<string, FieldStats>;
export declare function getDataBaseline(endpoint: string): Record<string, FieldStats>;
//# sourceMappingURL=datadrift-storage.d.ts.map