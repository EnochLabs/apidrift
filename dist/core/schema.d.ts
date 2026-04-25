/**
 * Schema extraction: turns a real API response into a lightweight "shape"
 * We store the shape, not the data — privacy-safe and tiny.
 */
export type SchemaType = "string" | "number" | "boolean" | "null" | "array" | "object" | "unknown";
export interface SchemaNode {
    type: SchemaType;
    optional?: boolean;
    children?: Record<string, SchemaNode>;
    items?: SchemaNode;
    nullable?: boolean;
    sensitive?: boolean;
    enum?: string[];
    pattern?: string;
    _samples?: string[];
    _seenCount?: number;
}
export type Schema = Record<string, SchemaNode>;
/**
 * Extract a schema "shape" from a JSON value.
 *
 * This is recursive and handles nested objects/arrays. A `seen` WeakSet is
 * threaded through every recursive call to detect circular references and
 * return `{ type: "unknown" }` instead of throwing a RangeError.
 */
export declare function extractSchema(value: unknown, seen?: WeakSet<object>): SchemaNode;
/**
 * Merge metadata like _samples from existing node into new node
 */
export declare function mergeMetadata(newNode: SchemaNode, oldNode?: SchemaNode): void;
/**
 * Extract top-level schema from a parsed JSON body
 */
export declare function extractTopLevelSchema(body: unknown): Schema;
//# sourceMappingURL=schema.d.ts.map