import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { words } from '../../language.js'

const KEYWORDS = words('if else foreach import template declare_args defined forward_variables_from')
const CONSTANTS = words('true false')
const BUILTINS = words(`
  executable static_library shared_library source_set group action action_foreach copy component
  config test loadable_module rust_library generated_file bundle_data create_bundle assert print
  get_path_info get_label_info get_target_outputs process_file_template read_file write_file
  rebase_path exec_script set_defaults split_list string_join string_replace string_split
  filter_include filter_exclude not_needed pool toolchain tool
`)
const VARIABLES = words(`
  target_name invoker current_toolchain root_build_dir root_out_dir target_out_dir target_gen_dir
`)

function name(text: string): TokenType | undefined {
  if (VARIABLES.has(text)) return 'variable'
  if (KEYWORDS.has(text)) return 'keyword'
  if (CONSTANTS.has(text)) return 'constant'
  return undefined
}

const IDENT = /[A-Za-z_]\w*/.source

// GN: Chromium's build files: targets with sources and deps, if blocks, templates and "$interpolation".
export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /([a-z_]\w*)(\s*)(\+=|-=|=)(?!=)/, groups: ['property', undefined, 'operator'] },
      { match: /\#.*/, token: 'comment' },
      { match: /"/, token: 'string', push: 'string0' },
      { match: new RegExp(`(\\??\\.)(${IDENT})(?=\\s*\\()`), groups: ['punctuation', 'function'] },
      { match: new RegExp(`(\\??\\.)(${IDENT})`), groups: ['punctuation', 'property'] },
      { match: new RegExp(`${IDENT}(?=\\s*\\()`), token: (t) => name(t) ?? (BUILTINS.has(t) ? 'builtin' : 'function') },
      { match: new RegExp(IDENT), token: (t) => name(t) ?? (BUILTINS.has(t) ? 'builtin' : undefined) },
      { match: /0[xX][\da-fA-F_]+\w*|0[bB][01_]+\w*|0[oO][0-7_]+\w*|(?:\d[\d_]*(?:\.(?![.A-Za-z_])[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?\d+)?\w*/, token: 'number' },
      { match: /\+=|-=|==|!=|<=|>=|&&|\|\||[-+<>=!]/, token: 'operator' },
      { match: /[()[\]{},;.]/, token: 'punctuation' },
    ],
    string0: [
      { match: /"/, token: 'string', pop: true },
      { match: /\$\{/, token: 'escape', push: 'interpolation' },
      { match: /\$[A-Za-z_]\w*/, token: 'variable' },
      { match: /\\[\\"$]|\$0x[\da-fA-F]{2}/, token: 'escape' },
      { match: /[^"$\\]+/, token: 'string' },
      { match: /./, token: 'string' },
      { match: /$/, pop: true },
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
  },
}
