import { defineConfig } from 'wxt';
import path from 'node:path';
import { analyserSeeds } from './vite/plugins/analyser-seeds';

export default defineConfig({
  srcDir: 'src',
  alias: { '@': 'src' },
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Network Data Viewer',
    description: 'Configurable network-data capture and analysis.',
    minimum_chrome_version: '116',
    // Chrome's DEFAULT sandbox CSP leaves connect-src unrestricted, so sandboxed
    // analyser code could fetch() captured data off-device — the privacy policy
    // and store listing promise "no network" from the sandbox. default-src 'none'
    // closes connect/img/frame egress; the bare `sandbox allow-scripts` token
    // drops the default allow-forms/allow-popups (form-action / window.open exfil).
    content_security_policy: {
      sandbox:
        "sandbox allow-scripts; script-src 'self' 'unsafe-inline' 'unsafe-eval'; default-src 'none'",
    },
    permissions: ['storage', 'sidePanel', 'offscreen'],
    host_permissions: ['<all_urls>'],
    icons: {
      16: 'icons/icon16.png',
      48: 'icons/icon48.png',
      128: 'icons/icon128.png',
    },
    action: {
      default_title: 'Network Data Viewer',
      default_icon: {
        16: 'icons/icon16.png',
        48: 'icons/icon48.png',
        128: 'icons/icon128.png',
      },
    },
  },
  vite: () => ({
    plugins: [analyserSeeds({ examplesDir: path.resolve(__dirname, 'src/examples') })],
    server: { port: 8001, strictPort: true },
  }),
});
