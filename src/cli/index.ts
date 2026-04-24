#!/usr/bin/env node
/**
 * apidrift CLI
 * The developer's API time machine.
 */
import * as fs from "fs";
import * as path from "path";
import * as https from "https";
// http is only used as a fallback for non-https URLs; alias it
const http = https;

const VERSION = "1.0.0";

// ─── Colors ────────────────────────────────────────────────────────────────
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  italic: "\x1b[3m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  blue: "\x1b[34m",
  gray: "\x1b[90m",
  white: "\x1b[97m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
};

const BANNER = `
  ${c.cyan}${c.bold}▗▖ ▗▖ ▗▄▄▖ ▗▄▄▄▖ ▗▄▄▖▗▄▄▄▖ ▗▄▄▖ ▗▄▄▄▖
  ${c.cyan}▐▌ ▐▌▐▌   ▐▌   ▐▌ ▐▌▐▌   ▐▌ ▐▌  █
  ${c.cyan}▐▛▀▜▌ ▝▀▚▖▐▛▀▀▘▐▛▀▚▖▐▛▀▀▘▐▛▀▚▖  █
  ${c.cyan}▐▌ ▐▌▗▄▄▞▘▐▙▄▄▖▐▌ ▐▌▐▌   ▐▌ ▐▌  █${c.reset}
  ${c.gray}  zero-config API drift detection — v${VERSION}${c.reset}
`;

// ─── Lazy imports ───────────────────────────────────────────────────────────
async function getModules() {
  const { listSnapshots, clearAllSnapshots, clearSnapshot, getSnapshot, saveSnapshot, loadStore } =
    await import("../core/storage.js");
  const { diffSchemas } = await import("../core/diff.js");
  const { reportDrift, ciReport } = await import("../core/reporter.js");
  const { extractTopLevelSchema } = await import("../core/schema.js");
  const { generateTypesFromSnapshots } = await import("../utils/typegen.js");
  const { compare } = await import("../core/tracker.js");
  const { getHistory, getAllHistory } = await import("../core/history.js");
  const { lockContract, loadContracts, getContract, hasContract } = await import("../core/contract.js");
  return {
    listSnapshots, clearAllSnapshots, clearSnapshot, getSnapshot, saveSnapshot, loadStore,
    diffSchemas, reportDrift, ciReport, extractTopLevelSchema, generateTypesFromSnapshots,
    compare, getHistory, getAllHistory, lockContract, loadContracts, getContract, hasContract,
  };
}

