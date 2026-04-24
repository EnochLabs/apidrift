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
exports.schemaChecksum = schemaChecksum;
exports.appendHistory = appendHistory;
exports.getHistory = getHistory;
exports.getAllHistory = getAllHistory;
exports.clearHistory = clearHistory;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const HISTORY_VERSION = "1.0";
const MAX_HISTORY_ENTRIES = 50; // per endpoint
function getHistoryPath() {
    let dir = process.cwd();
    for (let i = 0; i < 5; i++) {
        if (fs.existsSync(path.join(dir, "package.json"))) {
            return path.join(dir, ".apidrift", "history.json");
        }
        const parent = path.dirname(dir);
        if (parent === dir)
            break;
        dir = parent;
    }
    return path.join(process.cwd(), ".apidrift", "history.json");
}
function ensureDir(filePath) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir))
        fs.mkdirSync(dir, { recursive: true });
}
/**
 * Fast schema checksum — used to skip history writes when schema hasn't changed
 */
function schemaChecksum(schema) {
    const sorted = JSON.stringify(schema, Object.keys(schema).sort());
    let hash = 0;
    for (let i = 0; i < sorted.length; i++) {
        const chr = sorted.charCodeAt(i);
        hash = (hash << 5) - hash + chr;
        hash |= 0;
    }
    return (hash >>> 0).toString(16);
}
function loadHistoryStore() {
    const p = getHistoryPath();
    if (!fs.existsSync(p))
        return { version: HISTORY_VERSION, history: {} };
    try {
        return JSON.parse(fs.readFileSync(p, "utf-8"));
    }
    catch {
        return { version: HISTORY_VERSION, history: {} };
    }
}
function saveHistoryStore(store) {
    const p = getHistoryPath();
    ensureDir(p);
    fs.writeFileSync(p, JSON.stringify(store, null, 2), "utf-8");
}
/**
 * Append a history entry for an endpoint.
 * Deduplicates by checksum — only writes when schema actually changed.
 */
function appendHistory(endpoint, schema, changes, responseCount) {
    const store = loadHistoryStore();
    if (!store.history[endpoint]) {
        store.history[endpoint] = { endpoint, entries: [] };
    }
    const hist = store.history[endpoint];
    const checksum = schemaChecksum(schema);
    // Don't duplicate if schema unchanged
    const last = hist.entries[hist.entries.length - 1];
    if (last && last.checksum === checksum)
        return;
    const entry = {
        timestamp: new Date().toISOString(),
        schema,
        changes,
        responseCount,
        checksum,
    };
    hist.entries.push(entry);
    // Trim to max entries (keep oldest + newest)
    if (hist.entries.length > MAX_HISTORY_ENTRIES) {
        const keep = MAX_HISTORY_ENTRIES;
        hist.entries = [hist.entries[0], ...hist.entries.slice(-keep + 1)];
    }
    saveHistoryStore(store);
}
function getHistory(endpoint) {
    const store = loadHistoryStore();
    return store.history[endpoint] ?? null;
}
function getAllHistory() {
    return loadHistoryStore();
}
function clearHistory(endpoint) {
    const store = loadHistoryStore();
    if (endpoint) {
        delete store.history[endpoint];
    }
    else {
        store.history = {};
    }
    saveHistoryStore(store);
}
//# sourceMappingURL=history.js.map