import type { Grammar } from '../../engine/grammar.js'
import type { Token } from '../../tokens.js'

/** A block's type starts a line: service "web" {, locals {. */
const blockStart = (prev: Token | undefined) => prev === undefined

/** An object's key starts a line, or follows { or ,: not cond ? "a" : "b". */
const keyAllowed = (prev: Token | undefined) => !prev || prev.text === '{' || prev.text === ','

/** The word a heredoc ends at, from its opening: <<EOF, <<-EOT. */
function heredoc(text: string): string {
  return (text.startsWith('<<-') ? 'heredoc/-' : 'heredoc/') + text.replace(/^<<-?/, '')
}

export const grammar: Grammar = {
  states: {
    root: [
      { match: /[A-Za-z_][\w-]*(?=(?:\s+(?:"[^"\n]*"|[A-Za-z_][\w-]*))*\s*\{)/, token: 'keyword', after: blockStart },
      { include: 'expression' },
    ],
    expression: [
      { match: /\s+/ },
      { match: /(?:#|\/\/).*/, token: 'comment' },
      { match: /\/\*/, token: 'comment', push: 'blockComment' },
      { match: /<<-?[A-Za-z_]\w*/, token: 'string', push: heredoc },
      { match: /"/, token: 'string', push: 'string' },
      { match: /[A-Za-z_][\w-]*(?=\s*=(?!=))/, token: 'property' },
      { match: /(?:for|in|if)(?![\w-])/, token: 'keyword' },
      { match: /(?:true|false|null)(?![\w-])/, token: 'constant' },
      { match: /[A-Za-z_][\w-]*(?=\s*\()/, token: 'function' },
      { match: /(\.)([A-Za-z_][\w-]*)/, groups: ['punctuation', 'property'] },
      { match: /[A-Za-z_][\w-]*/ },
      { match: /\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/, token: 'number' },
      { match: /\{/, token: 'punctuation', push: 'braces' },
      { match: /=>|==|!=|<=|>=|&&|\|\||\.\.\.|[-+*/%<>!?:=]/, token: 'operator' },
      { match: /[()[\],.]/, token: 'punctuation' },
    ],
    // A block body or an object: attributes, nested blocks, to the closing }.
    braces: [
      { match: /\}/, token: 'punctuation', pop: true },
      { match: /[A-Za-z_][\w-]*(?=(?:\s+(?:"[^"\n]*"|[A-Za-z_][\w-]*))*\s*\{)/, token: 'keyword', after: blockStart },
      { match: /(?:"[^"\n]*"|[A-Za-z_][\w-]*)(?=\s*:(?!:))/, token: 'property', after: keyAllowed },
      { include: 'expression' },
    ],
    // "…${expr}…%{ if x }…%{ endif }"
    template: [
      { match: /\$\$\{|%%\{/, token: 'escape' },
      { match: /\$\{~?/, token: 'escape', push: 'interpolation' },
      { match: /%\{~?/, token: 'escape', push: 'directive' },
    ],
    string: [
      { match: /[^"\\$%]+/, token: 'string' },
      { match: /\\(?:u[\da-fA-F]{4}|U[\da-fA-F]{8}|.?)/, token: 'escape' },
      { include: 'template' },
      { match: /[$%]/, token: 'string' },
      { match: /"/, token: 'string', pop: true },
      { match: /$/, pop: true },
    ],
    interpolation: [
      { match: /~?\}/, token: 'escape', pop: true },
      { include: 'expression' },
    ],
    directive: [
      { match: /~?\}/, token: 'escape', pop: true },
      { match: /(?:if|else|endif|for|in|endfor)(?![\w-])/, token: 'keyword' },
      { include: 'expression' },
    ],
    // Lines up to the closing word, alone on its line (indented, with <<-).
    heredoc: [
      {
        match: (line, pos, arg) => {
          const word = arg.replace(/^-/, '')
          const text = arg.startsWith('-') ? line.trim() : line
          return pos === 0 && text === word ? line.length : -1
        },
        token: 'string',
        pop: true,
      },
      { include: 'template' },
      { match: /[^$%]+|[$%]/, token: 'string' },
    ],
    blockComment: [
      { match: /[^*]+/, token: 'comment' },
      { match: /\*\//, token: 'comment', pop: true },
      { match: /\*/, token: 'comment' },
    ],
  },
}
