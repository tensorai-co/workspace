import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words('let in with rec inherit if then else assert or import')
const BUILTINS = words(`
  builtins import toString map filter derivation abort throw baseNameOf dirOf fetchTarball
  fetchurl fetchGit isNull removeAttrs
`)

function name(text: string): TokenType | undefined {
  if (KEYWORDS.has(text)) return 'keyword'
  if (text === 'true' || text === 'false' || text === 'null') return 'constant'
  if (BUILTINS.has(text)) return 'builtin'
  return undefined
}

// Nix: the language of Nix packages, flakes and NixOS configurations.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /#.*/, token: 'comment' },
      { match: /\/\*/, token: 'comment', push: 'blockComment' },
      { match: /''/, token: 'string', push: 'indented' },
      { match: /\$\{/, token: 'escape', push: 'interpolation' }, // an attribute path's ${name}
      { match: /"/, token: 'string', push: 'string' },
      { match: /[a-zA-Z][\w+.-]*:\/\/[^\s;]+|<[\w./-]+>|(?:\.{0,2}|~)(?:\/[\w.+-]+)+\/?/, token: 'string' }, // URLs, <nixpkgs>, ./paths
      // An attribute: name = …; a.b.c = …;
      { match: /[A-Za-z_][\w'-]*(?:\.[A-Za-z_][\w'-]*)*(?=\s*=(?!=))/, token: 'property' },
      // A function's parameters: { pkgs, lib ? x, ... }: and x:
      { match: /[A-Za-z_][\w'-]*(?=\s*:(?!:)\s)/, token: 'variable' },
      { match: /(\.)([A-Za-z_][\w'-]*)/, groups: ['punctuation', 'property'] },
      { match: /[A-Za-z_][\w'-]*/, token: name },
      { match: /\d+(?:\.\d+)?(?:[eE][-+]?\d+)?/, token: 'number' },
      { match: /\.\.\.|\/\/|\+\+|==|!=|<=|>=|&&|\|\||->|[-+*/<>=!?@:]/, token: 'operator' },
      { match: /[()[\]{},;.]/, token: 'punctuation' },
    ],
    string: [
      { match: /[^"\\$]+/, token: 'string' },
      { match: /\\./, token: 'escape' },
      { match: /\$\{/, token: 'escape', push: 'interpolation' },
      { match: /\$/, token: 'string' },
      { match: /"/, token: 'string', pop: true },
    ],
    // ''…'': indented strings, where ''${ and ''' escape.
    indented: [
      { match: /'''|''\$|''\\./, token: 'escape' },
      { match: /''/, token: 'string', pop: true },
      { match: /\$\{/, token: 'escape', push: 'interpolation' },
      { match: /[^'$]+|['$]/, token: 'string' },
    ],
    interpolation: [
      { match: /\}/, token: 'escape', pop: true },
      { match: /\{/, token: 'punctuation', push: 'braces' },
      { include: 'root' },
    ],
    braces: [
      { match: /\}/, token: 'punctuation', pop: true },
      { match: /\{/, token: 'punctuation', push: 'braces' },
      { include: 'root' },
    ],
    blockComment: [
      { match: /[^*]+/, token: 'comment' },
      { match: /\*\//, token: 'comment', pop: true },
      { match: /\*/, token: 'comment' },
    ],
  },
}
