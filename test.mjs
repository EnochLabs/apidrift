/**
 * apidrift test suite
 * Run: node test.mjs
 * Zero external dependencies.
 */
import { createRequire } from "module";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const require = createRequire(import.meta.url);

// ── Isolated temp directory so tests never touch real project snapshots ──────
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "apidrift-test-"));
process.chdir(TMP);
// Write a package.json so storage locates its root correctly
fs.writeFileSync(path.join(TMP, "package.json"), '{"name":"test"}', "utf-8");

// ── Lazy module loader (re-require after chdir) ──────────────────────────────
const DIST = "/home/claude/apidrift/dist";
const m = (mod) => require(`${DIST}/${mod}`);

// ── Test harness ─────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
let section = "";

function describe(label) {
  section = label;
  console.log(`\n── ${label} ${"─".repeat(Math.max(0, 50 - label.length))}`);
}

function assert(condition, label) {
  if (condition) {
    console.log(`  ✔  ${label}`);
    passed++;
  } else {
    console.error(`  ✖  FAIL: ${label}  [${section}]`);
    failed++;
  }
}

function assertThrows(fn, label) {
  try {
    fn();
    console.error(`  ✖  FAIL (no throw): ${label}`);
    failed++;
  } catch {
    console.log(`  ✔  ${label}`);
    passed++;
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("Schema extraction — primitives");
const { extractTopLevelSchema: ext } = m("core/schema.js");

const s1 = ext({ id: 1, name: "Alice", active: true, score: null });
assert(s1.id?.type     === "number",  "number field");
assert(s1.name?.type   === "string",  "string field");
assert(s1.active?.type === "boolean", "boolean field");
assert(s1.score?.type  === "null",    "null field");

describe("Schema extraction — nested structures");
const s2 = ext({ users: [{ id: 1, name: "A" }] });
assert(s2.users?.type         === "array",  "array field");
assert(s2.users?.items?.type  === "object", "array items typed as object");
assert(s2.users?.items?.children?.id?.type === "number", "nested array item field");

const s3 = ext({ address: { city: "NYC", zip: "10001" } });
assert(s3.address?.type                    === "object", "nested object");
assert(s3.address?.children?.city?.type    === "string", "nested string");

const s4 = ext([1, 2, 3]);
assert(s4._root?.type === "array", "non-object root wrapped as _root");

const s5 = ext({});
assert(Object.keys(s5).length === 0, "empty object produces empty schema");

describe("Schema extraction — edge cases");
const s6 = ext({ mixed: [1, "two", true] });
assert(s6.mixed?.type === "array", "mixed array still typed as array");

const s7 = ext({ deep: { a: { b: { c: "leaf" } } } });
assert(s7.deep?.children?.a?.children?.b?.children?.c?.type === "string", "deeply nested field");

describe("Diff engine — breaking changes");
const { diffSchemas } = m("core/diff.js");

const old1 = ext({ name: "Alice", age: 30 });
const new1 = ext({ full_name: "Alice", age: "30" });
const r1 = diffSchemas("/api/user", old1, new1);

assert(r1.hasChanges,  "detects changes");
assert(r1.hasBreaking, "marks as breaking");
assert(r1.changes.some(c => c.kind === "FIELD_REMOVED" && c.path === "name"),      "field removal");
assert(r1.changes.some(c => c.kind === "FIELD_ADDED"   && c.path === "full_name"), "field addition");
assert(r1.changes.some(c => c.kind === "TYPE_CHANGED"  && c.path === "age"),       "type change");
assert(r1.changes.find(c => c.kind === "FIELD_REMOVED")?.from === "string",        "from type preserved");
assert(r1.changes.find(c => c.kind === "TYPE_CHANGED")?.to   === "string",         "to type preserved");

describe("Diff engine — non-breaking changes");
const r2 = diffSchemas("/api/user", ext({ id: 1 }), ext({ id: 1, email: "a@b.com" }));
assert(r2.hasChanges,   "new field detected");
assert(!r2.hasBreaking, "field addition is non-breaking");
assert(r2.changes[0].impact === "NON_BREAKING", "impact is NON_BREAKING");

describe("Diff engine — no changes");
const r3 = diffSchemas("/api/user", ext({ id: 1, name: "Alice" }), ext({ id: 2, name: "Bob" }));
assert(!r3.hasChanges, "same schema structure → no changes (values ignored)");

describe("Diff engine — nested object changes");
const rn = diffSchemas("/api",
  ext({ user: { name: "A", role: "admin" } }),
  ext({ user: { name: "A", permissions: ["read"] } })
);
assert(rn.hasBreaking, "nested field removal is breaking");
assert(rn.changes.some(c => c.path === "user.role"),        "nested removal path correct");
assert(rn.changes.some(c => c.path === "user.permissions"), "nested addition path correct");

describe("Impact classification");
const impacts = r1.changes.reduce((acc, c) => { acc[c.kind] = c.impact; return acc; }, {});
assert(impacts["FIELD_REMOVED"] === "BREAKING",     "FIELD_REMOVED → BREAKING");
assert(impacts["TYPE_CHANGED"]  === "BREAKING",     "TYPE_CHANGED → BREAKING");
assert(impacts["FIELD_ADDED"]   === "NON_BREAKING", "FIELD_ADDED → NON_BREAKING");

describe("compare() API — no snapshots");
const { compare } = m("index.js");
const cr = compare("/api/orders",
  { id: 1, total: 99.9, status: "paid" },
  { id: 1, total: 99.9, state: "paid" }
);
assert(cr.hasBreaking,      "compare() detects breaking rename");
assert(cr.changes.length === 2, "rename = 1 remove + 1 add");

describe("Snapshot storage");
const { saveSnapshot, getSnapshot, listSnapshots, clearAllSnapshots } = m("core/storage.js");
clearAllSnapshots();

saveSnapshot("https://api.example.com/users", ext({ id: 1, name: "Alice" }));
const snap = getSnapshot("https://api.example.com/users");
assert(snap !== null,                          "snapshot saved and retrieved");
assert(snap.endpoint === "https://api.example.com/users", "endpoint stored correctly");
assert(snap.schema.id?.type === "number",      "schema stored correctly");

const list = listSnapshots();
assert(list.length === 1, "listSnapshots returns one entry");

saveSnapshot("https://api.example.com/posts", ext({ id: 1, title: "Hi" }));
assert(listSnapshots().length === 2, "second snapshot added");

clearAllSnapshots();
assert(listSnapshots().length === 0, "clearAllSnapshots wipes store");

describe("Type generation");
const { generateTypesFromSnapshots } = m("utils/typegen.js");

saveSnapshot("https://api.example.com/users", ext({ id: 1, name: "Alice", email: "a@b.com" }));
saveSnapshot("https://api.example.com/posts", ext({ id: 1, title: "Hello", published: true }));
const types = generateTypesFromSnapshots(listSnapshots());

assert(types.includes("export interface"),                  "generates TypeScript interfaces");
assert(types.includes(": number"),                          "number type present");
assert(types.includes(": string"),                          "string type present");
assert(types.includes(": boolean"),                         "boolean type present");
assert(types.includes("Generated by apidrift"),             "header comment present");
assert((types.match(/export interface/g) || []).length >= 2, "one interface per endpoint");

describe("Contract enforcement");
const { lockContract, enforceContract, hasContract } = m("core/contract.js");

lockContract("https://api.example.com/users", ext({ id: 1, name: "Alice" }));
assert(hasContract("https://api.example.com/users"), "contract saved");

const pass = enforceContract("https://api.example.com/users", ext({ id: 2, name: "Bob" }));
assert(pass.passed,                  "same schema passes contract");
assert(pass.violations.length === 0, "no violations when schema matches");

const fail1 = enforceContract("https://api.example.com/users", ext({ id: 1, username: "Bob" }));
assert(!fail1.passed,                                    "missing required field fails");
assert(fail1.violations.some(v => v.field === "name"),   "violation identifies missing field");

const fail2 = enforceContract("https://api.example.com/users", ext({ id: "one", name: "Bob" }));
assert(!fail2.passed,                                  "type mismatch fails contract");
assert(fail2.violations.some(v => v.field === "id"),   "violation identifies type-changed field");

const noContract = enforceContract("https://api.example.com/unknown", ext({ x: 1 }));
assert(noContract.passed, "endpoint with no contract always passes");

describe("History timeline");
const { appendHistory, getHistory, clearHistory } = m("core/history.js");
const { schemaChecksum } = m("core/history.js");

const EP = "https://api.example.com/timeline";
clearHistory(EP);

const schema_v1 = ext({ id: 1 });
const schema_v2 = ext({ id: 1, name: "Alice" });
appendHistory(EP, schema_v1, [], 1);
appendHistory(EP, schema_v2, [{ path: "name", kind: "FIELD_ADDED", impact: "NON_BREAKING", description: "added" }], 2);

const hist = getHistory(EP);
assert(hist !== null,              "history retrieved");
assert(hist.entries.length === 2,  "two versions stored");
assert(hist.entries[0].changes.length === 0, "v1 has no changes");
assert(hist.entries[1].changes.length === 1, "v2 records its change");

// Deduplication: same schema must not create a new entry
appendHistory(EP, schema_v2, [], 3);
assert(getHistory(EP).entries.length === 2, "duplicate schema not re-stored");

// Checksum is stable
const cs1 = schemaChecksum(schema_v1);
const cs2 = schemaChecksum(schema_v1);
assert(cs1 === cs2, "checksum is deterministic");
assert(cs1 !== schemaChecksum(schema_v2), "different schemas have different checksums");

describe("Data drift — numeric extraction");
const { extractNumericPaths } = m("core/datadrift.js");

const nums = extractNumericPaths({ density: 1200, meta: { ratio: 0.85 }, label: "hi" });
assert(nums["density"]     === 1200, "top-level number");
assert(nums["meta.ratio"]  === 0.85, "nested number");
assert(!("label" in nums),           "strings not extracted");

const arr = extractNumericPaths({ values: [10, 20, 30] });
assert("values[].mean" in arr, "array mean extracted");
assert("values[].min"  in arr, "array min extracted");
assert(arr["values[].count"] === 3, "array count correct");

describe("Data drift — spike detection");
const { detectDataDrift, createSample, updateSample } = m("core/datadrift.js");

// Build a stable baseline manually
let sample = createSample(1000);
for (let i = 1; i < 20; i++) {
  sample = updateSample(sample, 1000 + (Math.random() * 40 - 20)); // ±20 noise
}
const baseline = { density: { path: "density", samples: sample, lastValue: 1000 } };

const noAlert = detectDataDrift("/api", { density: 1005 }, baseline);
assert(!noAlert.hasAlerts, "value within baseline range → no alert");

const spike = detectDataDrift("/api", { density: 9999 }, baseline);
assert(spike.hasAlerts,                                          "large spike detected");
assert(spike.alerts[0].kind === "SPIKE" || spike.alerts[0].kind === "MEAN_SHIFT", "correct kind");
assert(spike.alerts[0].severity === "HIGH",                      "spike severity is HIGH");
assert(spike.alerts[0].changePercent > 100,                      "change percent > 100%");

const drop = detectDataDrift("/api", { density: 1 }, baseline);
assert(drop.hasAlerts,           "large drop detected");
assert(drop.alerts[0].kind === "DROP" || drop.alerts[0].kind === "MEAN_SHIFT", "correct drop kind");

describe("Data drift — baseline accumulation");
const { updateDataBaseline, getDataBaseline } = m("core/datadrift-storage.js");

const EP2 = "https://api.ml/predict";
for (let i = 0; i < 8; i++) {
  updateDataBaseline(EP2, { score: 0.85 + (Math.random() * 0.02 - 0.01) });
}
const bl = getDataBaseline(EP2);
assert(bl["score"]?.samples.count === 8,           "8 samples accumulated");
assert(Math.abs(bl["score"].samples.mean - 0.85) < 0.05, "mean near 0.85");
assert(bl["score"].samples.min <= bl["score"].samples.mean, "min ≤ mean");
assert(bl["score"].samples.max >= bl["score"].samples.mean, "max ≥ mean");

describe("normalizeEndpoint");
const { normalizeEndpoint } = m("core/tracker.js");

assert(normalizeEndpoint("https://api.example.com/users?page=2") === "https://api.example.com/users", "strips query params");
assert(normalizeEndpoint("https://api.example.com/users/")       === "https://api.example.com/users", "strips trailing slash");
assert(normalizeEndpoint("/api/users")                            === "/api/users",                    "relative URL unchanged");
assert(normalizeEndpoint("https://api.example.com/users")        === "https://api.example.com/users", "clean URL unchanged");

// ── Summary ──────────────────────────────────────────────────────────────────
console.log("\n" + "─".repeat(52));
if (failed === 0) {
  console.log(`\n  ✔  All ${passed} tests passed.\n`);
} else {
  console.error(`\n  ${passed} passed  /  ${failed} FAILED\n`);
}

// Cleanup
fs.rmSync(TMP, { recursive: true, force: true });

process.exit(failed > 0 ? 1 : 0);
