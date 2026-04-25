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
assert(s1.id?.type === "number", "number field");
assert(s1.name?.type === "string", "string field");
assert(s1.active?.type === "boolean", "boolean field");
assert(s1.score?.type === "null", "null field");

// ── NEW FEATURES TESTS ───────────────────────────────────────────────────────

describe("Diffing — enums and patterns");
const { diffSchemas } = m("core/diff.js");

const oldSchema = {
  status: { type: "string", enum: ["active", "inactive"] },
  id: { type: "string", pattern: "uuid" },
};

const newSchema = {
  status: { type: "string", enum: ["active", "inactive", "pending"] },
  id: { type: "string", pattern: "email" },
};

const diff = diffSchemas("test", oldSchema, newSchema);

assert(diff.hasChanges === true, "detects changes");
assert(
  diff.changes.some((c) => c.kind === "ENUM_CHANGED"),
  "detects ENUM_CHANGED"
);
assert(
  diff.changes.some((c) => c.kind === "PATTERN_CHANGED"),
  "detects PATTERN_CHANGED"
);
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

describe("Deep Contracts");
const { lockContract, enforceContract } = m("core/contract.js");
const deepSchema = {
  user: {
    type: "object",
    children: {
      id: { type: "number" },
      profile: {
        type: "object",
        children: {
          bio: { type: "string" },
        },
      },
    },
  },
};
lockContract("https://api.test.com/deep", deepSchema);

const validDeep = {
  user: { id: 1, profile: { bio: "hello" } },
};
const { extractTopLevelSchema } = m("core/schema.js");
const res1 = enforceContract("https://api.test.com/deep", extractTopLevelSchema(validDeep));
assert(res1.passed === true, "validates deep nested objects");

const invalidDeep = {
  user: { id: 1, profile: { bio: 123 } },
};
const res2 = enforceContract("https://api.test.com/deep", extractTopLevelSchema(invalidDeep));
assert(res2.passed === false, "fails on deep type mismatch");
assert(
  res2.violations.some((v) => v.field === "user.profile.bio"),
  "correctly identifies deep field path"
);

describe("Enhanced Type Generation");
const { generateInterface } = m("utils/typegen.js");
const enumSchema = {
  status: { type: "string", enum: ["open", "closed"] },
  meta: {
    type: "object",
    children: {
      tags: { type: "array", items: { type: "string" } },
    },
  },
};
const typeOutput = generateInterface("TestResponse", enumSchema);
assert(typeOutput.includes('status: "open" | "closed"'), "generates union for enums");
assert(typeOutput.includes("tags: string[]"), "generates correct array types");
assert(typeOutput.includes("meta: {"), "generates nested objects with braces");

describe("Pro Features — Patterns and Latency");
const { extractSchema } = m("core/schema.js");

const patternsBody = {
  ip: "192.168.1.1",
  color: "#ff0000",
  phone: "+1234567890",
  password: "secret_password",
};
const ps = extractSchema(patternsBody);
assert(ps.children.ip.pattern === "ipv4", "detects ipv4 pattern");
assert(ps.children.color.pattern === "hexColor", "detects hexColor pattern");
assert(ps.children.phone.pattern === "phone", "detects phone pattern");
assert(ps.children.password.sensitive === true, "detects sensitive field");

const { saveSnapshot } = m("core/storage.js");
const latSchema = { test: { type: "number" } };
saveSnapshot("https://api.latency.test", latSchema, 100);
saveSnapshot("https://api.latency.test", latSchema, 200);
const latSnap = getSnapshot("https://api.latency.test");
assert(latSnap.avgLatency === 150, "tracks average latency");
assert(latSnap.latencyHistory.length === 2, "tracks latency history");

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
