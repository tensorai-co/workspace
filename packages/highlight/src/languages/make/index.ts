import type { Language } from '../../language.js'
import { grammar } from './grammar.js'

export const make: Language = { id: 'make', label: 'Makefile', grammar }
