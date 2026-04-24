"use strict";
/**
 * apidrift — zero-config API drift detection
 *
 * @example
 * // Auto-patch fetch (recommended)
 * import "apidrift/register"
 *
 * // Programmatic usage
 * import { track, compare } from "apidrift"
 * track(url, responseBody)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.patchAxios = exports.patchFetch = exports.generateTypesFromSnapshots = exports.generateInterface = exports.ciReport = exports.reportDrift = exports.getDataBaseline = exports.updateDataBaseline = exports.extractNumericPaths = exports.detectDataDrift = exports.saveContracts = exports.loadContracts = exports.getContract = exports.hasContract = exports.enforceContract = exports.lockContract = exports.schemaChecksum = exports.clearHistory = exports.getAllHistory = exports.getHistory = exports.appendHistory = exports.clearAllSnapshots = exports.clearSnapshot = exports.listSnapshots = exports.getSnapshot = exports.saveSnapshot = exports.loadStore = exports.extractTopLevelSchema = exports.extractSchema = exports.diffSchemas = exports.normalizeEndpoint = exports.compare = exports.track = void 0;
// Core
var tracker_js_1 = require("./core/tracker.js");
Object.defineProperty(exports, "track", { enumerable: true, get: function () { return tracker_js_1.track; } });
Object.defineProperty(exports, "compare", { enumerable: true, get: function () { return tracker_js_1.compare; } });
Object.defineProperty(exports, "normalizeEndpoint", { enumerable: true, get: function () { return tracker_js_1.normalizeEndpoint; } });
var diff_js_1 = require("./core/diff.js");
Object.defineProperty(exports, "diffSchemas", { enumerable: true, get: function () { return diff_js_1.diffSchemas; } });
var schema_js_1 = require("./core/schema.js");
Object.defineProperty(exports, "extractSchema", { enumerable: true, get: function () { return schema_js_1.extractSchema; } });
Object.defineProperty(exports, "extractTopLevelSchema", { enumerable: true, get: function () { return schema_js_1.extractTopLevelSchema; } });
// Storage
var storage_js_1 = require("./core/storage.js");
Object.defineProperty(exports, "loadStore", { enumerable: true, get: function () { return storage_js_1.loadStore; } });
Object.defineProperty(exports, "saveSnapshot", { enumerable: true, get: function () { return storage_js_1.saveSnapshot; } });
Object.defineProperty(exports, "getSnapshot", { enumerable: true, get: function () { return storage_js_1.getSnapshot; } });
Object.defineProperty(exports, "listSnapshots", { enumerable: true, get: function () { return storage_js_1.listSnapshots; } });
Object.defineProperty(exports, "clearSnapshot", { enumerable: true, get: function () { return storage_js_1.clearSnapshot; } });
Object.defineProperty(exports, "clearAllSnapshots", { enumerable: true, get: function () { return storage_js_1.clearAllSnapshots; } });
// History / timeline
var history_js_1 = require("./core/history.js");
Object.defineProperty(exports, "appendHistory", { enumerable: true, get: function () { return history_js_1.appendHistory; } });
Object.defineProperty(exports, "getHistory", { enumerable: true, get: function () { return history_js_1.getHistory; } });
Object.defineProperty(exports, "getAllHistory", { enumerable: true, get: function () { return history_js_1.getAllHistory; } });
Object.defineProperty(exports, "clearHistory", { enumerable: true, get: function () { return history_js_1.clearHistory; } });
Object.defineProperty(exports, "schemaChecksum", { enumerable: true, get: function () { return history_js_1.schemaChecksum; } });
// Contracts
var contract_js_1 = require("./core/contract.js");
Object.defineProperty(exports, "lockContract", { enumerable: true, get: function () { return contract_js_1.lockContract; } });
Object.defineProperty(exports, "enforceContract", { enumerable: true, get: function () { return contract_js_1.enforceContract; } });
Object.defineProperty(exports, "hasContract", { enumerable: true, get: function () { return contract_js_1.hasContract; } });
Object.defineProperty(exports, "getContract", { enumerable: true, get: function () { return contract_js_1.getContract; } });
Object.defineProperty(exports, "loadContracts", { enumerable: true, get: function () { return contract_js_1.loadContracts; } });
Object.defineProperty(exports, "saveContracts", { enumerable: true, get: function () { return contract_js_1.saveContracts; } });
// Data drift
var datadrift_js_1 = require("./core/datadrift.js");
Object.defineProperty(exports, "detectDataDrift", { enumerable: true, get: function () { return datadrift_js_1.detectDataDrift; } });
Object.defineProperty(exports, "extractNumericPaths", { enumerable: true, get: function () { return datadrift_js_1.extractNumericPaths; } });
var datadrift_storage_js_1 = require("./core/datadrift-storage.js");
Object.defineProperty(exports, "updateDataBaseline", { enumerable: true, get: function () { return datadrift_storage_js_1.updateDataBaseline; } });
Object.defineProperty(exports, "getDataBaseline", { enumerable: true, get: function () { return datadrift_storage_js_1.getDataBaseline; } });
// Reporting
var reporter_js_1 = require("./core/reporter.js");
Object.defineProperty(exports, "reportDrift", { enumerable: true, get: function () { return reporter_js_1.reportDrift; } });
Object.defineProperty(exports, "ciReport", { enumerable: true, get: function () { return reporter_js_1.ciReport; } });
// Type generation
var typegen_js_1 = require("./utils/typegen.js");
Object.defineProperty(exports, "generateInterface", { enumerable: true, get: function () { return typegen_js_1.generateInterface; } });
Object.defineProperty(exports, "generateTypesFromSnapshots", { enumerable: true, get: function () { return typegen_js_1.generateTypesFromSnapshots; } });
// Interceptors
var fetch_js_1 = require("./interceptors/fetch.js");
Object.defineProperty(exports, "patchFetch", { enumerable: true, get: function () { return fetch_js_1.patchFetch; } });
var axios_js_1 = require("./interceptors/axios.js");
Object.defineProperty(exports, "patchAxios", { enumerable: true, get: function () { return axios_js_1.patchAxios; } });
//# sourceMappingURL=index.js.map