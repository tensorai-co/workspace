import type { Grammar } from '../../engine/grammar.js'
import type { Token } from '../../tokens.js'

/** Where a key can be: a line's start, after "- " or "? ", or in a flow map after { or ,. */
function keyAllowed(prev: Token | undefined): boolean {
  return !prev || /^(?:-|\?|\{|,)$/.test(prev.text)
}

/** What ends a value: the line, a comment, or in a flow collection , ] }. */
const VALUE_END = /(?=[ \t]*(?:\s#|$|[,\]}]))/.source

const indent = (line: string) => /^ */.exec(line)![0].length

export const grammar: Grammar = {
  states: {
    root: [
      { match: /(?:---|\.\.\.)(?=\s|$)/, token: 'meta', after: (p) => p === undefined },
      { match: /%\w+.*/, token: 'meta', after: (p) => p === undefined },
      { include: 'node' },
      // A block scalar: | or >, then indented lines of text.
      { match: /[|>][-+]?\d?(?=[ \t]*(?:#.*)?$)/, token: 'operator', push: 'blockStart' },
      // A plain value runs to the end of the line or a comment, braces and all: ${{ x }}.
      { match: /[^\s#[\]{},][^\n]*?(?=[ \t]+#|[ \t]*$)/ },
    ],
    // [a, b] and {k: v}: plain values end at , ] }.
    flow: [
      { match: /[\]}]/, token: 'punctuation', pop: true },
      { include: 'node' },
      { match: /,/, token: 'punctuation' },
      { match: /[^\s#,[\]{}]+(?:[ \t]+[^\s#,[\]{}]+)*/ },
    ],
    // What blocks and flows share: keys, quoted and typed values, anchors, tags.
    node: [
      { match: /\s+/ },
      { match: /(?<![^\s])#.*/, token: 'comment' },
      { match: /"(?:[^"\\\n]|\\.)*"(?=[ \t]*:(?:\s|$))/, token: 'property', after: keyAllowed },
      { match: /'(?:[^'\n]|'')*'(?=[ \t]*:(?:\s|$))/, token: 'property', after: keyAllowed },
      { match: /(?:[^\s#'"[\]{},&*!|>%@`?:-]|[-?:](?=\S))[^#\n]*?(?=[ \t]*:(?:\s|$))/, token: 'property', after: keyAllowed },
      { match: /[-?](?=\s|$)/, token: 'punctuation' },
      { match: /:(?=\s|$)/, token: 'punctuation' },
      { match: /[[{]/, token: 'punctuation', push: 'flow' },
      { match: /"/, token: 'string', push: 'double' },
      { match: /'/, token: 'string', push: 'single' },
      { match: /[&*][^\s,[\]{}]+/, token: 'variable' }, // &anchor, *alias
      { match: /!(?:<[^>\n]*>|[\w!.:/-]*)/, token: 'meta' }, // !!str, !Ref
      { match: new RegExp(`(?:true|false|True|False|TRUE|FALSE|yes|no|on|off|null|Null|NULL|~)${VALUE_END}`), token: 'constant' },
      {
        match: new RegExp(`[-+]?(?:0x[\\da-fA-F]+|0o[0-7]+|(?:\\d[\\d_]*(?:\\.\\d*)?|\\.\\d+)(?:[eE][-+]?\\d+)?|\\.(?:inf|Inf|INF|nan|NaN|NAN))${VALUE_END}`),
        token: 'number',
      },
    ],
    double: [
      { match: /[^"\\]+/, token: 'string' },
      { match: /\\(?:x[\da-fA-F]{2}|u[\da-fA-F]{4}|U[\da-fA-F]{8}|.?)/, token: 'escape' },
      { match: /"/, token: 'string', pop: true },
    ],
    single: [
      { match: /[^']+/, token: 'string' },
      { match: /''/, token: 'escape' },
      { match: /'/, token: 'string', pop: true },
    ],
    // The rest of the | line; then the first text line sets the block's indent.
    blockStart: [
      { match: (line, pos) => (pos === 0 && /\S/.test(line) && indent(line) > 0 ? indent(line) : -1), next: (text) => `block/${text.length}` },
      { match: (line, pos) => (pos === 0 && /\S/.test(line) ? 0 : -1), pop: true },
      { match: /[ \t]+/ },
      { match: /#.*/, token: 'comment' },
    ],
    // Lines indented at least as far as the first are text, and blank lines.
    block: [
      { match: (line, pos, n) => (pos === 0 && (indent(line) >= Number(n) || !/\S/.test(line)) ? line.length : -1), token: 'string' },
      { match: (line, pos) => (pos === 0 && /\S/.test(line) ? 0 : -1), pop: true },
      { match: /.+/, token: 'string' }, // the first line, after its indent
    ],
  },
}
