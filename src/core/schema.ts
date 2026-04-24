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
  // Smart Inference
  enum?: string[];
  pattern?: string;
  _samples?: string[]; // Internal use for enum inference
  _seenCount?: number; // Internal use for enum inference
}

export type Schema = Record<string, SchemaNode>;

const PATTERNS = {
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  isoDate: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  url: /^https?:\/\/[^\s/$.?#].[^\s]*$/i,
};

/**
 * Extract a schema "shape" from a JSON value.
 *
 * This is recursive and handles nested objects/arrays. A `seen` WeakSet is
 * threaded through every recursive call to detect circular references and
 * return `{ type: "unknown" }` instead of throwing a RangeError.
 */
export function extractSchema(value: unknown, seen: WeakSet<object> = new WeakSet()): SchemaNode {
  if (value === null) return { type: "null" };
  if (value === undefined) return { type: "unknown" };

  const t = typeof value;
  if (t === "string") {
    const strValue = value as string;
    const node: SchemaNode = { type: "string" };
    // Pattern detection
    for (const [name, regex] of Object.entries(PATTERNS)) {
      if (regex.test(strValue)) {
        node.pattern = name;
        break;
      }
    }
    // Track samples for enum inference
    node._samples = [strValue];
    node._seenCount = 1;
    return node;
  }
  if (t === "number")  return { type: "number" };
  if (t === "boolean") return { type: "boolean" };

  if (Array.isArray(value)) {
    // Guard against circular arrays
    if (seen.has(value)) return { type: "array", items: { type: "unknown" } };
    seen.add(value);

    if (value.length === 0) {
      return { type: "array", items: { type: "unknown" } };
    }
    // Sample first few items to infer array item schema
    const samples = value.slice(0, 5); // Increased sample size for better enum detection
    const itemSchemas = samples.map((item) => extractSchema(item, seen));
    const merged = mergeSchemas(itemSchemas);

    // Enum detection for strings in arrays
    if (merged.type === "string" && value.length >= 3) {
      const strings = value.filter(v => typeof v === "string") as string[];
      const unique = Array.from(new Set(strings));
      // If we have many items but few unique values, it's likely an enum
      if (unique.length > 0 && unique.length <= 5 && unique.length < value.length / 2) {
        merged.enum = unique.sort();
      }
    }

    return { type: "array", items: merged };
  }

  if (t === "object") {
    const obj = value as Record<string, unknown>;

    // Guard against circular objects
    if (seen.has(obj)) return { type: "unknown" };
    seen.add(obj);

    const children: Record<string, SchemaNode> = {};
    for (const key of Object.keys(obj)) {
      children[key] = extractSchema(obj[key], seen);
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
    
    // Merge patterns and enums if they are consistent
    const merged: SchemaNode = { type: schemas[0].type };
    const patterns = new Set(schemas.map(s => s.pattern).filter(Boolean));
    if (patterns.size === 1) merged.pattern = Array.from(patterns)[0] as string;
    
    const enums = schemas.map(s => s.enum).filter(Boolean);
    if (enums.length === schemas.length) {
      const allValues = new Set(enums.flatMap(e => e!));
      merged.enum = Array.from(allValues).sort();
    }

    return merged;
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
 * Merge metadata like _samples from existing node into new node
 */
export function mergeMetadata(newNode: SchemaNode, oldNode?: SchemaNode): void {
  if (!oldNode) return;

  // Merge samples
  if (newNode.type === "string" && oldNode.type === "string") {
    newNode._seenCount = (oldNode._seenCount ?? 0) + 1;
    const combined = [...(oldNode._samples ?? []), ...(newNode._samples ?? [])];
    // Keep last 10 unique samples
    newNode._samples = Array.from(new Set(combined)).slice(-10);

    // Promote to enum if threshold met
    // Criteria: at least 5 samples seen, and no more than 3 unique values
    if (newNode._seenCount >= 5) {
      const unique = newNode._samples;
      if (unique.length <= 3) {
        newNode.enum = unique.sort();
      } else {
        delete newNode.enum;
      }
    }
  }

  // Recurse into objects
  if (newNode.type === "object" && oldNode.type === "object" && newNode.children && oldNode.children) {
    for (const key of Object.keys(newNode.children)) {
      mergeMetadata(newNode.children[key], oldNode.children[key]);
    }
  }

  // Recurse into arrays
  if (newNode.type === "array" && oldNode.type === "array" && newNode.items && oldNode.items) {
    mergeMetadata(newNode.items, oldNode.items);
  }
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
