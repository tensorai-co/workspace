/**
 * `when` clauses: `editorAreaFocus && activeEditorLangId == markdown`.
 *
 * - **Keys** are names of context values: true when the value is truthy.
 * - **Comparisons:** `key == value`, `key != value` (also `===` and `!==`). The value may be quoted or bare, and is
 *   compared as text, so `count == 2` and `visible == true` work.
 * - **Logic:** `!`, `&&`, `||` and parentheses, with `!` binding tightest and `&&` before `||`.
 */
export type When = (get: (key: string) => unknown) => boolean

type Token = { kind: 'op'; text: string; at: number } | { kind: 'word'; text: string; at: number } | { kind: 'string'; text: string; at: number }

const OPS = ['===', '!==', '==', '!=', '&&', '||', '!', '(', ')']

function tokenize(source: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < source.length) {
    const ch = source[i]!
    if (/\s/.test(ch)) {
      i++
      continue
    }
    const op = OPS.find((o) => source.startsWith(o, i))
    if (op) {
      tokens.push({ kind: 'op', text: op, at: i })
      i += op.length
      continue
    }
    if (ch === "'" || ch === '"') {
      const end = source.indexOf(ch, i + 1)
      if (end < 0) throw new SyntaxError(`Unclosed string at ${i} in "${source}"`)
      tokens.push({ kind: 'string', text: source.slice(i + 1, end), at: i })
      i = end + 1
      continue
    }
    const word = /^[^\s!=&|()'"]+/.exec(source.slice(i))
    if (!word) throw new SyntaxError(`Unexpected "${ch}" at ${i} in "${source}"`)
    tokens.push({ kind: 'word', text: word[0], at: i })
    i += word[0].length
  }
  return tokens
}

const cache = new Map<string, When>()

/** Reads a `when` clause into a function of the context. Throws a `SyntaxError` for one it can't read. */
export function parseWhen(source: string): When {
  const known = cache.get(source)
  if (known) return known
  const tokens = tokenize(source)
  let at = 0
  const peek = () => tokens[at]
  const fail = (what: string): never => {
    throw new SyntaxError(`${what} at ${peek()?.at ?? source.length} in "${source}"`)
  }
  const isOp = (text: string) => peek()?.kind === 'op' && peek()!.text === text

  const or = (): When => {
    const parts = [and()]
    while (isOp('||')) {
      at++
      parts.push(and())
    }
    return parts.length === 1 ? parts[0]! : (get) => parts.some((p) => p(get))
  }
  const and = (): When => {
    const parts = [unary()]
    while (isOp('&&')) {
      at++
      parts.push(unary())
    }
    return parts.length === 1 ? parts[0]! : (get) => parts.every((p) => p(get))
  }
  const unary = (): When => {
    if (isOp('!')) {
      at++
      const inner = unary()
      return (get) => !inner(get)
    }
    if (isOp('(')) {
      at++
      const inner = or()
      if (!isOp(')')) fail('Expected ")"')
      at++
      return inner
    }
    const token = peek()
    if (token?.kind !== 'word') return fail('Expected a key')
    at++
    const key = token.text
    if (key === 'true') return () => true
    if (key === 'false') return () => false
    const op = peek()
    if (op?.kind === 'op' && ['==', '!=', '===', '!=='].includes(op.text)) {
      at++
      const value = peek()
      if (!value || value.kind === 'op') return fail('Expected a value')
      at++
      const equal = (get: (key: string) => unknown) => {
        const v = get(key)
        return v !== undefined && v !== null && String(v) === value.text
      }
      return op.text.startsWith('!') ? (get) => !equal(get) : equal
    }
    return (get) => !!get(key)
  }

  if (!tokens.length) fail('Empty clause')
  const result = or()
  if (at < tokens.length) fail('Unexpected text')
  cache.set(source, result)
  return result
}

/** Whether a clause holds. No clause always holds. */
export function evaluateWhen(source: string | undefined, get: (key: string) => unknown): boolean {
  return source === undefined || source.trim() === '' || parseWhen(source)(get)
}
