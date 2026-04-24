# apidrift

**Catches API changes the moment they happen — not after your users do.**

```
⚠  API Drift Detected
   Endpoint: https://api.example.com/users

  Breaking Changes
  - user.name        string   → REMOVED
  ~ user.age         number   → string

  Non-breaking Changes
  + user.full_name            (string)

  Summary: 2 breaking, 1 non-breaking
```

Zero config. No server. No account. Works with `fetch`, axios, Express, React, FastAPI, Django.

---

## Install

```bash
npm install apidrift
# yarn add apidrift
# pnpm add apidrift
```

---

## The 30-second version

```ts
import 'apidrift/register'
// Done. Every fetch() call is now tracked.
// Changes appear in your console immediately.
```

Or, if you prefer explicit:

```ts
import { track } from 'apidrift'

const body = await fetch('/api/user').then(r => r.json())
track('/api/user', body)
```

---

## What it actually does

Most API tooling is about the code you write, OpenAPI specs, generated clients, validators.
apidrift watches the traffic at runtime and tells you when reality diverges from expectations.

It sits between your app and its APIs. For every response, it extracts a lightweight schema
(field names and types and never values), compares it against the last known shape, and reports
any differences, classified by impact.

```
Your app  →  fetch('/api/user')  →  API
                    ↑
              apidrift sees the response
              compares against last snapshot
              reports if anything changed
```

No code generation. No decorators. No `.yml` files. It learns the shape from real traffic.

---

## Quickstart

```bash
npx apidrift init
```

Then add one import to your app entry point:

```ts
import 'apidrift/register'
```

That's it. apidrift will start reporting in your console as your app makes API calls.

---

## CLI

```bash
apidrift init                              # set up .apidrift/ in your project
apidrift list                              # all tracked endpoints, stability scores
apidrift watch https://api.example.com/u  # poll + diff in real-time
apidrift diff  https://api.example.com/u  # one-shot fetch and diff
apidrift history https://api.example.com  # full timeline of how the endpoint evolved
apidrift inspect https://api.example.com  # schema, stats, contract status
apidrift types src/types/api.ts           # generate TypeScript interfaces from real data
apidrift lock https://api.example.com/u   # lock schema as an enforced contract
apidrift contracts                        # list locked contracts
apidrift compare old.json new.json        # diff two local JSON files
apidrift check                            # CI mode which exits 1 on breaking drift
apidrift clear                            # reset all snapshots
apidrift dashboard                        # interactive terminal UI
apidrift export                           # export schemas as JSON Schema or OpenAPI
apidrift replay <url> <v1> <v2>           # diff two historical versions
apidrift stats                            # stability scores and drift frequency
apidrift report                           # generate interactive HTML report
apidrift ci-gen                           # generate GitHub Actions workflow
apidrift generate-middleware <fw>         # generate FastAPI/Django middleware
```

---

## Integrations

### fetch (auto-patch)

```ts
import 'apidrift/register'
// Every fetch() call in your app is now tracked.
```

### Axios

```ts
import axios from 'axios'
import { patchAxios } from 'apidrift'

patchAxios(axios)                     // patches the default instance
patchAxios(axios.create({ ... }))     // or any custom instance
```

### React

```ts
import { useApiDrift } from 'apidrift/react'

function UserProfile() {
  const { data, loading, drift, hasBreaking } = useApiDrift<User>('/api/user')

  if (hasBreaking) {
    console.warn('Breaking API drift:', drift?.changes)
  }

  return loading ? <Spinner /> : <div>{data?.name}</div>
}
```

Or wrap any async fetcher:

```ts
import { withDriftTracking } from 'apidrift/react'

const getUser = withDriftTracking('/api/user', () => api.getUser())
const { data, drift } = await getUser()
```

### Express

```ts
import { apiDriftMiddleware } from 'apidrift/express'

app.use(apiDriftMiddleware())
// Tracks what your server sends out, not just what it receives.
```

