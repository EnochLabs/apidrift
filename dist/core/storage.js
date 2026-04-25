import * as fs from "fs";
import * as path from "path";
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
export function loadStore() {
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
export function saveStore(store) {
    const storePath = getStorePath();
    ensureDir(storePath);
    const tempPath = storePath + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(store, null, 2), "utf-8");
    fs.renameSync(tempPath, storePath);
}
export function getSnapshot(endpoint) {
    // Normalize endpoint to use forward slashes for cross-platform compatibility
    endpoint = endpoint.replace(/\\/g, '/');
    const store = loadStore();
    return store.snapshots[endpoint] ?? null;
}
export function saveSnapshot(endpoint, schema, latency) {
    // Normalize endpoint to use forward slashes for cross-platform compatibility
    endpoint = endpoint.replace(/\\/g, '/');
    const store = loadStore();
    const existing = store.snapshots[endpoint];
    let avgLatency = existing?.avgLatency;
    const latencyHistory = existing?.latencyHistory ?? [];
    if (latency !== undefined) {
        latencyHistory.push(latency);
        if (latencyHistory.length > 20)
            latencyHistory.shift();
        const sum = latencyHistory.reduce((a, b) => a + b, 0);
        avgLatency = sum / latencyHistory.length;
    }
    const snapshot = {
        endpoint,
        schema,
        capturedAt: new Date().toISOString(),
        responseCount: (existing?.responseCount ?? 0) + 1,
        avgLatency,
        latencyHistory,
    };
    store.snapshots[endpoint] = snapshot;
    saveStore(store);
    return snapshot;
}
export function clearSnapshot(endpoint) {
    const store = loadStore();
    delete store.snapshots[endpoint];
    saveStore(store);
}
export function clearAllSnapshots() {
    saveStore({ version: STORE_VERSION, snapshots: {} });
}
export function listSnapshots() {
    const store = loadStore();
    return Object.values(store.snapshots);
}
export function getStoreDirPath() {
    return path.dirname(getStorePath());
}
//# sourceMappingURL=storage.js.map