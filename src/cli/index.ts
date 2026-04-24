#!/usr/bin/env node
/**
 * apidrift CLI
 * The developer's API time machine.
 */
import * as fs from "fs";
import * as path from "path";
import https from "https";
import http from "http";

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
  const { reportDrift, ciReport, generateHtmlReport } = await import("../core/reporter.js");
  const { extractTopLevelSchema } = await import("../core/schema.js");
  const { generateTypesFromSnapshots } = await import("../utils/typegen.js");
  const { compare } = await import("../core/tracker.js");
  const { getHistory, getAllHistory } = await import("../core/history.js");
  const { lockContract, loadContracts, getContract, hasContract } = await import("../core/contract.js");
  return {
    listSnapshots, clearAllSnapshots, clearSnapshot, getSnapshot, saveSnapshot, loadStore,
    diffSchemas, reportDrift, ciReport, generateHtmlReport, extractTopLevelSchema, generateTypesFromSnapshots,
    compare, getHistory, getAllHistory, lockContract, loadContracts, getContract, hasContract,
  };
}

// ─── Utils ──────────────────────────────────────────────────────────────────
async function fetchJson(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const client: any = url.startsWith("https") ? https : http;
    const req = client.get(url, { headers: { Accept: "application/json" } }, (res: any) => {
      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode} from ${url}`));
        return;
      }
      let data = "";
      res.on("data", (chunk: any) => (data += chunk.toString()));
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

/**
 * Emit output: if --json flag is set, write JSON to stdout; otherwise print
 * the human-readable console output via the provided printFn.
 */
function outputOrJson(jsonPayload: unknown, printFn: () => void, flags: Record<string, string | boolean>): void {
  if (flags["--json"]) {
    process.stdout.write(JSON.stringify(jsonPayload, null, 2) + "\n");
  } else {
    printFn();
  }
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

async function cmdList(flags: Record<string, string | boolean> = {}): Promise<void> {
  const { listSnapshots, getHistory } = await getModules();
  const snapshots = listSnapshots();

  if (flags["--json"]) {
    const result = snapshots.map(snap => {
      const hist = getHistory(snap.endpoint);
      const versions = hist?.entries.length ?? 1;
      return {
        endpoint: snap.endpoint,
        fieldCount: Object.keys(snap.schema).length,
        responseCount: snap.responseCount,
        capturedAt: snap.capturedAt,
        versions,
        driftEvents: Math.max(0, versions - 1),
      };
    });
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    return;
  }

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

async function cmdDiff(url: string, flags: Record<string, string | boolean>): Promise<void> {
  const { extractTopLevelSchema, diffSchemas, getSnapshot, saveSnapshot, reportDrift } = await getModules();

  if (!url) {
    console.error(`  ${c.red}Error:${c.reset} URL required\n  Usage: ${c.cyan}apidrift diff <url>${c.reset}`);
    process.exit(1);
  }

  // ── fs.watch mode: watch the snapshots file for offline, zero-latency diffs ──
  if (flags["--watch-file"]) {
    await cmdDiffWatchFile(url, flags);
    return;
  }

  if (!flags["--json"]) {
    process.stdout.write(`  ${c.gray}Fetching ${truncate(url, 60)}...${c.reset} `);
  }
  let body: unknown;
  try {
    body = await fetchJson(url);
    if (!flags["--json"]) console.log(`${c.green}✔${c.reset}`);
  } catch (err) {
    if (!flags["--json"]) console.log(`${c.red}✖${c.reset}`);
    if (flags["--json"]) {
      process.stdout.write(JSON.stringify({ error: (err as Error).message }, null, 2) + "\n");
    } else {
      console.error(`\n  ${c.red}Error:${c.reset} ${(err as Error).message}\n`);
    }
    process.exit(1);
  }

  const newSchema = extractTopLevelSchema(body);
  const existing = getSnapshot(url);

  if (!existing) {
    saveSnapshot(url, newSchema);
    if (flags["--json"]) {
      process.stdout.write(JSON.stringify({ firstSnapshot: true, endpoint: url, schema: newSchema }, null, 2) + "\n");
    } else {
      console.log(`\n  ${c.green}✔${c.reset} First snapshot saved for this endpoint.`);
      console.log(`  ${c.gray}Run again to detect drift.${c.reset}\n`);
    }
    return;
  }

  const result = diffSchemas(url, existing.schema, newSchema);

  if (flags["--json"]) {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    return;
  }

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

/**
 * fs.watch mode for diff: watches .apidrift/snapshots.json for changes made
 * by any other process (e.g. your running app) and immediately shows the diff.
 * Zero latency, zero network calls, works completely offline.
 */
async function cmdDiffWatchFile(url: string, flags: Record<string, string | boolean>): Promise<void> {
  const { getStoreDirPath } = await import("../core/storage.js");
  const { extractTopLevelSchema, diffSchemas, getSnapshot, reportDrift } = await getModules();

  const snapshotsFile = path.join(getStoreDirPath(), "snapshots.json");

  if (!flags["--json"]) {
    console.log(`\n  ${c.cyan}${c.bold}Watching snapshots file${c.reset}`);
    console.log(`  ${c.gray}File: ${snapshotsFile}${c.reset}`);
    console.log(`  ${c.gray}Endpoint: ${url}${c.reset}`);
    console.log(`  ${c.gray}Waiting for changes — Ctrl+C to stop${c.reset}\n`);
  }

  let lastChecksum = "";

  function checkForDrift() {
    try {
      const existing = getSnapshot(url);
      if (!existing) return;

      const raw = JSON.stringify(existing.schema);
      if (raw === lastChecksum) return;

      if (lastChecksum === "") {
        // First read — record baseline silently
        lastChecksum = raw;
        if (!flags["--json"]) {
          console.log(`  ${c.green}✔${c.reset} Baseline loaded (${Object.keys(existing.schema).length} fields)`);
        }
        return;
      }

      // Parse the previous schema from the checksum string
      const prevSchema = JSON.parse(lastChecksum);
      const result = diffSchemas(url, prevSchema, existing.schema);
      lastChecksum = raw;

      if (result.hasChanges) {
        if (flags["--json"]) {
          process.stdout.write(JSON.stringify(result, null, 2) + "\n");
        } else {
          const ts = new Date().toLocaleTimeString();
          process.stdout.write(`\n  ${c.gray}[${ts}] Change detected${c.reset}\n`);
          reportDrift(result);
        }
      }
    } catch {
      // File may be mid-write; ignore transient errors
    }
  }

  // Initial read
  checkForDrift();

  // Watch for file changes
  if (fs.existsSync(snapshotsFile)) {
    fs.watch(snapshotsFile, () => {
      // Debounce: wait a tick for the write to complete
      setTimeout(checkForDrift, 50);
    });
  } else {
    // Watch the directory for the file to be created
    const watchDir = path.dirname(snapshotsFile);
    if (!fs.existsSync(watchDir)) fs.mkdirSync(watchDir, { recursive: true });
    fs.watch(watchDir, (_event: string, filename: string | null) => {
      if (filename === "snapshots.json") {
        setTimeout(checkForDrift, 50);
      }
    });
  }

  process.on("SIGINT", () => {
    if (!flags["--json"]) {
      console.log(`\n\n  ${c.gray}File watch stopped.${c.reset}\n`);
    }
    process.exit(0);
  });

  // Keep process alive
  await new Promise(() => {});
}

async function cmdWatch(url: string, flags: Record<string, string | boolean>): Promise<void> {
  const { extractTopLevelSchema, diffSchemas, getSnapshot, saveSnapshot, reportDrift } = await getModules();

  if (!url) {
    console.error(`  ${c.red}Error:${c.reset} URL required\n  Usage: ${c.cyan}apidrift watch <url> [--interval 5] [--output drift-log.json]${c.reset}`);
    process.exit(1);
  }

  const intervalSec = parseInt(String(flags["--interval"] ?? "5"), 10);
  const outputFile = flags["--output"] as string | undefined;

  // Accumulated log entries when --output is used
  const driftLog: unknown[] = [];

  if (!flags["--json"]) {
    console.log(`\n  ${c.cyan}${c.bold}Watching${c.reset}  ${url}`);
    console.log(`  ${c.gray}Polling every ${intervalSec}s — Ctrl+C to stop${c.reset}`);
    if (outputFile) {
      console.log(`  ${c.gray}Logging drift to: ${c.cyan}${outputFile}${c.reset}`);
    }
    console.log("");
  }

  let pollCount = 0;

  async function poll() {
    pollCount++;
    const ts = new Date().toLocaleTimeString();
    if (!flags["--json"]) {
      process.stdout.write(`  ${c.gray}[${ts}] poll #${pollCount}...${c.reset}\r`);
    }

    let body: unknown;
    try {
      body = await fetchJson(url);
    } catch (err) {
      const msg = `fetch failed: ${(err as Error).message}`;
      if (!flags["--json"]) {
        process.stdout.write(`  ${c.red}[${ts}] ${msg}${c.reset}\n`);
      }
      if (outputFile) {
        driftLog.push({ timestamp: new Date().toISOString(), poll: pollCount, error: msg });
        fs.writeFileSync(outputFile, JSON.stringify(driftLog, null, 2), "utf-8");
      }
      return;
    }

    const newSchema = extractTopLevelSchema(body);
    const existing = getSnapshot(url);

    if (!existing) {
      saveSnapshot(url, newSchema);
      if (!flags["--json"]) {
        console.log(`  ${c.green}[${ts}]${c.reset} Baseline captured (${Object.keys(newSchema).length} fields)`);
      }
      if (outputFile) {
        driftLog.push({ timestamp: new Date().toISOString(), poll: pollCount, event: "baseline_captured", fieldCount: Object.keys(newSchema).length });
        fs.writeFileSync(outputFile, JSON.stringify(driftLog, null, 2), "utf-8");
      }
      return;
    }

    const result = diffSchemas(url, existing.schema, newSchema);

    if (result.hasChanges) {
      if (flags["--json"]) {
        process.stdout.write(JSON.stringify(result, null, 2) + "\n");
      } else {
        process.stdout.write("\n");
        reportDrift(result);
      }
      saveSnapshot(url, newSchema);

      if (outputFile) {
        driftLog.push(result);
        fs.writeFileSync(outputFile, JSON.stringify(driftLog, null, 2), "utf-8");
      }
    } else {
      if (!flags["--json"]) {
        process.stdout.write(`  ${c.gray}[${ts}] poll #${pollCount} — ${c.green}no drift${c.reset}       \r`);
      }
    }
  }

  await poll();
  const timer = setInterval(poll, intervalSec * 1000);

  process.on("SIGINT", () => {
    clearInterval(timer);
    if (!flags["--json"]) {
      console.log(`\n\n  ${c.gray}Watch stopped. Run ${c.cyan}apidrift list${c.gray} to see all endpoints.${c.reset}\n`);
    }
    if (outputFile && driftLog.length > 0) {
      fs.writeFileSync(outputFile, JSON.stringify(driftLog, null, 2), "utf-8");
      if (!flags["--json"]) {
        console.log(`  ${c.gray}Drift log saved to: ${c.cyan}${outputFile}${c.reset}\n`);
      }
    }
    process.exit(0);
  });
}

