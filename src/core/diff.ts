import { Schema, SchemaNode } from "./schema.js";

export type ChangeKind =
  | "FIELD_REMOVED"
  | "FIELD_ADDED"
  | "TYPE_CHANGED"
  | "NULLABLE_CHANGED"
  | "OPTIONAL_CHANGED";

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
 * Classify impact of a change
 */
function classifyImpact(kind: ChangeKind): ChangeImpact {
  switch (kind) {
    case "FIELD_REMOVED":
    case "TYPE_CHANGED":
      return "BREAKING";
    case "FIELD_ADDED":
      return "NON_BREAKING";
    case "NULLABLE_CHANGED":
    case "OPTIONAL_CHANGED":
      return "INFO";
  }
}

/**
 * Format a SchemaNode type for display
 */
function formatType(node: SchemaNode): string {
  let base: string = node.type;
  if (node.type === "array" && node.items) {
    base = `${node.items.type}[]`;
  }
  if (node.nullable) base = `${base} | null`;
  if (node.optional) base = `${base}?`;
  return base;
}

/**
 * Recursively diff two schema nodes at a given path
 */
function diffNodes(
  path: string,
  oldNode: SchemaNode | undefined,
  newNode: SchemaNode | undefined,
  changes: DriftChange[]
): void {
  // Field removed
  if (oldNode && !newNode) {
    const kind: ChangeKind = "FIELD_REMOVED";
    changes.push({
      path,
      kind,
      impact: classifyImpact(kind),
      from: formatType(oldNode),
      description: `Field \`${path}\` was removed (was ${formatType(oldNode)})`,
    });
    return;
  }

  // Field added
  if (!oldNode && newNode) {
    const kind: ChangeKind = "FIELD_ADDED";
    changes.push({
      path,
      kind,
      impact: classifyImpact(kind),
      to: formatType(newNode),
      description: `Field \`${path}\` was added (${formatType(newNode)})`,
    });
    return;
  }

  if (!oldNode || !newNode) return;

  // Type changed
  if (oldNode.type !== newNode.type) {
    const kind: ChangeKind = "TYPE_CHANGED";
    changes.push({
      path,
      kind,
      impact: classifyImpact(kind),
      from: formatType(oldNode),
      to: formatType(newNode),
      description: `Field \`${path}\` changed type: ${formatType(oldNode)} → ${formatType(newNode)}`,
    });
    return; // Don't recurse if type changed fundamentally
  }

  // Nullable changed
  if (!!oldNode.nullable !== !!newNode.nullable) {
    const kind: ChangeKind = "NULLABLE_CHANGED";
    changes.push({
      path,
      kind,
      impact: classifyImpact(kind),
      from: oldNode.nullable ? "nullable" : "non-nullable",
      to: newNode.nullable ? "nullable" : "non-nullable",
      description: `Field \`${path}\` nullable status changed`,
    });
  }

  // Recurse into objects
  if (oldNode.type === "object" && newNode.type === "object") {
    const oldChildren = oldNode.children ?? {};
    const newChildren = newNode.children ?? {};
    const allKeys = new Set([
      ...Object.keys(oldChildren),
      ...Object.keys(newChildren),
    ]);
    for (const key of allKeys) {
      diffNodes(
        path ? `${path}.${key}` : key,
        oldChildren[key],
        newChildren[key],
        changes
      );
    }
    return;
  }

  // Recurse into arrays
  if (
    oldNode.type === "array" &&
    newNode.type === "array" &&
    oldNode.items &&
    newNode.items
  ) {
    diffNodes(`${path}[]`, oldNode.items, newNode.items, changes);
  }
}

/**
 * Compare two schemas and return a DriftResult
 */
export function diffSchemas(
  endpoint: string,
  oldSchema: Schema,
  newSchema: Schema
): DriftResult {
  const changes: DriftChange[] = [];

  const allKeys = new Set([
    ...Object.keys(oldSchema),
    ...Object.keys(newSchema),
  ]);

  for (const key of allKeys) {
    diffNodes(key, oldSchema[key], newSchema[key], changes);
  }

  return {
    endpoint,
    timestamp: new Date().toISOString(),
    hasChanges: changes.length > 0,
    hasBreaking: changes.some((c) => c.impact === "BREAKING"),
    changes,
  };
}
