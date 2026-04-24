import { DriftResult } from "./diff.js";
export declare function reportDrift(result: DriftResult): void;
export declare function reportFirstSeen(endpoint: string): void;
export declare function reportNoDrift(endpoint: string): void;
/**
 * Exit-code reporter: for CI/CD use.
 * Returns 1 if any breaking changes exist.
 */
export declare function ciReport(results: DriftResult[]): number;
//# sourceMappingURL=reporter.d.ts.map