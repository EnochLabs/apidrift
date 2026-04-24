import { Schema } from "../core/schema.js";
import { Snapshot } from "../core/storage.js";
/**
 * Generate a TypeScript interface from a Schema
 */
export declare function generateInterface(name: string, schema: Schema): string;
/**
 * Generate TypeScript types from all snapshots
 */
export declare function generateTypesFromSnapshots(snapshots: Snapshot[]): string;
//# sourceMappingURL=typegen.d.ts.map