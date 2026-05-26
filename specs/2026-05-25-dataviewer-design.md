# Dataviewer Design Spec

**Created:** 2026-05-25
**Status:** Approved (post grilling phase)

## Goal

A Chrome-Web-Store-publishable MV3 extension that does always-on network capture across all origins, routes matching traffic through user-installed **analysers** (each: URL regex match + transform DSL chain + optional sandboxed JS escape hatch), and renders the transformed results in a session-scoped side-panel live tail. Analyser configs (single or bundled) are shareable as compressed strings. The viewer is built surface-agnostic so it can pivot from side panel to popup or devtools later without rewriting it.

## Repository

Lives at `/projects/network-data-viewer/` as a standalone GitHub repository (separate from the `life` repo's `wip/dataviewer/` folder, which holds the originating context only). Initially private; flipped to public only after explicit owner approval, after the release checklist passes.

## Scope

### In scope

- Chrome (114+), Manifest V3, Web Store publishable
- Always-on capture of JS-initiated network calls (`fetch`, `XMLHttpRequest`, `navigator.sendBeacon`, `WebSocket`)
- Configurable analysers: URL regex match → DSL transform chain → optional sandboxed-JS transform
- Session-scoped event tail in the side panel (cleared on browser restart)
- Analyser config export/import as compressed string (`dvw:1:<lz-string-json>`)
- Three seed analysers shipped: GA4, ContentSquare, Celebrus
- Surface-agnostic viewer component (the panel UI is portable to popup / devtools)
- Vitest unit tests for pure logic + Playwright E2E with loaded extension

### Out of scope

- Firefox / Edge / Safari ports
- Persistent event history across browser restarts
- Per-tab opt-in capture (we capture globally and tag by tab/origin)
- DevTools panel UI (deferred; viewer architecture keeps door open)
- Modifying / blocking requests (observational only)
- Capture of non-JS-initiated traffic (images, browser-internal, CSS prefetches)
- Custom per-analyser render templates (auto JSON tree only in v1)
- Authentication / signed shared configs
- Cloud sync of analyser configs
- Brotli decompression in DSL (defer until requested)
- Performance/RUM analytics — this is a debugging tool, not telemetry

## Architecture

### Top-level diagram

```
                       PAGE (any origin)
                       │
                       │  fetch / XHR / sendBeacon / WebSocket
                       ▼
                ┌──────────────────────┐
                │ MAIN-world content   │  monkey-patches network APIs
                │ script (per page)    │
                └──────────┬───────────┘
                           │ MessageChannel port (trusted, set up at document_start)
                           ▼
                ┌──────────────────────┐
                │ ISOLATED-world       │  validates, forwards to SW
                │ bridge content       │
                │ script               │
                └──────────┬───────────┘
                           │ chrome.runtime.sendMessage
                           ▼
                ┌──────────────────────┐
                │ Service Worker       │  stateless on wake; reads config
                │ (background)         │  from chrome.storage; runs DSL chain;
                │                      │  forwards to offscreen if sandbox code
                └─────┬────────┬───────┘
                      │        │
                      │        │ chrome.offscreen + postMessage
                      │        ▼
                      │   ┌──────────────────────────────────────────┐
                      │   │ Offscreen Document                       │
                      │   │  ┌──────────┐ ┌──────────┐ ┌──────────┐  │
                      │   │  │ sandbox  │ │ sandbox  │ │ sandbox  │  │
                      │   │  │ iframe A │ │ iframe B │ │ iframe C │  │
                      │   │  └──────────┘ └──────────┘ └──────────┘  │
                      │   │  (one per analyser w/ custom code)       │
                      │   └──────────────────────┬───────────────────┘
                      │                          │ result via offscreen relay
                      │◄─────────────────────────┘
                      │ long-lived port broadcast
                      ▼
                ┌──────────────────────┐
                │ Side Panel (React)   │  renders event live-tail
                │ chrome.sidePanel API │
                └──────────────────────┘
```

### Components

#### 1. MAIN-world content script (`src/content/main-world.ts`)

- Injected at `document_start`, `world: "MAIN"`, `matches: ["<all_urls>"]`
- Monkey-patches: `window.fetch`, `XMLHttpRequest.prototype.send`, `XMLHttpRequest.prototype.open`, `navigator.sendBeacon`, `WebSocket` constructor
- For each intercepted call:
  - Invokes the original API with the same args (page sees normal behaviour)
  - Captures request side (method, URL, headers, body — best effort)
  - Captures response side (status, headers, body — via `.clone()` or wrapped `onreadystatechange`)
- **WebSocket capture model:** because WS is bidirectional with no request/response pairing, we emit one event per `socket.send(data)` (`source: "ws-send"`, `method: ""`, `reqBody = data`, response fields null) and one event per inbound `message` (`source: "ws-recv"`, `method: ""`, `reqBody = null`, `resBody = data`, `resStatus = null`). The URL is the WS endpoint in both cases. Analysers filter via URL pattern as normal; `AnalyserConfig.source` selects `reqBody` vs `resBody` to feed the DSL.
- Forwards captures via `MessageChannel` port (set up via a one-time `CustomEvent` named `__dvw_setup__` at document_start — page JS hasn't run yet, so it can't intercept)
- Patches are idempotent (guards against double-injection)
- Wraps in try/catch — never throws into page code

#### 2. ISOLATED-world bridge (`src/content/bridge.ts`)

- Injected at `document_start`, default ISOLATED world, `matches: ["<all_urls>"]`
- Listens for `__dvw_setup__` `CustomEvent`, captures the `MessagePort`
- Validates incoming messages on the port (schema check)
- Forwards to service worker via `chrome.runtime.sendMessage({type: "captured-event", payload: ...})`
- Has access to `chrome.runtime` (MAIN world does not); this is the only reason for the split

#### 3. Service worker (`src/background/service-worker.ts`)

- Entry: registers `chrome.runtime.onMessage`, `chrome.runtime.onConnect` (for side panel port), `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })`
- On every `captured-event` message:
  1. Wake-up handler: cache hit on `analyserConfigs`? If miss, `await chrome.storage.local.get('analyserConfigs')`, cache on SW instance
  2. Run dispatcher (pure function, `src/background/dispatcher.ts`):
     - For each enabled analyser, match URL regex
     - On match, run DSL chain (pure)
     - If analyser has sandbox code, send `{requestId, analyserId, code, input}` to offscreen manager
     - Wait up to 1000ms for sandbox response (else error)
  3. Broadcast result(s) to all connected side-panel ports
- No event buffering: if no ports connected, results are dropped
- Stateless on cold-start: config re-read from storage; no in-memory event log

#### 4. Offscreen manager (`src/background/offscreen-manager.ts`)

- Spawns a single `chrome.offscreen` document when at least one enabled analyser has sandbox code; closes it when no analysers need it
- Document URL: `/offscreen/offscreen.html`; reason: `DOM_PARSER`
- Maintains a `requestId → resolver` map for in-flight sandbox requests
- Forwards messages to/from the offscreen doc via `chrome.runtime.sendMessage` with a target field

#### 5. Offscreen document (`src/offscreen/offscreen.ts` + `offscreen.html`)

- HTML page with no user-visible UI; lives only to host sandboxed iframes
- Maintains a registry `analyserId → HTMLIFrameElement` (one iframe per analyser with sandbox code)
- On analyser-add message: creates iframe with `src="/sandbox/sandbox.html#<analyserId>"`, awaits ready handshake
- On analyser-remove or code-change: destroys + recreates iframe
- On transform request: `iframe.contentWindow.postMessage({requestId, code, input}, "*")`, awaits response, relays back to SW

#### 6. Sandboxed iframe (`src/sandbox/sandbox.ts` + `sandbox.html`)

- Loaded via manifest `sandbox.pages: ["sandbox/sandbox.html"]` — Chrome enforces CSP isolation; no `chrome.*` APIs, no cookies, no network in this context
- CSP allows `unsafe-eval` (only inside sandbox, per Chrome MV3 sandbox-page rules)
- Receives `{requestId, code, input}` messages
- Executes `new Function('input', code)(input)` — code is the analyser's JS string, evaluated once and cached
- Replies with `{requestId, result}` or `{requestId, error}`
- All errors caught and serialised; never throws to parent

#### 7. Side panel (`src/side-panel/`)

- `index.html` + `index.tsx`: React 18 root, registered as the side panel page via `chrome.sidePanel`
- On mount: `chrome.runtime.connect({ name: "dataviewer-events" })`, listens for incoming events, prepends to in-memory list (capped at 1000 — drop oldest)
- Components (all under `src/side-panel/components/`):
  - `EventList.tsx` — virtualised list of captured events
  - `EventCard.tsx` — per-event row: timestamp, analyser badge, origin, URL, method, expandable payload
  - `JsonTree.tsx` — recursive collapsible JSON viewer with copy-on-click
  - `AnalyserManager.tsx` — toggle, edit, add, delete analysers
  - `ConfigEditor.tsx` — form for editing analyser config: regex input, DSL chain step rows with add/remove, sandbox code in a plain `<textarea>` (no Monaco — kept lightweight for v1)
  - `ImportDialog.tsx` — paste `dvw:1:...` string, parse, install
  - `ExportButton.tsx` — encode + copy to clipboard
- **Surface-agnostic architecture:** `EventList`, `EventCard`, `JsonTree` accept events as props. The side-panel page is just a thin host that wires the port → component tree. To pivot to popup / devtools, swap the host page; reuse the component tree.

#### 8. Storage (`src/background/storage.ts`)

- Wraps `chrome.storage.local` with a typed adapter
- Single key: `analyserConfigs: AnalyserConfig[]`
- Single key: `settings: { theme: "system" | "dark" | "light" }` (defer to v1.1; default dark only per user pref)
- No event storage (session-only, in side-panel memory)

## Data flow

### Captured-event lifecycle (happy path)

1. Page JS calls `fetch("https://example.com/api/event", { method: "POST", body: JSON.stringify({...}) })`
2. MAIN-world monkey-patched `fetch` intercepts:
   - Calls the original `fetch` to start the real request
   - Clones the request body
   - Awaits response, clones via `.clone()` to read body without consuming
   - Builds `CapturedEvent { id, ts, method, url, reqHeaders, reqBody, resStatus, resHeaders, resBody, source: "fetch" }`
   - Posts to MessageChannel port
3. ISOLATED bridge receives port message, validates schema (`zod`), forwards via `chrome.runtime.sendMessage({type: "captured-event", payload})` with `sender.tab` info implicit
4. SW receives, wakes if asleep, runs dispatcher:
   - For each analyser config in cache:
     - `new RegExp(analyser.urlPattern).test(event.url)` — match? continue : skip
     - Run DSL chain (`runDslChain(analyser.dsl, event)` → `dslOutput`)
     - If `analyser.sandboxCode`: `await offscreenManager.runSandbox(analyser.id, analyser.sandboxCode, dslOutput)` (1s timeout)
     - Push `MatchResult { analyserId, raw: event, dslOutput, sandboxOutput?, error?, latencyMs }` to results array
5. SW broadcasts each result to all connected side-panel ports
6. Side panel receives, prepends to `events` state, virtualised list re-renders top item

### Sandbox transform invocation

1. SW calls `offscreenManager.runSandbox(analyserId, code, input)`
2. If offscreen doc not yet open, `await chrome.offscreen.createDocument(...)` and await handshake
3. If iframe for `analyserId` not yet created, send `{type: "create-iframe", analyserId, code}` to offscreen doc; offscreen creates iframe, awaits its ready handshake
4. SW generates `requestId`, sends `{type: "run-transform", analyserId, requestId, input}` to offscreen
5. Offscreen relays to iframe: `iframe.contentWindow.postMessage({requestId, input}, "*")`
6. Sandbox iframe runs `new Function('input', code)(input)`, posts back `{requestId, result}` or `{requestId, error}`
7. Offscreen forwards to SW; SW resolves the pending request
8. If 1000ms elapses with no response, SW resolves with `{ error: "timeout" }`; offscreen marks iframe as suspect and destroys+recreates it

### Side panel open / close

- Open: panel mounts → `chrome.runtime.connect({ name: "dataviewer-events" })` → SW adds port to its connection set → events start flowing
- Close: port `onDisconnect` fires in SW → SW removes from connection set → if no ports remain, future events are still processed (DSL + sandbox) but no broadcast target → results dropped

### Config import / export

- **Export:** `JSON.stringify(analyserConfig)` → `LZString.compressToEncodedURIComponent(json)` → `"dvw:1:" + compressed`
- **Import:** parse prefix → `LZString.decompressFromEncodedURIComponent` → `JSON.parse` → `zod` schema validation → silent install (write to storage, SW reloads cache via `chrome.storage.onChanged`)
- Versioning: unknown prefix version → reject with clear error in side panel

## Interfaces

### Analyser config (TypeScript)

```ts
type AnalyserConfig = {
  id: string;              // UUID v4
  name: string;            // human-readable
  enabled: boolean;
  urlPattern: string;      // JavaScript regex source
  source: "reqBody" | "url" | "resBody";  // initial input for DSL chain (default: reqBody)
  dsl: DslStep[];          // ordered chain
  sandboxCode?: string;    // optional JS body: `(input) => { ... return out; }`
  createdAt: number;       // unix ms
};

type DslStep =
  | { op: "decode-uri" }
  | { op: "decode-base64" }
  | { op: "decode-form" }
  | { op: "gunzip" }
  | { op: "json-parse" }
  | { op: "query-parse" }
  | { op: "jsonpath"; path: string }
  | { op: "pluck"; keys: string[] }
  | { op: "regex-extract"; pattern: string; group?: number }
  | { op: "to-string" };
```

### Captured event

```ts
type CapturedEvent = {
  id: string;
  ts: number;
  source: "fetch" | "xhr" | "beacon" | "ws-send" | "ws-recv";
  method: string;
  url: string;
  reqHeaders: Record<string, string>;
  reqBody: string | null;          // best-effort; binary → base64 with marker
  resStatus: number | null;
  resHeaders: Record<string, string>;
  resBody: string | null;
  originTab?: { tabId: number; url: string };
};
```

### Match result (SW → side panel)

```ts
type MatchResult = {
  analyserId: string;
  analyserName: string;
  event: CapturedEvent;
  dslOutput: unknown;
  sandboxOutput?: unknown;
  error?: { stage: "dsl" | "sandbox"; message: string };
  latencyMs: number;
};
```

### DSL grammar

DSL is an ordered array of step objects. Each step takes the previous output and produces the next. The initial input is selected by `AnalyserConfig.source`:

- `"reqBody"` (default) → `event.reqBody` (string or null)
- `"url"` → `event.url` (full URL string; use `query-parse` to get a key/value object)
- `"resBody"` → `event.resBody` (string or null)

`decode-uri` runs `decodeURIComponent` on a string (1:1 unescape). To split a URL into query params, use `query-parse`.

Example: GA4 collect payload (form-urlencoded POST body):

```json
[
  { "op": "decode-form" },
  { "op": "pluck", "keys": ["en", "ep", "ec", "el", "ev"] }
]
```

Example: Celebrus (encrypted JSON in body, decrypted via sandbox):

```json
[
  { "op": "json-parse" }
]
```

…with sandbox code (the user writes whatever transform they need; the snippet below is one possible shape):

```js
// `input` here is the DSL output. Whatever transformation the user wants goes inline.
// Example: assume the payload has a base64-encoded blob to unwrap.
if (input && typeof input === "object" && typeof input.payload === "string") {
  return JSON.parse(atob(input.payload));
}
return input;
```

### postMessage protocol

| Channel | From | To | Shape |
|---|---|---|---|
| MessageChannel port | MAIN content script | ISOLATED bridge | `CapturedEvent` |
| chrome.runtime.sendMessage | ISOLATED bridge | SW | `{type: "captured-event", payload: CapturedEvent}` |
| chrome.runtime.sendMessage | SW | Offscreen | `{type: "create-iframe" \| "destroy-iframe" \| "run-transform", ...}` |
| iframe postMessage | Offscreen | Sandbox iframe | `{requestId, input}` (code injected once at create) |
| iframe postMessage | Sandbox iframe | Offscreen | `{requestId, result} \| {requestId, error}` |
| Long-lived port | SW | Side panel | `MatchResult` |

## Error handling

| Failure | Component | Behaviour |
|---|---|---|
| Page closes during request capture | MAIN content script | Best-effort: response side may be lost; emit event with `resBody: null` |
| Body too large (> 5 MB) | MAIN content script | Truncate to 5 MB; mark `truncated: true` on the captured event |
| Schema validation fails on bridge | ISOLATED bridge | Drop silently, `console.warn` once per session |
| Storage read fails | SW | Treat as empty analyser list; log to extension console |
| Analyser regex invalid | SW dispatcher | Skip that analyser this event; surface error in side panel `AnalyserManager` |
| DSL step throws | SW dispatcher | Stop chain at that step; emit MatchResult with `error.stage: "dsl"` |
| Sandbox timeout (1000 ms) | Offscreen manager | Destroy + recreate iframe; emit MatchResult with `error.stage: "sandbox", message: "timeout"` |
| Sandbox throws | Sandbox iframe | Catch, post `{requestId, error}` |
| Side panel disconnected | SW | Stop broadcasting; events still processed but dropped at port-write stage |
| Offscreen doc closed unexpectedly | Offscreen manager | Re-spawn on next sandbox request |
| Import string has unknown version | Side panel `ImportDialog` | Reject with "unsupported config version" |
| LZ-String decompress fails | Side panel `ImportDialog` | Reject with "corrupt config string" |

## Testing strategy

### Vitest unit (`tests/unit/`)

- DSL operations: each op tested in isolation (`decode-base64`, `gunzip`, `jsonpath`, etc.) with happy path + 1–2 edge cases (empty input, malformed input)
- DSL chain runner: chain of ops, error propagation, empty chain
- Dispatcher: with mocked storage adapter — match + no-match scenarios, multiple analysers, regex error
- Share encode/decode: roundtrip + version mismatch + corruption
- Storage adapter: chrome.storage mocked via `vitest-chrome` or hand-rolled mock

### Playwright E2E (`tests/e2e/`)

- Bootstrap Chrome with `--load-extension=./dist`
- Test page: simple HTML that fires `fetch("/__test/analytics", { method: "POST", body: ... })`
- Test cases:
  1. Side panel opens; captures fetch; renders event in list
  2. Two analysers, one matches, one doesn't; only the matching one appears
  3. DSL chain decodes base64 + JSON-parses, output rendered as JSON tree
  4. Sandbox code transforms input, output rendered
  5. Sandbox timeout → error badge rendered
  6. Import shared config string → analyser appears in manager
  7. Export → clipboard contains valid `dvw:1:...` string
  8. Side panel closed during capture → re-open shows no historical events (session-only)

### Manual smoke

- Real Chrome, real `google.com` (GA4 firing) → confirm GA4 analyser captures `g/collect`
- Synthetic test page firing a `fetch` against a fixture endpoint with the Celebrus URL pattern and a base64-wrapped JSON body → confirm sandbox-code path produces the expected unwrapped output

## Performance budgets

- Capture overhead: < 1 ms added per intercepted call (best-effort; large bodies dominate)
- Dispatcher overhead per event with 10 analysers configured: < 5 ms (regex match + DSL chain, no sandbox)
- Sandbox round-trip: 5–50 ms typical; 1000 ms hard timeout
- Side panel: 60 fps on event-list scroll with 1000 events (virtualised)
- Service worker cold-start (wake from termination): Chrome-controlled, but spec-side budget for our code (config load + first dispatch): < 20 ms after the SW global runs

## Manifest declarations (sketch)

```jsonc
{
  "manifest_version": 3,
  "name": "Dataviewer",
  "version": "0.1.0",
  "minimum_chrome_version": "116",
  "permissions": ["storage", "sidePanel", "offscreen"],
  "host_permissions": ["<all_urls>"],
  "background": { "service_worker": "src/background/service-worker.ts", "type": "module" },
  "side_panel": { "default_path": "src/side-panel/index.html" },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["src/content/main-world.ts"],
      "run_at": "document_start",
      "world": "MAIN",
      "all_frames": true
    },
    {
      "matches": ["<all_urls>"],
      "js": ["src/content/bridge.ts"],
      "run_at": "document_start",
      "world": "ISOLATED",
      "all_frames": true
    }
  ],
  "sandbox": { "pages": ["src/sandbox/sandbox.html"] },
  "web_accessible_resources": [
    { "resources": ["src/sandbox/sandbox.html"], "matches": ["<all_urls>"] }
  ],
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  "action": {
    "default_title": "Dataviewer",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  }
}
```

**Note on `run_at: "document_start"` and `world: "MAIN"`:** dataviewer deviates from the chrome-extension skill's default `document_idle`. Justification: monkey-patching `fetch`/XHR/`sendBeacon`/`WebSocket` must run before page JS so we capture the page's first network call. `world: "MAIN"` is required so the patched globals are the ones the page actually invokes (ISOLATED world has its own `window`).

## Constraints

- Chrome 116+ (`chrome.offscreen` minimum)
- MV3 only
- Web Store policies: no remote code, no eval outside sandbox pages, declared permissions justified
- Sandbox iframes are CSP-isolated (no chrome.*, no network, no cookies) by Chrome platform rules

## Surface-agnostic viewer note

The React component tree (`EventList`, `EventCard`, `JsonTree`, `AnalyserManager`, `ConfigEditor`) takes data via props and emits actions via callbacks. The side panel page is a 50-line host that:

1. Calls `chrome.runtime.connect`
2. Adapts incoming port messages into props for `EventList`
3. Adapts component action callbacks into outgoing port messages

To pivot to popup or devtools panel later: write a new host file that does the same wiring against the popup's lifetime or `chrome.devtools.panels` — zero changes to components.

## File layout

The repo is `/projects/network-data-viewer/` (the life repo's `wip/dataviewer/` keeps only `PRIMER.md` plus the canonical design docs; `specs/` and `plans/` in the new repo are gitignored — see Phase 0 in the plan).

```
network-data-viewer/                       # github.com/curtyo18/network-data-viewer (private)
├── README.md                              # placeholder until Task H3
├── package.json                           # vite + crxjs + react + tailwind + zod + lz-string + resvg + archiver
├── tsconfig.json
├── vite.config.ts                         # emptyOutDir: true
├── manifest.config.ts                     # crxjs manifest builder
├── tailwind.config.js
├── postcss.config.js
├── .gitignore                             # specs/, plans/, node_modules, dist, *.zip, .claude
├── specs/                                 # GITIGNORED — local working copy of life-repo spec
├── plans/                                 # GITIGNORED — local working copy of life-repo plan
├── scripts/
│   ├── generate-icons.mjs                 # SVG → 16/48/128 PNGs via @resvg/resvg-js
│   └── package-extension.mjs              # vite build + archiver → network-data-viewer-v<version>.zip
├── docs/
│   ├── privacy.html                       # plain-English data/network policy (deploy to Netlify)
│   ├── screenshot-mock.html               # 1280x800 mockup for Web Store listing
│   └── permissions-justification.md       # paste-into-Web-Store-submission text
├── src/
│   ├── icons/
│   │   └── icon.svg                       # icon source; resvg renders to PNGs
│   ├── content/
│   │   ├── main-world.ts                  # monkey-patch fetch/XHR/sendBeacon/WebSocket
│   │   └── bridge.ts                      # ISOLATED-world relay
│   ├── background/
│   │   ├── service-worker.ts              # SW entry; runtime hooks; port wiring
│   │   ├── dispatcher.ts                  # pure: match + DSL + sandbox dispatch
│   │   ├── storage.ts                     # chrome.storage.local adapter
│   │   └── offscreen-manager.ts           # spawn/close offscreen; iframe routing
│   ├── offscreen/
│   │   ├── offscreen.html
│   │   └── offscreen.ts                   # iframe registry; relay
│   ├── sandbox/
│   │   ├── sandbox.html
│   │   └── sandbox.ts                     # new Function executor
│   ├── side-panel/
│   │   ├── index.html
│   │   ├── index.tsx                      # React root; port wiring
│   │   ├── components/
│   │   │   ├── EventList.tsx
│   │   │   ├── EventCard.tsx
│   │   │   ├── JsonTree.tsx
│   │   │   ├── AnalyserManager.tsx
│   │   │   ├── ConfigEditor.tsx
│   │   │   ├── ImportDialog.tsx
│   │   │   └── ExportButton.tsx
│   │   └── lib/
│   │       └── port.ts                    # long-lived port wrapper
│   ├── shared/
│   │   ├── schema.ts                      # zod schemas
│   │   ├── types.ts                       # TS types
│   │   ├── dsl/
│   │   │   ├── index.ts                   # chain runner
│   │   │   └── ops/
│   │   │       ├── decode-uri.ts
│   │   │       ├── decode-base64.ts
│   │   │       ├── decode-form.ts
│   │   │       ├── gunzip.ts
│   │   │       ├── json-parse.ts
│   │   │       ├── query-parse.ts
│   │   │       ├── jsonpath.ts
│   │   │       ├── pluck.ts
│   │   │       ├── regex-extract.ts
│   │   │       └── to-string.ts
│   │   └── share/
│   │       ├── encode.ts                  # JSON → lz-string → dvw:1: prefix
│   │       └── decode.ts                  # reverse
│   └── examples/
│       ├── ga4.json
│       ├── contentsquare.json
│       └── celebrus.json
├── tests/
│   ├── unit/                              # vitest
│   │   ├── dsl/                           # one file per op
│   │   ├── dispatcher.test.ts
│   │   ├── storage.test.ts
│   │   └── share.test.ts
│   └── e2e/                               # playwright
│       ├── fixtures/
│       │   └── test-page.html             # fires fetch to fake endpoint
│       ├── helpers.ts                     # load extension, get side panel
│       └── capture-and-render.test.ts
└── public/
    └── icon-{16,48,128}.png
```

## Addendum — implementation deviations

The sections above describe the design as approved in May 2026. The implementation has since diverged on a small number of points. Listed here so future readers know which document wins (the code) and which expectations were intentionally changed.

### MAIN ↔ ISOLATED handoff: `window.postMessage`, not MessageChannel

The original design used a `MessageChannel` port handed over via a one-time `CustomEvent` at document_start. In practice this races: depending on when each world's content script registers its listener, the setup event can fire before the listener exists. We switched to plain `window.postMessage` (MAIN posts; ISOLATED listens) — no handshake, no race. Tagged messages have a `__dvw_event` discriminator. See `src/content/main-world.ts` and `src/content/bridge.ts`.

### Settings shape

The design speculated about a `settings: { theme }` blob deferred to v1.1. Instead we shipped `settings: { showRaw: boolean }` in v0.2 — a feature gate for analysers that want filtered vs verbose output (Celebrus is the current consumer). Theme is dark-only and not configurable.

### EventList virtualisation

Implemented with `@tanstack/react-virtual`. The original design didn't pick a library; that's the choice as of v0.3.

### Result buffering

The design's note that "if no ports connected, results are dropped" is now relaxed: the SW keeps a 100-entry ring of recent MatchResults and flushes them to a newly-connected panel. Session-only, in memory. Lets a user open the panel mid-browse and still see what just happened.

### Extension name

Manifest name is "Network Data Viewer" (the design used a working title of "Dataviewer").

### Capture: binary bodies

The design called for base64 with a marker. Implemented in v0.3 via `reqBodyEncoding: "text" | "base64"` on `CapturedEvent`. Analysers can use the `decode-base64` DSL step to round-trip.

### Per-analyser error indicator

Added in v0.3 — the SW keeps a small ring of recent errors per analyser id and `AnalyserManager` renders a red dot + expandable details. Closes the "silent failing analyser" gap.

### Performance budget

The <5 ms dispatcher budget is now pinned by a regression test in `tests/unit/dispatcher.perf.test.ts`. Compiled regexes are cached once per config-cache rebuild rather than per-event.
