import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words(`
  if elif else for while match when break continue pass return class class_name extends is in as
  self signal func static const enum var breakpoint preload await yield assert void not and or
  super get set
`)
const CONSTANTS = words('true false null PI TAU INF NAN')
const TYPES = words('int float bool')
const BUILTINS = words(`
  print printerr push_error push_warning len range str int float bool abs clamp lerp min max sqrt
  pow sin cos randf randi randf_range randi_range load preload is_instance_valid typeof
  instance_from_id weakref
`)

function name(text: string): TokenType | undefined {
  if (text === 'self') return 'variable'
  if (KEYWORDS.has(text)) return 'keyword'
  if (CONSTANTS.has(text)) return 'constant'
  if (TYPES.has(text)) return 'type'
  if (/^[A-Z][A-Z\d_]+$/.test(text)) return 'constant'
  if (/^[A-Z]/.test(text)) return 'type' // Node2D, Vector2, Area3D
  return undefined
}

// GDScript: Godot's Python-like language.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /##.*|#.*/, token: 'comment' },
      { match: /@[A-Za-z_]\w*/, token: 'meta' }, // @export, @onready, @tool
      { match: /"""/, token: 'string', push: 'triple' },
      { match: /[&^]?"(?:[^"\\\n]|\\.)*"?|[&^]?'(?:[^'\\\n]|\\.)*'?/, token: 'string' }, // &"StringName", ^"NodePath"
      { match: /\$(?:"[^"\n]*"|[\w/]+)|%[A-Za-z_]\w*/, token: 'variable' }, // $Sprite2D, %UniqueNode
      { match: /(func)(\s+)([A-Za-z_]\w*)/, groups: ['keyword', undefined, 'function'] },
      { match: /(class_name|class|extends)(\s+)([A-Za-z_][\w.]*)/, groups: ['keyword', undefined, 'type'] },
      { match: /(signal)(\s+)([A-Za-z_]\w*)/, groups: ['keyword', undefined, 'function'] },
      { match: /(\.)([A-Za-z_]\w*)(?=\s*\()/, groups: ['punctuation', 'function'] },
      { match: /(\.)([A-Za-z_]\w*)/, groups: ['punctuation', 'property'] },
      { match: /[A-Za-z_]\w*(?=\s*\()/, token: (t) => name(t) ?? (BUILTINS.has(t) ? 'builtin' : 'function') },
      { match: /[A-Za-z_]\w*/, token: name },
      { match: /0[xX][\da-fA-F_]+|0[bB][01_]+|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][-+]?\d+)?/, token: 'number' },
      { match: /->|:=|\*\*=?|<<=?|>>=?|&&|\|\||[-+*/%&|^<>!=]=?|[~]/, token: 'operator' },
      { match: /[()[\]{},;.:]/, token: 'punctuation' },
    ],
    triple: [
      { match: /"""/, token: 'string', pop: true },
      { match: /[^"]+|"/, token: 'string' },
    ],
  },
}
