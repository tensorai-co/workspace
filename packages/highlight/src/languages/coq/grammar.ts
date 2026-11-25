import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words(`
  Definition Theorem Lemma Remark Fact Corollary Proposition Example Fixpoint CoFixpoint Inductive
  CoInductive Record Structure Class Instance Context Variable Variables Hypothesis Parameter Axiom
  Module End Section Require Import Export Open Scope Notation Infix Ltac Proof Qed Defined Admitted
  Abort Check Compute Eval Print Search About Arguments Implicit Set Unset Hint Local Global Program
  Let match with end fun forall exists if then else let in as return struct fix cofix Type Prop Set
`)
const TYPES = words('nat bool list option prod sum unit Z Q R string')
const CONSTANTS = words('true false O S nil cons None Some tt I')
const BUILTINS = words(`
  intros intro apply exact reflexivity simpl rewrite induction destruct inversion auto eauto omega
  lia unfold split left right exists assumption contradiction discriminate injection constructor
  subst trivial congruence ring field f_equal generalize revert specialize assert pose clear easy
  now
`)

function name(text: string): TokenType | undefined {
  if (KEYWORDS.has(text)) return 'keyword'
  if (TYPES.has(text)) return 'builtin'
  if (CONSTANTS.has(text)) return 'constant'
  return undefined
}

const IDENT = /[A-Za-z_][\w']*/.source

// Rocq (formerly Coq): vernacular commands, Gallina terms and Ltac proofs, between (* nested comments *).
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /\(\*/, token: 'comment', push: 'blockComment' },
      { match: /"/, token: 'string', push: 'string0' },
      { match: new RegExp(`(Inductive|Record|Structure|Class|Module|Section)(\\s+)(${IDENT})`), groups: ['keyword', undefined, 'type'] },
      { match: new RegExp(`(Definition|Theorem|Lemma|Fixpoint|CoFixpoint|Example|Remark|Fact|Corollary|Proposition|Instance|Ltac)(\\s+)(${IDENT})`), groups: ['keyword', undefined, 'function'] },
      { match: new RegExp(`(\\??\\.)(${IDENT})(?=\\s*\\()`), groups: ['punctuation', 'function'] },
      { match: new RegExp(`(\\??\\.)(${IDENT})`), groups: ['punctuation', 'property'] },
      { match: new RegExp(`${IDENT}(?=\\s*\\()`), token: (t) => name(t) ?? (BUILTINS.has(t) ? 'builtin' : 'function') },
      { match: new RegExp(IDENT), token: (t) => name(t) ?? (BUILTINS.has(t) ? 'builtin' : undefined) },
      { match: /0[xX][\da-fA-F_]+\w*|0[bB][01_]+\w*|0[oO][0-7_]+\w*|(?:\d[\d_]*(?:\.(?![.A-Za-z_])[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?\d+)?\w*/, token: 'number' },
      { match: /:=|=>|->|<->|<-|\/\\|\\\/|::|\+\+|[-+*\/<>=~!|&@:%]=?/, token: 'operator' },
      { match: /[()[\]{},;.]/, token: 'punctuation' },
    ],
    string0: [
      { match: /"/, token: 'string', pop: true },
      { match: /[^"]+/, token: 'string' },
      { match: /./, token: 'string' },
      { match: /$/, pop: true },
    ],
    blockComment: [
      { match: /[^()*]+/, token: 'comment' },
      { match: /\(\*/, token: 'comment', push: 'blockComment' }, // they nest
      { match: /\*\)/, token: 'comment', pop: true },
      { match: /[()*]/, token: 'comment' },
    ],
  },
}
