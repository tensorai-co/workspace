import type { Language } from '../../language.js'
import { grammar } from './grammar.js'

export const llvm: Language = { id: 'llvm', label: 'LLVM IR', grammar }
