import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words(`
  def theorem lemma example abbrev instance structure inductive class where extends namespace
  section end open export import variable universe axiom noncomputable partial private protected
  unsafe mutual deriving fun λ match with if then else do let have show from by calc at this return
  for in unless mut try catch macro syntax macro_rules notation infix infixl infixr prefix postfix
  set_option attribute local scoped
`)
const TYPES = words(`
  Nat Int Float String Bool Prop Type Sort List Array Option IO Unit Char Fin UInt8 UInt32 UInt64
  Except
`)
const CONSTANTS = words('true false none some rfl sorry')
const BUILTINS = words(`
  simp rw exact intro intros apply refine cases induction constructor rfl omega decide linarith
  norm_num aesop assumption contradiction exfalso unfold trivial ring use obtain rcases specialize
  congr ext funext
`)

function name(text: string): TokenType | undefined {
  if (KEYWORDS.has(text)) return 'keyword'
  if (TYPES.has(text)) return 'builtin'
  if (CONSTANTS.has(text)) return 'constant'
  if (/^[A-Z][A-Z\d_]+$/.test(text) && text.length > 1) return 'constant'
  if (/^[A-Z]/.test(text)) return 'type'
  return undefined
}

const IDENT = /[A-Za-z_α-ωΑ-Ω][\w'!?₀-₉]*/.source

// Lean 4: definitions, theorems and tactic proofs, #commands, @[attributes] and Unicode notation.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /'[^'\\\n]'|'\\.'/, token: 'string' },
      { match: /\-\-.*/, token: 'comment' },
      { match: /\/\-/, token: 'comment', push: 'blockComment' },
      { match: /"/, token: 'string', push: 'string0' },
      { match: /@\[[^\]]*\]|#[a-z_]+/, token: 'meta' },
      { match: new RegExp(`(structure|inductive|class|instance|namespace)(\\s+)(${IDENT})`), groups: ['keyword', undefined, 'type'] },
      { match: new RegExp(`(def|theorem|lemma|abbrev)(\\s+)(${IDENT})`), groups: ['keyword', undefined, 'function'] },
      { match: new RegExp(`(\\??\\.)(${IDENT})(?=\\s*\\()`), groups: ['punctuation', 'function'] },
      { match: new RegExp(`(\\??\\.)(${IDENT})`), groups: ['punctuation', 'property'] },
      { match: new RegExp(`${IDENT}(?=\\s*\\()`), token: (t) => name(t) ?? (BUILTINS.has(t) ? 'builtin' : 'function') },
      { match: new RegExp(IDENT), token: (t) => name(t) ?? (BUILTINS.has(t) ? 'builtin' : undefined) },
      { match: /0[xX][\da-fA-F_]+\w*|0[bB][01_]+\w*|0[oO][0-7_]+\w*|(?:\d[\d_]*(?:\.(?![.A-Za-z_])[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?\d+)?\w*/, token: 'number' },
      { match: /[→←↔∀∃λ∧∨¬≠≤≥∘×▸·∈∉⊆∪∩]|:=|=>|<-|->|<\|>|\|>|<\||::|\.\.|&&|\|\||[-+*/%<>=!^&|:$]=?/, token: 'operator' },
      { match: /[()[\]{},;.⟨⟩]/, token: 'punctuation' },
    ],
    string0: [
      { match: /"/, token: 'string', pop: true },
      { match: /\\(?:x[\da-fA-F]{2}|u\{[\da-fA-F]+\}|u[\da-fA-F]{4}|.?)/, token: 'escape' },
      { match: /[^"\\]+/, token: 'string' },
      { match: /./, token: 'string' },
      { match: /$/, pop: true },
    ],
    blockComment: [
      { match: /[^\-\/]+/, token: 'comment' },
      { match: /\/\-/, token: 'comment', push: 'blockComment' }, // they nest
      { match: /\-\//, token: 'comment', pop: true },
      { match: /[\-\/]/, token: 'comment' },
    ],
  },
}
