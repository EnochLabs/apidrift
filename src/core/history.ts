import * as fs from "fs";
import * as path from "path";
import { Schema } from "./schema.js";
import { DriftChange } from "./diff.js";

export interface HistoryEntry {
  timestamp: string;
  schema: Schema;
  changes: DriftChange[]; // empty for first entry
  responseCount: number;
  checksum: string; // quick equality check
}

export interface EndpointHistory {
  endpoint: string;
  entries: HistoryEntry[];
}

export interface HistoryStore {
  version: string;
  history: Record<string, EndpointHistory>;
}

const HISTORY_VERSION = "1.0";
const MAX_HISTORY_ENTRIES = 50; // per endpoint

function getHistoryPath(): string {
  let dir = process.cwd();
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(dir, "package.json"))) {
      return path.join(dir, ".apidrift", "history.json");
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.join(process.cwd(), ".apidrift", "history.json");
}

function ensureDir(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/**
 * Fast schema checksum — used to skip history writes when schema hasn't changed
 */
export function schemaChecksum(schema: Schema): string {
  const sorted = JSON.stringify(schema, Object.keys(schema).sort());
  let hash = 0;
  for (let i = 0; i < sorted.length; i++) {
    const chr = sorted.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0;
  }
  return (hash >>> 0).toString(16);
}

function loadHistoryStore(): HistoryStore {
  const p = getHistoryPath();
  if (!fs.existsSync(p)) return { version: HISTORY_VERSION, history: {} };
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8")) as HistoryStore;
  } catch {
    return { version: HISTORY_VERSION, history: {} };
  }
}

function saveHistoryStore(store: HistoryStore): void {
  const p = getHistoryPath();
  ensureDir(p);
  const tempPath = p + ".tmp";
  fs.writeFileSync(tempPath, JSON.stringify(store, null, 2), "utf-8");
  fs.renameSync(tempPath, p);
}

/**
 * Append a history entry for an endpoint.
 * Deduplicates by checksum — only writes when schema actually changed.
 */
export function appendHistory(
  endpoint: string,
  schema: Schema,
  changes: DriftChange[],
  responseCount: number
): void {
  const store = loadHistoryStore();
  if (!store.history[endpoint]) {
    store.history[endpoint] = { endpoint, entries: [] };
  }

  const hist = store.history[endpoint];
  const checksum = schemaChecksum(schema);

  // Don't duplicate if schema unchanged
  const last = hist.entries[hist.entries.length - 1];
  if (last && last.checksum === checksum) return;

  const entry: HistoryEntry = {
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

export function getHistory(endpoint: string): EndpointHistory | null {
  const store = loadHistoryStore();
  return store.history[endpoint] ?? null;
}

export function getAllHistory(): HistoryStore {
  return loadHistoryStore();
}

export function clearHistory(endpoint?: string): void {
  const store = loadHistoryStore();
  if (endpoint) {
    delete store.history[endpoint];
  } else {
    store.history = {};
  }
  saveHistoryStore(store);
}
