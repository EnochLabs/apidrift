"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadContracts = loadContracts;
exports.saveContracts = saveContracts;
exports.lockContract = lockContract;
exports.unlockContract = unlockContract;
exports.enforceContract = enforceContract;
exports.hasContract = hasContract;
exports.getContract = getContract;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
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
function loadContracts() {
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
function saveContracts(store) {
    const p = getContractPath();
    fs.writeFileSync(p, JSON.stringify(store, null, 2), "utf-8");
}
/**
 * Save current snapshot schema as a contract for an endpoint
 */
function lockContract(endpoint, schema) {
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
function unlockContract(endpoint) {
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
    // Deep check objects
    if (expected.type === "object" && expected.children) {
        const actualChildren = actual.children || {};
        for (const [key, expectedChild] of Object.entries(expected.children)) {
            validateNode(path ? `${path}.${key}` : key, actualChildren[key], expectedChild, violations);
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
function enforceContract(endpoint, schema) {
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
function hasContract(endpoint) {
    const store = loadContracts();
    return !!store.contracts[endpoint];
}
function getContract(endpoint) {
    const store = loadContracts();
    return store.contracts[endpoint] ?? null;
}
//# sourceMappingURL=contract.js.map