Or per-route:

```ts
import { trackRoute } from 'apidrift/express'

app.get('/api/user', trackRoute(async (req, res) => {
  const user = await db.getUser(req.params.id)
  res.json(user)
}))
```

### FastAPI / Django

```bash
apidrift generate-middleware fastapi   # writes apidrift_middleware.py
apidrift generate-middleware django    # writes apidrift_middleware.py
```

The generated file is a standalone Python class, copy it into your project and add one line to
register it. No Python package required. Full instructions are inside the generated file.

---

## TypeScript type generation

apidrift learns the shape of your APIs from real responses and generates accurate types:

```bash
apidrift types src/types/api.generated.ts
```

```ts
// Generated by apidrift — 2024-01-15T12:00:00.000Z
// Do not edit manually — run `apidrift types` to regenerate

export interface Users_Response {
  id: number;
  full_name: string;
  email: string;
  created_at: string;
  role: string | null;
  address: {
    city: string;
    country: string;
  };
}
```

Because types come from real traffic, they're accurate. Not guesses, not stale specs — what the
API is actually returning right now.

---

## Contract enforcement

Lock a schema. Get alerted the moment anything deviates.

```bash
apidrift lock https://api.example.com/users
```

This writes `apidrift.contract.json` — commit it to your repo:

```json
{
  "version": "1.0",
  "contracts": {
    "https://api.example.com/users": {
      "id":    { "type": "number" },
      "name":  { "type": "string" },
      "email": { "type": "string" }
    }
  }
}
```

Now any response that deviates from this contract triggers a violation — independent of whether
the diff engine has a previous snapshot. Useful for third-party APIs you don't control.

---

## Data drift detection

apidrift goes beyond schema structure. When numeric fields shift statistically, it tells you.

```
📊 Data Drift Detected   https://api.ml/predict

  ●  parasite_density: spike detected (+750% from baseline μ=1200.00)
  ◐  confidence_score: value 0.12 outside historical range [0.85, 0.98]
```

This uses Welford's online algorithm to maintain running statistics (mean, variance, min, max)
for every numeric field across all responses. Detection thresholds:

| Condition | Alert kind |
|-----------|------------|
| > 2.5 standard deviations from mean | SPIKE / DROP |
| > 40% change from running mean | MEAN_SHIFT |
| Outside historical min–max envelope | RANGE_EXCEEDED |

Particularly useful for ML inference APIs, financial data feeds, and health metrics.

---

## Drift timeline

```bash
apidrift history https://api.example.com/users
```

```
  Timeline: https://api.example.com/users
  4 versions recorded

  ├─ v1  Jan 15  3 days ago
  │    Initial snapshot · 5 fields

  ├─ v2  Jan 17  1 day ago
  │  △  Field `role` was added (string)

  ├─ v3  Jan 18  6h ago
  │  ✖  Field `name` changed type: string → object

  └─ v4  Jan 18  2h ago
     ✖  Field `name` was removed
     △  Field `full_name` was added (string)
```

Every schema version is stored with its changes. History is deduplicated by schema checksum —
re-sending the same shape never creates a new entry.

---

## CI/CD

```yaml
# .github/workflows/api-check.yml
- name: Check for breaking API drift
  run: npx apidrift check
```

Exits 0 if clean, 1 if breaking drift is in history. Combine with `apidrift watch` in your
staging environment to catch drift before it reaches production.

Or fail the build at runtime the moment drift occurs:

```bash
APIDRIFT_CI=1 node server.js
# Process exits with code 1 on first breaking drift
```

---

## Terminal dashboard

```bash
apidrift dashboard
```

An interactive TUI, no browser, no external process. Four tabs:

- **Overview**:  all endpoints, stability scores, change counts, sparklines
- **Timeline**:  schema evolution history for the selected endpoint
- **Contracts**: locked contracts and their status
- **Help**:      all commands and environment variables

