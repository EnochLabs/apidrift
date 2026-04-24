import { DriftResult, DriftChange, ChangeImpact } from "./diff.js";

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

function impactIcon(impact: ChangeImpact): string {
  switch (impact) {
    case "BREAKING":
      return `${c.red}✖ BREAKING${c.reset}`;
    case "NON_BREAKING":
      return `${c.yellow}△ NON-BREAKING${c.reset}`;
    case "INFO":
      return `${c.cyan}ℹ INFO${c.reset}`;
  }
}

function impactPrefix(impact: ChangeImpact): string {
  switch (impact) {
    case "BREAKING":
      return `${c.red}-${c.reset}`;
    case "NON_BREAKING":
      return `${c.green}+${c.reset}`;
    case "INFO":
      return `${c.cyan}~${c.reset}`;
  }
}

export function reportDrift(result: DriftResult): void {
  if (!result.hasChanges) return;

  console.log("");
  console.log(
    `${c.bold}${result.hasBreaking ? c.red : c.yellow}⚠  API Drift Detected${c.reset}`
  );
  console.log(
    `${c.gray}   Endpoint: ${c.reset}${c.white}${result.endpoint}${c.reset}`
  );
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
  const parts: string[] = [];
  if (breaking.length > 0)
    parts.push(`${c.red}${breaking.length} breaking${c.reset}`);
  if (nonBreaking.length > 0)
    parts.push(`${c.yellow}${nonBreaking.length} non-breaking${c.reset}`);
  if (info.length > 0) parts.push(`${c.cyan}${info.length} info${c.reset}`);

  console.log(`  ${c.dim}Summary: ${parts.join(", ")}${c.reset}`);
  console.log("");
}

function printChange(change: DriftChange): void {
  const prefix = impactPrefix(change.impact);
  const path = `${c.bold}${change.path}${c.reset}`;

  if (change.from && change.to) {
    console.log(
      `    ${prefix} ${path}  ${c.gray}${change.from}${c.reset} → ${c.white}${change.to}${c.reset}`
    );
  } else if (change.from) {
    console.log(
      `    ${prefix} ${path}  ${c.gray}(was: ${change.from})${c.reset}`
    );
  } else if (change.to) {
    console.log(`    ${prefix} ${path}  ${c.dim}(${change.to})${c.reset}`);
  } else {
    console.log(`    ${prefix} ${path}`);
  }
}

export function reportFirstSeen(endpoint: string): void {
  console.log(
    `${c.gray}[apidrift] First seen: ${c.cyan}${endpoint}${c.reset}${c.gray} — snapshot saved${c.reset}`
  );
}

export function reportNoDrift(endpoint: string): void {
  // Silent by default — only log if verbose
  if (process.env.APIDRIFT_VERBOSE) {
    console.log(
      `${c.gray}[apidrift] No drift: ${c.green}${endpoint}${c.reset}`
    );
  }
}

/**
 * Exit-code reporter: for CI/CD use.
 * Returns 1 if any breaking changes exist.
 */
export function ciReport(results: DriftResult[]): number {
  const breaking = results.filter((r) => r.hasBreaking);
  const changed = results.filter((r) => r.hasChanges);

  if (breaking.length > 0) {
    console.log(
      `\n${c.red}${c.bold}❌ Breaking API drift detected in ${breaking.length} endpoint(s):${c.reset}`
    );
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
    console.log(
      `\n${c.yellow}△ Non-breaking API drift in ${changed.length} endpoint(s) — safe to continue.${c.reset}\n`
    );
    return 0;
  }

  console.log(`\n${c.green}✔ No API drift detected.${c.reset}\n`);
  return 0;
}

/**
 * Generate a beautiful, interactive static HTML report.
 */
export async function generateHtmlReport(outputPath: string): Promise<void> {
  const fs = await import('fs');
  const { listSnapshots } = await import('./storage.js');
  const { getAllHistory } = await import('./history.js');
  
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
    <title>apidrift Dashboard</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-50 p-8">
    <h1 class="text-3xl font-bold mb-8">apidrift Dashboard</h1>
    <div class="grid gap-4">
        ${snapshots.map(s => `
            <div class="bg-white p-4 rounded shadow">
                <h2 class="font-bold">${s.endpoint}</h2>
                <p class="text-sm text-gray-500">Last seen: ${new Date(s.capturedAt).toLocaleString()}</p>
            </div>
        `).join('')}
    </div>
    <script>
        console.log("Data:", ${JSON.stringify(data)});
    </script>
</body>
</html>
  `.trim();

  fs.writeFileSync(outputPath, html, 'utf-8');
}
