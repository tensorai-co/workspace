import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words(`
  alias break case const const_assert continue continuing default diagnostic discard else enable fn
  for if let loop override requires return struct switch var while
`)
const BUILTINS = words(`
  abs acos all any asin atan atan2 ceil clamp cos cross degrees determinant distance dot exp exp2
  floor fract length log log2 max min mix normalize pow radians reflect refract round saturate sign
  sin smoothstep sqrt step tan transpose trunc select arrayLength textureSample textureSampleLevel
  textureLoad textureStore textureDimensions atomicAdd atomicLoad atomicStore workgroupBarrier
  storageBarrier bitcast
`)

function name(text: string): TokenType | undefined {
  if (KEYWORDS.has(text)) return 'keyword'
  if (text === 'true' || text === 'false') return 'constant'
  if (/^(?:bool|f16|f32|i32|u32|vec[234][fhiu]?|mat[234]x[234][fh]?|array|ptr|atomic|sampler(?:_comparison)?|texture_\w+|function|private|workgroup|uniform|storage|read|write|read_write)$/.test(text)) return 'builtin'
  if (/^[A-Z]/.test(text)) return 'type'
  return undefined
}

// WGSL: WebGPU's shading language.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /\/\/.*/, token: 'comment' },
      { match: /\/\*/, token: 'comment', push: 'blockComment' },
      { match: /@[A-Za-z_]\w*/, token: 'meta' }, // @vertex, @group(0), @builtin(position)
      { match: /(fn)(\s+)([A-Za-z_]\w*)/, groups: ['keyword', undefined, 'function'] },
      { match: /(struct|alias)(\s+)([A-Za-z_]\w*)/, groups: ['keyword', undefined, 'type'] },
      { match: /(\.)([xyzwrgba]{1,4})\b/, groups: ['punctuation', 'property'] },
      { match: /(\.)([A-Za-z_]\w*)/, groups: ['punctuation', 'property'] },
      { match: /[A-Za-z_]\w*(?=\s*(?:<[^<>\n]*>)?\s*\()/, token: (t) => name(t) ?? (BUILTINS.has(t) ? 'builtin' : 'function') },
      { match: /[A-Za-z_]\w*/, token: name },
      { match: /(?:0[xX][\da-fA-F]+(?:\.[\da-fA-F]*)?(?:[pP][-+]?\d+)?|(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)[iufh]?/, token: 'number' },
      { match: /->|\+\+|--|<<=?|>>=?|&&|\|\||[-+*/%&|^<>!=]=?|[~]/, token: 'operator' },
      { match: /[()[\]{},;.:]/, token: 'punctuation' },
    ],
    blockComment: [
      { match: /\/\*/, token: 'comment', push: 'blockComment' }, // they nest
      { match: /\*\//, token: 'comment', pop: true },
      { match: /[^*/]+|[*/]/, token: 'comment' },
    ],
  },
}
