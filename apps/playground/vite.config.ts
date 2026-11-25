import { defineConfig } from 'vite'
import { shell } from './shell/plugin'

export default defineConfig({ plugins: [shell()] })
