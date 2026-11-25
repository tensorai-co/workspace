import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words(`
  attribute const uniform varying buffer shared layout centroid flat smooth noperspective patch
  sample in out inout if else for while do break continue return discard switch case default
  struct precision highp mediump lowp invariant precise subroutine coherent volatile restrict
  readonly writeonly shader_type render_mode instance global group_uniforms varying const
`)
/** Godot's built-in variables: ALBEDO, VERTEX, TIME… */
const GODOT = words(`
  VERTEX NORMAL TANGENT BINORMAL UV UV2 COLOR POINT_SIZE INSTANCE_ID VERTEX_ID MODEL_MATRIX VIEW_MATRIX
  PROJECTION_MATRIX MODELVIEW_MATRIX INV_VIEW_MATRIX CAMERA_POSITION_WORLD TIME PI TAU E ALBEDO ALPHA
  METALLIC ROUGHNESS SPECULAR EMISSION NORMAL_MAP NORMAL_MAP_DEPTH RIM AO SCREEN_UV SCREEN_PIXEL_SIZE
  FRAGCOORD FRONT_FACING VIEW LIGHT LIGHT_COLOR ATTENUATION DIFFUSE_LIGHT SPECULAR_LIGHT TEXTURE
  TEXTURE_PIXEL_SIZE SCREEN_TEXTURE NODE_POSITION_WORLD
`)
const BUILTINS = words(`
  radians degrees sin cos tan asin acos atan pow exp log exp2 log2 sqrt inversesqrt abs sign floor
  ceil fract mod min max clamp mix step smoothstep length distance dot cross normalize reflect
  refract faceforward matrixCompMult transpose inverse determinant lessThan greaterThan equal any
  all not texture textureLod texelFetch textureSize dFdx dFdy fwidth emit EmitVertex EndPrimitive
  barrier imageLoad imageStore atomicAdd
`)

function name(text: string): TokenType | undefined {
  if (KEYWORDS.has(text)) return 'keyword'
  if (text === 'true' || text === 'false') return 'constant'
  if (/^(?:void|bool|int|uint|float|double|[biud]?vec[234]|d?mat[234](?:x[234])?|[iu]?(?:sampler|image|texture)\w*|atomic_uint)$/.test(text)) return 'builtin'
  if (GODOT.has(text)) return 'variable'
  if (/^[A-Z][A-Z\d_]+$/.test(text)) return 'constant'
  return undefined
}

// Godot shaders: GLSL-like, with shader_type, render_mode, uniform hints
// (: source_color, hint_range) and Godot's built-ins.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /\/\/.*/, token: 'comment' },
      { match: /\/\*/, token: 'comment', push: 'blockComment' },
      { match: /#\s*\w+.*/, token: 'meta', after: (p) => p === undefined }, // #version 300 es, #define
      { match: /(struct)(\s+)([A-Za-z_]\w*)/, groups: ['keyword', undefined, 'type'] },
      { match: /(\.)([xyzwrgbastpq]{1,4})\b/, groups: ['punctuation', 'property'] }, // a swizzle: .xyz
      { match: /(\.)([A-Za-z_]\w*)/, groups: ['punctuation', 'property'] },
      { match: /[A-Za-z_]\w*(?=\s*\()/, token: (t) => name(t) ?? (BUILTINS.has(t) ? 'builtin' : 'function') },
      { match: /[A-Za-z_]\w*/, token: name },
      { match: /(?:0[xX][\da-fA-F]+|(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)(?:[uU]|[fF]|lf|LF)?/, token: 'number' },
      { match: /\+\+|--|<<=?|>>=?|&&|\|\||\^\^|[-+*/%&|^<>!=]=?|[~?:]/, token: 'operator' },
      { match: /[()[\]{},;.]/, token: 'punctuation' },
    ],
    blockComment: [
      { match: /[^*]+/, token: 'comment' },
      { match: /\*\//, token: 'comment', pop: true },
      { match: /\*/, token: 'comment' },
    ],
  },
}
