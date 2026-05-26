# Network Data Viewer

Chrome extension that captures JS-initiated network traffic in real time and runs configurable analysers over it. Each analyser is a URL pattern, an optional transform chain, and an optional bit of sandboxed JavaScript. Results stream into a side panel as the page makes requests. Analyser configs are shareable as compressed strings.

## What it's for

- Reverse-engineering the payloads of tracking, analytics, and observability vendors firing from a page
- Debugging your own client-side telemetry
- Validating that the right events fire (or don't)

Not a replacement for the browser's Network panel — it's complementary. The Network panel shows the *transport*; Network Data Viewer shows the *meaning* (after decoding, decompression, JSON parsing, etc.).

## Install

Until the extension is published to the Chrome Web Store — download the latest `network-data-viewer-vX.Y.Z.zip` from [Releases](../../releases), unzip, then in Chrome:

1. Visit `chrome://extensions`
2. Enable Developer Mode (top right)
3. Click "Load unpacked"
4. Select the unzipped folder

Open the side panel from the toolbar icon or via the extension menu.

## Concepts

### Analysers

An analyser is a small config:

- **URL pattern** — JavaScript regex matched against the request URL. Only matching requests run through the analyser.
- **Source** — `url`, `reqBody`, or `resBody`: which part of the request to feed into the transform chain.
- **DSL chain** — an ordered list of small transform steps (`json-parse`, `decode-base64`, `gunzip`, `query-parse`, `pluck`, `regex-extract`, `jsonpath`, ...). Each step's output becomes the next step's input.
- **Sandbox code** (optional) — a small JS function body that takes the DSL output and returns whatever you want rendered. Sandboxed by Chrome — no `chrome.*` APIs, no cookies, no network.

Three analysers ship by default: GA4, ContentSquare, Celebrus.

### Sharing

Export the current analyser configs as a single compressed string starting with `dvw:1:`. Paste it into another browser via the Import dialog to install the same set.

### Storage

Analyser configs persist via `chrome.storage.local`. Captured events do NOT persist — the event list is session-scoped and clears when you close the browser.

## Settings

A "show raw" toggle (`settings: { showRaw }`) in the panel header switches some analysers (currently Celebrus) between filtered and verbose output.

Available keyboard shortcuts:

| Shortcut | Action |
|---|---|
| `Ctrl+L` | Clear the event list |
| `Ctrl+F` | Focus the filter bar |
| `Ctrl+E` | Copy the export string to clipboard |
| `Esc` | Close the config / import dialog |

## Permissions

The extension requests:

- `storage` — persist analyser configs and the "show raw" setting
- `sidePanel` — render the live tail in Chrome's side panel surface
- `offscreen` — host the offscreen document that runs sandboxed analyser code
- Host access to `<all_urls>` — content scripts inject into pages to monkey-patch `fetch`, `XMLHttpRequest`, `sendBeacon`, and `WebSocket`, observing all four transports

The extension is **read-only**: it observes, never modifies or blocks requests. No data is sent anywhere — everything stays local to your browser.

See `docs/permissions-justification.md` for the per-permission Web Store narrative and `docs/privacy.html` for the privacy policy.

## Development

Requires Node 20+.

```bash
npm install
npm run icons       # generate icons from src/icons/icon.svg
npm run dev         # vite watch build into dist/
npm run build       # production build into dist/
npm test            # vitest unit tests
npm run test:e2e    # Playwright (loads dist/) — requires `npx playwright install`
npm run package     # build + zip dist/ → network-data-viewer-vX.Y.Z.zip
```

Load the built `dist/` via `chrome://extensions` → "Load unpacked" while iterating.

### Architecture

A content script monkey-patches `fetch`, `XMLHttpRequest`, `sendBeacon`, and `WebSocket` in the page's MAIN world. Captured events are forwarded to the ISOLATED-world bridge via `window.postMessage` (tagged with a `__dvw_event` discriminator — no handshake, no race). The bridge forwards to the service worker, which matches each event against enabled analysers, runs the DSL chain, and optionally invokes sandboxed JS in an offscreen iframe. Results broadcast to the side panel via a long-lived port. The SW buffers a recent ring of results so a panel that opens mid-browse still sees what just happened.

The side panel uses `@tanstack/react-virtual` to render the event list at 60 fps regardless of list length.

Full design in `specs/2026-05-25-dataviewer-design.md`. That document is living — current code may have evolved past it; see the addendum at the bottom of that file for tracked deviations.

## Contributing

- Branch off `main`. Open a PR.
- Keep commits small and focused; the project uses no-squash merges so commits land verbatim.
- Run the test bar before pushing: `npm test && npm run typecheck && npm run build`.
- Coverage isn't enforced, but new code paths should have at least one test.
- Bug reports and analyser-pattern contributions welcome via Issues.

## License

TBD — license will be added before public flip.
