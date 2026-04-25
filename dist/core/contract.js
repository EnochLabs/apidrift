import * as fs from "fs";
import * as path from "path";
import { formatType } from "./diff.js";
const CONTRACT_FILE = "apidrift.contract.json";
function getContractPath() {
    let dir = process.cwd();
    for (let i = 0; i < 5; i++) {
        const candidate = path.join(dir, CONTRACT_FILE);
        if (fs.existsSync(candidate))
            return candidate;
        if (fs.existsSync(path.join(dir, "package.json"))) {
            return candidate; // default location
        }
        const parent = path.dirname(dir);
        if (parent === dir)
            break;
        dir = parent;
    }
    return path.join(process.cwd(), CONTRACT_FILE);
}
export function loadContracts() {
    const p = getContractPath();
    if (!fs.existsSync(p))
        return { version: "1.0", contracts: {} };
    try {
        return JSON.parse(fs.readFileSync(p, "utf-8"));
    }
    catch {
        return { version: "1.0", contracts: {} };
    }
}
export function saveContracts(store) {
    const p = getContractPath();
    const tempPath = p + ".tmp";
    fs.writeFileSync(tempPath, JSON.stringify(store, null, 2), "utf-8");
    fs.renameSync(tempPath, p);
}
/**
 * Save current snapshot schema as a contract for an endpoint
 */
export function lockContract(endpoint, schema) {
    const store = loadContracts();
    const contract = {};
    for (const [key, node] of Object.entries(schema)) {
        contract[key] = schemaNodeToContract(node);
    }
    store.contracts[endpoint] = contract;
    saveContracts(store);
}
/**
 * Remove contract for an endpoint
 */
export function unlockContract(endpoint) {
    const store = loadContracts();
    delete store.contracts[endpoint];
    saveContracts(store);
}
function schemaNodeToContract(node) {
    const field = { type: node.type };
    if (node.optional)
        field.optional = true;
    if (node.nullable)
        field.nullable = true;
    if (node.enum)
        field.enum = node.enum;
    if (node.pattern)
        field.pattern = node.pattern;
    if (node.children) {
        field.children = {};
        for (const [key, child] of Object.entries(node.children)) {
            field.children[key] = schemaNodeToContract(child);
        }
    }
    if (node.items) {
        field.items = schemaNodeToContract(node.items);
    }
    return field;
}
function getExpectedType(field) {
    let t = field.type;
    if (field.type === "array" && field.items) {
        t = `${getExpectedType(field.items)}[]`;
    }
    if (field.nullable)
        t += " | null";
    if (field.optional)
        t += "?";
    return t;
}
function validateNode(path, actual, expected, violations) {
    const expectedTypeDisplay = getExpectedType(expected);
    if (!actual) {
        if (!expected.optional) {
            violations.push({
                field: path,
                expected: expectedTypeDisplay,
                actual: "missing",
                description: `Required field \`${path}\` is missing from API response`,
            });
        }
        return;
    }
    const actualType = actual.type + (actual.nullable ? " | null" : "");
    const expectedType = expected.type + (expected.nullable ? " | null" : "");
    if (actualType !== expectedType && expected.type !== "unknown") {
        violations.push({
            field: path,
            expected: expectedType,
            actual: actualType,
            description: `Field \`${path}\` type mismatch: expected ${expectedType}, got ${actualType}`,
        });
        return;
    }
    // Enum check
    if (expected.enum && JSON.stringify(expected.enum) !== JSON.stringify(actual.enum)) {
        violations.push({
            field: path,
            expected: `enum(${expected.enum.join(",")})`,
            actual: actual.enum ? `enum(${actual.enum.join(",")})` : "none",
            description: `Field \`${path}\` enum mismatch`,
        });
    }
    // Pattern check
    if (expected.pattern && expected.pattern !== actual.pattern) {
        violations.push({
            field: path,
            expected: `pattern:${expected.pattern}`,
            actual: actual.pattern || "none",
            description: `Field \`${path}\` pattern mismatch`,
        });
    }
    // Deep check objects
    if (expected.type === "object" && expected.children) {
        const actualChildren = actual.children || {};
        for (const [key, expectedChild] of Object.entries(expected.children)) {
            validateNode(path ? `${path}.${key}` : key, actualChildren[key], expectedChild, violations);
        }
        // Check for unexpected fields
        for (const key of Object.keys(actualChildren)) {
            if (!(key in expected.children)) {
                violations.push({
                    field: path ? `${path}.${key}` : key,
                    expected: "field not in contract",
                    actual: formatType(actualChildren[key]),
                    description: `Unexpected field \`${path ? `${path}.${key}` : key}\` found in schema`,
                });
            }
        }
    }
    // Deep check arrays
    if (expected.type === "array" && expected.items && actual.items) {
        validateNode(`${path}[]`, actual.items, expected.items, violations);
    }
}
/**
 * Validate a schema against a contract
 */
export function enforceContract(endpoint, schema) {
    const store = loadContracts();
    const contract = store.contracts[endpoint];
    if (!contract) {
        return { endpoint, passed: true, violations: [] };
    }
    const violations = [];
    for (const [field, expected] of Object.entries(contract)) {
        validateNode(field, schema[field], expected, violations);
    }
    return {
        endpoint,
        passed: violations.length === 0,
        violations,
    };
}
export function hasContract(endpoint) {
    const store = loadContracts();
    return !!store.contracts[endpoint];
}
export function getContract(endpoint) {
    const store = loadContracts();
    return store.contracts[endpoint] ?? null;
}
//# sourceMappingURL=contract.js.map