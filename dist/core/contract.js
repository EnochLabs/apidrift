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
function schemaNodeToContract(node) {
    const field = { type: node.type };
    if (node.optional)
        field.optional = true;
    if (node.nullable)
        field.nullable = true;
    return field;
}
function getExpectedType(field) {
    if (typeof field === "string")
        return field;
    let t = field.type;
    if (field.nullable)
        t += " | null";
    if (field.optional)
        t += "?";
    return t;
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
    // Check all contract fields exist in schema
    for (const [field, expected] of Object.entries(contract)) {
        const actual = schema[field];
        const expectedType = getExpectedType(expected);
        if (!actual) {
            const isOptional = typeof expected === "object" && expected.optional;
            if (!isOptional) {
                violations.push({
                    field,
                    expected: expectedType,
                    actual: "missing",
                    description: `Required field \`${field}\` is missing from API response`,
                });
            }
            continue;
        }
        const actualType = actual.type + (actual.nullable ? " | null" : "");
        const contractType = typeof expected === "string"
            ? expected
            : expected.type + (expected.nullable ? " | null" : "");
        if (actualType !== contractType) {
            violations.push({
                field,
                expected: contractType,
                actual: actualType,
                description: `Field \`${field}\` type mismatch: expected ${contractType}, got ${actualType}`,
            });
        }
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