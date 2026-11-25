import { LANGUAGES, loadedLanguage, loadLanguage, resolveLanguage, type Grammar, type LanguageId } from '@tensorai-co/workspace/highlight'
import { languageDefinitions } from './data/languages.js'
import { compileRules, type CompiledOnEnterRule, type Rules } from './rules.js'
import type { LanguageDefinition } from './definitions.js'

/** A language the editor knows: its id, a name for people, its grammar (if highlight has one) and its rules. */
export interface LanguageInfo {
  /** The language's id ("typescriptreact"), or highlight's where there's no definition for it ("toml"). */
  readonly id: string
  /** For a status bar: "TypeScript JSX". */
  readonly label: string
  /** The highlight grammar, when highlight has one. */
  readonly grammar: LanguageId | undefined
  readonly rules: Rules
}

/** Language ids that highlight knows by another name. */
const GRAMMAR_FOR: Record<string, LanguageId | null> = {
  typescriptreact: 'tsx',
  javascriptreact: 'jsx',
  plaintext: null,
  ignore: null,
  'code-text-binary': null,
}

/** Line comments for languages that have no definition but that highlight colors. */
const COMMENTS: Record<string, string> = {
  toml: '#', nix: '#', nim: '#', elixir: '#', erlang: '%', haskell: '--', zig: '//', kotlin: '//', scala: '//', solidity: '//',
  terraform: '#', hcl: '#', graphql: '#', prisma: '//', proto: '//', cmake: '#', gdscript: '#', crystal: '#', elm: '--', purescript: '--',
  ocaml: '(*', gleam: '//', v: '//', vala: '//', odin: '//', wgsl: '//', glsl: '//', hlsl: '//', verilog: '//', vhdl: '--', ada: '--',
}

/**
 * Enter between JSX tags. These aren't part of the language definitions: they're registered
 * them in code (extensions/typescript-language-features, languageConfiguration.ts, MIT). Same patterns, plus a guard so
 * TypeScript generics (`useState<number>(`) don't count as tags, since there's no embedded jsx-tags scope here.
 */
const VOID = 'area|base|br|col|embed|hr|img|input|keygen|link|menuitem|meta|param|source|track|wbr'
const JSX_OPEN = new RegExp(`(?:^|[^\\w$\\])])<(?!(?:${VOID})\\b)([_:\\w][_:\\w\\-.\\d]*)([^/>]*(?!/)>)[^<]*$`, 'i')
const JSX_ON_ENTER: CompiledOnEnterRule[] = [
  { beforeText: JSX_OPEN, afterText: /^<\/([_:\w][_:\w\-.\d]*)\s*>/i, action: { indent: 'indentOutdent' } },
  { beforeText: JSX_OPEN, action: { indent: 'indent' } },
]
const JSX_LANGUAGES = new Set(['typescriptreact', 'javascriptreact'])

const byId = new Map<string, LanguageInfo>()

function info(id: string, label: string, grammar: LanguageId | undefined, definition?: LanguageDefinition): LanguageInfo {
  const existing = byId.get(id)
  if (existing) return existing
  const rules = compileRules(definition?.rules, definition?.rules ? undefined : COMMENTS[id])
  if (JSX_LANGUAGES.has(id)) rules.onEnter = [...JSX_ON_ENTER, ...rules.onEnter]
  const made: LanguageInfo = { id, label, grammar, rules }
  byId.set(id, made)
  return made
}

function fromDefinition(l: LanguageDefinition): LanguageInfo {
  const mapped = GRAMMAR_FOR[l.id]
  const grammar = mapped === null ? undefined : (mapped ?? resolveLanguage(l.id) ?? (l.aliases ?? []).map((a) => resolveLanguage(a.toLowerCase())).find(Boolean))
  return info(l.id, l.aliases?.[0] ?? l.id, grammar, l)
}

function fromHighlight(id: LanguageId): LanguageInfo {
  return info(id, LANGUAGES[id].label, id)
}

const PLAIN = (): LanguageInfo => {
  const plain = languageDefinitions.find((l) => l.id === 'plaintext')
  return plain ? fromDefinition(plain) : info('plaintext', 'Plain Text', undefined)
}

