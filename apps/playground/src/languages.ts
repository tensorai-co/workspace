import type { CompletionItem, CompletionKind, Diagnostic, DocumentSymbol, FileSystem, Hover, LanguageService, Location, SymbolKind, TextEdit } from '@tensorai-workspace/host'

/**
 * A pretend language service for the playground's TypeScript and JavaScript files. It reads declarations with a few
 * patterns rather than compiling anything, which is enough to try the editor's language features: completions from
 * what's declared and used, hovers with doc comments, a few problems, go to definition (across files, through
 * relative imports), the outline and formatting.
 */
export function pretendLanguages(fs: FileSystem): LanguageService {
  return {
    triggerCharacters: ['.'],
    async completions({ doc, position, language }) {
      if (!isScript(language)) return undefined
      const text = doc.toString()
      const word = wordAt(text, position)
      // After a dot: the members of what's before it.
      if (text[word.from - 1] === '.') {
        const owner = wordAt(text, word.from - 1).word
        const known = Object.hasOwn(MEMBERS, owner) ? MEMBERS[owner] : undefined
        if (known) return known.map(([label, kind, detail, documentation]) => ({ label, kind, detail, documentation }))
        const seen = new Map<string, CompletionKind>()
        for (const m of text.matchAll(/\.([A-Za-z_$][\w$]*)(\s*\()?/g)) if (m.index + 1 !== word.from) seen.set(m[1]!, m[2] ? 'method' : 'property')
        return [...seen].map(([label, kind]) => ({ label, kind }))
      }
      const items = new Map<string, CompletionItem>()
      for (const d of declarations(text)) {
        if (d.from === word.from) continue
        items.set(d.name, { label: d.name, kind: d.completion, detail: d.signature, documentation: d.doc })
      }
      for (const [name, [detail, documentation]] of Object.entries(GLOBALS)) if (!items.has(name)) items.set(name, { label: name, kind: name[0] === name[0]!.toUpperCase() ? 'variable' : 'function', detail, documentation })
      for (const keyword of KEYWORDS) if (!items.has(keyword)) items.set(keyword, { label: keyword, kind: 'keyword' })
      // Every other word in the file word-based suggestions.
      for (const m of text.matchAll(/[A-Za-z_$][\w$]{2,}/g)) if (m.index !== word.from && !items.has(m[0])) items.set(m[0], { label: m[0], kind: 'text' })
      return [...items.values()]
    },

    async hover({ doc, position, language }) {
      if (!isScript(language)) return undefined
      const text = doc.toString()
      const word = wordAt(text, position)
      if (!word.word || KEYWORDS.includes(word.word)) return undefined
      const range = { from: word.from, to: word.to }
      const d = declarations(text).find((x) => x.name === word.word)
      if (d) return { contents: [fence(d.signature), d.doc].filter((c): c is string => !!c), range } satisfies Hover
      const global = Object.hasOwn(GLOBALS, word.word) ? GLOBALS[word.word] : undefined
      if (global) return { contents: [fence(global[0]), global[1]].filter((c): c is string => !!c), range }
      if (text[word.from - 1] === '.') {
        const owner = wordAt(text, word.from - 1).word
        const member = Object.hasOwn(MEMBERS, owner) ? MEMBERS[owner]!.find(([label]) => label === word.word) : undefined
        if (member) return { contents: [fence(member[2]), member[3]].filter((c): c is string => !!c), range }
      }
      return undefined
    },

    async diagnostics({ doc, language }) {
      if (!isScript(language)) return []
      return problems(doc.toString())
    },

    async definition({ doc, position, language, path }) {
      if (!isScript(language)) return undefined
      const text = doc.toString()
      const word = wordAt(text, position)
      if (!word.word) return undefined
      // Imported from a file in the project: its declaration there.
      for (const m of text.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+['"](\.[^'"]+)['"]/g)) {
        const names = m[1]!.split(',').map((n) => n.replace(/^\s*type\s+/, '').trim())
        if (!names.includes(word.word) || !path) continue
        const found = await findIn(fs, resolve(path, m[2]!), word.word)
        if (found) return [found]
      }
      const d = declarations(text).find((x) => x.name === word.word)
      return d ? [{ from: d.from, to: d.from + d.name.length }] : undefined
    },

    async symbols({ doc, language }) {
      if (!isScript(language)) return []
      return outline(doc.toString())
    },

    async format({ doc, tabSize, insertSpaces }) {
      const edits: TextEdit[] = []
      const text = doc.toString()
      let at = 0
      for (const line of text.split('\n')) {
        const indent = /^[ \t]*/.exec(line)![0]
        const tidy = insertSpaces ? indent.replace(/\t/g, ' '.repeat(tabSize)) : indent
        if (tidy !== indent) edits.push({ from: at, to: at + indent.length, insert: tidy })
        const trailing = /[ \t]+$/.exec(line)
        if (trailing && trailing.index >= indent.length) edits.push({ from: at + trailing.index, to: at + line.length, insert: '' })
        at += line.length + 1
      }
      if (text && !text.endsWith('\n')) edits.push({ from: text.length, to: text.length, insert: '\n' })
      return edits
    },
  }
}

