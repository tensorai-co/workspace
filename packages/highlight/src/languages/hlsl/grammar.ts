import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words(`
  cbuffer tbuffer struct class interface typedef static const uniform extern volatile shared
  groupshared precise inline in out inout return if else for while do break continue discard
  switch case default register packoffset technique technique10 technique11 pass namespace
  nointerpolation linear centroid noperspective sample row_major column_major
`)
const BUILTINS = words(`
  abs acos all any asin atan atan2 ceil clamp clip cos cross ddx ddy degrees determinant distance
  dot exp exp2 floor fmod frac lerp length log log2 mad max min mul normalize pow radians reflect
  refract round rsqrt saturate sign sin smoothstep sqrt step tan transpose trunc InterlockedAdd
  GroupMemoryBarrierWithGroupSync Sample SampleLevel Load GetDimensions
`)

function name(text: string): TokenType | undefined {
  if (KEYWORDS.has(text)) return 'keyword'
  if (text === 'true' || text === 'false') return 'constant'
  if (/^(?:void|bool|int|uint|dword|half|float|double|min16float|min16int|(?:bool|int|uint|half|float|double)[1-4](?:x[1-4])?|matrix|vector|string)$/.test(text)) return 'builtin'
  if (/^(?:RW)?(?:Texture[123]D(?:Array)?|TextureCube|Buffer|StructuredBuffer|ByteAddressBuffer)$|^Sampler(?:State|ComparisonState)$|^ConstantBuffer$/.test(text)) return 'builtin'
  if (/^[A-Z][A-Z\d_]+$/.test(text)) return 'constant'
  return undefined
}

// HLSL: Direct3D shaders.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /\/\/.*/, token: 'comment' },
      { match: /\/\*/, token: 'comment', push: 'blockComment' },
      { match: /#\s*\w+.*/, token: 'meta', after: (p) => p === undefined },
      { match: /\[\w+(?:\([^)\]\n]*\))?\]/, token: 'meta', after: (p) => p === undefined }, // [numthreads(8, 8, 1)]
      { match: /(:)(\s*)(SV_\w+|[A-Z][A-Z_]*\d*)(?=\s*(?:[;,){=]|$))/, groups: ['punctuation', undefined, 'meta'] }, // a semantic: : SV_Position
      { match: /(struct|cbuffer|class)(\s+)([A-Za-z_]\w*)/, groups: ['keyword', undefined, 'type'] },
      { match: /"(?:[^"\\\n]|\\.)*"?/, token: 'string' },
      { match: /(\.)([xyzwrgba]{1,4})\b/, groups: ['punctuation', 'property'] },
      { match: /(\.)([A-Za-z_]\w*)(?=\s*\()/, groups: ['punctuation', 'function'] },
      { match: /(\.)([A-Za-z_]\w*)/, groups: ['punctuation', 'property'] },
      { match: /[A-Za-z_]\w*(?=\s*\()/, token: (t) => name(t) ?? (BUILTINS.has(t) ? 'builtin' : 'function') },
      { match: /[A-Za-z_]\w*/, token: name },
      { match: /(?:0[xX][\da-fA-F]+|(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)(?:[uUlLhHfF])?/, token: 'number' },
      { match: /\+\+|--|<<=?|>>=?|&&|\|\||[-+*/%&|^<>!=]=?|[~?:]/, token: 'operator' },
      { match: /[()[\]{},;.]/, token: 'punctuation' },
    ],
    blockComment: [
      { match: /[^*]+/, token: 'comment' },
      { match: /\*\//, token: 'comment', pop: true },
      { match: /\*/, token: 'comment' },
    ],
  },
}
