import { defineConfig } from 'vitest/config'

// One Vitest project per package. DOM-free packages run in Node; view packages in jsdom.
export default defineConfig({
  test: {
    projects: [
      { test: { name: 'text', root: 'packages/text', environment: 'node' } },
      { test: { name: 'highlight', root: 'packages/highlight', environment: 'node' } },
      { test: { name: 'languages', root: 'packages/languages', environment: 'node' } },
      { test: { name: 'markdown-parser', root: 'packages/markdown-parser', environment: 'node' } },
      { test: { name: 'icons', root: 'packages/icons', environment: 'node' } },
      { test: { name: 'theme', root: 'packages/theme', environment: 'jsdom' } },
      { test: { name: 'testing', root: 'packages/testing', environment: 'node' } },
      { test: { name: 'overlays', root: 'packages/overlays', environment: 'jsdom' } },
      { test: { name: 'tabs', root: 'packages/tabs', environment: 'jsdom' } },
      { test: { name: 'split', root: 'packages/split', environment: 'jsdom' } },
      { test: { name: 'terminal', root: 'packages/terminal', environment: 'jsdom' } },
      { test: { name: 'markdown', root: 'packages/markdown', environment: 'jsdom' } },
      { test: { name: 'tree', root: 'packages/tree', environment: 'jsdom' } },
      { test: { name: 'explorer', root: 'packages/explorer', environment: 'jsdom' } },
      { test: { name: 'editor', root: 'packages/editor', environment: 'jsdom' } },
      { test: { name: 'workspace', root: 'packages/workspace', environment: 'jsdom' } },
    ],
  },
})
