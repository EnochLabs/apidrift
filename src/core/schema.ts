/**
 * Schema extraction: turns a real API response into a lightweight "shape"
 * We store the shape, not the data — privacy-safe and tiny.
 */

export type SchemaType =
  | "string"
  | "number"
  | "boolean"
  | "null"
  | "array"
  | "object"
  | "unknown";

export interface SchemaNode {
  type: SchemaType;
  optional?: boolean;
  children?: Record<string, SchemaNode>; // for objects
  items?: SchemaNode; // for arrays
  nullable?: boolean;
}

export type Schema = Record<string, SchemaNode>;

/**
 * Extract a schema "shape" from a JSON value.
 * This is recursive and handles nested objects/arrays.
 */
export function extractSchema(value: unknown): SchemaNode {
  if (value === null) return { type: "null" };
  if (value === undefined) return { type: "unknown" };

  const t = typeof value;

  if (t === "string") return { type: "string" };
  if (t === "number") return { type: "number" };
  if (t === "boolean") return { type: "boolean" };

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return { type: "array", items: { type: "unknown" } };
    }
    // Sample first few items to infer array item schema
    const samples = value.slice(0, 3);
    const itemSchemas = samples.map(extractSchema);
    const merged = mergeSchemas(itemSchemas);
    return { type: "array", items: merged };
  }

  if (t === "object") {
    const obj = value as Record<string, unknown>;
    const children: Record<string, SchemaNode> = {};
    for (const key of Object.keys(obj)) {
      children[key] = extractSchema(obj[key]);
    }
    return { type: "object", children };
  }

  return { type: "unknown" };
}

/**
 * Merge multiple SchemaNodes into one (used for array items)
 */
function mergeSchemas(schemas: SchemaNode[]): SchemaNode {
  if (schemas.length === 0) return { type: "unknown" };
  if (schemas.length === 1) return schemas[0];

  const types = new Set(schemas.map((s) => s.type));

  // If all same type, use that
  if (types.size === 1) {
    const type = schemas[0].type;
    if (type === "object") {
      // Merge children across all schemas
      const allKeys = new Set(
        schemas.flatMap((s) => Object.keys(s.children ?? {}))
      );
      const children: Record<string, SchemaNode> = {};
      for (const key of allKeys) {
        const childSchemas = schemas
          .filter((s) => s.children?.[key])
          .map((s) => s.children![key]);
        const merged = mergeSchemas(childSchemas);
        // Mark as optional if not all schemas have this key
        if (childSchemas.length < schemas.length) merged.optional = true;
        children[key] = merged;
      }
      return { type: "object", children };
    }
    return schemas[0];
  }

  // Mixed types — mark as nullable if null is one of them
  const nonNull = schemas.filter((s) => s.type !== "null");
  if (nonNull.length === 1) {
    return { ...nonNull[0], nullable: true };
  }

  // Truly mixed — return first dominant type
  return { ...schemas[0], nullable: types.has("null") };
}

/**
 * Extract top-level schema from a parsed JSON body
 */
export function extractTopLevelSchema(body: unknown): Schema {
  const node = extractSchema(body);
  if (node.type === "object" && node.children) {
    return node.children;
  }
  // Wrap non-object responses
  return { _root: node };
}
