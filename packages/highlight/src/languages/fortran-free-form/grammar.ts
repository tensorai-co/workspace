import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { words } from '../../language.js'

// Fortran 90 and later, free form. Its words are any case.
const KEYWORDS = words(`
  allocate allocatable associate block call case class close common contains continue cycle data
  deallocate default dimension do else elseif elsewhere end enddo endif entry enum enumerator exit
  extends external final forall format function goto if implicit import in inout intent
  interface intrinsic module namelist none nullify only open operator optional out parameter
  pointer print private procedure program protected public pure read recursive result return
  rewind save select sequence stop submodule subroutine target then to type use value where while
  write elemental impure abstract concurrent
`)
const TYPES = words('integer real double precision complex character logical')
const BUILTINS = words(`
  abs sqrt exp log sin cos tan size shape sum product maxval minval maxloc minloc len trim adjustl
  allocated present mod modulo int nint real dble huge tiny epsilon kind selected_real_kind matmul
  dot_product transpose reshape spread any all count merge
`)

function name(text: string): TokenType | undefined {
  const lower = text.toLowerCase()
  if (TYPES.has(lower)) return 'builtin'
  if (KEYWORDS.has(lower)) return 'keyword'
  return undefined
}

export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /!.*/, token: 'comment' },
      { match: /#\s*\w+.*/, token: 'meta', after: (p) => p === undefined }, // #include, #ifdef
      { match: /'(?:[^'\n]|'')*'?|"(?:[^"\n]|"")*"?/, token: 'string' },
      { match: /\.(?:true|false)\.(?:_\w+)?/i, token: 'constant' },
      { match: /\.(?:and|or|not|eqv|neqv|eq|ne|lt|le|gt|ge)\./i, token: 'operator' },
      { match: /(subroutine|function|procedure)(\s+)([A-Za-z_]\w*)/i, groups: ['keyword', undefined, 'function'] },
      { match: /(program|module|submodule)(\s+)([A-Za-z_]\w*)/i, groups: ['keyword', undefined, 'type'] },
      { match: /(type)(\s*(?:,[^:\n]*)?::\s*|\s+)([A-Za-z_]\w*)/i, groups: ['keyword', undefined, 'type'] },
      { match: /(%)([A-Za-z_]\w*)/, groups: ['operator', 'property'] }, // a component: point%x
      { match: /[A-Za-z_]\w*(?=\s*\()/, token: (t) => name(t) ?? (BUILTINS.has(t.toLowerCase()) ? 'builtin' : 'function') },
      { match: /[A-Za-z_]\w*/, token: name },
      { match: /(?:\d+\.?\d*|\.\d+)(?:[eEdD][-+]?\d+)?(?:_\w+)?|[bozBOZ]'[\da-fA-F]+'/, token: 'number' },
      { match: /\*\*|\/\/|==|\/=|<=|>=|=>|::|[-+*/=<>&%]/, token: 'operator' },
      { match: /[()[\],;:]/, token: 'punctuation' },
    ],
  },
}
