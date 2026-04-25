import { Schema } from "./schema.js";
export interface Snapshot {
    endpoint: string;
    schema: Schema;
    capturedAt: string;
    responseCount: number;
    avgLatency?: number;
    latencyHistory?: number[];
}
export interface SnapshotStore {
    version: string;
    snapshots: Record<string, Snapshot>;
}
export declare function loadStore(): SnapshotStore;
export declare function saveStore(store: SnapshotStore): void;
export declare function getSnapshot(endpoint: string): Snapshot | null;
export declare function saveSnapshot(endpoint: string, schema: Schema, latency?: number): Snapshot;
export declare function clearSnapshot(endpoint: string): void;
export declare function clearAllSnapshots(): void;
export declare function listSnapshots(): Snapshot[];
export declare function getStoreDirPath(): string;
//# sourceMappingURL=storage.d.ts.map