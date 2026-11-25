import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words(`
  abstract and as break callable case catch class clone const continue declare default do echo else
  elseif empty enddeclare endfor endforeach endif endswitch endwhile enum extends final finally fn for
  foreach function global goto if implements include include_once instanceof insteadof interface
  isset list match namespace new or print private protected public readonly require require_once
  return static switch throw trait try unset use var while xor yield from
`)
const TYPES = words('array bool callable float int iterable mixed never object string void self parent')
const CONSTANTS = words('true false null TRUE FALSE NULL __CLASS__ __DIR__ __FILE__ __FUNCTION__ __LINE__ __METHOD__ __NAMESPACE__ __TRAIT__ PHP_EOL PHP_VERSION')
const BUILTINS = words(`
  array_filter array_key_exists array_keys array_map array_merge array_push array_reduce array_search
  array_slice array_sum array_unique array_values count in_array implode explode str_contains
  str_ends_with str_starts_with str_replace strlen strtolower strtoupper substr trim sprintf printf
  number_format json_encode json_decode var_dump var_export print_r die exit is_array is_null
  is_string is_int is_numeric intval floatval strval date time strtotime file_get_contents
  file_put_contents htmlspecialchars preg_match preg_replace sort usort ksort compact extract
  define defined function_exists class_exists method_exists dirname basename
`)

function name(text: string): TokenType | undefined {
  const lower = text.toLowerCase()
  if (KEYWORDS.has(lower)) return 'keyword'
  if (TYPES.has(lower)) return 'builtin'
  if (CONSTANTS.has(text) || lower === 'true' || lower === 'false' || lower === 'null') return 'constant'
  if (/^[A-Z][A-Z\d_]+$/.test(text)) return 'constant' // MAX_SIZE
  if (/^[A-Z]/.test(text)) return 'type' // User, PDO
  return undefined
}

const IDENT = /[A-Za-z_\x80-\uffff][\w\x80-\uffff]*/.source

