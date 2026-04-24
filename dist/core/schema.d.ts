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
}
export type Schema = Record<string, SchemaNode>;
/**
 * Extract a schema "shape" from a JSON value.
 * This is recursive and handles nested objects/arrays.
 */
export declare function extractSchema(value: unknown): SchemaNode;
/**
 * Extract top-level schema from a parsed JSON body
 */
export declare function extractTopLevelSchema(body: unknown): Schema;
//# sourceMappingURL=schema.d.ts.map