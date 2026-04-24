# Changelog

All notable changes to apidrift are documented here.

## [1.0.0] — Initial release

### Core engine
- Zero-config schema extraction from any JSON response
- Deep recursive differ with path-accurate change detection
- Breaking / non-breaking / info impact classification
- `track(url, body)` — the one function you actually call

### Interceptors
- `import "apidrift/register"` — auto-patches global `fetch`, that's all it takes
- `patchAxios(instance)` — attaches to any axios instance or the default export

### CLI — 13 commands
- `init` — initializes `.apidrift/` and updates `.gitignore`
- `list` — shows all tracked endpoints with stability and last-seen
- `diff <url>` — fetches live and diffs against stored snapshot
- `watch <url>` — polls with configurable interval, reports drift in real-time
- `history [url]` — shows the full schema evolution timeline for an endpoint
- `inspect <url>` — deep view of schema, stats, contract status
- `compare <f1> <f2>` — diffs two local JSON files (exits 1 on breaking)
- `types [output]` — generates TypeScript interfaces from real response shapes
- `lock <url>` — pins the current schema as an enforced contract
- `contracts` — lists all locked contracts
- `check` — CI mode, exits 1 if breaking drift is in history
- `clear [url]` — removes snapshots and history
- `dashboard` — interactive terminal UI (4 tabs, keyboard nav, auto-refresh)

### Advanced features
- **History timeline** — every schema version ever seen, stored efficiently via Welford checksum deduplication
- **Contract enforcement** — lock schemas, get violations in console and programmatic callbacks
- **Data drift detection** — statistical value-level monitoring using Welford's online algorithm; detects spikes, drops, mean shifts, and range violations in numeric fields
- **TypeScript type generation** — generates accurate interfaces from real response data
- **Terminal dashboard** — full TUI with overview, timeline, contracts, and help tabs

### Plugins
- `apidrift/react` — `useApiDrift<T>(url)` hook and `withDriftTracking()` HOF
- `apidrift/express` — `apiDriftMiddleware()` and `trackRoute()` for Express servers
- `generate-middleware fastapi` — generates a FastAPI `BaseHTTPMiddleware` subclass
- `generate-middleware django` — generates a Django middleware class

### Storage
- `.apidrift/snapshots.json` — current schema baselines
- `.apidrift/history.json` — full timeline, capped at 100 entries per endpoint
- `.apidrift/datadrift.json` — numeric baselines using streaming statistics
- `apidrift.contract.json` — locked contracts (commit this one)

### Environment variables
- `APIDRIFT_SILENT=1` — suppress all output
- `APIDRIFT_VERBOSE=1` — log no-drift responses too
- `APIDRIFT_FILTER=<str>` — only track URLs containing this string
- `APIDRIFT_CI=1` — exit process immediately on first breaking drift
