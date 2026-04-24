import { Schema } from "./schema.js";
import { DriftChange } from "./diff.js";
export interface HistoryEntry {
    timestamp: string;
    schema: Schema;
    changes: DriftChange[];
    responseCount: number;
    checksum: string;
}
export interface EndpointHistory {
    endpoint: string;
    entries: HistoryEntry[];
}
export interface HistoryStore {
    version: string;
    history: Record<string, EndpointHistory>;
}
/**
 * Fast schema checksum — used to skip history writes when schema hasn't changed
 */
export declare function schemaChecksum(schema: Schema): string;
/**
 * Append a history entry for an endpoint.
 * Deduplicates by checksum — only writes when schema actually changed.
 */
export declare function appendHistory(endpoint: string, schema: Schema, changes: DriftChange[], responseCount: number): void;
export declare function getHistory(endpoint: string): EndpointHistory | null;
export declare function getAllHistory(): HistoryStore;
export declare function clearHistory(endpoint?: string): void;
//# sourceMappingURL=history.d.ts.map