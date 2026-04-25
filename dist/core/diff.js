/**
 * Classify impact of a change
 */
function classifyImpact(kind) {
    switch (kind) {
        case "FIELD_REMOVED":
        case "TYPE_CHANGED":
        case "ARRAY_ITEM_TYPE_CHANGED":
        case "ENUM_CHANGED":
            return "BREAKING";
        case "FIELD_ADDED":
        case "PATTERN_CHANGED":
            return "NON_BREAKING";
        case "NULLABLE_CHANGED":
        case "OPTIONAL_CHANGED":
            return "INFO";
    }
}
/**
 * Format a SchemaNode type for display
 */
function formatType(node) {
    let base = node.type;
    if (node.type === "array" && node.items) {
        base = `${node.items.type}[]`;
    }
    if (node.nullable)
        base = `${base} | null`;
    if (node.optional)
        base = `${base}?`;
    return base;
}
/**
 * Determine whether a SchemaNode represents a "structural" type (object or array)
 * vs a "primitive" type (string, number, boolean, null, unknown).
 * Switching between these categories is always a breaking change.
 */
function isStructural(node) {
    return node.type === "object" || node.type === "array";
}
/**
 * Recursively diff two schema nodes at a given path.
 * The `depth` parameter guards against runaway recursion on pathological input.
 */
function diffNodes(path, oldNode, newNode, changes, depth = 0) {
    // Hard guard: never recurse beyond 50 levels — prevents stack overflow on
    // adversarially deep schemas while still covering any realistic API shape.
    if (depth > 50)
        return;
    // Field removed
    if (oldNode && !newNode) {
        const kind = "FIELD_REMOVED";
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
        const kind = "FIELD_ADDED";
        changes.push({
            path,
            kind,
            impact: classifyImpact(kind),
            to: formatType(newNode),
            description: `Field \`${path}\` was added (${formatType(newNode)})`,
        });
        return;
    }
    if (!oldNode || !newNode)
        return;
    // Top-level type changed
    if (oldNode.type !== newNode.type) {
        const kind = "TYPE_CHANGED";
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
        const kind = "NULLABLE_CHANGED";
        changes.push({
            path,
            kind,
            impact: classifyImpact(kind),
            from: oldNode.nullable ? "nullable" : "non-nullable",
            to: newNode.nullable ? "nullable" : "non-nullable",
            description: `Field \`${path}\` nullable status changed`,
        });
    }
    // Pattern changed
    if (oldNode.pattern !== newNode.pattern) {
        const kind = "PATTERN_CHANGED";
        changes.push({
            path,
            kind,
            impact: classifyImpact(kind),
            from: oldNode.pattern ?? "none",
            to: newNode.pattern ?? "none",
            description: `Field \`${path}\` pattern changed: ${oldNode.pattern ?? "none"} → ${newNode.pattern ?? "none"}`,
        });
    }
    // Enum changed
    if (JSON.stringify(oldNode.enum) !== JSON.stringify(newNode.enum)) {
        const kind = "ENUM_CHANGED";
        changes.push({
            path,
            kind,
            impact: classifyImpact(kind),
            from: oldNode.enum ? `enum(${oldNode.enum.join(",")})` : "none",
            to: newNode.enum ? `enum(${newNode.enum.join(",")})` : "none",
            description: `Field \`${path}\` enum values changed`,
        });
    }
    // Recurse into objects
    if (oldNode.type === "object" && newNode.type === "object") {
        const oldChildren = oldNode.children ?? {};
        const newChildren = newNode.children ?? {};
        const allKeys = new Set([...Object.keys(oldChildren), ...Object.keys(newChildren)]);
        for (const key of allKeys) {
            diffNodes(path ? `${path}.${key}` : key, oldChildren[key], newChildren[key], changes, depth + 1);
        }
        return;
    }
    // Recurse into arrays — with explicit structural-switch detection
    if (oldNode.type === "array" && newNode.type === "array" && oldNode.items && newNode.items) {
        const oldItems = oldNode.items;
        const newItems = newNode.items;
        // Detect the critical case: array switches between object items and
        // primitive items (or vice versa). This is a breaking change that the
        // previous implementation missed because it only checked the top-level
        // type string — but "object" vs "string" would have been caught anyway.
        // The real gap was object ↔ primitive or array ↔ primitive transitions
        // where the item type string differs but the structural category changes.
        if (isStructural(oldItems) !== isStructural(newItems)) {
            const kind = "ARRAY_ITEM_TYPE_CHANGED";
            const fromType = formatType(oldItems);
            const toType = formatType(newItems);
            changes.push({
                path: `${path}[]`,
                kind,
                impact: classifyImpact(kind),
                from: fromType,
                to: toType,
                description: `Array \`${path}\` item type changed from ${fromType} to ${toType} (structural change)`,
            });
            return; // Don't recurse further — the whole item shape changed
        }
        // If both are the same structural category, recurse normally
        diffNodes(`${path}[]`, oldItems, newItems, changes, depth + 1);
    }
}
/**
 * Compare two schemas and return a DriftResult
 */
export function diffSchemas(endpoint, oldSchema, newSchema) {
    const changes = [];
    const allKeys = new Set([...Object.keys(oldSchema), ...Object.keys(newSchema)]);
    for (const key of allKeys) {
        diffNodes(key, oldSchema[key], newSchema[key], changes, 0);
    }
    return {
        endpoint,
        timestamp: new Date().toISOString(),
        hasChanges: changes.length > 0,
        hasBreaking: changes.some((c) => c.impact === "BREAKING"),
        changes,
    };
}
//# sourceMappingURL=diff.js.map