import type { Grammar } from '../../engine/grammar.js'
import { lengthAt, words } from '../../language.js'

const BUILTINS = words(`
  is not call findall bagof setof forall assert asserta assertz retract format write writeln print nl
  read atom number var nonvar atom_codes atom_chars atom_length atom_string number_codes sub_atom
  length append member memberchk reverse nth0 nth1 msort sort predsort last sum_list max_list min_list
  maplist foldl include exclude succ_or_fail between succ plus copy_term functor arg halt catch throw
  string_concat split_string string_chars format_atom tab true fail false once ignore
`)

/** A clause's head: its name, at the start of a line. */
const HEAD = /[a-z]\w*(?=\(|\s*(?::-|-->|\.))/y

// Prolog: facts and rules, Variables, 'quoted atoms', "strings", :- and
// --> clauses, % and /* */ comments.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /%.*/, token: 'comment' },
      { match: /\/\*/, token: 'comment', push: 'blockComment' },
      { match: /(:-)(\s*)(\w+)/, groups: ['operator', undefined, 'keyword'], after: (p) => p === undefined }, // :- module(…), :- use_module
      { match: /"/, token: 'string', push: 'double' },
      { match: /`/, token: 'string', push: 'backquote' },
      { match: /'/, token: 'string', push: 'single' },
      { match: /0'(?:\\.|.)/, token: 'string' }, // 0'a: a character code
      // A clause's head, at the start of a line: append([], L, L).
      { match: (line, pos) => (pos === 0 ? lengthAt(HEAD, line, pos) : -1), token: 'function' },
      { match: /[a-z]\w*(?=\()/, token: (t) => (BUILTINS.has(t) ? 'builtin' : 'function') },
      { match: /[A-Z_]\w*/, token: 'variable' },
      { match: /[a-z]\w*/, token: (t) => (BUILTINS.has(t) ? 'builtin' : t === 'is' || t === 'mod' || t === 'rem' ? 'operator' : undefined) },
      { match: /0[xob][\da-fA-F]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/, token: 'number' },
      { match: /:-|-->|\?-|->|\\\+|=\.\.|=:=|=\\=|\\==|==|\\=|@?[<>]=?|=<|>=|[-+*/^=<>|;!\\]|#=|#\\=|#[<>]=?/, token: 'operator' },
      { match: /[()[\]{},.]/, token: 'punctuation' },
    ],
    double: [
      { match: /"/, token: 'string', pop: true },
      { match: /\\./, token: 'escape' },
      { match: /~[\w~]/, token: 'escape' }, // format directives: ~w ~a ~n
      { match: /[^"\\~]+|~/, token: 'string' },
    ],
    backquote: [
      { match: /`/, token: 'string', pop: true },
      { match: /[^`]+/, token: 'string' },
    ],
    single: [
      { match: /'/, token: 'string', pop: true },
      { match: /\\.|''/, token: 'escape' },
      { match: /~[\w~]/, token: 'escape' },
      { match: /[^'\\~]+|~/, token: 'string' },
    ],
    blockComment: [
      { match: /[^*]+/, token: 'comment' },
      { match: /\*\//, token: 'comment', pop: true },
      { match: /\*/, token: 'comment' },
    ],
  },
}
