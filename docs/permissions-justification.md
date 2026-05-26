# Permissions Justification — Network Data Viewer

This document contains the per-permission rationale for the Chrome Web Store submission.
Paste the relevant section into the corresponding field in the Developer Dashboard.

---

## `storage`

Network Data Viewer stores user-created analyser configurations (URL patterns, DSL transform
chains, and optional sandbox code snippets) and a global "show raw" toggle in
`chrome.storage.local`. This is required for the extension to remember the user's setup
across browser sessions. Without this permission, every configuration change would be lost
when the browser is closed. No user data is transmitted off-device; storage is sandboxed
per-extension by Chrome.

---

## `sidePanel`

The extension's primary user interface is a live tail of captured network events rendered
in Chrome's side panel surface. The `sidePanel` permission is required to register and open
this panel via `chrome.sidePanel`. Without it, the extension has no user-visible UI surface
for displaying results.

---

## `offscreen`

Network Data Viewer supports user-authored sandbox code: small JavaScript snippets that
transform captured payloads in ways the built-in DSL cannot express. Chrome MV3 service
workers cannot execute arbitrary user code, and `eval` / `new Function` are blocked in the
service worker context. The `offscreen` permission allows the extension to spawn an offscreen
document that hosts CSP-isolated sandboxed iframes — one per analyser with custom code.
These iframes have no access to `chrome.*` APIs, no network access, and no cookies, providing
the isolation Chrome's Web Store policies require for `new Function`. No data from these
iframes leaves the user's browser.

---

## Host permissions — `<all_urls>`

Network Data Viewer intercepts JS-initiated network traffic by injecting a content script
into pages at `document_start`. The content script monkey-patches `fetch`,
`XMLHttpRequest`, `sendBeacon`, and `WebSocket` in the page's MAIN world — the only
world in which patching these globals affects the code the page actually runs.

`<all_urls>` host access is necessary because the extension's purpose is to analyse the
network behaviour of arbitrary pages the user visits; limiting to specific domains would
make the extension useless for its core use case. The extension is strictly read-only:
it observes network traffic and displays it locally. It does not modify, redirect, or
block any requests, and it does not transmit captured data anywhere. All processing
happens on-device within the browser.