Navigate with arrow keys, switch tabs with Tab or 1–4, quit with `q`.

---

## Programmatic API

```ts
import {
  track,             // (url, body, options?) → DriftResult | null
  compare,           // (endpoint, oldBody, newBody) → DriftResult
  patchFetch,        // (options?) → void
  patchAxios,        // (instance, options?) → void
  listSnapshots,     // () → Snapshot[]
  getSnapshot,       // (endpoint) → Snapshot | null
  clearAllSnapshots, // () → void
  getHistory,        // (endpoint) → EndpointHistory | null
  lockContract,      // (endpoint, schema) → void
  enforceContract,   // (endpoint, schema) → ContractResult
  generateTypesFromSnapshots, // (snapshots) → string
  detectDataDrift,   // (endpoint, values, baseline) → DataDriftResult
} from 'apidrift'
```

### `track(url, body, options?)`

```ts
track('/api/user', body, {
  silent: false,
  endpointKey: '/user',          // override storage key (strips query params by default)
  dataDrift: true,               // enable numeric value tracking (default: true)
  onDrift:    (result) => { },   // called on any schema change
  onBreaking: (result) => { },   // called only for breaking changes
})
```

Returns a `DriftResult` if changes were found, `null` if the schema is unchanged or first-seen.

### `compare(endpoint, oldBody, newBody)`

One-shot comparison — no snapshot store involved:

```ts
const result = compare('/api/user', responseYesterday, responseToday)
if (result.hasBreaking) {
  result.changes.forEach(c => console.log(c.description))
}
```

### `DriftResult`

```ts
interface DriftResult {
  endpoint:    string;
  timestamp:   string;
  hasChanges:  boolean;
  hasBreaking: boolean;
  changes:     DriftChange[];
}

interface DriftChange {
  path:        string;       // dot-path to the changed field, e.g. "user.address.city"
  kind:        'FIELD_REMOVED' | 'FIELD_ADDED' | 'TYPE_CHANGED' | 'NULLABLE_CHANGED' | 'OPTIONAL_CHANGED';
  impact:      'BREAKING' | 'NON_BREAKING' | 'INFO';
  from?:       string;       // previous type
  to?:         string;       // new type
  description: string;       // human-readable summary
}
```

---

## Storage

Everything lives in `.apidrift/` — plain JSON, local only, git-ignored by `apidrift init`:

| File | Contents |
|------|----------|
| `.apidrift/snapshots.json` | Current schema baseline per endpoint |
| `.apidrift/history.json` | Full version timeline (max 100 entries per endpoint) |
| `.apidrift/datadrift.json` | Numeric field statistics (Welford running stats) |
| `apidrift.contract.json` | Locked contracts — **commit this one** |

---

## Privacy

- **No data leaves your machine.** All storage is local.
- **Schemas, not data.** Only field names and types are stored — never field values.
- **Opt-in verbose mode.** By default, only changes are logged.

---

## Environment variables

| Variable | Effect |
|----------|--------|
| `APIDRIFT_SILENT=1` | Suppress all output (snapshots still update) |
| `APIDRIFT_VERBOSE=1` | Log every tracked endpoint including no-drift responses |
| `APIDRIFT_FILTER=<str>` | Only track URLs that contain this string |
| `APIDRIFT_CI=1` | Exit the process with code 1 on first breaking drift |

---

## How drift is classified

| Change | Kind | Impact |
|--------|------|--------|
| Field removed | `FIELD_REMOVED` | 🔴 Breaking |
| Field type changed | `TYPE_CHANGED` | 🔴 Breaking |
| New field added | `FIELD_ADDED` | 🟡 Non-breaking |
| Field became nullable | `NULLABLE_CHANGED` | 🔵 Info |
| Field became optional | `OPTIONAL_CHANGED` | 🔵 Info |

---

## License

MIT