const isScript = (language: string) => /^(typescript|javascript)(react)?$|^[jt]sx$/.test(language)

const WORD = /[\w$]/
function wordAt(text: string, pos: number) {
  let from = pos
  let to = pos
  while (from > 0 && WORD.test(text[from - 1]!)) from--
  while (to < text.length && WORD.test(text[to]!)) to++
  return { from, to, word: text.slice(from, to) }
}

const fence = (code: string) => '```typescript\n' + code + '\n```'

const KEYWORDS = ['as', 'async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'default', 'else', 'export', 'extends', 'false', 'finally', 'for', 'function', 'if', 'import', 'interface', 'let', 'new', 'null', 'return', 'switch', 'this', 'throw', 'true', 'try', 'type', 'typeof', 'undefined', 'while']

const GLOBALS: Record<string, [detail: string, docs?: string]> = {
  console: ['var console: Console', 'Logs to the browser’s console, or a process’s output.'],
  Math: ['var Math: Math', 'An intrinsic object that provides basic mathematics functionality and constants.'],
  JSON: ['var JSON: JSON', 'An intrinsic object that provides functions to convert JavaScript values to and from the JavaScript Object Notation (JSON) format.'],
  Number: ['var Number: NumberConstructor', 'An object that represents a number of any kind.'],
  Promise: ['var Promise: PromiseConstructor', 'Represents the completion of an asynchronous operation.'],
  setTimeout: ['function setTimeout(handler: TimerHandler, timeout?: number): number'],
  setInterval: ['function setInterval(handler: TimerHandler, timeout?: number): number'],
  clearInterval: ['function clearInterval(id: number | undefined): void'],
}

type Member = [label: string, kind: CompletionKind, detail: string, docs?: string]
const MEMBERS: Record<string, Member[]> = {
  console: [
    ['log', 'method', '(method) Console.log(...data: any[]): void', 'Prints to the console, with a newline.'],
    ['error', 'method', '(method) Console.error(...data: any[]): void', 'Prints to the console as an error.'],
    ['warn', 'method', '(method) Console.warn(...data: any[]): void', 'Prints to the console as a warning.'],
    ['info', 'method', '(method) Console.info(...data: any[]): void'],
    ['table', 'method', '(method) Console.table(tabularData?: any, properties?: string[]): void'],
  ],
  Math: [
    ['PI', 'property', '(property) Math.PI: number', 'Pi. This is the ratio of the circumference of a circle to its diameter.'],
    ['abs', 'method', '(method) Math.abs(x: number): number', 'Returns the absolute value of a number (the value without regard to whether it is positive or negative).\n\n*@param* `x` — A numeric expression for which the absolute value is needed.'],
    ['ceil', 'method', '(method) Math.ceil(x: number): number', 'Returns the smallest integer greater than or equal to its numeric argument.'],
    ['floor', 'method', '(method) Math.floor(x: number): number', 'Returns the greatest integer less than or equal to its numeric argument.'],
    ['log', 'method', '(method) Math.log(x: number): number', 'Returns the natural logarithm (base e) of a number.\n\n*@param* `x` — A numeric expression.'],
    ['max', 'method', '(method) Math.max(...values: number[]): number', 'Returns the larger of a set of supplied numeric expressions.'],
    ['min', 'method', '(method) Math.min(...values: number[]): number', 'Returns the smaller of a set of supplied numeric expressions.'],
    ['random', 'method', '(method) Math.random(): number', 'Returns a pseudorandom number between 0 and 1.'],
    ['round', 'method', '(method) Math.round(x: number): number', 'Returns a supplied numeric expression rounded to the nearest integer.'],
  ],
  JSON: [
    ['parse', 'method', '(method) JSON.parse(text: string, reviver?: (this: any, key: string, value: any) => any): any', 'Converts a JavaScript Object Notation (JSON) string into an object.'],
    ['stringify', 'method', '(method) JSON.stringify(value: any, replacer?: (number | string)[] | null, space?: string | number): string', 'Converts a JavaScript value to a JavaScript Object Notation (JSON) string.'],
  ],
}

interface Declaration {
  name: string
  from: number
  /** Where its body ends, when it has one. */
  to: number
  completion: CompletionKind
  symbol: SymbolKind
  signature: string
  doc?: string
  indent: number
}

/** The doc comment right before a position, as Markdown. */
function docBefore(text: string, at: number): string | undefined {
  const lineStart = text.lastIndexOf('\n', at - 1) + 1
  const before = text.slice(0, lineStart).trimEnd()
  if (!before.endsWith('*/')) return undefined
  const start = before.lastIndexOf('/**')
  if (start < 0) return undefined
  return before
    .slice(start + 3, -2)
    .split('\n')
    .map((l) => l.replace(/^\s*\*\s?/, ''))
    .join('\n')
    .trim()
}

/** Where the bracket opened at `open` closes, skipping strings and comments; the end of the text if it doesn't. */
function closing(text: string, open: number): number {
  let depth = 0
  for (const t of scan(text, open)) {
    if (t.ch === '{' || t.ch === '(' || t.ch === '[') depth++
    else if (t.ch === '}' || t.ch === ')' || t.ch === ']') if (--depth === 0) return t.at + 1
  }
  return text.length
}

/** The brackets of code, with strings, template text and comments skipped. */
function* scan(text: string, from = 0): Generator<{ ch: string; at: number }> {
  let i = from
  /** Open template literals, and the brace depth inside each `${`. */
  const templates: number[] = []
  while (i < text.length) {
    const ch = text[i]!
    if (ch === '/' && text[i + 1] === '/') {
      i = text.indexOf('\n', i)
      if (i < 0) return
      continue
    }
    if (ch === '/' && text[i + 1] === '*') {
      i = text.indexOf('*/', i + 2)
      if (i < 0) return
      i += 2
      continue
    }
    if (ch === "'" || ch === '"') {
      i++
      while (i < text.length && text[i] !== ch && text[i] !== '\n') i += text[i] === '\\' ? 2 : 1
      i++
      continue
    }
    if (ch === '`' || (ch === '}' && templates.length && templates[templates.length - 1] === 0)) {
      if (ch === '}') templates.pop()
      // Template text, up to its end or the next `${`.
      i++
      while (i < text.length && text[i] !== '`' && !(text[i] === '$' && text[i + 1] === '{')) i += text[i] === '\\' ? 2 : 1
      if (text[i] === '$') {
        templates.push(0)
        i += 2
      } else i++
      continue
    }
    if (templates.length && (ch === '{' || ch === '}')) templates[templates.length - 1]! += ch === '{' ? 1 : -1
    if ('{}()[]'.includes(ch)) yield { ch, at: i }
    i++
  }
}

/** What's declared, by pattern: functions, classes, interfaces, types, variables and imports. */
function declarations(text: string): Declaration[] {
  const out: Declaration[] = []
  const add = (name: string, from: number, completion: CompletionKind, symbol: SymbolKind, signature: string, to = from + name.length) => {
    const lineStart = text.lastIndexOf('\n', from - 1) + 1
    out.push({ name, from, to, completion, symbol, signature, doc: docBefore(text, from), indent: /^\s*/.exec(text.slice(lineStart))![0].length })
  }
  for (const m of text.matchAll(/^([ \t]*)(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm)) {
    const name = m[2]!
    const at = m.index + m[0].length - name.length
    const paren = text.indexOf('(', at)
    const end = closing(text, paren)
    const brace = text.indexOf('{', end)
    const returns = text.slice(end, brace < 0 ? end : brace).trim()
    add(name, at, 'function', 'function', `function ${name}${text.slice(paren, end)}${returns.startsWith(':') ? returns : ''}`, brace < 0 ? end : closing(text, brace))
  }
  for (const m of text.matchAll(/^([ \t]*)(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/gm)) {
    const at = m.index + m[0].length - m[2]!.length
    const brace = text.indexOf('{', at)
    add(m[2]!, at, 'class', 'class', `class ${m[2]}`, brace < 0 ? at : closing(text, brace))
  }
  for (const m of text.matchAll(/^([ \t]*)(?:export\s+)?(interface|type)\s+([A-Za-z_$][\w$]*)/gm)) {
    const at = m.index + m[0].length - m[3]!.length
    const brace = text.indexOf('{', at)
    const end = m[2] === 'interface' && brace >= 0 ? closing(text, brace) : text.indexOf('\n', at)
    add(m[3]!, at, 'interface', m[2] === 'interface' ? 'interface' : 'class', `${m[2]} ${m[3]}`, end < 0 ? text.length : end)
    // An interface's members.
    if (m[2] === 'interface' && brace >= 0) {
      for (const p of text.slice(brace + 1, end - 1).matchAll(/^([ \t]*)([A-Za-z_$][\w$]*)(\??)(\(|:)([^\n]*)/gm)) {
        const pAt = brace + 1 + p.index + p[1]!.length
        const method = p[4] === '('
        add(p[2]!, pAt, method ? 'method' : 'property', method ? 'method' : 'property', `(${method ? 'method' : 'property'}) ${m[3]}.${p[2]}${p[3]}${p[4]}${p[5]!.trim()}`)
      }
    }
  }
  for (const m of text.matchAll(/^([ \t]*)(?:export\s+)?(const|let|var)\s+(\[[^\]]*\]|\{[^}]*\}|[A-Za-z_$][\w$]*)([^\n]*)/gm)) {
    const target = m[3]!
    const at = m.index + m[0].length - m[4]!.length - target.length
    const rest = m[4]!.trim()
    const arrow = /^=\s*(?:async\s*)?\(/.test(rest) || /^=\s*(?:async\s+)?[A-Za-z_$][\w$]*\s*=>/.test(rest)
    if (target[0] === '[' || target[0] === '{') {
      for (const n of target.slice(1, -1).matchAll(/[A-Za-z_$][\w$]*/g)) add(n[0], at + 1 + n.index, 'variable', 'variable', `${m[2]} ${n[0]}`)
      continue
    }
    const brace = rest.endsWith('{') ? text.indexOf('{', at + target.length + m[4]!.length - 1) : -1
    const shown = rest.length > 60 ? rest.slice(0, 57) + '...' : rest.replace(/\s*\{$/, '')
    add(target, at, arrow ? 'function' : 'variable', arrow ? 'function' : m[2] === 'const' ? 'constant' : 'variable', `${m[2]} ${target}${shown.startsWith(':') ? shown : shown ? ' ' + shown : ''}`, brace >= 0 ? closing(text, brace) : at + target.length)
  }
  for (const m of text.matchAll(/^import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+(['"][^'"]+['"])/gm)) {
    const listAt = m.index + m[0].indexOf('{') + 1
    for (const n of m[1]!.matchAll(/(?:type\s+)?([A-Za-z_$][\w$]*)/g)) add(n[1]!, listAt + n.index + n[0].length - n[1]!.length, 'variable', 'variable', `(alias) import ${n[1]} from ${m[2]}`)
  }
  return out.sort((a, b) => a.from - b.from)
}

/** The outline: declarations, with the ones inside a body under it. */
function outline(text: string): DocumentSymbol[] {
  const all = declarations(text).filter((d) => !d.signature.startsWith('(alias)'))
  const top: DocumentSymbol[] = []
  const stack: { d: Declaration; s: DocumentSymbol }[] = []
  for (const d of all) {
    const s: DocumentSymbol = { name: d.name, kind: d.symbol, from: d.from, to: d.to, selection: { from: d.from, to: d.from + d.name.length } }
    while (stack.length && stack[stack.length - 1]!.d.to <= d.from) stack.pop()
    const parent = stack[stack.length - 1]
    if (parent) (parent.s.children ??= []).push(s)
    else top.push(s)
    if (d.to > d.from + d.name.length) stack.push({ d, s })
  }
  return top
}

/** A few problems a linter or compiler would report. */
function problems(text: string): Diagnostic[] {
  const out: Diagnostic[] = []
  // Brackets that don't match.
  const open: { ch: string; at: number }[] = []
  const pairs: Record<string, string> = { ')': '(', ']': '[', '}': '{' }
  for (const t of scan(text)) {
    if ('([{'.includes(t.ch)) open.push(t)
    else if (open[open.length - 1]?.ch === pairs[t.ch]) open.pop()
    else out.push({ from: t.at, to: t.at + 1, severity: 'error', message: `Unexpected '${t.ch}'.`, source: 'ts', code: 1128 })
  }
  for (const t of open) out.push({ from: t.at, to: t.at + 1, severity: 'error', message: `'${{ '(': ')', '[': ']', '{': '}' }[t.ch]}' expected.`, source: 'ts', code: 1005 })
  for (const m of text.matchAll(/:\s*number\s*=\s*(['"`])/g)) {
    const name = /([A-Za-z_$][\w$]*)\s*$/.exec(text.slice(0, m.index))
    if (name) out.push({ from: m.index - name[1]!.length, to: m.index, severity: 'error', message: "Type 'string' is not assignable to type 'number'.", source: 'ts', code: 2322 })
  }
  for (const m of text.matchAll(/\bconsole\.[a-z]+/g)) out.push({ from: m.index, to: m.index + m[0].length, severity: 'warning', message: 'Unexpected console statement.', source: 'eslint', code: 'no-console' })
  for (const m of text.matchAll(/[^=!<>]([!=]=)(?!=)/g)) {
    const at = m.index + 1
    out.push({ from: at, to: at + 2, severity: 'warning', message: `Expected '${m[1]}=' and instead saw '${m[1]}'.`, source: 'eslint', code: 'eqeqeq' })
  }
  for (const m of text.matchAll(/\/\/\s*(TODO\b.*)/g)) out.push({ from: m.index + m[0].length - m[1]!.length, to: m.index + m[0].length, severity: 'info', message: m[1]!.trim(), source: 'todo' })
  return out.sort((a, b) => a.from - b.from)
}

/** A relative import's file, from the importing file's path. */
function resolve(from: string, spec: string): string {
  const parts = from.split('/').slice(0, -1)
  for (const part of spec.split('/')) {
    if (part === '..') parts.pop()
    else if (part !== '.') parts.push(part)
  }
  return parts.join('/')
}

/** Where a name is exported from a module, trying the extensions TypeScript would. */
async function findIn(fs: FileSystem, base: string, name: string): Promise<Location | undefined> {
  for (const path of [base, `${base}.tsx`, `${base}.ts`, `${base}.jsx`, `${base}.js`, `${base}/index.tsx`, `${base}/index.ts`]) {
    let text: string
    try {
      text = new TextDecoder().decode(await fs.read(path))
    } catch {
      continue
    }
    const d = declarations(text).find((x) => x.name === name && x.indent === 0)
    if (d) return { path, from: d.from, to: d.from + name.length }
  }
  return undefined
}
