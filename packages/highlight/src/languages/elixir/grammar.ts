import type { Grammar, Rule } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { lengthAt, words } from '../../language.js'

const KEYWORDS = words(`
  after alias and case catch cond def defdelegate defexception defguard defimpl defmacro defmodule
  defoverridable defp defprotocol defstruct do else end fn for if import in not or quote raise
  receive require rescue reraise try unless unquote use when with
`)
const CONSTANTS = words('true false nil')

function name(text: string): TokenType | undefined {
  if (KEYWORDS.has(text)) return 'keyword'
  if (CONSTANTS.has(text)) return 'constant'
  return undefined
}

/** A sigil's closing delimiter: ~r/…/, ~s(…), ~w[…], ~H"""…""". */
const CLOSE: Record<string, string> = { '(': ')', '[': ']', '{': '}', '<': '>' }

/** A sigil's state: "regex/i/)" or "sigil//]", i when it interpolates (lowercase letter), then its closing. */
function sigil(text: string): string {
  const letter = text[1]!
  const open = text.slice(2)
  const close = open.length === 3 ? open : (CLOSE[open] ?? open)
  return `${letter === 'r' || letter === 'R' ? 'regex' : 'sigil'}/${/[a-z]/.test(letter) ? 'i' : ''}/${close}`
}

const closing = (arg: string) => arg.slice(arg.indexOf('/') + 1)

/** A sigil's rules, in its color: to the closing delimiter and any modifiers. */
function sigilRules(token: TokenType): Rule[] {
  return [
    { match: (line, pos, arg) => (line.startsWith(closing(arg), pos) ? closing(arg).length + lengthAt(MODIFIERS, line, pos + closing(arg).length) : -1), token, pop: true },
    { match: (line, pos, arg) => (arg.startsWith('i/') && line.startsWith('#{', pos) ? 2 : -1), token: 'escape', push: 'interpolation' },
    { match: /\\./, token: 'escape' },
    { match: /[^\\#/|"')\]}>]+|./, token },
  ]
}
const MODIFIERS = /[a-zA-Z]*/y

export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /#.*/, token: 'comment' },
      { match: /"""/, token: 'string', push: 'heredoc' },
      { match: /"/, token: 'string', push: 'double' },
      { match: /'(?:[^'\\\n]|\\.)*'/, token: 'string' }, // a charlist
      { match: /~[A-Za-z](?:"""|'''|[/|"'([{<])/, token: (t) => (/^~[rR]/.test(t) ? 'regexp' : 'string'), push: sigil },
      { match: /:"(?:[^"\\\n]|\\.)*"|:[A-Za-z_][\w@]*[?!]?|:(?:<<>>|\.\.\.|[-+*/<>=!&|^~@]+)/, token: 'constant' }, // :atom
      { match: /[A-Za-z_][\w@]*[?!]?:(?=\s)/, token: 'property' }, // keyword: value
      { match: /@[a-z_]\w*/, token: 'meta' }, // @moduledoc
      { match: /(def[a-z]*)(\s+)([a-z_][\w]*[?!]?)/, groups: ['keyword', undefined, 'function'] },
      { match: /__[A-Z]+__/, token: 'constant' }, // __MODULE__
      { match: /[A-Z][\w]*(?:\.[A-Z][\w]*)*/, token: 'type' }, // Enum, MyApp.Repo
      { match: /(\.)([a-z_][\w]*[?!]?)(?=\s*\(|\s+[\w"':[{])/, groups: ['punctuation', 'function'] },
      { match: /(\.)([a-z_][\w]*)/, groups: ['punctuation', 'property'] },
      { match: /[a-z_][\w]*[?!]?(?=\s*\()/, token: (t) => name(t) ?? 'function' },
      { match: /[a-z_][\w]*[?!]?/, token: name },
      { match: /\?(?:\\.|.)/, token: 'string' }, // ?a
      { match: /0x[\da-fA-F_]+|0b[01_]+|0o[0-7_]+|\d[\d_]*(?:\.\d[\d_]*(?:[eE][-+]?\d+)?)?/, token: 'number' },
      { match: /\|>|<-|->|=>|<>|\+\+|--|\.\.\/\/|\.\.|::|===?|!==?|<=|>=|&&|\|\||<<<|>>>|\\\\|[-+*/<>=!&|^~@]/, token: 'operator' },
      { match: /[()[\]{},;.%]/, token: 'punctuation' },
    ],
    interpolated: [
      { match: /\\./, token: 'escape' },
      { match: /#\{/, token: 'escape', push: 'interpolation' },
    ],
    double: [
      { match: /[^"\\#]+/, token: 'string' },
      { include: 'interpolated' },
      { match: /#/, token: 'string' },
      { match: /"/, token: 'string', pop: true },
    ],
    heredoc: [
      { match: /"""/, token: 'string', pop: true },
      { match: /[^"\\#]+|"/, token: 'string' },
      { include: 'interpolated' },
      { match: /#/, token: 'string' },
    ],
    sigil: sigilRules('string'),
    regex: sigilRules('regexp'),
    interpolation: [
      { match: /\}/, token: 'escape', pop: true },
      { match: /\{/, token: 'punctuation', push: 'braces' },
      { include: 'root' },
    ],
    braces: [
      { match: /\}/, token: 'punctuation', pop: true },
      { match: /\{/, token: 'punctuation', push: 'braces' },
      { include: 'root' },
    ],
  },
}
