import { Schema } from "./schema.js";
export type ChangeKind = "FIELD_REMOVED" | "FIELD_ADDED" | "TYPE_CHANGED" | "NULLABLE_CHANGED" | "OPTIONAL_CHANGED";
export type ChangeImpact = "BREAKING" | "NON_BREAKING" | "INFO";
export interface DriftChange {
    path: string;
    kind: ChangeKind;
    impact: ChangeImpact;
    from?: string;
    to?: string;
    description: string;
}
export interface DriftResult {
    endpoint: string;
    timestamp: string;
    hasChanges: boolean;
    hasBreaking: boolean;
    changes: DriftChange[];
}
/**
 * Compare two schemas and return a DriftResult
 */
export declare function diffSchemas(endpoint: string, oldSchema: Schema, newSchema: Schema): DriftResult;
//# sourceMappingURL=diff.d.ts.map