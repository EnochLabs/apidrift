// ANSI color codes — works in Node.js terminals
const c = {
    reset: "\x1b[0m",
    bold: "\x1b[1m",
    dim: "\x1b[2m",
    red: "\x1b[31m",
    yellow: "\x1b[33m",
    green: "\x1b[32m",
    cyan: "\x1b[36m",
    gray: "\x1b[90m",
    white: "\x1b[97m",
    bgRed: "\x1b[41m",
    bgYellow: "\x1b[43m",
};
function impactIcon(impact) {
    switch (impact) {
        case "BREAKING":
            return `${c.red}✖ BREAKING${c.reset}`;
        case "NON_BREAKING":
            return `${c.yellow}△ NON-BREAKING${c.reset}`;
        case "INFO":
            return `${c.cyan}ℹ INFO${c.reset}`;
    }
}
function impactPrefix(impact) {
    switch (impact) {
        case "BREAKING":
            return `${c.red}-${c.reset}`;
        case "NON_BREAKING":
            return `${c.green}+${c.reset}`;
        case "INFO":
            return `${c.cyan}~${c.reset}`;
    }
}
export function reportDrift(result) {
    if (!result.hasChanges)
        return;
    console.log("");
    console.log(`${c.bold}${result.hasBreaking ? c.red : c.yellow}⚠  API Drift Detected${c.reset}`);
    console.log(`${c.gray}   Endpoint: ${c.reset}${c.white}${result.endpoint}${c.reset}`);
    console.log(`${c.gray}   At:       ${c.reset}${c.dim}${result.timestamp}${c.reset}`);
    console.log("");
    // Group by impact
    const breaking = result.changes.filter((c) => c.impact === "BREAKING");
    const nonBreaking = result.changes.filter((c) => c.impact === "NON_BREAKING");
    const info = result.changes.filter((c) => c.impact === "INFO");
    if (breaking.length > 0) {
        console.log(`  ${c.red}${c.bold}Breaking Changes${c.reset}`);
        for (const change of breaking) {
            printChange(change);
        }
        console.log("");
    }
    if (nonBreaking.length > 0) {
        console.log(`  ${c.yellow}${c.bold}Non-breaking Changes${c.reset}`);
        for (const change of nonBreaking) {
            printChange(change);
        }
        console.log("");
    }
    if (info.length > 0) {
        console.log(`  ${c.cyan}${c.bold}Info${c.reset}`);
        for (const change of info) {
            printChange(change);
        }
        console.log("");
    }
    // Summary line
    const parts = [];
    if (breaking.length > 0)
        parts.push(`${c.red}${breaking.length} breaking${c.reset}`);
    if (nonBreaking.length > 0)
        parts.push(`${c.yellow}${nonBreaking.length} non-breaking${c.reset}`);
    if (info.length > 0)
        parts.push(`${c.cyan}${info.length} info${c.reset}`);
    console.log(`  ${c.dim}Summary: ${parts.join(", ")}${c.reset}`);
    console.log("");
}
function printChange(change) {
    const prefix = impactPrefix(change.impact);
    const path = `${c.bold}${change.path}${c.reset}`;
    if (change.from && change.to) {
        console.log(`    ${prefix} ${path}  ${c.gray}${change.from}${c.reset} → ${c.white}${change.to}${c.reset}`);
    }
    else if (change.from) {
        console.log(`    ${prefix} ${path}  ${c.gray}(was: ${change.from})${c.reset}`);
    }
    else if (change.to) {
        console.log(`    ${prefix} ${path}  ${c.dim}(${change.to})${c.reset}`);
    }
    else {
        console.log(`    ${prefix} ${path}`);
    }
}
export function reportFirstSeen(endpoint) {
    console.log(`${c.gray}[apidrift] First seen: ${c.cyan}${endpoint}${c.reset}${c.gray} — snapshot saved${c.reset}`);
}
export function reportNoDrift(endpoint) {
    // Silent by default — only log if verbose
    if (process.env.APIDRIFT_VERBOSE) {
        console.log(`${c.gray}[apidrift] No drift: ${c.green}${endpoint}${c.reset}`);
    }
}
/**
 * Exit-code reporter: for CI/CD use.
 * Returns 1 if any breaking changes exist.
 */