// ─── Utils ──────────────────────────────────────────────────────────────────
async function fetchJson(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    const req = client.get(url, { headers: { Accept: "application/json" } }, (res) => {
      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode} from ${url}`));
        return;
      }
      let data = "";
      res.on("data", (chunk: string) => (data += chunk));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error(`Response from ${url} is not valid JSON`)); }
      });
    });
    req.on("error", reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error("Request timed out")); });
  });
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function box(title: string, lines: string[], color = c.cyan): string {
  const width = Math.max(title.length + 4, ...lines.map(l => l.replace(/\x1b\[[0-9;]*m/g, "").length + 4));
  const top = `${color}┌${"─".repeat(width - 2)}┐${c.reset}`;
  const mid = `${color}│${c.reset} ${c.bold}${title}${c.reset}${" ".repeat(width - title.length - 3)}${color}│${c.reset}`;
  const sep = `${color}├${"─".repeat(width - 2)}┤${c.reset}`;
  const rows = lines.map(l => {
    const plain = l.replace(/\x1b\[[0-9;]*m/g, "");
    const pad = width - plain.length - 3;
    return `${color}│${c.reset} ${l}${" ".repeat(Math.max(0, pad))}${color}│${c.reset}`;
  });
  const bot = `${color}└${"─".repeat(width - 2)}┘${c.reset}`;
  return [top, mid, sep, ...rows, bot].join("\n");
}

// ─── Commands ───────────────────────────────────────────────────────────────

async function cmdInit(): Promise<void> {
  const dir = path.join(process.cwd(), ".apidrift");
  const gitignore = path.join(process.cwd(), ".gitignore");

  console.log(BANNER);

  const steps: Array<[string, () => void]> = [
    ["Creating .apidrift/ directory", () => {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }],
    ["Writing .apidrift/.gitkeep", () => {
      fs.writeFileSync(path.join(dir, ".gitkeep"), "", "utf-8");
    }],
    ["Adding .apidrift/ to .gitignore", () => {
      if (fs.existsSync(gitignore)) {
        const content = fs.readFileSync(gitignore, "utf-8");
        if (!content.includes(".apidrift")) {
          fs.appendFileSync(gitignore, "\n# apidrift — local API snapshots\n.apidrift/\n");
        }
      }
    }],
  ];

  for (const [label, fn] of steps) {
    process.stdout.write(`  ${c.dim}${label}...${c.reset} `);
    fn();
    console.log(`${c.green}✔${c.reset}`);
  }

  console.log(`\n  ${c.bold}${c.green}apidrift is ready!${c.reset}\n`);
  console.log(`  ${c.bold}Quick start:${c.reset}\n`);
  console.log(`  ${c.gray}# Auto-track every fetch() call:${c.reset}`);
  console.log(`  ${c.cyan}import "apidrift/register"${c.reset}\n`);
  console.log(`  ${c.gray}# Or track manually:${c.reset}`);
  console.log(`  ${c.cyan}import { track } from "apidrift"${c.reset}`);
  console.log(`  ${c.cyan}track(url, responseBody)${c.reset}\n`);
  console.log(`  ${c.gray}# Watch a live endpoint:${c.reset}`);
  console.log(`  ${c.cyan}apidrift watch https://api.example.com/users${c.reset}\n`);
  console.log(`  ${c.gray}Run ${c.reset}${c.cyan}apidrift --help${c.reset}${c.gray} for all commands.${c.reset}\n`);
}

async function cmdList(): Promise<void> {
  const { listSnapshots, getHistory } = await getModules();
  const snapshots = listSnapshots();

  if (snapshots.length === 0) {
    console.log(`\n  ${c.yellow}No endpoints tracked yet.${c.reset}`);
    console.log(`\n  ${c.gray}Add to your app:${c.reset}  ${c.cyan}import "apidrift/register"${c.reset}`);
    console.log(`  ${c.gray}Or track live:  ${c.reset}  ${c.cyan}apidrift watch <url>${c.reset}\n`);
    return;
  }

  console.log(`\n  ${c.bold}Tracked Endpoints${c.reset}  ${c.gray}(${snapshots.length} total)${c.reset}\n`);

  for (const snap of snapshots) {
    const hist = getHistory(snap.endpoint);
    const versions = hist?.entries.length ?? 1;
    const fieldCount = Object.keys(snap.schema).length;
    const age = relativeTime(snap.capturedAt);
    const driftCount = Math.max(0, versions - 1);

    const driftLabel = driftCount > 0
      ? `${c.yellow}${driftCount} drift${driftCount === 1 ? "" : "s"}${c.reset}`
      : `${c.green}stable${c.reset}`;

    console.log(`  ${c.cyan}${c.bold}${truncate(snap.endpoint, 70)}${c.reset}`);
    console.log(
      `  ${c.gray}  ${fieldCount} fields · seen ${snap.responseCount}x · last ${age} · ${driftLabel}${c.reset}`
    );
    console.log("");
  }
}

async function cmdDiff(url: string, flags: Record<string, boolean>): Promise<void> {
  const { extractTopLevelSchema, diffSchemas, getSnapshot, saveSnapshot, reportDrift } = await getModules();

  if (!url) {
    console.error(`  ${c.red}Error:${c.reset} URL required\n  Usage: ${c.cyan}apidrift diff <url>${c.reset}`);
    process.exit(1);
  }

  process.stdout.write(`  ${c.gray}Fetching ${truncate(url, 60)}...${c.reset} `);
  let body: unknown;
  try {
    body = await fetchJson(url);
    console.log(`${c.green}✔${c.reset}`);
  } catch (err) {
    console.log(`${c.red}✖${c.reset}`);
    console.error(`\n  ${c.red}Error:${c.reset} ${(err as Error).message}\n`);
    process.exit(1);
  }

  const newSchema = extractTopLevelSchema(body);
  const existing = getSnapshot(url);

  if (!existing) {
    saveSnapshot(url, newSchema);
    console.log(`\n  ${c.green}✔${c.reset} First snapshot saved for this endpoint.`);
    console.log(`  ${c.gray}Run again to detect drift.${c.reset}\n`);
    return;
  }

  const result = diffSchemas(url, existing.schema, newSchema);

  if (!result.hasChanges) {
    console.log(`\n  ${c.green}✔ No drift detected.${c.reset}  ${c.gray}Schema unchanged.${c.reset}\n`);
  } else {
    reportDrift(result);
    if (flags["--save"]) {
      saveSnapshot(url, newSchema);
      console.log(`  ${c.gray}Snapshot updated.${c.reset}\n`);
    } else {
      console.log(`  ${c.gray}Tip: use ${c.reset}${c.cyan}--save${c.reset}${c.gray} to update the snapshot.${c.reset}\n`);
    }
  }
}

async function cmdWatch(url: string, flags: Record<string, string>): Promise<void> {
  const { extractTopLevelSchema, diffSchemas, getSnapshot, saveSnapshot, reportDrift } = await getModules();

  if (!url) {
    console.error(`  ${c.red}Error:${c.reset} URL required\n  Usage: ${c.cyan}apidrift watch <url> [--interval 5]${c.reset}`);
    process.exit(1);
  }

  const intervalSec = parseInt(flags["--interval"] ?? "5", 10);
  console.log(`\n  ${c.cyan}${c.bold}Watching${c.reset}  ${url}`);
  console.log(`  ${c.gray}Polling every ${intervalSec}s — Ctrl+C to stop${c.reset}\n`);

  let pollCount = 0;

  async function poll() {
    pollCount++;
    const ts = new Date().toLocaleTimeString();
    process.stdout.write(`  ${c.gray}[${ts}] poll #${pollCount}...${c.reset}\r`);

    let body: unknown;
    try {
      body = await fetchJson(url);
    } catch (err) {
      process.stdout.write(`  ${c.red}[${ts}] fetch failed: ${(err as Error).message}${c.reset}\n`);
      return;
    }

    const newSchema = extractTopLevelSchema(body);
    const existing = getSnapshot(url);

    if (!existing) {
      saveSnapshot(url, newSchema);
      console.log(`  ${c.green}[${ts}]${c.reset} Baseline captured (${Object.keys(newSchema).length} fields)`);
      return;
    }

    const result = diffSchemas(url, existing.schema, newSchema);

    if (result.hasChanges) {
      process.stdout.write("\n");
      reportDrift(result);
      saveSnapshot(url, newSchema);
    } else {
      process.stdout.write(`  ${c.gray}[${ts}] poll #${pollCount} — ${c.green}no drift${c.reset}       \r`);
    }
  }

  await poll();
  const timer = setInterval(poll, intervalSec * 1000);

  process.on("SIGINT", () => {
    clearInterval(timer);
    console.log(`\n\n  ${c.gray}Watch stopped. Run ${c.cyan}apidrift list${c.gray} to see all endpoints.${c.reset}\n`);
    process.exit(0);
  });
}

async function cmdHistory(endpoint: string): Promise<void> {
  const { getHistory, getAllHistory } = await getModules();

  if (!endpoint) {
    // Show summary of all endpoints with history
    const all = getAllHistory();
    const entries = Object.values(all.history);
    if (entries.length === 0) {
      console.log(`\n  ${c.yellow}No history yet.${c.reset}\n`);
      return;
    }
    console.log(`\n  ${c.bold}Drift History${c.reset}  ${c.gray}(${entries.length} endpoints)${c.reset}\n`);
    for (const eh of entries) {
      const versions = eh.entries.length;
      const drifts = Math.max(0, versions - 1);
      const last = eh.entries[eh.entries.length - 1];
      console.log(`  ${c.cyan}${truncate(eh.endpoint, 65)}${c.reset}`);
      console.log(`  ${c.gray}  ${versions} version${versions === 1 ? "" : "s"} · ${drifts} drift event${drifts === 1 ? "" : "s"} · last change ${relativeTime(last.timestamp)}${c.reset}`);
      console.log("");
    }
    return;
  }

  const hist = getHistory(endpoint);
  if (!hist || hist.entries.length === 0) {
    console.log(`\n  ${c.yellow}No history for:${c.reset} ${endpoint}\n`);
    return;
  }

  console.log(`\n  ${c.bold}Timeline:${c.reset} ${c.cyan}${truncate(endpoint, 60)}${c.reset}`);
  console.log(`  ${c.gray}${hist.entries.length} version${hist.entries.length === 1 ? "" : "s"} recorded${c.reset}\n`);

  for (let i = 0; i < hist.entries.length; i++) {
    const entry = hist.entries[i];
    const isFirst = i === 0;
    const isLast = i === hist.entries.length - 1;
    const connector = isLast ? "└" : "├";
    const ts = new Date(entry.timestamp).toLocaleString();
    const age = relativeTime(entry.timestamp);

    if (isFirst) {
      console.log(`  ${c.gray}${connector}─${c.reset} ${c.green}v1${c.reset}  ${c.dim}${ts}${c.reset}  ${c.gray}${age}${c.reset}`);
      console.log(`  ${isLast ? " " : c.gray + "│" + c.reset}    ${c.gray}Initial snapshot · ${Object.keys(entry.schema).length} fields${c.reset}`);
    } else {
      const vNum = `v${i + 1}`;
      const hasBreaking = entry.changes.some(ch => ch.impact === "BREAKING");
      const vColor = hasBreaking ? c.red : c.yellow;
      console.log(`  ${c.gray}${connector}─${c.reset} ${vColor}${vNum}${c.reset}  ${c.dim}${ts}${c.reset}  ${c.gray}${age}${c.reset}`);

      for (const change of entry.changes.slice(0, 5)) {
        const icon = change.impact === "BREAKING" ? `${c.red}✖` : `${c.yellow}△`;
        const line = isLast ? " " : c.gray + "│" + c.reset;
        console.log(`  ${line}    ${icon}${c.reset}  ${c.dim}${truncate(change.description, 60)}${c.reset}`);
      }
      if (entry.changes.length > 5) {
        const line = isLast ? " " : c.gray + "│" + c.reset;
        console.log(`  ${line}    ${c.gray}...and ${entry.changes.length - 5} more changes${c.reset}`);
      }
    }
    if (!isLast) console.log(`  ${c.gray}│${c.reset}`);
  }
  console.log("");
}

async function cmdCheck(): Promise<number> {
  const { listSnapshots, getAllHistory } = await getModules();
  const snapshots = listSnapshots();

  if (snapshots.length === 0) {
    console.log(`\n  ${c.yellow}⚠  No snapshots found.${c.reset} Run your app first to capture baselines.\n`);
    return 0;
  }

  const all = getAllHistory();
  let totalDrifts = 0;
  let totalBreaking = 0;

  for (const snap of snapshots) {
    const hist = all.history[snap.endpoint];
    if (!hist) continue;
    for (const entry of hist.entries) {
      const breakingInEntry = entry.changes.filter(ch => ch.impact === "BREAKING").length;
      totalBreaking += breakingInEntry;
      if (entry.changes.length > 0) totalDrifts++;
    }
  }

  console.log(`\n  ${c.bold}apidrift check${c.reset}\n`);
  console.log(`  ${c.gray}Endpoints tracked:${c.reset}  ${snapshots.length}`);
  console.log(`  ${c.gray}Drift events:${c.reset}       ${totalDrifts}`);

  if (totalBreaking > 0) {
    console.log(`  ${c.red}Breaking changes:   ${totalBreaking}${c.reset}`);
    console.log(`\n  ${c.red}${c.bold}❌ Breaking drift in history. Review with:${c.reset}`);
    console.log(`  ${c.cyan}  apidrift history${c.reset}\n`);
    return 1;
  }

  console.log(`  ${c.gray}Breaking changes:${c.reset}   ${c.green}0${c.reset}`);
  console.log(`\n  ${c.green}${c.bold}✔ Clean.${c.reset}  No breaking drift recorded.\n`);
  return 0;
}

async function cmdTypes(output?: string): Promise<void> {
  const { listSnapshots, generateTypesFromSnapshots } = await getModules();
  const snapshots = listSnapshots();

  if (snapshots.length === 0) {
    console.error(`  ${c.yellow}No snapshots found.${c.reset} Start your app to capture API shapes first.`);
    process.exit(1);
  }

  const types = generateTypesFromSnapshots(snapshots);

  if (output) {
    const dir = path.dirname(output);
    if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(output, types, "utf-8");
    console.log(`\n  ${c.green}✔${c.reset} Generated ${c.cyan}${output}${c.reset}`);
    console.log(`  ${c.gray}  ${snapshots.length} interface${snapshots.length === 1 ? "" : "s"} from ${snapshots.length} endpoint${snapshots.length === 1 ? "" : "s"}${c.reset}\n`);
  } else {
    process.stdout.write(types);
  }
}

async function cmdClear(endpoint?: string): Promise<void> {
  const { clearAllSnapshots, clearSnapshot } = await getModules();
  const { clearHistory } = await import("../core/history.js");

  if (endpoint) {
    clearSnapshot(endpoint);
    clearHistory(endpoint);
    console.log(`\n  ${c.green}✔${c.reset} Cleared snapshot and history for:\n  ${c.cyan}${endpoint}${c.reset}\n`);
  } else {
    // Confirm
    const args = process.argv.slice(2);
    if (!args.includes("--yes") && !args.includes("-y")) {
      console.log(`\n  ${c.yellow}This will clear ALL snapshots and history.${c.reset}`);
      console.log(`  Add ${c.cyan}--yes${c.reset} to confirm:  ${c.cyan}apidrift clear --yes${c.reset}\n`);
      return;
    }
    clearAllSnapshots();
    clearHistory();
    console.log(`\n  ${c.green}✔${c.reset} All snapshots and history cleared.\n`);
  }
}

async function cmdCompare(file1: string, file2: string): Promise<void> {
  const { compare, reportDrift } = await getModules();

  if (!file1 || !file2) {
    console.error(`  ${c.red}Error:${c.reset} Two files required\n  Usage: ${c.cyan}apidrift compare <old.json> <new.json>${c.reset}`);
    process.exit(1);
  }

  let body1: unknown, body2: unknown;
  try { body1 = JSON.parse(fs.readFileSync(file1, "utf-8")); }
  catch { console.error(`  ${c.red}Error reading:${c.reset} ${file1}`); process.exit(1); }
  try { body2 = JSON.parse(fs.readFileSync(file2, "utf-8")); }
  catch { console.error(`  ${c.red}Error reading:${c.reset} ${file2}`); process.exit(1); }

  const label = `${path.basename(file1)} → ${path.basename(file2)}`;
  const result = compare(label, body1, body2);

  if (!result.hasChanges) {
    console.log(`\n  ${c.green}✔ Identical schemas.${c.reset} No differences found.\n`);
  } else {
    reportDrift(result);
    process.exit(result.hasBreaking ? 1 : 0);
  }
}

async function cmdLock(url: string): Promise<void> {
  const { getSnapshot, lockContract, hasContract } = await getModules();

  if (!url) {
    console.error(`  ${c.red}Error:${c.reset} URL required\n  Usage: ${c.cyan}apidrift lock <url>${c.reset}`);
    process.exit(1);
  }

  const snap = getSnapshot(url);
  if (!snap) {
    console.error(`\n  ${c.red}No snapshot for:${c.reset} ${url}`);
    console.log(`  ${c.gray}Run your app first or: ${c.cyan}apidrift diff ${url}${c.reset}\n`);
    process.exit(1);
  }

  lockContract(url, snap.schema);
  const fieldCount = Object.keys(snap.schema).length;
  console.log(`\n  ${c.green}✔${c.reset} Contract locked for:`);
  console.log(`  ${c.cyan}${url}${c.reset}`);
  console.log(`  ${c.gray}  ${fieldCount} field${fieldCount === 1 ? "" : "s"} locked → saved to ${c.cyan}apidrift.contract.json${c.reset}`);
  console.log(`\n  ${c.gray}Any deviation from this schema will trigger a contract violation.${c.reset}\n`);
}

async function cmdContracts(): Promise<void> {
  const { loadContracts } = await getModules();
  const store = loadContracts();
  const entries = Object.entries(store.contracts);

  if (entries.length === 0) {
    console.log(`\n  ${c.yellow}No contracts defined.${c.reset}`);
    console.log(`  Use ${c.cyan}apidrift lock <url>${c.reset} to lock a schema as a contract.\n`);
    return;
  }

  console.log(`\n  ${c.bold}Contracts${c.reset}  ${c.gray}(${entries.length} locked)${c.reset}\n`);
  for (const [endpoint, contract] of entries) {
    const fieldCount = Object.keys(contract).length;
    console.log(`  ${c.green}🔒${c.reset}  ${c.cyan}${truncate(endpoint, 65)}${c.reset}`);
    console.log(`  ${c.gray}     ${fieldCount} field${fieldCount === 1 ? "" : "s"} locked${c.reset}\n`);
  }
}

async function cmdInspect(url: string): Promise<void> {
  const { getSnapshot, getHistory, getContract } = await getModules();

  if (!url) {
    console.error(`  ${c.red}Error:${c.reset} URL required\n  Usage: ${c.cyan}apidrift inspect <url>${c.reset}`);
    process.exit(1);
  }

  const snap = getSnapshot(url);
  if (!snap) {
    console.log(`\n  ${c.yellow}No snapshot for:${c.reset} ${url}\n`);
    process.exit(0);
  }

  const hist = getHistory(url);
  const contract = getContract(url);
  const versions = hist?.entries.length ?? 1;
  const drifts = Math.max(0, versions - 1);

  console.log(`\n  ${c.bold}${c.cyan}${truncate(url, 70)}${c.reset}\n`);

  // Stats
  console.log(`  ${c.bold}Stats${c.reset}`);
  console.log(`  ${c.gray}  Seen:        ${c.reset}${snap.responseCount} times`);
  console.log(`  ${c.gray}  Last seen:   ${c.reset}${relativeTime(snap.capturedAt)}`);
  console.log(`  ${c.gray}  Versions:    ${c.reset}${versions}`);
  console.log(`  ${c.gray}  Drift events:${c.reset}${drifts}`);
  console.log(`  ${c.gray}  Contract:    ${c.reset}${contract ? `${c.green}locked${c.reset}` : `${c.gray}none${c.reset}`}`);
  console.log("");

  // Schema
  console.log(`  ${c.bold}Current Schema${c.reset}  ${c.gray}(${Object.keys(snap.schema).length} fields)${c.reset}`);
  for (const [field, node] of Object.entries(snap.schema)) {
    const opt = node.optional ? c.gray + "?" + c.reset : "";
    const nullable = node.nullable ? `${c.gray} | null${c.reset}` : "";
    let typeStr = `${c.yellow}${node.type}${c.reset}`;
    if (node.type === "array" && node.items) typeStr = `${c.yellow}${node.items.type}[]${c.reset}`;
    if (node.type === "object" && node.children) {
      const childKeys = Object.keys(node.children).join(", ");
      typeStr = `${c.yellow}object${c.reset} ${c.gray}{ ${truncate(childKeys, 40)} }${c.reset}`;
    }
    console.log(`  ${c.gray}  ${field}${c.reset}${opt}  ${typeStr}${nullable}`);
  }
  console.log("");
}

async function cmdGenerateMiddleware(framework?: string): Promise<void> {
  const { generateFastAPIMiddleware, generateDjangoMiddleware } = await import("../plugins/codegen.js");

  const fw = (framework ?? "").toLowerCase();
  if (!fw || (fw !== "fastapi" && fw !== "django")) {
    console.error(`  ${c.red}Error:${c.reset} Framework required\n  Usage: ${c.cyan}apidrift generate-middleware <fastapi|django>${c.reset}`);
    process.exit(1);
  }

  const code = fw === "fastapi" ? generateFastAPIMiddleware() : generateDjangoMiddleware();
  const filename = fw === "fastapi" ? "apidrift_middleware.py" : "apidrift_middleware.py";

  fs.writeFileSync(filename, code, "utf-8");
  console.log(`\n  ${c.green}✔${c.reset} Generated ${c.cyan}${filename}${c.reset}`);
  console.log(`  ${c.gray}Add it to your ${fw === "fastapi" ? "FastAPI" : "Django"} app — instructions are in the file.${c.reset}\n`);
}

// ─── Help ───────────────────────────────────────────────────────────────────
function printHelp(): void {
  console.log(BANNER);
  console.log(`  ${c.bold}COMMANDS${c.reset}\n`);

  const cmds: Array<[string, string]> = [
    ["init", "Initialize apidrift in current project"],
    ["list", "List all tracked endpoints"],
    ["diff <url>", "Fetch URL and diff against saved snapshot"],
    ["watch <url>", "Poll URL and report drift in real-time"],
    ["history [url]", "Show drift timeline for an endpoint"],
    ["inspect <url>", "Deep-inspect a tracked endpoint"],
    ["compare <f1> <f2>", "Diff two JSON files"],
    ["types [output]", "Generate TypeScript types from snapshots"],
    ["lock <url>", "Lock current schema as a contract"],
    ["contracts", "List all locked contracts"],
    ["check", "CI mode: exit 1 if breaking drift exists"],
    ["clear [url]", "Remove snapshot(s) and history"],
    ["dashboard", "Open interactive terminal dashboard"],
    ["generate-middleware <fastapi|django>", "Generate server-side middleware code"],
  ];

  for (const [cmd, desc] of cmds) {
    const padded = cmd.padEnd(22);
    console.log(`  ${c.cyan}apidrift ${padded}${c.reset}${c.gray}${desc}${c.reset}`);
  }

  console.log(`\n  ${c.bold}OPTIONS${c.reset}\n`);
  console.log(`  ${c.cyan}--help, -h    ${c.reset}${c.gray}Show this help${c.reset}`);
  console.log(`  ${c.cyan}--version, -v ${c.reset}${c.gray}Show version${c.reset}`);
  console.log(`  ${c.cyan}--verbose     ${c.reset}${c.gray}Extra output${c.reset}`);

  console.log(`\n  ${c.bold}ENV VARS${c.reset}\n`);
  console.log(`  ${c.cyan}APIDRIFT_VERBOSE=1  ${c.reset}${c.gray}Log all tracked endpoints${c.reset}`);
  console.log(`  ${c.cyan}APIDRIFT_SILENT=1   ${c.reset}${c.gray}Suppress all output${c.reset}`);
  console.log(`  ${c.cyan}APIDRIFT_FILTER=api ${c.reset}${c.gray}Only track URLs containing this string${c.reset}`);
  console.log(`  ${c.cyan}APIDRIFT_CI=1       ${c.reset}${c.gray}Exit 1 on breaking drift (for CI pipelines)${c.reset}`);

  console.log(`\n  ${c.bold}EXAMPLES${c.reset}\n`);
  console.log(`  ${c.gray}# Track everything automatically:${c.reset}`);
  console.log(`  ${c.cyan}import "apidrift/register"${c.reset}\n`);
  console.log(`  ${c.gray}# Watch a live endpoint:${c.reset}`);
  console.log(`  ${c.cyan}apidrift watch https://api.github.com/users/octocat${c.reset}\n`);
  console.log(`  ${c.gray}# Generate types from real responses:${c.reset}`);
  console.log(`  ${c.cyan}apidrift types src/types/api.generated.ts${c.reset}\n`);
  console.log(`  ${c.gray}# Lock contract + enforce in CI:${c.reset}`);
  console.log(`  ${c.cyan}apidrift lock https://api.example.com/users${c.reset}`);
  console.log(`  ${c.cyan}apidrift check  # exits 1 if contract violated${c.reset}\n`);
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  // Parse flags
  const flags: Record<string, string | boolean> = {};
  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const next = args[i + 1];
      if (next && !next.startsWith("--")) {
        flags[args[i]] = next;
        i++;
      } else {
        flags[args[i]] = true;
      }
    }
  }
  const positional = args.filter((a, i) => i > 0 && !a.startsWith("--") && args[i - 1]?.startsWith("--") === false);

  if (!command || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command === "--version" || command === "-v") {
    console.log(`apidrift v${VERSION}`);
    return;
  }

  switch (command) {
    case "init":   await cmdInit(); break;
    case "list":   await cmdList(); break;
    case "diff":   await cmdDiff(args[1], flags as Record<string, boolean>); break;
    case "watch":  await cmdWatch(args[1], flags as Record<string, string>); break;
    case "history": await cmdHistory(args[1]); break;
    case "inspect": await cmdInspect(args[1]); break;
    case "compare": await cmdCompare(args[1], args[2]); break;
    case "types":  await cmdTypes(args[1]); break;
    case "lock":   await cmdLock(args[1]); break;
    case "contracts": await cmdContracts(); break;
    case "check":  { const code = await cmdCheck(); process.exit(code); break; }
    case "clear":  await cmdClear(args[1]); break;
    case "dashboard": {
      const { runDashboard } = await import("./dashboard.js");
      await runDashboard();
      break;
    }
    case "generate-middleware": {
      await cmdGenerateMiddleware(args[1]);
      break;
    }
    default:
      console.error(`\n  ${c.red}Unknown command:${c.reset} ${command}`);
      console.error(`  Run ${c.cyan}apidrift --help${c.reset} for usage\n`);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(`\n  ${c.red}Fatal error:${c.reset}`, (err as Error).message);
  if (process.env.APIDRIFT_VERBOSE) console.error(err);
  process.exit(1);
});
