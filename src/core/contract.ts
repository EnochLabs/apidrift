import * as fs from "fs";
import * as path from "path";
import { Schema, SchemaNode } from "./schema.js";
import { DriftChange } from "./diff.js";

export interface ContractField {
  type: string;
  optional?: boolean;
  nullable?: boolean;
}

export type Contract = Record<string, ContractField | string>;

export interface ContractViolation {
  field: string;
  expected: string;
  actual: string;
  description: string;
}

export interface ContractResult {
  endpoint: string;
  passed: boolean;
  violations: ContractViolation[];
}

const CONTRACT_FILE = "apidrift.contract.json";

function getContractPath(): string {
  let dir = process.cwd();
  for (let i = 0; i < 5; i++) {
    const candidate = path.join(dir, CONTRACT_FILE);
    if (fs.existsSync(candidate)) return candidate;
    if (fs.existsSync(path.join(dir, "package.json"))) {
      return candidate; // default location
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.join(process.cwd(), CONTRACT_FILE);
}

export interface ContractStore {
  version: string;
  contracts: Record<string, Contract>;
}

export function loadContracts(): ContractStore {
  const p = getContractPath();
  if (!fs.existsSync(p)) return { version: "1.0", contracts: {} };
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8")) as ContractStore;
  } catch {
    return { version: "1.0", contracts: {} };
  }
}

export function saveContracts(store: ContractStore): void {
  const p = getContractPath();
  fs.writeFileSync(p, JSON.stringify(store, null, 2), "utf-8");
}

/**
 * Save current snapshot schema as a contract for an endpoint
 */
export function lockContract(endpoint: string, schema: Schema): void {
  const store = loadContracts();
  const contract: Contract = {};

  for (const [key, node] of Object.entries(schema)) {
    contract[key] = schemaNodeToContract(node);
  }

  store.contracts[endpoint] = contract;
  saveContracts(store);
}

function schemaNodeToContract(node: SchemaNode): ContractField {
  const field: ContractField = { type: node.type };
  if (node.optional) field.optional = true;
  if (node.nullable) field.nullable = true;
  return field;
}

function getExpectedType(field: ContractField | string): string {
  if (typeof field === "string") return field;
  let t = field.type;
  if (field.nullable) t += " | null";
  if (field.optional) t += "?";
  return t;
}

/**
 * Validate a schema against a contract
 */
export function enforceContract(
  endpoint: string,
  schema: Schema
): ContractResult {
  const store = loadContracts();
  const contract = store.contracts[endpoint];

  if (!contract) {
    return { endpoint, passed: true, violations: [] };
  }

  const violations: ContractViolation[] = [];

  // Check all contract fields exist in schema
  for (const [field, expected] of Object.entries(contract)) {
    const actual = schema[field];
    const expectedType = getExpectedType(expected);

    if (!actual) {
      const isOptional =
        typeof expected === "object" && expected.optional;
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

    const actualType =
      actual.type + (actual.nullable ? " | null" : "");
    const contractType =
      typeof expected === "string"
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

export function hasContract(endpoint: string): boolean {
  const store = loadContracts();
  return !!store.contracts[endpoint];
}

export function getContract(endpoint: string): Contract | null {
  const store = loadContracts();
  return store.contracts[endpoint] ?? null;
}