/** The heredoc's state: "heredoc/EOT/i" interpolates; "heredoc/EOT/" (a nowdoc) doesn't. */
function heredoc(text: string): string {
  const m = /^<<<\s*(["']?)([A-Za-z_]\w*)\1$/.exec(text)!
  return `heredoc/${m[2]}/${m[1] === "'" ? '' : 'i'}`
}

export const grammar: Grammar = {
  states: {
    root: [
      { match: /<\?(?:php|=)?/, token: 'meta' },
      { match: /\?>/, token: 'meta', push: 'html' },
      { include: 'code' },
    ],
    // Outside <?php … ?>: the page's own text.
    html: [
      { match: /<\?(?:php|=)?/, token: 'meta', pop: true },
      { match: /[^<]+|</ },
    ],
    code: [
      { match: /\s+/ },
      { match: /#\[/, token: 'meta', push: 'attribute' },
      { match: /(?:\/\/|#).*?(?=\?>|$)/, token: 'comment' },
      { match: /\/\*/, token: 'comment', push: 'blockComment' },
      { match: /<<<\s*(["']?)[A-Za-z_]\w*\1/, token: 'string', push: heredoc },
      { match: /'/, token: 'string', push: 'single' },
      { match: /"/, token: 'string', push: 'double' },
      { match: /\$this\b/, token: 'variable' },
      { match: new RegExp(`\\$+${IDENT}`), token: 'variable' },
      { match: new RegExp(`(function|fn)(\\s+&?\\s*)(${IDENT})`), groups: ['keyword', undefined, 'function'] },
      { match: new RegExp(`(class|interface|trait|enum|extends|implements|new|instanceof)(\\s+)(\\\\?${IDENT}(?:\\\\${IDENT})*)`), groups: ['keyword', undefined, 'type'] },
      { match: new RegExp(`(namespace|use)(\\s+)(\\\\?${IDENT}(?:\\\\${IDENT})*)`), groups: ['keyword', undefined, 'type'] },
      { match: new RegExp(`(\\??->)(${IDENT})(?=\\s*\\()`), groups: ['operator', 'function'] },
      { match: new RegExp(`(\\??->)(${IDENT})`), groups: ['operator', 'property'] },
      { match: new RegExp(`(::)(${IDENT})(?=\\s*\\()`), groups: ['operator', 'function'] },
      { match: new RegExp(`(::)(${IDENT})`), groups: ['operator', 'constant'] },
      { match: new RegExp(`\\\\?${IDENT}(?:\\\\${IDENT})+`), token: 'type' }, // App\Models\User
      { match: new RegExp(`${IDENT}(?=\\s*\\()`), token: (t) => name(t) ?? (BUILTINS.has(t.toLowerCase()) ? 'builtin' : 'function') },
      { match: new RegExp(IDENT), token: name },
      { match: /(?:0[xX][\da-fA-F_]+|0[bB][01_]+|0[oO]?[0-7_]+|(?:\d[\d_]*(?:\.\d[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?\d+)?)/, token: 'number' },
      { match: /<=>|\*\*=?|===?|!==?|<>|\?\?=?|\?->|->|=>|::|\.\.\.|\+\+|--|&&|\|\||<<=?|>>=?|\.=|[-+*/%&|^<>!=.]=?|[~?:@]/, token: 'operator' },
      { match: /[()[\]{},;\\]/, token: 'punctuation' },
    ],
    // #[Route('/x')]: to the matching ].
    attribute: [
      { match: /\]/, token: 'meta', pop: true },
      { match: /\[/, token: 'meta', push: 'attribute' },
      { match: /'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/, token: 'string' },
      { match: /[^\]['"]+/, token: 'meta' },
    ],
    single: [
      { match: /[^'\\]+/, token: 'string' },
      { match: /\\['\\]/, token: 'escape' },
      { match: /\\/, token: 'string' },
      { match: /'/, token: 'string', pop: true },
    ],
    double: [
      { match: /[^"\\${]+/, token: 'string' },
      { match: /"/, token: 'string', pop: true },
      { include: 'interpolated' },
    ],
    // $var, $obj->prop, $arr['k'], {$expr} and ${var}, with escapes.
    interpolated: [
      { match: /\\(?:[nrtvef\\$"]|[0-7]{1,3}|x[\da-fA-F]{1,2}|u\{[\da-fA-F]+\})/, token: 'escape' },
      { match: /\{(?=\$)/, token: 'escape', push: 'interpolation' },
      { match: /\$\{/, token: 'escape', push: 'interpolation' },
      { match: new RegExp(`\\$${IDENT}(?:->${IDENT}|\\[[^\\]\\n]*\\])?`), token: 'variable' },
      { match: /[\\${]/, token: 'string' },
    ],
    interpolation: [
      { match: /\}/, token: 'escape', pop: true },
      { match: /\{/, token: 'punctuation', push: 'braces' },
      { include: 'code' },
    ],
    braces: [
      { match: /\}/, token: 'punctuation', pop: true },
      { match: /\{/, token: 'punctuation', push: 'braces' },
      { include: 'code' },
    ],
    // To the closing word, alone and possibly indented, on its own line.
    heredoc: [
      {
        match: (line, pos, arg) => {
          const word = arg.slice(0, arg.indexOf('/'))
          const m = /^\s*([A-Za-z_]\w*)/.exec(line)
          return pos === 0 && m?.[1] === word ? m[0].length : -1
        },
        token: 'string',
        pop: true,
      },
      { match: (line, pos, arg) => (arg.endsWith('/i') ? -1 : line.length - pos || -1), token: 'string' },
      { match: /[^\\${]+/, token: 'string' },
      { include: 'interpolated' },
    ],
    blockComment: [
      { match: /[^*]+/, token: 'comment' },
      { match: /\*\//, token: 'comment', pop: true },
      { match: /\*/, token: 'comment' },
    ],
  },
}
