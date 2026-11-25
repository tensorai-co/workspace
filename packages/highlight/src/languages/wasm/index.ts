import type { Language } from '../../language.js'
import { grammar } from './grammar.js'

export const wasm: Language = { id: 'wasm', label: 'WebAssembly', grammar }
