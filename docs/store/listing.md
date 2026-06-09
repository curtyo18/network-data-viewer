# Network Data Viewer — Chrome Web Store Listing Pack

Copy-paste source for the CWS Developer Dashboard. Draft — review before publishing.

> ⚠️ **Data-use answer is deliberately NOT "does not collect."** Because this tool
> captures network traffic that can contain authentication tokens / PII, CWS
> counts that as handling sensitive data **even though it never leaves the
> device**. Answering "does not collect" here is the most likely substantive
> rejection. See the Data usage section below — declare the data types and rely on
> the Limited Use certification.

---

## Store item name (max 75 chars)

`Network Data Viewer` (19 chars) — generic, no trademark conflict.

## Summary / short description (max 132 chars)

Current manifest: `Configurable network-data capture and analysis.` (47 chars — fine).

Richer alternative (104 chars):
`Capture and analyse a page's network traffic locally — fetch, XHR, beacons, WebSocket — in Chrome's side panel.`

## Category

**Developer Tools**

## Language

**English (United Kingdom)** (or en-US — match your dashboard default)

## Single-purpose description (required, Privacy tab — separate field)

> Network Data Viewer captures the JS-initiated network traffic of the page you
> are on (fetch, XMLHttpRequest, sendBeacon, WebSocket), runs your configured
> local analysers over it, and shows the decoded results in Chrome's side panel —
> entirely on-device. Local network-traffic capture and analysis is its single
> purpose.

## Detailed description (max 16,000 chars)

> **See and decode what a page is sending — without leaving the browser.**
>
> Network Data Viewer captures the network requests a page makes in JavaScript —
> `fetch`, `XMLHttpRequest`, `sendBeacon`, and `WebSocket` — and runs your own
> configurable analysers over them, showing decoded results live in Chrome's side
> panel.
>
> **Built for analytics / tag debugging.** Write URL-pattern matchers and
> transform chains (or small sandboxed code snippets) to pull apart beacons from
> GA4, ContentSquare, Celebrus, and anything else, into readable fields.
>
> **Everything is local.**
> • Captured traffic is processed entirely on your device and shown in the side
>   panel — it is never sent to any server, analytics service, or third party.
> • Your analyser configs are stored locally (`chrome.storage.local`).
> • No telemetry. No remotely hosted code — analyser snippets you write run in a
>   privilege-less, CSP-isolated sandbox with no `chrome.*`, network, or cookie
>   access.
>
> **Scope note (by design):** because it patches the page's own JS network APIs
> rather than using the `debugger` or `webRequest` permissions, it sees
> JS-initiated traffic — not browser-level requests, redirects, or service-worker
> fetches. This keeps it lightweight and avoids the "started debugging this
> browser" banner.
>
> Open source — code and privacy policy linked below.

## Screenshots (≥1 required; 1280×800 or 640×400)

- **Present:** `docs/screenshot.png` (640×400, 24-bit, no alpha) — the side panel
  decoding a live GA4 beacon on a retail page. Submittable as-is. The captured
  session's `userId` value is blurred; no brand/logo is identifiable in frame.
- **Recommended extras** (scrub real URLs / payloads first): the analyser-config
  editor; a second decoded vendor beacon. Match 640×400 so all screenshots share
  one dimension.

Store icon 128×128 is already present (`public/icons/icon128.png`).
Note: manifest sets `minimum_chrome_version: 116` — listing will reflect that.

## Privacy policy URL

`https://curtyo18.github.io/network-data-viewer/privacy.html`
*(GitHub Pages — enabled 2026-06-08. Confirm it renders in a browser before
submitting.)*

---

## Privacy practices tab

### Permission justifications

**`storage`**
> Stores user-created analyser configurations (URL patterns, DSL transform chains,
> optional sandbox code snippets) and a "show raw" toggle in chrome.storage.local
> so the user's setup persists across sessions. No data is transmitted off-device;
> storage is sandboxed per-extension by Chrome.

**`sidePanel`**
> The extension's entire UI is a live tail of captured network events rendered in
> Chrome's side panel; this permission registers and opens that panel. Without it
> the extension has no user-visible surface.

**`offscreen`**
> Hosts an offscreen document containing CSP-isolated sandbox iframes that execute
> user-authored transform code. MV3 service workers cannot run new Function/eval,
> so the offscreen document is the only compliant execution surface. The iframes
> have no chrome.* access, no network, and no cookies. No data from them leaves the
> browser.

**Host permissions — `<all_urls>`** *(the one needing the most care)*
> A content script is injected at document_start to monkey-patch fetch,
> XMLHttpRequest, sendBeacon, and WebSocket in the page's MAIN world — the only
> world where patching affects the code the page runs. Broad host access is
> required because the tool must work on whatever page the user is analysing;
> a fixed domain list would defeat its purpose. It is strictly read-only: it never
> modifies, redirects, or blocks requests, and never transmits captured data — all
> processing is on-device.

### Data usage disclosures  ⚠️ (the important part)

- **Remote code:** **No** — all code is bundled. *(Reviewer note: the `new
  Function` call in the sandbox runs user-authored, locally-stored snippets inside
  a privilege-less iframe; it is NOT remotely hosted code.)*
- **Does this item collect or use user data?** **Yes — declare the data types it
  handles**, do NOT claim "does not collect":
  - **Authentication information** (captured request/response headers/bodies can
    contain tokens/cookies).
  - **Website content** (captured request/response payloads).
  - *(Consider also "Personal communications" if message-bearing traffic is in
    scope.)*
- **Certify the Limited Use commitment:** the data is **processed locally on the
  user's device, never transmitted off-device, never sold, and never transferred**
  for any purpose other than the user's own inspection.
- **Certification checkboxes:** affirm all three.

### Reviewer notes (paste into the "notes to reviewer" field)

> Lead facts: **no `debugger`, no `webRequest`, no remotely hosted code.**
> Interception is via a MAIN-world content script that monkey-patches the page's
> own fetch / XHR / sendBeacon / WebSocket and reads (never modifies) the traffic.
> The `new Function` usage executes user-authored, locally-stored transform code
> inside a CSP-isolated offscreen iframe with no chrome.*, network, or cookie
> access — not remote code. Captured data is shown only in the side panel and is
> never transmitted off-device; configs live in chrome.storage.local. We declare
> the data types handled (auth info, website content) and certify local-only
> processing under Limited Use, because the tool inspects traffic that can contain
> sensitive data even though nothing leaves the device.

---

## Submission checklist (NDV)

- [x] MV3 package built at current version (0.5.4) — `.output/network-data-viewer-0.5.4-chrome.zip`
- [x] Privacy policy hosted — Pages enabled (confirm renders in browser)
- [x] 128×128 icon present
- [x] ≥1 screenshot (`docs/screenshot.png`, 640×400, userId blurred) — optional extras recommended
- [ ] CWS developer account + $5 fee + 2-Step Verification + verified contact email (user)
- [ ] Category / language / visibility set in dashboard
- [ ] Paste summary, detailed description, single-purpose, permission
      justifications, reviewer notes
- [ ] Data-use: **declare auth-info + website-content, certify Limited Use** (NOT "does not collect")
- [ ] Upload zip + screenshots + icon → Submit
- [ ] Do NOT upload the legacy zip (`network-data-viewer-0.5.3-chrome.zip`)
