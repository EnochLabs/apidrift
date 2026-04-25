/**
 * apidrift dashboard — interactive terminal UI
 *
 * Zero dependencies. Pure ANSI escape codes + stdin raw mode.
 * Run: apidrift dashboard
 */
import { listSnapshots } from "../core/storage.js";
import { getAllHistory } from "../core/history.js";
import { loadContracts } from "../core/contract.js";
// ─── ANSI ────────────────────────────────────────────────────────────────────
const ESC = "\x1b[";
const A = {
    reset: "\x1b[0m",
    bold: "\x1b[1m",
    dim: "\x1b[2m",
    italic: "\x1b[3m",
    underline: "\x1b[4m",
    // Colors
    black: "\x1b[30m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    white: "\x1b[37m",
    gray: "\x1b[90m",
    brightRed: "\x1b[91m",
    brightGreen: "\x1b[92m",
    brightYellow: "\x1b[93m",
    brightBlue: "\x1b[94m",
    brightMagenta: "\x1b[95m",
    brightCyan: "\x1b[96m",
    brightWhite: "\x1b[97m",
    // Backgrounds
    bgBlack: "\x1b[40m",
    bgRed: "\x1b[41m",
    bgGreen: "\x1b[42m",
    bgYellow: "\x1b[43m",
    bgBlue: "\x1b[44m",
    bgMagenta: "\x1b[45m",
    bgCyan: "\x1b[46m",
    bgWhite: "\x1b[47m",
    bgGray: "\x1b[100m",
    bgBrightBlue: "\x1b[104m",
};
function move(row, col) {
    return `${ESC}${row};${col}H`;
}
function clearScreen() {
    return `${ESC}2J${ESC}H`;
}
function hideCursor() {
    return `${ESC}?25l`;
}
function showCursor() {
    return `${ESC}?25h`;
}
// ─── RENDERING ───────────────────────────────────────────────────────────────
function getTermSize() {
    return {
        cols: process.stdout.columns ?? 120,
        rows: process.stdout.rows ?? 40,
    };
}
function pad(str, len, char = " ") {
    const visible = stripAnsi(str);
    const needed = len - visible.length;
    if (needed <= 0)
        return str;
    return str + char.repeat(needed);
}
function truncate(str, maxLen) {
    if (str.length <= maxLen)
        return str;
    return str.slice(0, maxLen - 1) + "…";
}
function stripAnsi(str) {
    return str.replace(/\x1b\[[0-9;]*[mGKHJABCDsuhl?]/g, "");
}
function stabilityBar(score, width = 10) {
    const filled = Math.round((score / 100) * width);
    const empty = width - filled;
    const color = score >= 80 ? A.brightGreen : score >= 50 ? A.yellow : A.brightRed;
    return color + "█".repeat(filled) + A.dim + "░".repeat(empty) + A.reset;
}
function computeStabilityScore(hist) {
    if (!hist || hist.entries.length <= 1)
        return 100;
    const breaking = hist.entries.reduce((acc, e) => acc + e.changes.filter((c) => c.impact === "BREAKING").length, 0);
    const total = hist.entries.reduce((acc, e) => acc + e.changes.length, 0);
    return Math.max(0, Math.round(100 - breaking * 20 - Math.min(total * 3, 40)));
}
// ─── RENDER FUNCTIONS ─────────────────────────────────────────────────────────
function renderHeader(state, cols) {
    const title = `${A.bold}${A.brightCyan}◈ apidrift${A.reset}`;
    const subtitle = `${A.dim}API Drift Dashboard${A.reset}`;
    const refreshed = `${A.gray}↻ ${state.lastRefresh.toLocaleTimeString()}${A.reset}`;
    const tabs = [
        { id: "overview", label: "Overview" },
        { id: "timeline", label: "Timeline" },
        { id: "contracts", label: "Contracts" },
        { id: "help", label: "Help" },
    ];
    const tabStr = tabs
        .map(({ id, label }) => {
        if (state.tab === id) {
            return `${A.bold}${A.bgBrightBlue}${A.white} ${label} ${A.reset}`;
        }
        return `${A.dim} ${label} ${A.reset}`;
    })
        .join(`${A.gray}│${A.reset}`);
    const line1 = `  ${title}  ${subtitle}${" ".repeat(Math.max(0, cols - 30))}${refreshed}`;
    const line2 = `  ${tabStr}`;
    const divider = `${A.dim}${"─".repeat(cols)}${A.reset}`;
    return [line1, line2, divider].join("\n");
}
function renderOverview(state, cols, rows) {
    const { snapshots, historyStore } = state;
    const lines = [];
    if (snapshots.length === 0) {
        lines.push("");
        lines.push(`  ${A.dim}No endpoints tracked yet.${A.reset}`);
        lines.push("");
        lines.push(`  ${A.cyan}To start:${A.reset}`);
        lines.push(`  ${A.gray}  import "apidrift/register"${A.reset}`);
        lines.push(`  ${A.gray}  then make some API calls.${A.reset}`);
        return lines.join("\n");
    }
    // Summary bar
    const totalEndpoints = snapshots.length;
    const totalBreaking = historyStore.history
        ? Object.values(historyStore.history).reduce((acc, h) => acc +
            h.entries.reduce((a, e) => a + e.changes.filter((c) => c.impact === "BREAKING").length, 0), 0)
        : 0;
    const hasContract = Object.keys(state.contractStore.contracts).length;
    lines.push("");
    lines.push(`  ${A.bold}${totalEndpoints}${A.reset}${A.gray} endpoints  ${A.reset}` +
        `${A.bold}${A.brightRed}${totalBreaking}${A.reset}${A.gray} breaking changes  ${A.reset}` +
        `${A.bold}${A.cyan}${hasContract}${A.reset}${A.gray} contracts locked${A.reset}`);
    lines.push("");
    // Table header
    const COL_ENDPOINT = Math.min(45, Math.floor(cols * 0.35));
    const COL_STABILITY = 14;
    const COL_CHANGES = 10;
    const COL_FIELDS = 8;
    const COL_LAST = 22;
    const header = `  ${A.bold}${A.underline}${A.gray}` +
        pad("ENDPOINT", COL_ENDPOINT) +
        "  " +
        pad("STABILITY", COL_STABILITY) +
        "  " +
        pad("CHANGES", COL_CHANGES) +
        "  " +
        pad("FIELDS", COL_FIELDS) +
        "  " +
        pad("LAST SEEN", COL_LAST) +
        A.reset;
    lines.push(header);
    lines.push(`  ${A.dim}${"─".repeat(cols - 4)}${A.reset}`);
    const visibleRows = rows - 12;
    const start = Math.max(0, Math.min(state.scrollOffset, snapshots.length - visibleRows));
    const visible = snapshots.slice(start, start + visibleRows);
    visible.forEach((snap, i) => {
        const idx = start + i;
        const isSelected = idx === state.selectedEndpoint;
        const hist = historyStore.history?.[snap.endpoint];
        const score = computeStabilityScore(hist);
        const totalChanges = hist?.entries.reduce((a, e) => a + e.changes.length, 0) ?? 0;
        const fieldCount = Object.keys(snap.schema).length;
        const lastSeen = new Date(snap.capturedAt).toLocaleString("en", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
        const endpointStr = truncate(snap.endpoint.replace(/^https?:\/\/[^/]+/, "") || snap.endpoint, COL_ENDPOINT);
        const bar = stabilityBar(score, 8);
        const scoreStr = `${score >= 80 ? A.brightGreen : score >= 50 ? A.yellow : A.brightRed}${String(score).padStart(3)}%${A.reset}`;
        const changesStr = totalChanges === 0
            ? `${A.dim}   none${A.reset}`
            : `${A.yellow}${String(totalChanges).padStart(6)}${A.reset}`;
        const bg = isSelected ? `${A.bgGray}` : "";
        const reset = isSelected ? A.reset : "";
        const cursor = isSelected ? `${A.brightCyan}▶${A.reset} ` : "  ";
        const row = `${cursor}${bg}` +
            pad(`${isSelected ? A.brightWhite : A.white}${endpointStr}${A.reset}`, COL_ENDPOINT + 10) +
            "  " +
            `${bar} ${scoreStr}   ` +
            pad(changesStr, COL_CHANGES + 10) +
            "  " +
            pad(`${A.gray}${fieldCount}${A.reset}`, COL_FIELDS + 8) +
            "  " +
            `${A.dim}${lastSeen}${A.reset}` +
            `${reset}`;
        lines.push(row);
    });
    // Scroll indicator
    if (snapshots.length > visibleRows) {
        const pct = Math.round((start / (snapshots.length - visibleRows)) * 100);
        lines.push(`  ${A.dim}  ↑↓ scroll  (${pct}%)  [${start + 1}–${start + visible.length} of ${snapshots.length}]${A.reset}`);
    }
    return lines.join("\n");
}
function renderTimeline(state, cols) {
    const lines = [];
    const snap = state.snapshots[state.selectedEndpoint];
    if (!snap) {
        lines.push(`\n  ${A.dim}No endpoint selected. Press ↑↓ in Overview tab.${A.reset}`);
        return lines.join("\n");
    }
    const hist = state.historyStore.history?.[snap.endpoint];
    lines.push("");
    lines.push(`  ${A.bold}${A.brightCyan}${snap.endpoint}${A.reset}`);
    lines.push("");
    if (!hist || hist.entries.length <= 1) {
        lines.push(`  ${A.dim}No history yet — this endpoint has been stable.${A.reset}`);
        lines.push(`  ${A.gray}Changes will appear here as the API evolves.${A.reset}`);
        return lines.join("\n");
    }
    lines.push(`  ${A.gray}${hist.entries.length} snapshots tracked${A.reset}`);
    lines.push("");
    // Timeline visualization
    hist.entries.slice(-15).forEach((entry, i) => {
        const date = new Date(entry.timestamp).toLocaleString("en", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
        const isFirst = i === 0;
        const hasBreaking = entry.changes.some((c) => c.impact === "BREAKING");
        const hasChanges = entry.changes.length > 0;
        const dot = isFirst
            ? `${A.dim}◎${A.reset}`
            : hasBreaking
                ? `${A.brightRed}◉${A.reset}`
                : hasChanges
                    ? `${A.yellow}◉${A.reset}`
                    : `${A.green}◎${A.reset}`;
        const pipe = isFirst ? " " : `${A.dim}│${A.reset}`;
        const label = isFirst
            ? `${A.dim}baseline${A.reset}`
            : hasBreaking
                ? `${A.brightRed}${A.bold}BREAKING${A.reset}`
                : hasChanges
                    ? `${A.yellow}changed${A.reset}`
                    : `${A.dim}stable${A.reset}`;
        lines.push(`  ${pipe}`);
        lines.push(`  ${dot}  ${A.gray}${date}${A.reset}  ${label}`);
        if (entry.changes.length > 0) {
            entry.changes.slice(0, 3).forEach((change) => {
                const icon = change.impact === "BREAKING" ? `${A.red}-` : `${A.green}+`;
                lines.push(`  │    ${icon} ${A.dim}${truncate(change.description, cols - 12)}${A.reset}`);
            });
            if (entry.changes.length > 3) {
                lines.push(`  │    ${A.dim}  … ${entry.changes.length - 3} more${A.reset}`);
            }
        }
    });
    lines.push(`  ${A.dim}│${A.reset}`);
    lines.push(`  ${A.brightCyan}◈${A.reset}  ${A.dim}now${A.reset}`);
    return lines.join("\n");
}
function renderContracts(state, cols) {
    const lines = [];
    const { contracts } = state.contractStore;
    const endpoints = Object.keys(contracts);
    lines.push("");
    lines.push(`  ${A.bold}Contract Enforcement${A.reset}  ${A.dim}Lock schemas to catch any deviation${A.reset}`);
    lines.push("");
    if (endpoints.length === 0) {
        lines.push(`  ${A.dim}No contracts locked yet.${A.reset}`);
        lines.push("");
        lines.push(`  ${A.gray}Lock a contract:${A.reset}`);
        lines.push(`  ${A.cyan}  apidrift lock <endpoint-url>${A.reset}`);
        lines.push("");
        lines.push(`  ${A.dim}Once locked, any deviation from the expected schema${A.reset}`);
        lines.push(`  ${A.dim}will trigger an alert — even non-breaking changes.${A.reset}`);
        return lines.join("\n");
    }
    endpoints.forEach((endpoint) => {
        const contract = contracts[endpoint];
        const fieldCount = Object.keys(contract).length;
        lines.push(`  ${A.brightCyan}●${A.reset}  ${A.bold}${truncate(endpoint, cols - 20)}${A.reset}`);
        lines.push(`     ${A.gray}${fieldCount} fields locked${A.reset}`);
        lines.push("");
    });
    lines.push(`  ${A.dim}${"─".repeat(cols - 4)}${A.reset}`);
    lines.push(`  ${A.gray}  apidrift lock <url>     — lock current schema as contract${A.reset}`);
    lines.push(`  ${A.gray}  apidrift unlock <url>   — remove contract${A.reset}`);
    return lines.join("\n");
}
function renderHelp(_cols) {
    const lines = [];
    const section = (title) => `\n  ${A.bold}${A.brightCyan}${title}${A.reset}`;
    const cmd = (key, desc) => `  ${A.bold}${A.yellow}${pad(key, 18)}${A.reset}  ${A.dim}${desc}${A.reset}`;
    lines.push(section("Navigation"));
    lines.push(cmd("Tab / 1–4", "Switch tabs"));
    lines.push(cmd("↑ ↓", "Select / scroll endpoints"));
    lines.push(cmd("r", "Refresh data"));
    lines.push(cmd("q / Ctrl+C", "Quit"));
    lines.push(section("CLI Commands"));
    lines.push(cmd("apidrift init", "Initialize in current project"));
    lines.push(cmd("apidrift list", "List all tracked endpoints"));
    lines.push(cmd("apidrift diff <url>", "Fetch and diff a URL"));
    lines.push(cmd("apidrift check", "CI mode — exit 1 on breaking drift"));
    lines.push(cmd("apidrift types [out]", "Generate TypeScript types"));
    lines.push(cmd("apidrift lock <url>", "Lock schema as contract"));
    lines.push(cmd("apidrift compare a.json b.json", "Compare two JSON files"));
    lines.push(cmd("apidrift clear [url]", "Clear snapshot(s)"));
    lines.push(cmd("apidrift dashboard", "Open this dashboard"));
    lines.push(section("Environment Variables"));
    lines.push(cmd("APIDRIFT_SILENT=1", "Suppress all console output"));
    lines.push(cmd("APIDRIFT_VERBOSE=1", "Enable verbose logging"));
    lines.push(cmd("APIDRIFT_CI=1", "Exit on breaking drift (CI mode)"));
    lines.push(cmd("APIDRIFT_FILTER=<str>", "Only track URLs containing string"));
    lines.push(section("Integration"));
    lines.push(`  ${A.gray}  import "apidrift/register"${A.reset}           ${A.dim}auto-patch fetch${A.reset}`);
    lines.push(`  ${A.gray}  import { patchAxios } from "apidrift"${A.reset}  ${A.dim}patch axios instance${A.reset}`);
    lines.push(`  ${A.gray}  import { track } from "apidrift"${A.reset}       ${A.dim}manual tracking${A.reset}`);
    lines.push("");
    return lines.join("\n");
}
function renderFooter(state, cols) {
    const keys = `${A.bgGray}${A.white} Tab ${A.reset}${A.dim} switch  ${A.reset}` +
        `${A.bgGray}${A.white} ↑↓ ${A.reset}${A.dim} navigate  ${A.reset}` +
        `${A.bgGray}${A.white} r ${A.reset}${A.dim} refresh  ${A.reset}` +
        `${A.bgGray}${A.white} q ${A.reset}${A.dim} quit  ${A.reset}`;
    const version = `${A.dim}apidrift v1.0.0${A.reset}`;
    const right = `${A.dim}${state.snapshots.length} endpoints  ·  tick ${state.tick}${A.reset}  ${version}`;
    const divider = `${A.dim}${"─".repeat(cols)}${A.reset}`;
    const footer = `  ${keys}${" ".repeat(Math.max(0, cols - stripAnsi(keys).length - stripAnsi(right).length - 4))}${right}`;
    return divider + "\n" + footer;
}
// ─── DASHBOARD LOOP ───────────────────────────────────────────────────────────
function loadState() {
    return {
        tab: "overview",
        selectedEndpoint: 0,
        snapshots: listSnapshots(),
        historyStore: getAllHistory(),
        contractStore: loadContracts(),
        tick: 0,
        lastRefresh: new Date(),
        scrollOffset: 0,
    };
}
export async function runDashboard() {
    if (!process.stdout.isTTY) {
        console.error("apidrift dashboard requires a TTY terminal.");
        process.exit(1);
    }
    let state = loadState();
    const { stdin } = process;
    // Raw mode for key handling
    if (stdin.setRawMode)
        stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf-8");
    const write = (s) => {
        process.stdout.write(s);
    };
    function render() {
        const { cols, rows } = getTermSize();
        const buf = [];
        buf.push(clearScreen());
        buf.push(hideCursor());
        buf.push(move(1, 1));
        buf.push(renderHeader(state, cols));
        buf.push("\n");
        switch (state.tab) {
            case "overview":
                buf.push(renderOverview(state, cols, rows));
                break;
            case "timeline":
                buf.push(renderTimeline(state, cols));
                break;
            case "contracts":
                buf.push(renderContracts(state, cols));
                break;
            case "help":
                buf.push(renderHelp(cols));
                break;
        }
        // Push footer to bottom
        const content = buf.join("");
        const contentLines = content.split("\n").length;
        const padding = Math.max(0, rows - contentLines - 3);
        buf.push("\n".repeat(padding));
        buf.push(renderFooter(state, cols));
        write(buf.join(""));
    }
    function refresh() {
        state = {
            ...loadState(),
            tab: state.tab,
            selectedEndpoint: state.selectedEndpoint,
            scrollOffset: state.scrollOffset,
            tick: state.tick + 1,
        };
        render();
    }
    function cleanup() {
        write(showCursor());
        write(clearScreen());
        if (stdin.setRawMode)
            stdin.setRawMode(false);
        stdin.pause();
        console.log("\nBye! 👋\n");
        process.exit(0);
    }
    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);
    // Key handling
    stdin.on("data", (key) => {
        const UP = "\x1b[A";
        const DOWN = "\x1b[B";
        if (key === "q" || key === "\x03") {
            cleanup();
            return;
        }
        if (key === "\t" || key === "\x09") {
            const tabs = ["overview", "timeline", "contracts", "help"];
            const idx = tabs.indexOf(state.tab);
            state.tab = tabs[(idx + 1) % tabs.length];
        }
        if (key === "1")
            state.tab = "overview";
        if (key === "2")
            state.tab = "timeline";
        if (key === "3")
            state.tab = "contracts";
        if (key === "4")
            state.tab = "help";
        if (key === "r") {
            refresh();
            return;
        }
        const snapCount = state.snapshots.length;
        if (key === UP) {
            state.selectedEndpoint = Math.max(0, state.selectedEndpoint - 1);
            if (state.selectedEndpoint < state.scrollOffset) {
                state.scrollOffset = state.selectedEndpoint;
            }
        }
        if (key === DOWN) {
            state.selectedEndpoint = Math.min(snapCount - 1, state.selectedEndpoint + 1);
            const { rows } = getTermSize();
            const visible = rows - 12;
            if (state.selectedEndpoint >= state.scrollOffset + visible) {
                state.scrollOffset = state.selectedEndpoint - visible + 1;
            }
        }
        render();
    });
    // Auto-refresh every 5 seconds
    const timer = setInterval(refresh, 5000);
    timer.unref();
    // Handle resize
    process.stdout.on("resize", render);
    // Initial render
    render();
    // Keep process alive
    await new Promise(() => {
        /* runs until cleanup() */
    });
}
//# sourceMappingURL=dashboard.js.map