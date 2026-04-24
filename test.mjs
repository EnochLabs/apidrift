/**
 * apidrift test suite
 * Run: node test.mjs
 * Zero external dependencies.
 */
import { createRequire } from "module";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);

// ── Resolve project dist directory (independent of cwd) ──────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, "dist");

// ── Isolated temp directory so tests never touch real project snapshots ──────
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "apidrift-test-"));
process.chdir(TMP);

// Write a package.json so storage locates its root correctly
fs.writeFileSync(path.join(TMP, "package.json"), '{"name":"test"}', "utf-8");

// ── Lazy module loader (re-require after chdir) ──────────────────────────────
const m = (mod) => require(path.join(DIST, mod));

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

// ── NEW FEATURES TESTS ───────────────────────────────────────────────────────

describe("Diffing — enums and patterns");
const { diffSchemas } = m("core/diff.js");

const oldSchema = {
  status: { type: "string", enum: ["active", "inactive"] },
  id: { type: "string", pattern: "uuid" }
};

const newSchema = {
  status: { type: "string", enum: ["active", "inactive", "pending"] },
  id: { type: "string", pattern: "email" }
};

const diff = diffSchemas("test", oldSchema, newSchema);

assert(diff.hasChanges === true, "detects changes");
assert(diff.changes.some(c => c.kind === "ENUM_CHANGED"), "detects ENUM_CHANGED");
assert(diff.changes.some(c => c.kind === "PATTERN_CHANGED"), "detects PATTERN_CHANGED");
assert(diff.hasBreaking === true, "enum change is breaking");

// ── Smart Enum Inference ─────────────────────────────────────────────────────

describe("Smart Inference — enums across calls");
const { track } = m("core/tracker.js");
const { getSnapshot } = m("core/storage.js");

const url = "https://api.test.com/status";

track(url, { status: "active" }, { silent: true });
track(url, { status: "inactive" }, { silent: true });
track(url, { status: "active" }, { silent: true });
track(url, { status: "inactive" }, { silent: true });
track(url, { status: "active" }, { silent: true });

const snap = getSnapshot(url);

assert(snap !== null, "snapshot exists");
assert(snap.schema.status.enum !== undefined, "infers enum after 5 calls");
assert(snap.schema.status.enum.includes("active"), "enum contains 'active'");
assert(snap.schema.status.enum.includes("inactive"), "enum contains 'inactive'");

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