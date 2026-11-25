import { defaultClientConditions, defineConfig } from 'vite'
import { shell } from './shell/plugin'

// The playground runs on the packages' TypeScript: the `source` condition in package.json's exports.
export default defineConfig({ plugins: [shell()], resolve: { conditions: ['source', ...defaultClientConditions] } })
