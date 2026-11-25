import type { Grammar } from '../../engine/grammar.js'
import { words } from '../../language.js'

const CONSTANTS = words('true false null inf nan')

// Godot resource and scene files (.tscn, .tres): [headings key=value] and
// key = value lines with Godot's values: Vector2(…), ExtResource("1").
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /;.*/, token: 'comment' },
      { match: /(\[)([\w]+)/, groups: ['punctuation', 'tag'], push: 'heading', after: (p) => p === undefined },
      { match: /([\w/:.-]+)(\s*)(=)/, groups: ['property', undefined, 'operator'], after: (p) => p === undefined },
      { include: 'values' },
    ],
    heading: [
      { match: /\]/, token: 'punctuation', pop: true },
      { match: /\s+/ },
      { match: /([\w]+)(=)/, groups: ['property', 'operator'] },
      { include: 'values' },
    ],
    values: [
      { match: /&?"/, token: 'string', push: 'string' }, // "text", &"StringName"
      { match: /\^"(?:[^"\\]|\\.)*"/, token: 'string' }, // ^"NodePath"
      { match: /[A-Z]\w*(?=\()/, token: 'type' }, // Vector2(), Color(), ExtResource()
      { match: /[A-Za-z_]\w*/, token: (t) => (CONSTANTS.has(t) ? 'constant' : undefined) },
      { match: /-?\d+(?:\.\d+)?(?:e[-+]?\d+)?/, token: 'number' },
      { match: /[()[\]{},:]/, token: 'punctuation' },
    ],
    string: [
      { match: /"/, token: 'string', pop: true },
      { match: /\\./, token: 'escape' },
      { match: /[^"\\]+/, token: 'string' },
    ],
  },
}
