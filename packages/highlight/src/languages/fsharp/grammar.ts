import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words(`
  abstract and as assert base begin class default delegate do done downcast downto elif else end
  exception extern for fun function global if in inherit inline interface internal lazy let match
  member module mutable namespace new not of open or override private public rec return select sig
  static struct then to try type upcast use val void when while with yield async task
`)
const TYPES = words('int int64 float decimal string bool char byte unit obj list seq option array Result Async Task')
const BUILTINS = words('printfn printf sprintf failwith raise ignore id fst snd not box unbox')

function name(text: string): TokenType | undefined {
  if (KEYWORDS.has(text)) return 'keyword'
  if (text === 'true' || text === 'false' || text === 'null') return 'constant'
  if (TYPES.has(text)) return 'builtin'
  if (BUILTINS.has(text)) return 'builtin'
  if (/^[A-Z]/.test(text)) return 'type'
  return undefined
}

export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /\/\/.*/, token: 'comment' },
      { match: /\(\*(?!\))/, token: 'comment', push: 'comment' },
      { match: /#(?:if|else|endif|light|load|r|nowarn|time)\b.*/, token: 'meta', after: (p) => p === undefined },
      { match: /\[<[^>\n]*>\]/, token: 'meta' }, // [<EntryPoint>]
      { match: /\$?"""/, token: 'string', push: (t) => (t.startsWith('$') ? 'triple/i' : 'triple/') },
      { match: /\$@"|@\$"|@"/, token: 'string', push: (t) => (t.includes('$') ? 'verbatim/i' : 'verbatim/') },
      { match: /\$?"/, token: 'string', push: (t) => (t.startsWith('$') ? 'string/i' : 'string/') },
      { match: /'(?:[^'\\\n]|\\(?:u[\da-fA-F]{4}|.))'B?/, token: 'string' },
      { match: /'[a-z_]\w*/, token: 'type' }, // 'a
      // A function: let f x, member this.Fetch(…). A value (let x = 1) isn't one.
      { match: /(let|and)(\s+)(?:(rec|inline|private)(\s+))?([a-z_]\w*)(?=\s+[\w(]|\s*\()/, groups: ['keyword', undefined, 'keyword', undefined, 'function'] },
      { match: /(member|override|abstract|default)(\s+)(?:([a-z_]\w*)(\.))?([A-Za-z_]\w*)/, groups: ['keyword', undefined, 'variable', 'punctuation', 'function'] },
      { match: /(type|module|exception)(\s+)([A-Za-z_]\w*)/, groups: ['keyword', undefined, 'type'] },
      { match: /(\.)([A-Za-z_]\w*)/, groups: ['punctuation', 'property'] },
      { match: /[A-Za-z_]\w*/, token: name },
      { match: /(?:0[xX][\da-fA-F_]+|0[oO][0-7_]+|0[bB][01_]+|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][-+]?\d+)?)(?:uy|y|s|us|u|l|ul|L|UL|n|un|m|M|f|F)?/, token: 'number' },
      { match: /\|>|<\||>>|<<|->|<-|:=|::|:>|:\?>?|\?\?|&&|\|\||<>|[-+*/%=<>@^|&!?~$:]+/, token: 'operator' },
      { match: /[()[\]{},;.]/, token: 'punctuation' },
    ],
    // "…", $"…{x}…": "string/i" interpolates.
    string: [
      { match: /"/, token: 'string', pop: true },
      { match: /\\(?:u[\da-fA-F]{4}|U[\da-fA-F]{8}|.?)/, token: 'escape' },
      { match: (line, pos, i) => (i === 'i' && (line.startsWith('{{', pos) || line.startsWith('}}', pos)) ? 2 : -1), token: 'escape' },
      { match: (line, pos, i) => (i === 'i' && line[pos] === '{' ? 1 : -1), token: 'escape', push: 'interpolation' },
      { match: /[^"\\{}]+|[{}]/, token: 'string' },
    ],
    verbatim: [
      { match: /""/, token: 'escape' },
      { match: /"/, token: 'string', pop: true },
      { match: (line, pos, i) => (i === 'i' && line[pos] === '{' ? 1 : -1), token: 'escape', push: 'interpolation' },
      { match: /[^"{}]+|[{}]/, token: 'string' },
    ],
    triple: [
      { match: /"""/, token: 'string', pop: true },
      { match: (line, pos, i) => (i === 'i' && line[pos] === '{' ? 1 : -1), token: 'escape', push: 'interpolation' },
      { match: /[^"{}]+|["{}]/, token: 'string' },
    ],
    interpolation: [
      { match: /\}/, token: 'escape', pop: true },
      { match: /:[^}"]*(?=\})/, token: 'escape' },
      { include: 'root' },
    ],
    comment: [
      { match: /\(\*/, token: 'comment', push: 'comment' },
      { match: /\*\)/, token: 'comment', pop: true },
      { match: /[^(*]+|[(*]/, token: 'comment' },
    ],
  },
}
