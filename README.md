# Network Data Viewer

Chrome MV3 extension. Always-on capture of JS-initiated network traffic; configurable analysers (URL regex → transform DSL chain → optional sandboxed JS) render results into a side-panel live tail. Configs shareable as `dvw:1:…` strings.

**Status:** private repo, pre-release. Public release pending owner approval.

## Stack

Vite + `@crxjs/vite-plugin`, React 18, TypeScript, Tailwind CSS, Zod, LZ-String, Vitest + Playwright.

Chrome 116+ minimum (uses `chrome.offscreen` API).

## Dev

```bash
npm install
npm run icons     # generate icons from src/icons/icon.svg
npm run dev       # vite watch build into dist/
npm run build     # production build into dist/
npm test          # vitest unit (53 tests)
npm run test:e2e  # playwright (loads dist/) — requires Chromium binaries (npx playwright install)
npm run package   # build + zip dist/ → network-data-viewer-v<version>.zip
```

Load `dist/` via `chrome://extensions` → "Load unpacked".

## Architecture

See `specs/2026-05-25-dataviewer-design.md` (gitignored — canonical copy lives in the life repo at `wip/dataviewer/specs/`).

High-level: content-script monkey-patching of `fetch`/XHR/`sendBeacon`/WebSocket → MessageChannel → ISOLATED bridge → service worker dispatcher (URL regex match + DSL chain + optional sandboxed-iframe JS) → long-lived port to side-panel React UI.
