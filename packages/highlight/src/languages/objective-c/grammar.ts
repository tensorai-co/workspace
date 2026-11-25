import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words(`
  alignas alignof auto break case const constexpr continue default do else enum extern for goto if
  inline register restrict return sizeof static static_assert struct switch thread_local typedef
  typeof typeof_unqual union volatile while _Alignas _Alignof _Atomic _Generic _Noreturn
  _Static_assert _Thread_local
`)
const TYPES = words(`
  bool char double float int long short signed unsigned void _Bool _Complex _Imaginary
  size_t ssize_t ptrdiff_t intptr_t uintptr_t intmax_t uintmax_t wchar_t FILE va_list
`)
const CONSTANTS = words('NULL true false nullptr EOF stdin stdout stderr YES NO nil Nil')
/** Objective-C's own: id, BOOL, instancetype, SEL… */
const OBJC_TYPES = words('id BOOL SEL Class IMP instancetype NSInteger NSUInteger CGFloat')
/** @interface, @property, @selector… */
const DIRECTIVES = words(`
  interface implementation end protocol property synthesize dynamic class selector encode optional
  required public private protected package try catch finally throw autoreleasepool synchronized
  import compatibility_alias available
`)
const BUILTINS = words(`
  printf fprintf sprintf snprintf scanf fscanf sscanf puts fputs putchar getchar fgets fopen fclose
  fread fwrite fflush malloc calloc realloc free memcpy memmove memset memcmp strlen strcpy strncpy
  strcat strncat strcmp strncmp strchr strrchr strstr strdup strtol strtoul strtod atoi atof exit
  abort atexit assert qsort bsearch abs labs rand srand time
`)

function name(text: string): TokenType | undefined {
  if (text === 'self' || text === 'super' || text === '_cmd') return 'variable'
  if (KEYWORDS.has(text)) return 'keyword'
  if (OBJC_TYPES.has(text)) return 'builtin'
  if (TYPES.has(text) || /^u?int(?:8|16|32|64)_t$/.test(text)) return 'builtin'
  if (CONSTANTS.has(text)) return 'constant'
  if (/_t$/.test(text) || /^[A-Z][a-z]\w*$/.test(text) || /^[A-Z]{2,}[a-z]\w*$/.test(text)) return 'type' // node_t, NSString, UIView
  if (/^_*[A-Z][A-Z\d_]+$/.test(text)) return 'constant' // a macro by convention: MAX_LEN, __FILE__
  return undefined
}

const IDENT = /[A-Za-z_]\w*/.source

// Objective-C: C with classes, @directives and [messages].
export const grammar: Grammar = {
  states: {
    root: [
      // A directive starts a line: #include <stdio.h>, #define MAX 10.
      { match: /(#\s*)(include|import|include_next)\b/, groups: ['meta', 'meta'], push: 'include', after: (p) => p === undefined },
      { match: /#\s*[A-Za-z_]+/, token: 'meta', push: 'directive', after: (p) => p === undefined },
      { include: 'code' },
    ],
    code: [
      { match: /\s+/ },
      { match: /\/\/.*/, token: 'comment' },
      { match: /\/\*/, token: 'comment', push: 'blockComment' },
      { match: /@"/, token: 'string', push: 'string' }, // @"an NSString"
      { match: /(?:u8|[uUL])?"/, token: 'string', push: 'string' },
      // @interface Name : Super, @implementation Name, @protocol Name
      { match: /(@(?:interface|implementation|protocol))(\s+)([A-Za-z_]\w*)/, groups: ['keyword', undefined, 'type'] },
      { match: /@[a-z]+/, token: (t) => (DIRECTIVES.has(t.slice(1)) ? 'keyword' : undefined) },
      { match: /@(?=[[{(\d])/, token: 'punctuation' }, // @[…], @{…}, @(…), @42
      // A method: - (void)load:(NSString *)city, and the parts of a message: [cache objectForKey:key]
      { match: /[A-Za-z_]\w*(?=:(?!:))/, token: (t) => name(t) ?? 'function', after: (p) => !p || p.text !== '?' },
      { match: /[A-Za-z_]\w*(?=\s*\])/, token: (t) => name(t) ?? 'function', after: (p) => !!p && (p.type === undefined || p.type === 'variable' || p.type === 'type' || p.text.endsWith(']') || p.text.endsWith(')')) },
      { match: /(?:u8|[uUL])?'(?:[^'\\\n]|\\(?:x[\da-fA-F]+|[0-7]{1,3}|u[\da-fA-F]{4}|U[\da-fA-F]{8}|.))*'/, token: 'string' },
      { match: new RegExp(`(struct|union|enum)(\\s+)(${IDENT})`), groups: ['keyword', undefined, 'type'] },
      { match: new RegExp(`(\\.|->)(\\s*)(${IDENT})`), groups: ['operator', undefined, 'property'] },
      { match: new RegExp(`${IDENT}(?=\\s*\\()`), token: (t) => (KEYWORDS.has(t) || TYPES.has(t) ? 'keyword' : BUILTINS.has(t) ? 'builtin' : 'function') },
      { match: new RegExp(IDENT), token: name },
      {
        match: /(?:0[xX][\da-fA-F']+(?:\.[\da-fA-F']*)?(?:[pP][+-]?\d+)?|0[bB][01']+|(?:\d[\d']*(?:\.[\d']*)?|\.\d[\d']*)(?:[eE][+-]?\d+)?)[uUlLfF]*/,
        token: 'number',
      },
      { match: /->|\+\+|--|<<=?|>>=?|&&|\|\||\.\.\.|[-+*/%&|^<>!=]=?|[~?^]/, token: 'operator' },
      { match: /[()[\]{},;.:]/, token: 'punctuation' },
    ],
    // The path after #include, to the end of the line.
    include: [
      { match: /\s+/ },
      { match: /<[^>\n]*>?/, token: 'string' },
      { match: /"[^"\n]*"?/, token: 'string' },
      { match: /\/\/.*/, token: 'comment' },
      { match: /$/, pop: true },
    ],
    // The rest of a directive is code, to the end of the line or past a \.
    directive: [
      { match: /\\$/, token: 'escape' },
      { match: (line, pos) => (pos === line.length && !line.endsWith('\\') ? 0 : -1), pop: true },
      { match: new RegExp(`(?<=^#\\s*(?:define|undef|ifdef|ifndef)\\s+)${IDENT}`), token: 'function' },
      { include: 'code' },
    ],
    string: [
      { match: /[^"\\]+/, token: 'string' },
      { match: /\\(?:x[\da-fA-F]+|[0-7]{1,3}|u[\da-fA-F]{4}|U[\da-fA-F]{8}|.?)/, token: 'escape' },
      { match: /"/, token: 'string', pop: true },
      { match: /$/, pop: true },
    ],
    blockComment: [
      { match: /[^*]+/, token: 'comment' },
      { match: /\*\//, token: 'comment', pop: true },
      { match: /\*/, token: 'comment' },
    ],
  },
}
