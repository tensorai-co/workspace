import type { Language } from '../../language.js'
import { grammar } from './grammar.js'

export const gitCommit: Language = { id: 'git-commit', label: 'Commit message', grammar }
