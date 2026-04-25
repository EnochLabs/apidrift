import { Schema } from "./schema.js";
export interface ContractField {
    type: string;
    optional?: boolean;
    nullable?: boolean;
    children?: Record<string, ContractField>;
    items?: ContractField;
    enum?: string[];
    pattern?: string;
}
export type Contract = Record<string, ContractField>;
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
export interface ContractStore {
    version: string;
    contracts: Record<string, Contract>;
}
export declare function loadContracts(): ContractStore;
export declare function saveContracts(store: ContractStore): void;
/**
 * Save current snapshot schema as a contract for an endpoint
 */
export declare function lockContract(endpoint: string, schema: Schema): void;
/**
 * Remove contract for an endpoint
 */
export declare function unlockContract(endpoint: string): void;
/**
 * Validate a schema against a contract
 */
export declare function enforceContract(endpoint: string, schema: Schema): ContractResult;
export declare function hasContract(endpoint: string): boolean;
export declare function getContract(endpoint: string): Contract | null;
//# sourceMappingURL=contract.d.ts.map