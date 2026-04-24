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
exports.loadStore = loadStore;
exports.saveStore = saveStore;
exports.getSnapshot = getSnapshot;
exports.saveSnapshot = saveSnapshot;
exports.clearSnapshot = clearSnapshot;
exports.clearAllSnapshots = clearAllSnapshots;
exports.listSnapshots = listSnapshots;
exports.getStoreDirPath = getStoreDirPath;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const STORE_DIR = ".apidrift";
const STORE_FILE = "snapshots.json";
const STORE_VERSION = "1.0";
function getStorePath() {
    // Walk up to find project root (where package.json is), or use cwd
    let dir = process.cwd();
    for (let i = 0; i < 5; i++) {
        if (fs.existsSync(path.join(dir, "package.json"))) {
            return path.join(dir, STORE_DIR, STORE_FILE);
        }
        const parent = path.dirname(dir);
        if (parent === dir)
            break;
        dir = parent;
    }
    return path.join(process.cwd(), STORE_DIR, STORE_FILE);
}
function ensureDir(filePath) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}
function loadStore() {
    const storePath = getStorePath();
    if (!fs.existsSync(storePath)) {
        return { version: STORE_VERSION, snapshots: {} };
    }
    try {
        const raw = fs.readFileSync(storePath, "utf-8");
        return JSON.parse(raw);
    }
    catch {
        return { version: STORE_VERSION, snapshots: {} };
    }
}
function saveStore(store) {
    const storePath = getStorePath();
    ensureDir(storePath);
    fs.writeFileSync(storePath, JSON.stringify(store, null, 2), "utf-8");
}
function getSnapshot(endpoint) {
    const store = loadStore();
    return store.snapshots[endpoint] ?? null;
}
function saveSnapshot(endpoint, schema) {
    const store = loadStore();
    const existing = store.snapshots[endpoint];
    const snapshot = {
        endpoint,
        schema,
        capturedAt: new Date().toISOString(),
        responseCount: (existing?.responseCount ?? 0) + 1,
    };
    store.snapshots[endpoint] = snapshot;
    saveStore(store);
    return snapshot;
}
function clearSnapshot(endpoint) {
    const store = loadStore();
    delete store.snapshots[endpoint];
    saveStore(store);
}
function clearAllSnapshots() {
    saveStore({ version: STORE_VERSION, snapshots: {} });
}
function listSnapshots() {
    const store = loadStore();
    return Object.values(store.snapshots);
}
function getStoreDirPath() {
    return path.dirname(getStorePath());
}
//# sourceMappingURL=storage.js.map