async function cmdHistory(endpoint: string, flags: Record<string, string | boolean> = {}): Promise<void> {
  const { getHistory, getAllHistory } = await getModules();

  if (!endpoint) {
    const all = getAllHistory();
    const entries = Object.values(all.history);

    if (flags["--json"]) {
      process.stdout.write(JSON.stringify(all, null, 2) + "\n");
      return;
    }

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

  if (flags["--json"]) {
    process.stdout.write(JSON.stringify(hist, null, 2) + "\n");
    return;
  }

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

async function cmdCheck(flags: Record<string, string | boolean> = {}): Promise<number> {
  const { listSnapshots, getAllHistory } = await getModules();
  const snapshots = listSnapshots();

  if (snapshots.length === 0) {
    if (flags["--json"]) {
      process.stdout.write(JSON.stringify({ clean: true, message: "No snapshots found" }, null, 2) + "\n");
    } else {
      console.log(`\n  ${c.yellow}⚠  No snapshots found.${c.reset} Run your app first to capture baselines.\n`);
    }
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

  if (flags["--json"]) {
    process.stdout.write(JSON.stringify({
      clean: totalBreaking === 0,
      endpoints: snapshots.length,
      driftEvents: totalDrifts,
      breakingChanges: totalBreaking,
    }, null, 2) + "\n");
    return totalBreaking > 0 ? 1 : 0;
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

async function cmdCompare(file1: string, file2: string, flags: Record<string, string | boolean> = {}): Promise<void> {
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

  if (flags["--json"]) {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    process.exit(result.hasBreaking ? 1 : 0);
    return;
  }

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

async function cmdContracts(flags: Record<string, string | boolean> = {}): Promise<void> {
  const { loadContracts } = await getModules();
  const store = loadContracts();
  const entries = Object.entries(store.contracts);

  if (flags["--json"]) {
    process.stdout.write(JSON.stringify(store, null, 2) + "\n");
    return;
  }

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

async function cmdInspect(url: string, flags: Record<string, string | boolean> = {}): Promise<void> {
  const { getSnapshot, getHistory, getContract } = await getModules();

  if (!url) {
    console.error(`  ${c.red}Error:${c.reset} URL required\n  Usage: ${c.cyan}apidrift inspect <url>${c.reset}`);
    process.exit(1);
  }

  const snap = getSnapshot(url);
  if (!snap) {
    if (flags["--json"]) {
      process.stdout.write(JSON.stringify({ error: "No snapshot found", endpoint: url }, null, 2) + "\n");
    } else {
      console.log(`\n  ${c.yellow}No snapshot for:${c.reset} ${url}\n`);
    }
    process.exit(0);
  }

  const hist = getHistory(url);
  const contract = getContract(url);
  const versions = hist?.entries.length ?? 1;
  const drifts = Math.max(0, versions - 1);

  if (flags["--json"]) {
    process.stdout.write(JSON.stringify({
      endpoint: url,
      responseCount: snap.responseCount,
      capturedAt: snap.capturedAt,
      versions,
      driftEvents: drifts,
      hasContract: !!contract,
      schema: snap.schema,
      history: hist,
    }, null, 2) + "\n");
    return;
  }

  console.log(`\n  ${c.bold}${c.cyan}${truncate(url, 70)}${c.reset}\n`);
  console.log(`  ${c.bold}Stats${c.reset}`);
  console.log(`  ${c.gray}  Seen:        ${c.reset}${snap.responseCount} times`);
  console.log(`  ${c.gray}  Last seen:   ${c.reset}${relativeTime(snap.capturedAt)}`);
  console.log(`  ${c.gray}  Versions:    ${c.reset}${versions}`);
  console.log(`  ${c.gray}  Drift events:${c.reset}${drifts}`);
  console.log(`  ${c.gray}  Contract:    ${c.reset}${contract ? `${c.green}locked${c.reset}` : `${c.gray}none${c.reset}`}`);
  console.log("");

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

// ─── New Commands ────────────────────────────────────────────────────────────

/**
 * apidrift export
 *
 * Dumps all snapshots as proper JSON Schema (draft-07) or as an OpenAPI 3.0
 * paths fragment. Developers use this to bootstrap specs from real traffic
 * rather than writing them by hand.
 *
 * Usage:
 *   apidrift export                        # JSON Schema to stdout
 *   apidrift export --format openapi       # OpenAPI fragment to stdout
 *   apidrift export --output schema.json   # write to file
 */
async function cmdExport(flags: Record<string, string | boolean>): Promise<void> {
  const { listSnapshots } = await getModules();
  const snapshots = listSnapshots();

  if (snapshots.length === 0) {
    console.error(`  ${c.yellow}No snapshots found.${c.reset} Start your app to capture API shapes first.`);
    process.exit(1);
  }

  const format = String(flags["--format"] ?? "json-schema").toLowerCase();
  const outputFile = flags["--output"] as string | undefined;

  let output: string;

  if (format === "openapi") {
    output = exportAsOpenAPI(snapshots);
  } else {
    output = exportAsJsonSchema(snapshots);
  }

  if (outputFile) {
    const dir = path.dirname(outputFile);
    if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outputFile, output, "utf-8");
    if (!flags["--json"]) {
      console.log(`\n  ${c.green}✔${c.reset} Exported ${snapshots.length} schema${snapshots.length === 1 ? "" : "s"} to ${c.cyan}${outputFile}${c.reset}`);
      console.log(`  ${c.gray}Format: ${format}${c.reset}\n`);
    }
  } else {
    process.stdout.write(output + "\n");
  }
}

function schemaNodeToJsonSchema(node: import("../core/schema.js").SchemaNode): Record<string, unknown> {
  switch (node.type) {
    case "string":  return node.nullable ? { type: ["string", "null"] } : { type: "string" };
    case "number":  return node.nullable ? { type: ["number", "null"] } : { type: "number" };
    case "boolean": return node.nullable ? { type: ["boolean", "null"] } : { type: "boolean" };
    case "null":    return { type: "null" };
    case "unknown": return {};
    case "array": {
      const base: Record<string, unknown> = { type: "array" };
      if (node.items) base.items = schemaNodeToJsonSchema(node.items);
      if (node.nullable) return { oneOf: [base, { type: "null" }] };
      return base;
    }
    case "object": {
      const props: Record<string, unknown> = {};
      const required: string[] = [];
      for (const [key, child] of Object.entries(node.children ?? {})) {
        props[key] = schemaNodeToJsonSchema(child);
        if (!child.optional) required.push(key);
      }
      const base: Record<string, unknown> = { type: "object", properties: props };
      if (required.length > 0) base.required = required;
      if (node.nullable) return { oneOf: [base, { type: "null" }] };
      return base;
    }
    default: return {};
  }
}

function exportAsJsonSchema(snapshots: import("../core/storage.js").Snapshot[]): string {
  const definitions: Record<string, unknown> = {};

  for (const snap of snapshots) {
    const key = snap.endpoint.replace(/[^a-zA-Z0-9_]/g, "_").replace(/^_+|_+$/g, "");
    const props: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [field, node] of Object.entries(snap.schema)) {
      props[field] = schemaNodeToJsonSchema(node);
      if (!node.optional) required.push(field);
    }

    definitions[key] = {
      $id: snap.endpoint,
      type: "object",
      title: snap.endpoint,
      description: `Generated by apidrift from ${snap.responseCount} response(s). Last seen: ${snap.capturedAt}`,
      properties: props,
      ...(required.length > 0 ? { required } : {}),
    };
  }

  return JSON.stringify({
    $schema: "http://json-schema.org/draft-07/schema#",
    title: "apidrift — exported schemas",
    description: `Generated by apidrift on ${new Date().toISOString()}`,
    definitions,
  }, null, 2);
}

function exportAsOpenAPI(snapshots: import("../core/storage.js").Snapshot[]): string {
  const paths: Record<string, unknown> = {};

  for (const snap of snapshots) {
    let urlPath = snap.endpoint;
    try {
      urlPath = new URL(snap.endpoint).pathname;
    } catch { /* relative URL — use as-is */ }

    const props: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [field, node] of Object.entries(snap.schema)) {
      props[field] = schemaNodeToJsonSchema(node);
      if (!node.optional) required.push(field);
    }

    paths[urlPath] = {
      get: {
        summary: `${snap.endpoint}`,
        description: `Tracked by apidrift. Seen ${snap.responseCount} time(s). Last: ${snap.capturedAt}`,
        responses: {
          "200": {
            description: "Successful response",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: props,
                  ...(required.length > 0 ? { required } : {}),
                },
              },
            },
          },
        },
      },
    };
  }

  return JSON.stringify({
    openapi: "3.0.3",
    info: {
      title: "apidrift — exported API schemas",
      version: "1.0.0",
      description: `Generated by apidrift on ${new Date().toISOString()}`,
    },
    paths,
  }, null, 2);
}

/**
 * apidrift replay <endpoint> <v1> <v2>
 *
 * Re-runs the diff between any two historical versions of an endpoint.
 * The history data is already stored — this command just queries it.
 *
 * Usage:
 *   apidrift replay https://api.example.com/users 2 4
 *   apidrift replay https://api.example.com/users 2 4 --json
 */
async function cmdReplay(
  endpoint: string,
  v1Str: string,
  v2Str: string,
  flags: Record<string, string | boolean>
): Promise<void> {
  const { getHistory, diffSchemas, reportDrift } = await getModules();

  if (!endpoint || !v1Str || !v2Str) {
    console.error(`  ${c.red}Error:${c.reset} endpoint and two version numbers required`);
    console.error(`  Usage: ${c.cyan}apidrift replay <endpoint> <v1> <v2>${c.reset}`);
    process.exit(1);
  }

  const hist = getHistory(endpoint);
  if (!hist || hist.entries.length === 0) {
    console.error(`\n  ${c.red}No history for:${c.reset} ${endpoint}\n`);
    process.exit(1);
  }

  const v1 = parseInt(v1Str, 10);
  const v2 = parseInt(v2Str, 10);

  if (isNaN(v1) || isNaN(v2)) {
    console.error(`  ${c.red}Error:${c.reset} Version numbers must be integers (e.g. 1, 2, 3)`);
    process.exit(1);
  }

  const maxV = hist.entries.length;
  if (v1 < 1 || v1 > maxV || v2 < 1 || v2 > maxV) {
    console.error(`  ${c.red}Error:${c.reset} Version numbers must be between 1 and ${maxV}`);
    console.error(`  ${c.gray}Run ${c.cyan}apidrift history ${endpoint}${c.gray} to see available versions.${c.reset}`);
    process.exit(1);
  }

  if (v1 === v2) {
    if (flags["--json"]) {
      process.stdout.write(JSON.stringify({ endpoint, v1, v2, hasChanges: false, changes: [] }, null, 2) + "\n");
    } else {
      console.log(`\n  ${c.green}✔ Same version.${c.reset} No differences.\n`);
    }
    return;
  }

  const entry1 = hist.entries[v1 - 1];
  const entry2 = hist.entries[v2 - 1];

  const result = diffSchemas(endpoint, entry1.schema, entry2.schema);

  // Augment result with version metadata
  const augmented = {
    ...result,
    fromVersion: v1,
    toVersion: v2,
    fromTimestamp: entry1.timestamp,
    toTimestamp: entry2.timestamp,
  };

  if (flags["--json"]) {
    process.stdout.write(JSON.stringify(augmented, null, 2) + "\n");
    return;
  }

  console.log(`\n  ${c.bold}Replay:${c.reset} ${c.cyan}${truncate(endpoint, 55)}${c.reset}`);
  console.log(`  ${c.gray}Comparing v${v1} (${relativeTime(entry1.timestamp)}) → v${v2} (${relativeTime(entry2.timestamp)})${c.reset}\n`);

  if (!result.hasChanges) {
    console.log(`  ${c.green}✔ No differences${c.reset} between v${v1} and v${v2}.\n`);
  } else {
    reportDrift(result);
  }
}

/**
 * apidrift stats
 *
 * Shows which endpoints change most frequently, which have the most breaking
 * changes, and the average stability score across the project. Useful for
 * identifying your most unstable APIs at a glance.
 *
 * Usage:
 *   apidrift stats
 *   apidrift stats --json
 */
async function cmdStats(flags: Record<string, string | boolean>): Promise<void> {
  const { listSnapshots, getAllHistory } = await getModules();
  const snapshots = listSnapshots();

  if (snapshots.length === 0) {
    if (flags["--json"]) {
      process.stdout.write(JSON.stringify({ endpoints: [] }, null, 2) + "\n");
    } else {
      console.log(`\n  ${c.yellow}No endpoints tracked yet.${c.reset}\n`);
    }
    return;
  }

  const all = getAllHistory();

  interface EndpointStat {
    endpoint: string;
    responseCount: number;
    versions: number;
    driftEvents: number;
    breakingChanges: number;
    nonBreakingChanges: number;
    stabilityScore: number;  // 0–100, higher = more stable
    lastSeen: string;
  }

  const stats: EndpointStat[] = snapshots.map(snap => {
    const hist = all.history[snap.endpoint];
    const entries = hist?.entries ?? [];
    const versions = entries.length;
    let driftEvents = 0;
    let breakingChanges = 0;
    let nonBreakingChanges = 0;

    for (const entry of entries) {
      if (entry.changes.length > 0) driftEvents++;
      for (const ch of entry.changes) {
        if (ch.impact === "BREAKING") breakingChanges++;
        else if (ch.impact === "NON_BREAKING") nonBreakingChanges++;
      }
    }

    // Stability score: 100 = never drifted, penalise breaking changes more
    const driftPenalty = driftEvents * 5;
    const breakingPenalty = breakingChanges * 15;
    const stabilityScore = Math.max(0, 100 - driftPenalty - breakingPenalty);

    return {
      endpoint: snap.endpoint,
      responseCount: snap.responseCount,
      versions,
      driftEvents,
      breakingChanges,
      nonBreakingChanges,
      stabilityScore,
      lastSeen: snap.capturedAt,
    };
  });

  // Sort by stability score ascending (most unstable first)
  stats.sort((a, b) => a.stabilityScore - b.stabilityScore);

  const totalBreaking = stats.reduce((s, e) => s + e.breakingChanges, 0);
  const avgStability = stats.reduce((s, e) => s + e.stabilityScore, 0) / stats.length;

  if (flags["--json"]) {
    process.stdout.write(JSON.stringify({
      summary: {
        totalEndpoints: stats.length,
        totalBreakingChanges: totalBreaking,
        averageStabilityScore: parseFloat(avgStability.toFixed(1)),
      },
      endpoints: stats,
    }, null, 2) + "\n");
    return;
  }

  console.log(`\n  ${c.bold}API Stability Stats${c.reset}  ${c.gray}(${stats.length} endpoints)${c.reset}\n`);

  // Summary row
  console.log(`  ${c.gray}Total breaking changes:${c.reset}  ${totalBreaking > 0 ? c.red : c.green}${totalBreaking}${c.reset}`);
  console.log(`  ${c.gray}Avg stability score:${c.reset}     ${avgStability >= 80 ? c.green : avgStability >= 50 ? c.yellow : c.red}${avgStability.toFixed(1)}/100${c.reset}`);
  console.log("");

  // Per-endpoint table
  const header = `  ${"Endpoint".padEnd(50)} ${"Seen".padStart(5)} ${"Drifts".padStart(7)} ${"Breaking".padStart(9)} ${"Score".padStart(6)}`;
  console.log(`${c.bold}${header}${c.reset}`);
  console.log(`  ${"─".repeat(80)}`);

  for (const stat of stats) {
    const ep = truncate(stat.endpoint, 48);
    const scoreColor = stat.stabilityScore >= 80 ? c.green : stat.stabilityScore >= 50 ? c.yellow : c.red;
    const breakColor = stat.breakingChanges > 0 ? c.red : c.gray;
    console.log(
      `  ${c.cyan}${ep.padEnd(50)}${c.reset}` +
      ` ${String(stat.responseCount).padStart(5)}` +
      ` ${String(stat.driftEvents).padStart(7)}` +
      ` ${breakColor}${String(stat.breakingChanges).padStart(9)}${c.reset}` +
      ` ${scoreColor}${String(stat.stabilityScore).padStart(6)}${c.reset}`
    );
  }
  console.log("");
}

// ─── Help ───────────────────────────────────────────────────────────────────

async function cmdCiGen(): Promise<void> {
  const fs = await import('fs');
  const path = await import('path');
  
  const workflowDir = path.join(process.cwd(), '.github', 'workflows');
  const workflowFile = path.join(workflowDir, 'apidrift-check.yml');
  
  const yaml = `name: apidrift-check

on:
  pull_request:
    branches: [ main, master ]
  push:
    branches: [ main, master ]

jobs:
  api-drift-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          
      - name: Install dependencies
        run: npm install
        
      - name: Run apidrift check
        run: |
          # Ensure apidrift is installed (either as dependency or global)
          # If not in package.json, we can run it via npx
          npx apidrift check --json
        env:
          APIDRIFT_CI: 1
`;

  if (!fs.existsSync(workflowDir)) {
    fs.mkdirSync(workflowDir, { recursive: true });
  }
  
  fs.writeFileSync(workflowFile, yaml, "utf-8");
  console.log(`\n  ${c.green}✔  GitHub Action generated:${c.reset} .github/workflows/apidrift-check.yml`);
  console.log(`  ${c.gray}This workflow will now run on every PR to ensure no breaking API changes are merged.${c.reset}\n`);
}


async function cmdReport(flags: Record<string, string | boolean> = {}): Promise<void> {
  const { generateHtmlReport } = await getModules();
  const outputPath = (flags["--output"] as string) || "apidrift-report.html";
  
  await generateHtmlReport(outputPath);
  
  console.log(`\n  ${c.green}✔  HTML Report generated:${c.reset} ${outputPath}`);
  console.log(`  ${c.gray}Open this file in your browser to view the API drift dashboard.${c.reset}\n`);
}

function printHelp(): void {
  console.log(BANNER);
  console.log(`  ${c.bold}COMMANDS${c.reset}\n`);
  const cmds: Array<[string, string]> = [
    ["init", "Initialize apidrift in current project"],
    ["list", "List all tracked endpoints"],
    ["diff <url>", "Fetch URL and diff against saved snapshot"],
    ["diff <url> --watch-file", "Watch snapshots.json for offline, zero-latency diffs"],
    ["watch <url>", "Poll URL and report drift in real-time"],
    ["history [url]", "Show drift timeline for an endpoint"],
    ["replay <url> <v1> <v2>", "Diff two historical versions of an endpoint"],
    ["stats", "Stability scores and drift frequency for all endpoints"],
    ["export", "Export all schemas as JSON Schema or OpenAPI fragment"],
    ["inspect <url>", "Deep-inspect a tracked endpoint"],
    ["compare <f1> <f2>", "Diff two local JSON files"],
    ["types [output]", "Generate TypeScript types from snapshots"],
    ["lock <url>", "Lock current schema as a contract"],
    ["contracts", "List all locked contracts"],
    ["check", "CI mode: exit 1 if breaking drift exists"],
    ["clear [url]", "Remove snapshot(s) and history"],
    ["dashboard", "Open interactive terminal dashboard"],
    ["generate-middleware <fastapi|django>", "Generate server-side middleware code"],
  ];
  for (const [cmd, desc] of cmds) {
    const padded = cmd.padEnd(30);
    console.log(`  ${c.cyan}apidrift ${padded}${c.reset}${c.gray}${desc}${c.reset}`);
  }
  console.log(`\n  ${c.bold}OPTIONS${c.reset}\n`);
  console.log(`  ${c.cyan}--help, -h         ${c.reset}${c.gray}Show this help${c.reset}`);
  console.log(`  ${c.cyan}--version, -v      ${c.reset}${c.gray}Show version${c.reset}`);
  console.log(`  ${c.cyan}--verbose          ${c.reset}${c.gray}Extra output${c.reset}`);
  console.log(`  ${c.cyan}--json             ${c.reset}${c.gray}Machine-readable JSON output (works on most commands)${c.reset}`);
  console.log(`  ${c.cyan}--output <file>    ${c.reset}${c.gray}Write output to file (watch, export)${c.reset}`);
  console.log(`  ${c.cyan}--format <fmt>     ${c.reset}${c.gray}Export format: json-schema (default) or openapi${c.reset}`);
  console.log(`  ${c.cyan}--interval <secs>  ${c.reset}${c.gray}Polling interval for watch (default: 5)${c.reset}`);
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
  console.log(`  ${c.gray}# Watch with output log for CI/alerting:${c.reset}`);
  console.log(`  ${c.cyan}apidrift watch https://api.example.com/users --output drift-log.json${c.reset}\n`);
  console.log(`  ${c.gray}# Machine-readable diff for scripting:${c.reset}`);
  console.log(`  ${c.cyan}apidrift diff https://api.example.com/users --json | jq .changes${c.reset}\n`);
  console.log(`  ${c.gray}# Replay what changed between v2 and v4:${c.reset}`);
  console.log(`  ${c.cyan}apidrift replay https://api.example.com/users 2 4${c.reset}\n`);
  console.log(`  ${c.gray}# Export schemas to bootstrap an OpenAPI spec:${c.reset}`);
  console.log(`  ${c.cyan}apidrift export --format openapi --output openapi.json${c.reset}\n`);
  console.log(`  ${c.gray}# See which endpoints are most unstable:${c.reset}`);
  console.log(`  ${c.cyan}apidrift stats${c.reset}\n`);
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

  // Parse flags — supports both --flag and --flag value forms
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

  if (!command || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command === "--version" || command === "-v") {
    console.log(`apidrift v${VERSION}`);
    return;
  }

  switch (command) {
    case "init":      await cmdInit(); break;
    case "list":      await cmdList(flags); break;
    case "diff":      await cmdDiff(args[1], flags); break;
    case "watch":     await cmdWatch(args[1], flags); break;
    case "history":   await cmdHistory(args[1], flags); break;
    case "replay":    await cmdReplay(args[1], args[2], args[3], flags); break;
    case "stats":     await cmdStats(flags); break;
    case "export":    await cmdExport(flags); break;
    case "inspect":   await cmdInspect(args[1], flags); break;
    case "compare":   await cmdCompare(args[1], args[2], flags); break;
    case "types":     await cmdTypes(args[1]); break;
    case "lock":      await cmdLock(args[1]); break;
    case "contracts": await cmdContracts(flags); break;
    case "report":    await cmdReport(flags as Record<string, string | boolean>); break;
    case "ci-gen":    await cmdCiGen(); break;
    case "check":     { const code = await cmdCheck(flags); process.exit(code); break; }
    case "clear":     await cmdClear(args[1]); break;
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
