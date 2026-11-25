import { defineConfig, mergeConfig } from 'vitest/config'
import { defaultClientConditions, defaultServerConditions } from 'vite'

// One Vitest project per package. DOM-free packages run in Node; view packages in jsdom.
// The packages import each other as @tensorai-co/workspace/...: the `source` condition takes those to their TypeScript.
const fromSource = {
  resolve: { conditions: ['source', ...defaultClientConditions] },
  ssr: { resolve: { conditions: ['source', ...defaultServerConditions] } },
}

export default mergeConfig(fromSource, defineConfig({
  test: {
    projects: [
      { extends: true, test: { name: 'text', root: 'packages/text', environment: 'node' } },
      { extends: true, test: { name: 'highlight', root: 'packages/highlight', environment: 'node' } },
      { extends: true, test: { name: 'languages', root: 'packages/languages', environment: 'node' } },
      { extends: true, test: { name: 'markdown-parser', root: 'packages/markdown-parser', environment: 'node' } },
      { extends: true, test: { name: 'icons', root: 'packages/icons', environment: 'node' } },
      { extends: true, test: { name: 'theme', root: 'packages/theme', environment: 'jsdom' } },
      { extends: true, test: { name: 'testing', root: 'packages/testing', environment: 'node' } },
      { extends: true, test: { name: 'overlays', root: 'packages/overlays', environment: 'jsdom' } },
      { extends: true, test: { name: 'tabs', root: 'packages/tabs', environment: 'jsdom' } },
      { extends: true, test: { name: 'split', root: 'packages/split', environment: 'jsdom' } },
      { extends: true, test: { name: 'terminal', root: 'packages/terminal', environment: 'jsdom' } },
      { extends: true, test: { name: 'markdown', root: 'packages/markdown', environment: 'jsdom' } },
      { extends: true, test: { name: 'tree', root: 'packages/tree', environment: 'jsdom' } },
      { extends: true, test: { name: 'explorer', root: 'packages/explorer', environment: 'jsdom' } },
      { extends: true, test: { name: 'editor', root: 'packages/editor', environment: 'jsdom' } },
      { extends: true, test: { name: 'workspace', root: 'packages/workspace', environment: 'jsdom' } },
    ],
  },
}))