/** A glob from a definition's filenamePatterns as a regex: *, **, ? and {a,b}. */
function globToRegex(glob: string): RegExp {
  let re = ''
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]!
    if (c === '*') {
      if (glob[i + 1] === '*') {
        re += '.*'
        i++
        if (glob[i + 1] === '/') i++
      } else re += '[^/]*'
    } else if (c === '?') re += '[^/]'
    else if (c === '{') {
      const end = glob.indexOf('}', i)
      re += '(' + glob.slice(i + 1, end).split(',').map((s) => s.replace(/[.+^$()|[\]\\]/g, '\\$&')).join('|') + ')'
      i = end
    } else re += c.replace(/[.+^$()|[\]\\]/g, '\\$&')
  }
  return new RegExp(`(^|/)${re}$`, 'i')
}

let index: { names: Map<string, LanguageDefinition>; exts: [string, LanguageDefinition][]; patterns: [RegExp, LanguageDefinition][]; firstLines: [RegExp, LanguageDefinition][] } | undefined

function buildIndex() {
  const names = new Map<string, LanguageDefinition>()
  const exts: [string, LanguageDefinition][] = []
  const patterns: [RegExp, LanguageDefinition][] = []
  const firstLines: [RegExp, LanguageDefinition][] = []
  for (const l of languageDefinitions) {
    for (const n of l.filenames ?? []) if (!names.has(n.toLowerCase())) names.set(n.toLowerCase(), l)
    for (const e of l.extensions ?? []) exts.push([e.toLowerCase(), l])
    for (const p of l.filenamePatterns ?? []) patterns.push([globToRegex(p), l])
    if (l.firstLine) {
      try {
        firstLines.push([new RegExp(l.firstLine), l])
      } catch {
        // An Oniguruma-only pattern; that language is still found by name and extension.
      }
    }
  }
  // Longest extension first, so ".d.ts" wins over ".ts" and ".js.map" over ".map".
  exts.sort((a, b) => b[0].length - a[0].length)
  return { names, exts, patterns, firstLines }
}

/**
 * The language of a file: exact file name, then file-name pattern, then the longest matching
 * extension, then the first line (a shebang, `<?xml`). Files no definition claims fall back to a highlight language
 * named like their extension (".toml" → TOML), then to plain text.
 */
export function detectLanguage(path: string, firstLine?: string): LanguageInfo {
  index ??= buildIndex()
  const name = (path.split(/[\\/]/).pop() ?? path).toLowerCase()
  const exact = index.names.get(name)
  if (exact) return fromDefinition(exact)
  for (const [re, l] of index.patterns) if (re.test(path)) return fromDefinition(l)
  for (const [ext, l] of index.exts) if (name.endsWith(ext)) return fromDefinition(l)
  if (firstLine) for (const [re, l] of index.firstLines) if (re.test(firstLine)) return fromDefinition(l)
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1) : name
  const grammar = resolveLanguage(ext)
  return grammar ? fromHighlight(grammar) : PLAIN()
}

/** A language by its id ("typescriptreact"), highlight id ("tsx") or alias ("ts"). */
export function languageById(id: string): LanguageInfo {
  const l = languageDefinitions.find((v) => v.id === id)
  if (l) return fromDefinition(l)
  const grammar = resolveLanguage(id)
  if (!grammar) return PLAIN()
  const definition = languageDefinitions.find((v) => GRAMMAR_FOR[v.id] === grammar || v.id === grammar)
  return definition ? fromDefinition(definition) : fromHighlight(grammar)
}

/** Every language: each defined language, then each highlight language with no definition. */
export function allLanguages(): LanguageInfo[] {
  const out = languageDefinitions.map(fromDefinition)
  const covered = new Set(out.map((l) => l.grammar).filter(Boolean))
  for (const id of Object.keys(LANGUAGES) as LanguageId[]) if (!covered.has(id)) out.push(fromHighlight(id))
  return out
}

/** The grammar, if it has loaded. */
export function grammarOf(language: LanguageInfo): Grammar | undefined {
  return language.grammar ? loadedLanguage(language.grammar)?.grammar : undefined
}

/** Loads the grammar the first time a language is used. */
export async function loadGrammar(language: LanguageInfo): Promise<Grammar | undefined> {
  return language.grammar ? (await loadLanguage(language.grammar)).grammar : undefined
}
