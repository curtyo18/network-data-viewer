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
