import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words(`
  module endmodule macromodule input output inout wire reg tri supply0 supply1 integer real time
  realtime parameter localparam defparam assign always initial begin end if else case casex casez
  endcase default for while repeat forever function endfunction task endtask generate endgenerate
  genvar posedge negedge or and not fork join disable wait specify endspecify signed unsigned
  automatic logic bit byte int shortint longint always_ff always_comb always_latch interface
  endinterface modport typedef enum struct packed unique priority import package endpackage
  class endclass extends implements virtual pure extern local protected static const new this super
  null rand randc constraint solve before dist inside with randomize covergroup endgroup coverpoint
  cross bins illegal_bins ignore_bins assert assume cover property endproperty sequence endsequence
  expect iff disable throughout within intersect first_match program endprogram clocking endclocking
  default input output ref return break continue do foreach final void string chandle event union
  tagged wait_order alias type let checker endchecker bind config endconfig unique0 forkjoin join_any
  join_none timeunit timeprecision
`)

function name(text: string): TokenType | undefined {
  if (KEYWORDS.has(text)) return 'keyword'
  if (/^[A-Z][A-Z\d_]+$/.test(text)) return 'constant' // a parameter by convention: WIDTH
  return undefined
}

// SystemVerilog: Verilog with classes, constraints, assertions, interfaces
// and UVM's `uvm_ macros.
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /\/\/.*/, token: 'comment' },
      { match: /\/\*/, token: 'comment', push: 'blockComment' },
      { match: /`[A-Za-z_]\w*/, token: 'meta' }, // `define, `timescale, `WIDTH
      { match: /"(?:[^"\\\n]|\\.)*"?/, token: 'string' },
      { match: /\$[A-Za-z_]\w*/, token: 'builtin' }, // $display, $finish
      { match: /(module|interface|package|function|task|program|property|sequence|covergroup)(\s+)((?:automatic\s+|static\s+)?)([A-Za-z_]\w*)/, groups: ['keyword', undefined, 'keyword', 'function'] },
      { match: /(class|typedef\s+class)(\s+)([A-Za-z_]\w*)/, groups: ['keyword', undefined, 'type'] },
      { match: /([A-Za-z_]\w*)(\s*)(::)/, groups: ['type', undefined, 'operator'] }, // uvm_pkg::
      // 8'hFF, 4'b10_10, 'd10, 32'sd5
      { match: /(?:\d+)?'[sS]?[bBoOdDhH][\da-fA-FxXzZ_?]+|\d[\d_]*(?:\.\d+)?(?:[eE][-+]?\d+)?(?:ns|us|ms|ps|fs|s)?/, token: 'number' },
      { match: /[A-Za-z_]\w*(?=\s*\()/, token: (t) => name(t) ?? 'function' },
      { match: /[A-Za-z_]\w*/, token: name },
      { match: /<=|>=|==|!=|===|!==|&&|\|\||<<<?|>>>?|~&|~\||~\^|\^~|\*\*|[-+*/%&|^~<>!=?:@#]/, token: 'operator' },
      { match: /[()[\]{},;.]/, token: 'punctuation' },
    ],
    blockComment: [
      { match: /[^*]+/, token: 'comment' },
      { match: /\*\//, token: 'comment', pop: true },
      { match: /\*/, token: 'comment' },
    ],
  },
}
