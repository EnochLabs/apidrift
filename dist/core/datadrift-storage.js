import * as fs from "fs";
import * as path from "path";
import { createSample, updateSample, extractNumericPaths, } from "./datadrift.js";
function getDataDriftPath() {
    let dir = process.cwd();
    for (let i = 0; i < 5; i++) {
        if (fs.existsSync(path.join(dir, "package.json"))) {
            return path.join(dir, ".apidrift", "datadrift.json");
        }
        const parent = path.dirname(dir);
        if (parent === dir)
            break;
        dir = parent;
    }
    return path.join(process.cwd(), ".apidrift", "datadrift.json");
}
function ensureDir(p) {
    const dir = path.dirname(p);
    if (!fs.existsSync(dir))
        fs.mkdirSync(dir, { recursive: true });
}
export function loadDataDriftStore() {
    const p = getDataDriftPath();
    if (!fs.existsSync(p))
        return { version: "1.0", fields: {} };
    try {
        return JSON.parse(fs.readFileSync(p, "utf-8"));
    }
    catch {
        return { version: "1.0", fields: {} };
    }
}
function saveDataDriftStore(store) {
    const p = getDataDriftPath();
    ensureDir(p);
    fs.writeFileSync(p, JSON.stringify(store, null, 2), "utf-8");
}
/**
 * Update baseline stats for an endpoint with a new response body.
 * Returns the current field stats for drift comparison.
 */
export function updateDataBaseline(endpoint, body) {
    const store = loadDataDriftStore();
    if (!store.fields[endpoint])
        store.fields[endpoint] = {};
    const numericPaths = extractNumericPaths(body);
    for (const [path, value] of Object.entries(numericPaths)) {
        const existing = store.fields[endpoint][path];
        if (!existing) {
            store.fields[endpoint][path] = {
                path,
                samples: createSample(value),
                lastValue: value,
            };
        }
        else {
            store.fields[endpoint][path] = {
                path,
                samples: updateSample(existing.samples, value),
                lastValue: value,
            };
        }
    }
    saveDataDriftStore(store);
    return store.fields[endpoint];
}
export function getDataBaseline(endpoint) {
    const store = loadDataDriftStore();
    return store.fields[endpoint] ?? {};
}
//# sourceMappingURL=datadrift-storage.js.map