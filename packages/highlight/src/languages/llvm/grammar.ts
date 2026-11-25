import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words(`
  define declare global constant private internal external linkonce weak common appending
  dso_local unnamed_addr local_unnamed_addr align to label source_filename target datalayout triple
  attributes nounwind readonly writeonly noinline alwaysinline uwtable nsw nuw exact inbounds
  volatile atomic seq_cst acquire release monotonic zeroinitializer undef poison null true false
  x eq ne ugt uge ult ule sgt sge slt sle oeq one olt ole ogt oge ord uno ueq une
`)
const INSTRUCTIONS = words(`
  ret br switch indirectbr invoke resume unreachable add fadd sub fsub mul fmul udiv sdiv fdiv urem
  srem frem shl lshr ashr and or xor extractelement insertelement shufflevector extractvalue
  insertvalue alloca load store fence cmpxchg atomicrmw getelementptr trunc zext sext fptrunc
  fpext fptoui fptosi uitofp sitofp ptrtoint inttoptr bitcast addrspacecast icmp fcmp phi select
  call tail musttail freeze
`)

function name(text: string): TokenType | undefined {
  if (INSTRUCTIONS.has(text)) return 'function'
  if (KEYWORDS.has(text)) return 'keyword'
  if (/^(?:i\d+|half|bfloat|float|double|fp128|void|ptr|label|metadata|opaque)$/.test(text)) return 'builtin'
  return undefined
}

export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /;.*/, token: 'comment' },
      { match: /c?"(?:[^"\\\n]|\\[\da-fA-F]{2}|\\\\)*"?/, token: 'string' },
      { match: /@[-\w$.]+|@"[^"\n]*"|@\d+/, token: 'type' }, // globals: @main
      { match: /%[-\w$.]+|%"[^"\n]*"|%\d+/, token: 'variable' }, // locals: %x, %0
      { match: /![\w.-]+|!\d+/, token: 'meta' }, // metadata: !dbg !0
      { match: /#\d+/, token: 'meta' }, // attribute groups
      { match: /[A-Za-z_][\w.]*:/, token: 'property', after: (p) => p === undefined }, // a block's label
      { match: /[A-Za-z_][\w.]*/, token: name },
      { match: /-?(?:0x[\da-fA-F]+|\d+(?:\.\d+)?(?:e[-+]?\d+)?)/, token: 'number' },
      { match: /\.\.\.|[=*]/, token: 'operator' },
      { match: /[()[\]{}<>,]/, token: 'punctuation' },
    ],
  },
}