export function ciReport(results) {
    const breaking = results.filter((r) => r.hasBreaking);
    const changed = results.filter((r) => r.hasChanges);
    if (breaking.length > 0) {
        console.log(`\n${c.red}${c.bold}❌ Breaking API drift detected in ${breaking.length} endpoint(s):${c.reset}`);
        for (const r of breaking) {
            console.log(`   ${c.red}✖${c.reset}  ${r.endpoint}`);
            for (const ch of r.changes.filter((c) => c.impact === "BREAKING")) {
                console.log(`      ${c.gray}${ch.description}${c.reset}`);
            }
        }
        console.log(`\n${c.red}Build failed.${c.reset}\n`);
        return 1;
    }
    if (changed.length > 0) {
        console.log(`\n${c.yellow}△ Non-breaking API drift in ${changed.length} endpoint(s) — safe to continue.${c.reset}\n`);
        return 0;
    }
    console.log(`\n${c.green}✔ No API drift detected.${c.reset}\n`);
    return 0;
}
/**
 * Generate a beautiful, interactive static HTML report.
 */
export async function generateHtmlReport(outputPath) {
    const fs = await import("fs");
    const { listSnapshots } = await import("./storage.js");
    const { getAllHistory } = await import("./history.js");
    const snapshots = listSnapshots();
    const history = getAllHistory();
    const data = {
        snapshots,
        history,
        generatedAt: new Date().toISOString(),
    };
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>apidrift | API Drift Dashboard</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Fira+Code&display=swap');
        body { font-family: 'Inter', sans-serif; }
        pre, code { font-family: 'Fira Code', monospace; }
    </style>
</head>
<body class="bg-gray-50 text-gray-900">
    <div class="max-w-7xl mx-auto px-4 py-8">
        <header class="flex justify-between items-center mb-12">
            <div>
                <h1 class="text-4xl font-extrabold tracking-tight text-cyan-600">apidrift</h1>
                <p class="text-gray-500 mt-2">API Change Intelligence Dashboard</p>
            </div>
            <div class="text-right">
                <div class="text-sm font-medium text-gray-400 uppercase tracking-wider">Report Generated</div>
                <div class="text-lg font-semibold">${new Date(data.generatedAt).toLocaleString()}</div>
            </div>
        </header>

        <main>
            <section class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div class="text-sm font-medium text-gray-400 uppercase mb-1">Tracked Endpoints</div>
                    <div class="text-3xl font-bold text-gray-800">${snapshots.length}</div>
                </div>
                <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div class="text-sm font-medium text-gray-400 uppercase mb-1">Total Drift Events</div>
                    <div class="text-3xl font-bold text-gray-800">${Object.values(history.history).reduce((acc, h) => acc + Math.max(0, h.entries.length - 1), 0)}</div>
                </div>
                <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div class="text-sm font-medium text-gray-400 uppercase mb-1">Breaking Changes</div>
                    <div class="text-3xl font-bold text-red-500">${Object.values(history.history).reduce((acc, h) => acc + h.entries.reduce((a, e) => a + e.changes.filter((c) => c.impact === "BREAKING").length, 0), 0)}</div>
                </div>
                <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div class="text-sm font-medium text-gray-400 uppercase mb-1">Avg Latency</div>
                    <div class="text-3xl font-bold text-cyan-600">${(snapshots.reduce((acc, s) => acc + (s.avgLatency || 0), 0) / (snapshots.filter((s) => s.avgLatency).length || 1)).toFixed(1)}ms</div>
                </div>
            </section>

            <div class="mb-8">
                <input type="text" id="endpointSearch" onkeyup="filterEndpoints()" placeholder="Search endpoints..." class="w-full p-4 rounded-xl border border-gray-200 shadow-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none">
            </div>

            <section class="space-y-8" id="endpointList">
                <h2 class="text-2xl font-bold text-gray-800">Endpoints</h2>
                ${snapshots
        .map((s, idx) => {
        const h = history.history[s.endpoint] || { entries: [] };
        const breakingCount = h.entries.reduce((a, e) => a + e.changes.filter((c) => c.impact === "BREAKING").length, 0);
        const stabilityScore = Math.max(0, 100 - (h.entries.length - 1) * 5 - breakingCount * 15);
        return `
                    <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden endpoint-card" data-endpoint="${s.endpoint}">
                        <div class="p-6 border-b border-gray-50 flex justify-between items-start">
                            <div class="flex-1 min-w-0">
                                <h3 class="text-lg font-bold text-cyan-600 truncate mb-1" title="${s.endpoint}">${s.endpoint}</h3>
                                <div class="flex items-center space-x-4 text-sm text-gray-500">
                                    <span>${Object.keys(s.schema).length} fields</span>
                                    <span>${s.responseCount} responses</span>
                                    <span>${s.avgLatency ? s.avgLatency.toFixed(1) + "ms avg" : "N/A latency"}</span>
                                    <span>Last seen ${new Date(s.capturedAt).toLocaleDateString()}</span>
                                </div>
                            </div>
                            <div class="ml-4 flex items-center space-x-4">
                                <div class="text-right">
                                    <div class="text-xs font-medium text-gray-400 uppercase">Stability</div>
                                    <div class="text-lg font-bold ${stabilityScore > 80 ? "text-green-500" : stabilityScore > 50 ? "text-yellow-500" : "text-red-500"}">${stabilityScore}%</div>
                                </div>
                                <button onclick="toggleDetails('details-${idx}')" class="px-4 py-2 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-lg text-sm font-semibold transition-colors">Details</button>
                            </div>
                        </div>
                        
                        <div id="details-${idx}" class="hidden p-6 bg-gray-50 border-t border-gray-100">
                            <div class="grid grid-cols-1 lg:grid-cols-4 gap-8">
                                <div>
                                    <h4 class="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Current Schema</h4>
                                    <div class="bg-white rounded-lg border border-gray-200 overflow-hidden">
                                        <div class="max-h-80 overflow-y-auto p-4 text-xs font-mono">
                                            ${Object.entries(s.schema)
            .map(([field, node]) => {
            const opt = node.optional
                ? '<span class="text-gray-400">?</span>'
                : "";
            const nullable = node.nullable
                ? '<span class="text-gray-400"> | null</span>'
                : "";
            const sensitive = node.sensitive
                ? ' <span class="bg-red-100 text-red-600 px-1 rounded text-[10px] font-bold">SENSITIVE</span>'
                : "";
            let typeStr = `<span class="text-yellow-600">${node.type}</span>`;
            if (node.enum)
                typeStr = `<span class="text-purple-600">enum(${node.enum.join("|")})</span>`;
            else if (node.type === "array" && node.items)
                typeStr = `<span class="text-yellow-600">${node.items.type}[]</span>`;
            return `<div class="mb-1"><span class="text-cyan-700 font-bold">${field}</span>${opt}: ${typeStr}${nullable}${sensitive}</div>`;
        })
            .join("")}
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <h4 class="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Schema Evolution</h4>
                                    <canvas id="chart-${idx}" class="w-full h-48"></canvas>
                                </div>
                                <div>
                                    <h4 class="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Latency (ms)</h4>
                                    <canvas id="latency-chart-${idx}" class="w-full h-48"></canvas>
                                </div>
                                <div>
                                    <h4 class="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Change History</h4>
                                    <div class="space-y-4 max-h-80 overflow-y-auto pr-2">
                                        ${h.entries
            .slice()
            .reverse()
            .map((e, vIdx) => {
            const vNum = h.entries.length - vIdx;
            return `
                                            <div class="relative pl-6 pb-2 border-l-2 ${e.changes.some((c) => c.impact === "BREAKING") ? "border-red-200" : "border-gray-200"}">
                                                <div class="absolute left-[-9px] top-0 w-4 h-4 rounded-full ${e.changes.some((c) => c.impact === "BREAKING") ? "bg-red-400" : "bg-gray-300"} border-2 border-white"></div>
                                                <div class="flex justify-between items-baseline mb-1">
                                                    <span class="font-bold text-sm">Version ${vNum}</span>
                                                    <span class="text-xs text-gray-400">${new Date(e.timestamp).toLocaleString()}</span>
                                                </div>
                                                ${e.changes.length === 0 ? '<p class="text-xs text-gray-400 italic">Initial baseline captured</p>' : ""}
                                                <ul class="space-y-1">
                                                    ${e.changes
                .map((c) => `
                                                        <li class="text-xs flex items-start">
                                                            <span class="mr-2 ${c.impact === "BREAKING" ? "text-red-500" : "text-yellow-500"} font-bold">${c.impact === "BREAKING" ? "✖" : "△"}</span>
                                                            <span class="text-gray-600">
                                                                <code class="bg-gray-100 px-1 rounded">${c.path}</code>: ${c.description}
                                                            </span>
                                                        </li>
                                                    `)
                .join("")}
                                                </ul>
                                            </div>
                                            `;
        })
            .join("")}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    `;
    })
        .join("")}
            </section>
        </main>
        
        <footer class="mt-16 pt-8 border-t border-gray-200 text-center text-gray-400 text-sm">
            Powered by <span class="font-bold text-cyan-600">apidrift</span> &middot; Zero-Config API Intelligence
        </footer>
    </div>

    <script>
        const appData = ${JSON.stringify(data)};

        function filterEndpoints() {
            const query = document.getElementById('endpointSearch').value.toLowerCase();
            const cards = document.querySelectorAll('.endpoint-card');
            cards.forEach(card => {
                const endpoint = card.getAttribute('data-endpoint').toLowerCase();
                if (endpoint.includes(query)) {
                    card.style.display = 'block';
                } else {
                    card.style.display = 'none';
                }
            });
        }

        function toggleDetails(id) {
            const el = document.getElementById(id);
            el.classList.toggle('hidden');
            if (!el.classList.contains('hidden')) {
                const idx = id.split('-')[1];
                renderChart(idx);
                renderLatencyChart(idx);
            }
        }

        function renderChart(idx) {
            const canvasId = 'chart-' + idx;
            const ctx = document.getElementById(canvasId).getContext('2d');
            const h = appData.history.history[appData.snapshots[idx].endpoint];
            
            if (window['chart_obj_' + idx] || !h) return;

            window['chart_obj_' + idx] = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: h.entries.map((_, i) => 'v' + (i + 1)),
                    datasets: [{
                        label: 'Field Count',
                        data: h.entries.map(e => Object.keys(e.schema).length),
                        borderColor: '#0891b2',
                        backgroundColor: '#0891b222',
                        tension: 0.3,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true, ticks: { stepSize: 1 } },
                        x: { grid: { display: false } }
                    }
                }
            });
        }

        function renderLatencyChart(idx) {
            const canvasId = 'latency-chart-' + idx;
            const ctx = document.getElementById(canvasId).getContext('2d');
            const snap = appData.snapshots[idx];

            if (window['latency_chart_obj_' + idx] || !snap.latencyHistory) return;

            window['latency_chart_obj_' + idx] = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: snap.latencyHistory.map((_, i) => i + 1),
                    datasets: [{
                        label: 'Latency',
                        data: snap.latencyHistory,
                        borderColor: '#10b981',
                        backgroundColor: '#10b98122',
                        tension: 0.3,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true },
                        x: { display: false }
                    }
                }
            });
        }
    </script>
</body>
</html>
  `.trim();
    fs.writeFileSync(outputPath, html, "utf-8");
}
//# sourceMappingURL=reporter.js.map