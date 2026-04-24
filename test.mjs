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

// (🔥 EVERYTHING BELOW REMAINS EXACTLY THE SAME — unchanged)

describe("Schema extraction — primitives");
const { extractTopLevelSchema: ext } = m("core/schema.js");

const s1 = ext({ id: 1, name: "Alice", active: true, score: null });
assert(s1.id?.type     === "number",  "number field");
assert(s1.name?.type   === "string",  "string field");
assert(s1.active?.type === "boolean", "boolean field");
assert(s1.score?.type  === "null",    "null field");

// ... ✅ ALL YOUR REMAINING CODE CONTINUES UNCHANGED ...

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