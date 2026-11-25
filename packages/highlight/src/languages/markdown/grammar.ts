import type { Grammar } from '../../engine/grammar.js'

/**
 * A fenced block's state: "code/```/python", its fence and its language.
 * The code runs in that language until a closing fence of the same
 * character, at least as long, on a line of its own.
 */
function openFence(text: string): string {
  const m = /^ {0,3}(`{3,}|~{3,})\s*([^\s`{]*)/.exec(text)!
  return `code/${m[1]}/${m[2]!.replace(/^\{?\.?/, '')}`
}

const CLOSE = /^ {0,3}(`{3,}|~{3,})\s*$/

/** closes reports whether line closes the fence in arg ("```/python"). */
function closes(line: string, arg: string): boolean {
  const fence = arg.slice(0, arg.indexOf('/'))
  const m = CLOSE.exec(line)
  return !!m && m[1]![0] === fence[0] && m[1]!.length >= fence.length
}

export const grammar: Grammar = {
  states: {
    root: [
      { match: / {0,3}(?:`{3,}[^`\n]*|~{3,}.*)$/, token: 'meta', push: openFence, after: (p) => p === undefined },
      { match: / {0,3}#{1,6}(?=\s|$).*/, token: 'property', after: (p) => p === undefined }, // # Heading
      { match: / {0,3}(?:(?:\*\s*){3,}|(?:-\s*){3,}|(?:_\s*){3,})$/, token: 'meta', after: (p) => p === undefined }, // ---
      { match: /(?:=+|-+)\s*$/, token: 'property', after: (p) => p === undefined }, // a setext underline
      { match: /(\s*)(>)/, groups: [undefined, 'comment'], after: (p) => p === undefined || p.text === '>' },
      { match: /(\s*)([-*+]|\d{1,9}[.)])(?=\s)/, groups: [undefined, 'variable'], after: (p) => p === undefined || p.text === '>' },
      { match: /(\[[ xX]\])(?=\s)/, token: 'variable', after: (p) => !!p && p.type === 'variable' }, // - [x] task
      { match: /( {0,3})(\[[^\]\n]+\])(:)(\s*)(\S+)/, groups: [undefined, 'string', 'punctuation', undefined, 'regexp'], after: (p) => p === undefined }, // [ref]: url
      { match: /\|/, token: 'punctuation' },
      { include: 'inline' },
    ],
    inline: [
      { match: /\\[!-/:-@[-`{-~]/, token: 'escape' },
      { match: /(`+)(?:(?!\1)[^`]|`)+?\1(?!`)/, token: 'string' }, // `code`
      { match: /!?\[(?=[^\]\n]*\]\()/, token: 'punctuation', push: 'linkText' },
      { match: /<(?:https?:\/\/|mailto:)[^>\s]+>/, token: 'regexp' }, // <https://…>
      { match: /<\/?[A-Za-z][\w-]*(?:\s[^>]*)?\/?>/, token: 'tag' }, // inline HTML
      { match: /(\*\*|__)(?=\S)/, token: 'punctuation', push: (t) => `strong/${t}` },
      { match: /([*_])(?=[^\s*_])/, token: 'punctuation', push: (t) => `emphasis/${t}`, after: (p) => !p || !/\w$/.test(p.text) },
      { match: /~~(?=\S)/, token: 'punctuation', push: 'strike' },
      { match: /[^\\`![<*_~|]+|[\\`![<*_~|]/ },
    ],
    // [text](url "title")
    linkText: [
      { match: /(\])(\()([^)\s]*)(?:(\s+)("[^"\n]*"))?(\))/, groups: ['punctuation', 'punctuation', 'regexp', undefined, 'string', 'punctuation'], pop: true },
      { match: /\]/, token: 'punctuation', pop: true },
      { match: /[^\]`\\]+/, token: 'string' },
      { include: 'inline' },
    ],
    strong: [
      { match: (line, pos, d) => (line.startsWith(d, pos) ? 2 : -1), token: 'punctuation', pop: true },
      { match: /$/, pop: true },
      { match: /[^*_`\\[]+/, token: 'keyword' },
      { include: 'inline' },
    ],
    emphasis: [
      { match: (line, pos, d) => (line[pos] === d && line[pos + 1] !== d ? 1 : -1), token: 'punctuation', pop: true },
      { match: /$/, pop: true },
      { match: /[^*_`\\[]+/, token: 'variable' },
      { include: 'inline' },
    ],
    // A fenced block: the code starts on the next line, and its closing fence ends it.
    code: [
      { match: (line, pos, arg) => (pos === 0 && closes(line, arg) ? line.length : -1), token: 'meta', pop: true },
      { match: (line, pos) => (pos === line.length ? 0 : -1), push: (_t, arg) => `@fence/${arg}` },
    ],
    strike: [
      { match: /~~/, token: 'punctuation', pop: true },
      { match: /$/, pop: true },
      { match: /[^~`\\[]+/, token: 'comment' },
      { include: 'inline' },
    ],
  },
  embeds: {
    fence: {
      language: (arg) => arg.slice(arg.indexOf('/') + 1),
      end: (line, from, arg) => (from === 0 && closes(line, arg) ? 0 : -1),
    },
  },
}

