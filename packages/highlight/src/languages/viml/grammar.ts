import type { Grammar } from '../../engine/grammar.js'
import type { Token } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words(`
  if elseif else endif for endfor while endwhile try catch finally endtry function endfunction
  return break continue let unlet const call execute echo echom echomsg echoerr in is isnot
  autocmd augroup command set setlocal setglobal map nmap vmap xmap imap omap cmap tmap noremap
  nnoremap vnoremap xnoremap inoremap onoremap cnoremap tnoremap unmap nunmap syntax highlight hi
  filetype source runtime normal silent lua def enddef vim9script import export throw abort range
  dict closure finish packadd colorscheme
`)
const BUILTINS = words(`
  exists has len empty get add remove extend copy deepcopy map filter sort uniq reverse join split
  string str2nr printf expand fnamemodify getline setline line col bufnr bufname winnr tabpagenr
  system systemlist readfile writefile glob globpath match matchstr substitute trim toupper tolower
  type keys values items range input confirm search searchpair feedkeys mode timer_start jobstart
`)

/** A command is the first word of a line, or after a | between commands. */
const commandStarts = (p: Token | undefined) => !p || p.text === '|'

// Vim script: commands and their arguments, scoped variables (g:, s:, l:,
// a:), &options, " comments, and mappings with <keys>.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /"(?![^"]*"\s*[\],)]).*/, token: 'comment', after: commandStarts }, // a comment line
      { match: /#.*/, token: 'comment', after: commandStarts }, // Vim9
      { match: /\\/, token: 'operator', after: (p) => p === undefined }, // a continued line
      { match: /(fu(?:nction)?!?|def!?)(\s+)([\w:#.<>]+)/, groups: ['keyword', undefined, 'function'], after: commandStarts },
      { match: /(au(?:tocmd)?|augroup)(\s+)/, groups: ['keyword', undefined], after: commandStarts, push: 'autocmd' },
      { match: /([nvxoicstl]?(?:nore)?map|[nvxoicstl]?noremap)(!?)(\s+)((?:<(?:buffer|silent|expr|nowait|unique|script)>\s*)*)(\S+)/, groups: ['keyword', 'keyword', undefined, 'meta', 'string'], after: commandStarts },
      { match: /[A-Za-z]\w*!?/, token: (t) => (KEYWORDS.has(t.replace('!', '')) ? 'keyword' : 'function'), after: commandStarts },
      { include: 'expression' },
    ],
    autocmd: [
      { match: /$/, pop: true },
      { match: /\s+/ },
      { match: /[A-Z]\w*(?:,[A-Z]\w*)*/, token: 'constant' }, // BufWritePre
      { match: /\S+(?=\s)/, token: 'string', next: 'autocmdCommand' }, // the pattern: *.py
    ],
    // What an autocmd runs: a command, to the end of the line.
    autocmdCommand: [
      { match: /$/, pop: true },
      { match: /[A-Za-z]\w*!?/, token: (t) => (KEYWORDS.has(t.replace('!', '')) ? 'keyword' : 'function'), after: (p) => p?.type === 'string' || p?.text === '|' },
      { include: 'expression' },
    ],
    expression: [
      { match: /\s+/ },
      // A trailing comment: a " after a space, with no closing quote.
      { match: (line, pos) => (line[pos] === '"' && pos > 0 && line[pos - 1] === ' ' && line.indexOf('"', pos + 1) < 0 ? line.length - pos : -1), token: 'comment' },
      { match: /'/, token: 'string', push: 'single' },
      { match: /"/, token: 'string', push: 'double' },
      { match: /<[\w-]+>/, token: 'escape' }, // <CR>, <leader>, <C-w>
      { match: /[gswtblav]:[\w#]*|v:\w+/, token: 'variable' },
      { match: /&(?:[lg]:)?\w+|@[\w"*+/-]|\$\w+/, token: 'variable' }, // &option, @register, $ENV
      { match: /([\w#.]+)(?=\()/, token: (t) => (BUILTINS.has(t) ? 'builtin' : 'function') },
      { match: /0[xX][\da-fA-F]+|\d+(?:\.\d+)?/, token: 'number' },
      { match: /[A-Za-z_]\w*/, token: (t) => (t === 'true' || t === 'false' || t === 'v:true' ? 'constant' : KEYWORDS.has(t) ? 'keyword' : undefined) },
      { match: /==[#?]?|!=[#?]?|=~[#?]?|!~[#?]?|[<>]=?[#?]?|\.\.=?|[-+*/%.]=|&&|\|\||->|[-+*/%!?:=.]/, token: 'operator' },
      { match: /\|/, token: 'punctuation' },
      { match: /[()[\]{},]/, token: 'punctuation' },
    ],
    single: [
      { match: /''/, token: 'escape' },
      { match: /'/, token: 'string', pop: true },
      { match: /[^']+/, token: 'string' },
      { match: /$/, pop: true },
    ],
    double: [
      { match: /"/, token: 'string', pop: true },
      { match: /\\(?:<[\w-]+>|x[\da-fA-F]{2}|.)/, token: 'escape' },
      { match: /[^"\\]+/, token: 'string' },
      { match: /$/, pop: true },
    ],
  },
}
