import type { Grammar } from '../../engine/grammar.js'
import type { TokenType } from '../../tokens.js'
import { words } from '../../language.js'

// Oracle PL/SQL: SQL, plus blocks, procedures, packages, cursors and exceptions.
const KEYWORDS = words(`
  add after all alter analyze and any as asc begin between by cascade case cast check collate column
  commit conflict constraint create cross current_date current_time current_timestamp database
  default deferrable delete desc distinct do drop each else end escape except exclusive exists
  explain fetch filter first following for foreign from full function grant group having if ignore
  ilike immediate in index inner insert instead intersect into is isnull join key last lateral
  left like limit materialized natural not nothing notnull null nulls of offset on only or order
  outer over partition preceding primary procedure range recursive references replace restrict
  returning returns revoke right rollback row rows savepoint schema select sequence set similar
  table temp temporary then ties to top transaction trigger truncate unbounded union unique update
  using vacuum values view when where window with without language security definer volatile
  stable immutable strict declare loop raise exception perform execute body package procedure
  cursor open fetch close bulk collect forall elsif others is type record rowtype pragma
  autonomous_transaction commit rollback savepoint immediate exit continue out nocopy deterministic
  pipelined sqlerrm sqlcode notfound found rowcount
`)
const TYPES = words(`
  bigint bigserial binary bit blob bool boolean bytea char character date datetime decimal double
  enum float int int2 int4 int8 integer interval json jsonb money nchar numeric nvarchar real
  serial smallint smallserial text time timestamp timestamptz tinyint uuid varbinary varchar xml
  precision varying zone number varchar2 nvarchar2 pls_integer binary_integer clob nclob raw long
`)
const CONSTANTS = words('true false null unknown')
const BUILTINS = words(`
  abs avg ceil coalesce concat count date_trunc extract floor greatest ifnull isnull json_agg
  jsonb_agg json_build_object jsonb_build_object least length lower ltrim max min now nullif
  round row_number rank dense_rank lag lead first_value last_value rtrim string_agg array_agg
  substring sum trim upper to_char to_date age generate_series random replace split_part position
  datediff dateadd getdate format group_concat strftime nvl nvl2 decode to_number sysdate
  systimestamp trunc dbms_output put_line raise_application_error
`)

/** The words a table's name follows. */
const TABLE_BEFORE = words('from join into update table exists references truncate')

function name(text: string): TokenType | undefined {
  const lower = text.toLowerCase()
  if (CONSTANTS.has(lower)) return 'constant'
  if (TYPES.has(lower)) return 'builtin'
  if (KEYWORDS.has(lower)) return 'keyword'
  return undefined
}

export const grammar: Grammar = {
  states: {
    root: [
      { match: /\s+/ },
      { match: /--.*/, token: 'comment' },
      { match: /#.*/, token: 'comment', after: (p) => p === undefined }, // MySQL
      { match: /\/\*/, token: 'comment', push: 'blockComment' },
      // Postgres $$ … $$ and $tag$ … $tag$: function bodies.
      { match: /\$[A-Za-z_]*\$/, token: 'string', push: (t) => `dollar/${t}` },
      { match: /[eEnN]?'/, token: 'string', push: 'single' },
      { match: /"(?:[^"]|"")*"|`[^`\n]*`|\[[^\]\n]+\]/, token: 'property' }, // "quoted" identifiers
      { match: /:[A-Za-z_]\w*|@@?[A-Za-z_]\w*|\$\d+|\?/, token: 'variable' }, // :name, @var, $1, ?
      { match: /%(?:TYPE|ROWTYPE|FOUND|NOTFOUND|ROWCOUNT|ISOPEN|BULK_ROWCOUNT)\b/i, token: 'meta' }, // emp.sal%TYPE, c%NOTFOUND
      { match: /(\.)([A-Za-z_]\w*)/, groups: ['punctuation', 'property'] },
      // A table's name: FROM t, JOIN t, INSERT INTO t (…), CREATE TABLE t (…).
      { match: /[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)?/, token: (t) => name(t) ?? 'type', after: (p) => !!p && TABLE_BEFORE.has(p.text.toLowerCase()) },
      { match: /[A-Za-z_]\w*(?=\s*\()/, token: (t) => name(t) ?? (BUILTINS.has(t.toLowerCase()) ? 'builtin' : 'function') },
      { match: /[A-Za-z_]\w*/, token: name },
      { match: /0[xX][\da-fA-F]+|(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/, token: 'number' },
      { match: /:=|=>|\.\.|<>|!=|<=|>=|\|\||[-+*/%=<>]/, token: 'operator' },
      { match: /[()[\],;.]/, token: 'punctuation' },
    ],
    single: [
      { match: /[^'\\]+/, token: 'string' },
      { match: /''|\\./, token: 'escape' },
      { match: /\\/, token: 'string' },
      { match: /'/, token: 'string', pop: true },
    ],
    dollar: [
      { match: (line, pos, tag) => (line.startsWith(tag, pos) ? tag.length : -1), token: 'string', pop: true },
      { match: /[^$]+|\$/, token: 'string' },
    ],
    blockComment: [
      { match: /[^*]+/, token: 'comment' },
      { match: /\*\//, token: 'comment', pop: true },
      { match: /\*/, token: 'comment' },
    ],
  },
}
