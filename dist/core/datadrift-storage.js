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
exports.loadDataDriftStore = loadDataDriftStore;
exports.updateDataBaseline = updateDataBaseline;
exports.getDataBaseline = getDataBaseline;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const datadrift_js_1 = require("./datadrift.js");
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
function loadDataDriftStore() {
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
function updateDataBaseline(endpoint, body) {
    const store = loadDataDriftStore();
    if (!store.fields[endpoint])
        store.fields[endpoint] = {};
    const numericPaths = (0, datadrift_js_1.extractNumericPaths)(body);
    for (const [path, value] of Object.entries(numericPaths)) {
        const existing = store.fields[endpoint][path];
        if (!existing) {
            store.fields[endpoint][path] = {
                path,
                samples: (0, datadrift_js_1.createSample)(value),
                lastValue: value,
            };
        }
        else {
            store.fields[endpoint][path] = {
                path,
                samples: (0, datadrift_js_1.updateSample)(existing.samples, value),
                lastValue: value,
            };
        }
    }
    saveDataDriftStore(store);
    return store.fields[endpoint];
}
function getDataBaseline(endpoint) {
    const store = loadDataDriftStore();
    return store.fields[endpoint] ?? {};
}
//# sourceMappingURL=datadrift-storage.js.map