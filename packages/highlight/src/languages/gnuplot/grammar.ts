import type { Grammar } from '../../engine/grammar.js'
import { words } from '../../language.js'

const COMMANDS = words(`
  set unset show plot splot replot fit print pause reset load call do for if else while clear cd
  exit quit help system eval stats test undefine bind history
`)
const OPTIONS = words(`
  using u with w title t notitle lines l points p linespoints lp boxes impulses dots errorbars
  filledcurves histograms candlesticks vectors labels pm3d image linewidth lw linetype lt linecolor lc
  pointtype pt pointsize ps dashtype dt axes smooth every index fill solid border xrange yrange zrange
  terminal output key xlabel ylabel zlabel grid logscale format xtics ytics style datafile separator
  palette view multiplot size origin font noenhanced enhanced
`)
const FUNCTIONS = words('sin cos tan asin acos atan atan2 sinh cosh tanh exp log log10 sqrt abs ceil floor int real imag rand norm sgn gamma column stringcolumn valid strlen substr sprintf gprintf words word')

// gnuplot: commands with their options, functions defined as f(x) = …,
// "strings", # comments and $data blocks.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /#.*/, token: 'comment' },
      { match: /(\$\w+)(\s*)(<<)(\s*)(\w+)/, groups: ['variable', undefined, 'operator', undefined, 'constant'], push: (t) => `data/${t.slice(t.lastIndexOf(' ') + 1).replace('<<', '')}` },
      { match: /([A-Za-z_]\w*)(\([\w,\s]*\))(\s*)(=)/, groups: ['function', undefined, undefined, 'operator'], after: (p) => p === undefined }, // f(x) = …
      { match: /[a-z]+/, token: (t) => (COMMANDS.has(t) ? 'keyword' : OPTIONS.has(t) ? 'property' : undefined), after: (p) => p === undefined || p.text === ';' || p.text === '{' },
      { match: /"/, token: 'string', push: 'double' },
      { match: /'[^'\n]*'/, token: 'string' },
      { match: /\$\w+|\$\d+/, token: 'variable' }, // $data, $1
      { match: /[A-Za-z_]\w*(?=\s*\()/, token: (t) => (FUNCTIONS.has(t) ? 'builtin' : 'function') },
      { match: /[A-Za-z_]\w*/, token: (t) => (OPTIONS.has(t) ? 'property' : COMMANDS.has(t) ? 'keyword' : t === 'pi' || t === 'NaN' ? 'constant' : undefined) },
      { match: /(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/, token: 'number' },
      { match: /\*\*|==|!=|<=|>=|&&|\|\||[-+*/%<>=!?:.&|^~]/, token: 'operator' },
      { match: /[()[\]{},;\\]/, token: 'punctuation' },
    ],
    double: [
      { match: /"/, token: 'string', pop: true },
      { match: /\\./, token: 'escape' },
      { match: /%[-+ #0]*\d*(?:\.\d+)?[a-zA-Z]/, token: 'variable' },
      { match: /[^"\\%]+|%/, token: 'string' },
    ],
    // $data << EOD … EOD
    data: [
      { match: (line, pos, end) => (pos === 0 && line.trim() === end ? line.length : -1), token: 'constant', pop: true },
      { match: /.+/, token: 'string' },
    ],
  },
}
