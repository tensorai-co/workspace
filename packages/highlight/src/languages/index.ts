// Every language there is: its id, label and aliases, and how to load it.
// Each lives in its own folder and is its own chunk, loaded the first time
// a block uses it. Nothing outside this list can be loaded.

import type { Grammar } from '../engine/grammar.js'
import type { Language } from '../language.js'

export interface LanguageEntry {
  label: string
  /** Other names code fences use for it. */
  aliases: string[]
  load: () => Promise<Language>
}

export const LANGUAGES = {
  abap: {
    label: 'ABAP',
    aliases: [],
    load: () => import('./abap/index.js').then((m) => m.abap),
  },
  'actionscript-3': {
    label: 'ActionScript',
    aliases: ['actionscript', 'as3', 'as'],
    load: () => import('./actionscript-3/index.js').then((m) => m.actionscript3),
  },
  ada: {
    label: 'Ada',
    aliases: ['adb', 'ads'],
    load: () => import('./ada/index.js').then((m) => m.ada),
  },
  ahk: {
    label: 'AutoHotkey',
    aliases: ['ahk1', 'ahk2', 'autohotkey'],
    load: () => import('./ahk/index.js').then((m) => m.ahk),
  },
  'angular-html': {
    label: 'Angular HTML',
    aliases: ['ng-html'],
    load: () => import('./angular-html/index.js').then((m) => m.angularHtml),
  },
  'angular-ts': {
    label: 'Angular TypeScript',
    aliases: ['ng-ts'],
    load: () => import('./angular-ts/index.js').then((m) => m.angularTs),
  },
  apache: {
    label: 'Apache Conf',
    aliases: ['apacheconf', 'htaccess'],
    load: () => import('./apache/index.js').then((m) => m.apache),
  },
  apex: {
    label: 'Apex',
    aliases: ['cls', 'trigger'],
    load: () => import('./apex/index.js').then((m) => m.apex),
  },
  apl: {
    label: 'APL',
    aliases: ['dyalog'],
    load: () => import('./apl/index.js').then((m) => m.apl),
  },
  applescript: {
    label: 'AppleScript',
    aliases: ['osascript'],
    load: () => import('./applescript/index.js').then((m) => m.applescript),
  },
  ara: {
    label: 'Ara',
    aliases: [],
    load: () => import('./ara/index.js').then((m) => m.ara),
  },
  asciidoc: {
    label: 'AsciiDoc',
    aliases: ['adoc'],
    load: () => import('./asciidoc/index.js').then((m) => m.asciidoc),
  },
  asm: {
    label: 'Assembly',
    aliases: ['assembly', 'nasm', 'x86asm', 'arm', 'armasm', 's'],
    load: () => import('./asm/index.js').then((m) => m.asm),
  },
  astro: {
    label: 'Astro',
    aliases: [],
    load: () => import('./astro/index.js').then((m) => m.astro),
  },
  awk: {
    label: 'AWK',
    aliases: ['gawk', 'mawk'],
    load: () => import('./awk/index.js').then((m) => m.awk),
  },
  ballerina: {
    label: 'Ballerina',
    aliases: ['bal'],
    load: () => import('./ballerina/index.js').then((m) => m.ballerina),
  },
  bash: {
    label: 'Bash',
    aliases: ['sh', 'shell', 'zsh', 'shellscript'],
    load: () => import('./bash/index.js').then((m) => m.bash),
  },
  bat: {
    label: 'Batch',
    aliases: ['batch', 'cmd'],
    load: () => import('./bat/index.js').then((m) => m.bat),
  },
  beancount: {
    label: 'Beancount',
    aliases: [],
    load: () => import('./beancount/index.js').then((m) => m.beancount),
  },
  berry: {
    label: 'Berry',
    aliases: ['be'],
    load: () => import('./berry/index.js').then((m) => m.berry),
  },
  bibtex: {
    label: 'BibTeX',
    aliases: ['bib'],
    load: () => import('./bibtex/index.js').then((m) => m.bibtex),
  },
  bicep: {
    label: 'Bicep',
    aliases: [],
    load: () => import('./bicep/index.js').then((m) => m.bicep),
  },
  bird2: {
    label: 'BIRD2 Configuration',
    aliases: ['bird'],
    load: () => import('./bird2/index.js').then((m) => m.bird2),
  },
  blade: {
    label: 'Blade',
    aliases: ['blade.php'],
    load: () => import('./blade/index.js').then((m) => m.blade),
  },
  bsl: {
    label: '1C (Enterprise)',
    aliases: ['1c'],
    load: () => import('./bsl/index.js').then((m) => m.bsl),
  },
  c: {
    label: 'C',
    aliases: ['h'],
    load: () => import('./c/index.js').then((m) => m.c),
  },
  c3: {
    label: 'C3',
    aliases: ['c3l'],
    load: () => import('./c3/index.js').then((m) => m.c3),
  },
  cadence: {
    label: 'Cadence',
    aliases: ['cdc'],
    load: () => import('./cadence/index.js').then((m) => m.cadence),
  },
  cairo: {
    label: 'Cairo',
    aliases: [],
    load: () => import('./cairo/index.js').then((m) => m.cairo),
  },
  chapel: {
    label: 'Chapel',
    aliases: ['chpl'],
    load: () => import('./chapel/index.js').then((m) => m.chapel),
  },
  clarity: {
    label: 'Clarity',
    aliases: ['clar'],
    load: () => import('./clarity/index.js').then((m) => m.clarity),
  },
  clojure: {
    label: 'Clojure',
    aliases: ['clj', 'cljs', 'cljc', 'edn'],
    load: () => import('./clojure/index.js').then((m) => m.clojure),
  },
  cmake: {
    label: 'CMake',
    aliases: ['cmakelists'],
    load: () => import('./cmake/index.js').then((m) => m.cmake),
  },
  cobol: {
    label: 'COBOL',
    aliases: ['cbl', 'cob'],
    load: () => import('./cobol/index.js').then((m) => m.cobol),
  },
  codeowners: {
    label: 'CODEOWNERS',
    aliases: [],
    load: () => import('./codeowners/index.js').then((m) => m.codeowners),
  },
  codeql: {
    label: 'CodeQL',
    aliases: ['ql'],
    load: () => import('./codeql/index.js').then((m) => m.codeql),
  },
  coffee: {
    label: 'CoffeeScript',
    aliases: ['coffeescript', 'cson', 'iced'],
    load: () => import('./coffee/index.js').then((m) => m.coffee),
  },
  'common-lisp': {
    label: 'Common Lisp',
    aliases: ['lisp', 'cl', 'elisp-cl'],
    load: () => import('./common-lisp/index.js').then((m) => m.commonLisp),
  },
  coq: {
    label: 'Rocq',
    aliases: ['rocq', 'v'],
    load: () => import('./coq/index.js').then((m) => m.coq),
  },
  cpp: {
    label: 'C++',
    aliases: ['c++', 'cc', 'cxx', 'hpp', 'hh', 'hxx'],
    load: () => import('./cpp/index.js').then((m) => m.cpp),
  },
  crystal: {
    label: 'Crystal',
    aliases: ['cr'],
    load: () => import('./crystal/index.js').then((m) => m.crystal),
  },
  csharp: {
    label: 'C#',
    aliases: ['c#', 'cs'],
    load: () => import('./csharp/index.js').then((m) => m.csharp),
  },
  css: {
    label: 'CSS',
    aliases: [],
    load: () => import('./css/index.js').then((m) => m.css),
  },
  csv: {
    label: 'CSV',
    aliases: [],
    load: () => import('./csv/index.js').then((m) => m.csv),
  },
  cue: {
    label: 'CUE',
    aliases: [],
    load: () => import('./cue/index.js').then((m) => m.cue),
  },
  cypher: {
    label: 'Cypher',
    aliases: ['cql', 'neo4j'],
    load: () => import('./cypher/index.js').then((m) => m.cypher),
  },
  d: {
    label: 'D',
    aliases: ['dlang'],
    load: () => import('./d/index.js').then((m) => m.d),
  },
  dart: {
    label: 'Dart',
    aliases: ['flutter'],
    load: () => import('./dart/index.js').then((m) => m.dart),
  },
  dax: {
    label: 'DAX',
    aliases: [],
    load: () => import('./dax/index.js').then((m) => m.dax),
  },
  desktop: {
    label: 'Desktop Entry',
    aliases: [],
    load: () => import('./desktop/index.js').then((m) => m.desktop),
  },
  diff: {
    label: 'Diff',
    aliases: ['patch'],
    load: () => import('./diff/index.js').then((m) => m.diff),
  },
  docker: {
    label: 'Dockerfile',
    aliases: ['dockerfile', 'containerfile'],
    load: () => import('./docker/index.js').then((m) => m.docker),
  },
  dotenv: {
    label: '.env',
    aliases: ['env'],
    load: () => import('./dotenv/index.js').then((m) => m.dotenv),
  },
  'dream-maker': {
    label: 'Dream Maker',
    aliases: ['dm', 'byond'],
    load: () => import('./dream-maker/index.js').then((m) => m.dreamMaker),
  },
  edge: {
    label: 'Edge',
    aliases: [],
    load: () => import('./edge/index.js').then((m) => m.edge),
  },
  elixir: {
    label: 'Elixir',
    aliases: ['ex', 'exs', 'heex'],
    load: () => import('./elixir/index.js').then((m) => m.elixir),
  },
  elm: {
    label: 'Elm',
    aliases: [],
    load: () => import('./elm/index.js').then((m) => m.elm),
  },
  'emacs-lisp': {
    label: 'Emacs Lisp',
    aliases: ['elisp', 'el'],
    load: () => import('./emacs-lisp/index.js').then((m) => m.emacsLisp),
  },
  erb: {
    label: 'ERB',
    aliases: ['rhtml', 'eruby'],
    load: () => import('./erb/index.js').then((m) => m.erb),
  },
  erlang: {
    label: 'Erlang',
    aliases: ['erl', 'hrl'],
    load: () => import('./erlang/index.js').then((m) => m.erlang),
  },
  fennel: {
    label: 'Fennel',
    aliases: ['fnl'],
    load: () => import('./fennel/index.js').then((m) => m.fennel),
  },
  fish: {
    label: 'Fish',
    aliases: [],
    load: () => import('./fish/index.js').then((m) => m.fish),
  },
  fluent: {
    label: 'Fluent',
    aliases: ['ftl'],
    load: () => import('./fluent/index.js').then((m) => m.fluent),
  },
  'fortran-fixed-form': {
    label: 'Fortran (Fixed Form)',
    aliases: ['f', 'for', 'f77'],
    load: () => import('./fortran-fixed-form/index.js').then((m) => m.fortranFixed),
  },
  'fortran-free-form': {
    label: 'Fortran',
    aliases: ['fortran', 'f90', 'f95', 'f03', 'f08', 'f18'],
    load: () => import('./fortran-free-form/index.js').then((m) => m.fortran),
  },
  fsharp: {
    label: 'F#',
    aliases: ['f#', 'fs', 'fsx', 'fsi'],
    load: () => import('./fsharp/index.js').then((m) => m.fsharp),
  },
  gdresource: {
    label: 'GDResource',
    aliases: ['tscn', 'tres'],
    load: () => import('./gdresource/index.js').then((m) => m.gdresource),
  },
  gdscript: {
    label: 'GDScript',
    aliases: ['gd', 'godot'],
    load: () => import('./gdscript/index.js').then((m) => m.gdscript),
  },
  gdshader: {
    label: 'GDShader',
    aliases: ['gdshaderinc'],
    load: () => import('./gdshader/index.js').then((m) => m.gdshader),
  },
  genie: {
    label: 'Genie',
    aliases: ['gs'],
    load: () => import('./genie/index.js').then((m) => m.genie),
  },
  gherkin: {
    label: 'Gherkin',
    aliases: ['feature', 'cucumber'],
    load: () => import('./gherkin/index.js').then((m) => m.gherkin),
  },
  'git-commit': {
    label: 'Commit message',
    aliases: ['commit', 'commit-msg'],
    load: () => import('./git-commit/index.js').then((m) => m.gitCommit),
  },
  'git-rebase': {
    label: 'Git Rebase Message',
    aliases: [],
    load: () => import('./git-rebase/index.js').then((m) => m.gitRebase),
  },
  gleam: {
    label: 'Gleam',
    aliases: [],
    load: () => import('./gleam/index.js').then((m) => m.gleam),
  },
  'glimmer-js': {
    label: 'Glimmer JS',
    aliases: ['gjs'],
    load: () => import('./glimmer-js/index.js').then((m) => m.glimmerJs),
  },
  'glimmer-ts': {
    label: 'Glimmer TS',
    aliases: ['gts'],
    load: () => import('./glimmer-ts/index.js').then((m) => m.glimmerTs),
  },
  glsl: {
    label: 'GLSL',
    aliases: ['vert', 'frag', 'shader'],
    load: () => import('./glsl/index.js').then((m) => m.glsl),
  },
  gn: {
    label: 'GN',
    aliases: ['gni'],
    load: () => import('./gn/index.js').then((m) => m.gn),
  },
  gnuplot: {
    label: 'Gnuplot',
    aliases: ['gp', 'plt'],
    load: () => import('./gnuplot/index.js').then((m) => m.gnuplot),
  },
  go: {
    label: 'Go',
    aliases: ['golang'],
    load: () => import('./go/index.js').then((m) => m.go),
  },
  graphql: {
    label: 'GraphQL',
    aliases: ['gql'],
    load: () => import('./graphql/index.js').then((m) => m.graphql),
  },
  groovy: {
    label: 'Groovy',
    aliases: ['gradle', 'gvy'],
    load: () => import('./groovy/index.js').then((m) => m.groovy),
  },
  hack: {
    label: 'Hack',
    aliases: ['hh'],
    load: () => import('./hack/index.js').then((m) => m.hack),
  },
  haml: {
    label: 'Haml',
    aliases: [],
    load: () => import('./haml/index.js').then((m) => m.haml),
  },
  handlebars: {
    label: 'Handlebars',
    aliases: ['hbs', 'mustache'],
    load: () => import('./handlebars/index.js').then((m) => m.handlebars),
  },
  haskell: {
    label: 'Haskell',
    aliases: ['hs'],
    load: () => import('./haskell/index.js').then((m) => m.haskell),
  },
  haxe: {
    label: 'Haxe',
    aliases: ['hx'],
    load: () => import('./haxe/index.js').then((m) => m.haxe),
  },
  hcl: {
    label: 'HCL',
    aliases: ['nomad'],
    load: () => import('./hcl/index.js').then((m) => m.hcl),
  },
  hjson: {
    label: 'Hjson',
    aliases: [],
    load: () => import('./hjson/index.js').then((m) => m.hjson),
  },
  hlsl: {
    label: 'HLSL',
    aliases: ['fx'],
    load: () => import('./hlsl/index.js').then((m) => m.hlsl),
  },
  html: {
    label: 'HTML',
    aliases: ['htm', 'xhtml', 'html-derivative'],
    load: () => import('./html/index.js').then((m) => m.html),
  },
  http: {
    label: 'HTTP',
    aliases: ['https', 'rest'],
    load: () => import('./http/index.js').then((m) => m.http),
  },
  hurl: {
    label: 'Hurl',
    aliases: [],
    load: () => import('./hurl/index.js').then((m) => m.hurl),
  },
  hxml: {
    label: 'HXML',
    aliases: [],
    load: () => import('./hxml/index.js').then((m) => m.hxml),
  },
  hy: {
    label: 'Hy',
    aliases: ['hylang'],
    load: () => import('./hy/index.js').then((m) => m.hy),
  },
  imba: {
    label: 'Imba',
    aliases: [],
    load: () => import('./imba/index.js').then((m) => m.imba),
  },
  ini: {
    label: 'INI',
    aliases: ['cfg', 'conf', 'properties', 'gitconfig', 'editorconfig'],
    load: () => import('./ini/index.js').then((m) => m.ini),
  },
  java: {
    label: 'Java',
    aliases: [],
    load: () => import('./java/index.js').then((m) => m.java),
  },
  javascript: {
    label: 'JavaScript',
    aliases: ['js', 'mjs', 'cjs', 'node'],
    load: () => import('./javascript/index.js').then((m) => m.javascript),
  },
  jinja: {
    label: 'Jinja',
    aliases: ['jinja2', 'j2', 'django', 'nunjucks', 'njk'],
    load: () => import('./jinja/index.js').then((m) => m.jinja),
  },
  jison: {
    label: 'Jison',
    aliases: [],
    load: () => import('./jison/index.js').then((m) => m.jison),
  },
  json: {
    label: 'JSON',
    aliases: ['jsonc', 'json5', 'jsonl', 'ndjson'],
    load: () => import('./json/index.js').then((m) => m.json),
  },
  jsonnet: {
    label: 'Jsonnet',
    aliases: ['libsonnet'],
    load: () => import('./jsonnet/index.js').then((m) => m.jsonnet),
  },
  jssm: {
    label: 'JSSM',
    aliases: ['fsl'],
    load: () => import('./jssm/index.js').then((m) => m.jssm),
  },
  jsx: {
    label: 'JSX',
    aliases: [],
    load: () => import('./jsx/index.js').then((m) => m.jsx),
  },
  julia: {
    label: 'Julia',
    aliases: ['jl'],
    load: () => import('./julia/index.js').then((m) => m.julia),
  },
  just: {
    label: 'Just',
    aliases: ['justfile'],
    load: () => import('./just/index.js').then((m) => m.just),
  },
  kdl: {
    label: 'KDL',
    aliases: [],
    load: () => import('./kdl/index.js').then((m) => m.kdl),
  },
  kotlin: {
    label: 'Kotlin',
    aliases: ['kt', 'kts'],
    load: () => import('./kotlin/index.js').then((m) => m.kotlin),
  },
  kusto: {
    label: 'Kusto',
    aliases: ['kql'],
    load: () => import('./kusto/index.js').then((m) => m.kusto),
  },
  latex: {
    label: 'LaTeX',
    aliases: ['tex'],
    load: () => import('./latex/index.js').then((m) => m.latex),
  },
  lean: {
    label: 'Lean 4',
    aliases: ['lean4'],
    load: () => import('./lean/index.js').then((m) => m.lean),
  },
  less: {
    label: 'Less',
    aliases: [],
    load: () => import('./less/index.js').then((m) => m.less),
  },
  liquid: {
    label: 'Liquid',
    aliases: [],
    load: () => import('./liquid/index.js').then((m) => m.liquid),
  },
  llvm: {
    label: 'LLVM IR',
    aliases: ['ll'],
    load: () => import('./llvm/index.js').then((m) => m.llvm),
  },
  log: {
    label: 'Log',
    aliases: ['logs'],
    load: () => import('./log/index.js').then((m) => m.log),
  },
  logo: {
    label: 'Logo',
    aliases: [],
    load: () => import('./logo/index.js').then((m) => m.logo),
  },
  lua: {
    label: 'Lua',
    aliases: [],
    load: () => import('./lua/index.js').then((m) => m.lua),
  },
  luau: {
    label: 'Luau',
    aliases: ['roblox'],
    load: () => import('./luau/index.js').then((m) => m.luau),
  },
  make: {
    label: 'Makefile',
    aliases: ['makefile', 'mk', 'mak'],
    load: () => import('./make/index.js').then((m) => m.make),
  },
  markdown: {
    label: 'Markdown',
    aliases: ['md', 'mkd', 'mdown', 'gfm'],
    load: () => import('./markdown/index.js').then((m) => m.markdown),
  },
  marko: {
    label: 'Marko',
    aliases: [],
    load: () => import('./marko/index.js').then((m) => m.marko),
  },
  matlab: {
    label: 'MATLAB',
    aliases: ['octave'],
    load: () => import('./matlab/index.js').then((m) => m.matlab),
  },
  mdc: {
    label: 'MDC',
    aliases: [],
    load: () => import('./mdc/index.js').then((m) => m.mdc),
  },
  mdx: {
    label: 'MDX',
    aliases: [],
    load: () => import('./mdx/index.js').then((m) => m.mdx),
  },
  mermaid: {
    label: 'Mermaid',
    aliases: ['mmd'],
    load: () => import('./mermaid/index.js').then((m) => m.mermaid),
  },
  mipsasm: {
    label: 'MIPS Assembly',
    aliases: ['mips'],
    load: () => import('./mipsasm/index.js').then((m) => m.mipsasm),
  },
  mojo: {
    label: 'Mojo',
    aliases: ['🔥'],
    load: () => import('./mojo/index.js').then((m) => m.mojo),
  },
  moonbit: {
    label: 'MoonBit',
    aliases: ['mbt', 'mbti'],
    load: () => import('./moonbit/index.js').then((m) => m.moonbit),
  },
  move: {
    label: 'Move',
    aliases: [],
    load: () => import('./move/index.js').then((m) => m.move),
  },
  narrat: {
    label: 'Narrat',
    aliases: ['nar'],
    load: () => import('./narrat/index.js').then((m) => m.narrat),
  },
  nextflow: {
    label: 'Nextflow',
    aliases: ['nf', 'nextflow-groovy'],
    load: () => import('./nextflow/index.js').then((m) => m.nextflow),
  },
  nginx: {
    label: 'nginx',
    aliases: ['nginxconf'],
    load: () => import('./nginx/index.js').then((m) => m.nginx),
  },
  nim: {
    label: 'Nim',
    aliases: ['nims', 'nimble'],
    load: () => import('./nim/index.js').then((m) => m.nim),
  },
  nix: {
    label: 'Nix',
    aliases: [],
    load: () => import('./nix/index.js').then((m) => m.nix),
  },
  nsis: {
    label: 'NSIS',
    aliases: ['nsi', 'nsh'],
    load: () => import('./nsis/index.js').then((m) => m.nsis),
  },
  nushell: {
    label: 'Nushell',
    aliases: ['nu'],
    load: () => import('./nushell/index.js').then((m) => m.nushell),
  },
  'objective-c': {
    label: 'Objective-C',
    aliases: ['objc', 'objectivec', 'm', 'mm'],
    load: () => import('./objective-c/index.js').then((m) => m.objectiveC),
  },
  'objective-cpp': {
    label: 'Objective-C++',
    aliases: ['objcpp', 'objc++', 'mm'],
    load: () => import('./objective-cpp/index.js').then((m) => m.objectiveCpp),
  },
  ocaml: {
    label: 'OCaml',
    aliases: ['ml', 'mli'],
    load: () => import('./ocaml/index.js').then((m) => m.ocaml),
  },
  odin: {
    label: 'Odin',
    aliases: [],
    load: () => import('./odin/index.js').then((m) => m.odin),
  },
  openscad: {
    label: 'OpenSCAD',
    aliases: ['scad'],
    load: () => import('./openscad/index.js').then((m) => m.openscad),
  },
  org: {
    label: 'Org Mode',
    aliases: ['org-mode'],
    load: () => import('./org/index.js').then((m) => m.org),
  },
  pascal: {
    label: 'Pascal',
    aliases: ['delphi', 'objectpascal', 'pas', 'dpr'],
    load: () => import('./pascal/index.js').then((m) => m.pascal),
  },
  perl: {
    label: 'Perl',
    aliases: ['pl', 'pm', 'perl5'],
    load: () => import('./perl/index.js').then((m) => m.perl),
  },
  php: {
    label: 'PHP',
    aliases: ['php8'],
    load: () => import('./php/index.js').then((m) => m.php),
  },
  pkl: {
    label: 'Pkl',
    aliases: [],
    load: () => import('./pkl/index.js').then((m) => m.pkl),
  },
  plsql: {
    label: 'PL/SQL',
    aliases: ['oracle', 'pls'],
    load: () => import('./plsql/index.js').then((m) => m.plsql),
  },
  po: {
    label: 'Gettext PO',
    aliases: ['pot', 'potx'],
    load: () => import('./po/index.js').then((m) => m.po),
  },
  polar: {
    label: 'Polar',
    aliases: [],
    load: () => import('./polar/index.js').then((m) => m.polar),
  },
  postcss: {
    label: 'PostCSS',
    aliases: ['pcss'],
    load: () => import('./postcss/index.js').then((m) => m.postcss),
  },
  powerquery: {
    label: 'PowerQuery',
    aliases: ['m', 'pq'],
    load: () => import('./powerquery/index.js').then((m) => m.powerquery),
  },
  powershell: {
    label: 'PowerShell',
    aliases: ['ps', 'ps1', 'pwsh', 'psm1'],
    load: () => import('./powershell/index.js').then((m) => m.powershell),
  },
  prisma: {
    label: 'Prisma',
    aliases: [],
    load: () => import('./prisma/index.js').then((m) => m.prisma),
  },
  prolog: {
    label: 'Prolog',
    aliases: ['pl'],
    load: () => import('./prolog/index.js').then((m) => m.prolog),
  },
  proto: {
    label: 'Protocol Buffers',
    aliases: ['protobuf', 'proto3'],
    load: () => import('./proto/index.js').then((m) => m.proto),
  },
  pug: {
    label: 'Pug',
    aliases: ['jade'],
    load: () => import('./pug/index.js').then((m) => m.pug),
  },
  puppet: {
    label: 'Puppet',
    aliases: ['pp'],
    load: () => import('./puppet/index.js').then((m) => m.puppet),
  },
  purescript: {
    label: 'PureScript',
    aliases: ['purs'],
    load: () => import('./purescript/index.js').then((m) => m.purescript),
  },
  python: {
    label: 'Python',
    aliases: ['py', 'python3', 'py3'],
    load: () => import('./python/index.js').then((m) => m.python),
  },
  qml: {
    label: 'QML',
    aliases: ['qbs'],
    load: () => import('./qml/index.js').then((m) => m.qml),
  },
  qmldir: {
    label: 'QML Directory',
    aliases: [],
    load: () => import('./qmldir/index.js').then((m) => m.qmldir),
  },
  qss: {
    label: 'Qt Style Sheets',
    aliases: [],
    load: () => import('./qss/index.js').then((m) => m.qss),
  },
  r: {
    label: 'R',
    aliases: ['rscript', 'rmd'],
    load: () => import('./r/index.js').then((m) => m.r),
  },
  racket: {
    label: 'Racket',
    aliases: ['rkt'],
    load: () => import('./racket/index.js').then((m) => m.racket),
  },
  raku: {
    label: 'Raku',
    aliases: ['perl6', 'rakumod', 'rakutest'],
    load: () => import('./raku/index.js').then((m) => m.raku),
  },
  razor: {
    label: 'Razor',
    aliases: ['cshtml', 'blazor'],
    load: () => import('./razor/index.js').then((m) => m.razor),
  },
  rbs: {
    label: 'RBS',
    aliases: ['ruby-signature'],
    load: () => import('./rbs/index.js').then((m) => m.rbs),
  },
  reg: {
    label: 'Windows Registry Script',
    aliases: ['regedit'],
    load: () => import('./reg/index.js').then((m) => m.reg),
  },
  regexp: {
    label: 'RegExp',
    aliases: ['regex'],
    load: () => import('./regexp/index.js').then((m) => m.regexp),
  },
  rel: {
    label: 'Rel',
    aliases: [],
    load: () => import('./rel/index.js').then((m) => m.rel),
  },
  riscv: {
    label: 'RISC-V Assembly',
    aliases: ['risc-v', 'rv32', 'rv64'],
    load: () => import('./riscv/index.js').then((m) => m.riscv),
  },
  ron: {
    label: 'RON',
    aliases: [],
    load: () => import('./ron/index.js').then((m) => m.ron),
  },
  rosmsg: {
    label: 'ROS Interface',
    aliases: ['msg', 'srv', 'ros'],
    load: () => import('./rosmsg/index.js').then((m) => m.rosmsg),
  },
  rst: {
    label: 'reStructuredText',
    aliases: ['restructuredtext'],
    load: () => import('./rst/index.js').then((m) => m.rst),
  },
  ruby: {
    label: 'Ruby',
    aliases: ['rb', 'gemfile', 'rake', 'podfile'],
    load: () => import('./ruby/index.js').then((m) => m.ruby),
  },
  rust: {
    label: 'Rust',
    aliases: ['rs'],
    load: () => import('./rust/index.js').then((m) => m.rust),
  },
  sas: {
    label: 'SAS',
    aliases: [],
    load: () => import('./sas/index.js').then((m) => m.sas),
  },
  sass: {
    label: 'Sass',
    aliases: [],
    load: () => import('./sass/index.js').then((m) => m.sass),
  },
  scala: {
    label: 'Scala',
    aliases: ['sc', 'sbt'],
    load: () => import('./scala/index.js').then((m) => m.scala),
  },
  scheme: {
    label: 'Scheme',
    aliases: ['scm', 'ss', 'sld'],
    load: () => import('./scheme/index.js').then((m) => m.scheme),
  },
  scss: {
    label: 'SCSS',
    aliases: [],
    load: () => import('./scss/index.js').then((m) => m.scss),
  },
  sdbl: {
    label: '1C (Query)',
    aliases: ['1c-query'],
    load: () => import('./sdbl/index.js').then((m) => m.sdbl),
  },
  shaderlab: {
    label: 'ShaderLab',
    aliases: ['shader'],
    load: () => import('./shaderlab/index.js').then((m) => m.shaderlab),
  },
  shellsession: {
    label: 'Shell session',
    aliases: ['console', 'terminal', 'sh-session', 'shell-session'],
    load: () => import('./shellsession/index.js').then((m) => m.shellsession),
  },
  smalltalk: {
    label: 'Smalltalk',
    aliases: ['st', 'pharo', 'squeak'],
    load: () => import('./smalltalk/index.js').then((m) => m.smalltalk),
  },
  smithy: {
    label: 'Smithy',
    aliases: [],
    load: () => import('./smithy/index.js').then((m) => m.smithy),
  },
  solidity: {
    label: 'Solidity',
    aliases: ['sol'],
    load: () => import('./solidity/index.js').then((m) => m.solidity),
  },
  soy: {
    label: 'Closure Templates',
    aliases: ['closure-templates'],
    load: () => import('./soy/index.js').then((m) => m.soy),
  },
  sparql: {
    label: 'SPARQL',
    aliases: ['rq'],
    load: () => import('./sparql/index.js').then((m) => m.sparql),
  },
  splunk: {
    label: 'Splunk Query Language',
    aliases: ['spl'],
    load: () => import('./splunk/index.js').then((m) => m.splunk),
  },
  sql: {
    label: 'SQL',
    aliases: ['postgres', 'postgresql', 'mysql', 'sqlite', 'tsql', 'psql'],
    load: () => import('./sql/index.js').then((m) => m.sql),
  },
  'ssh-config': {
    label: 'SSH Config',
    aliases: ['sshconfig', 'sshd_config'],
    load: () => import('./ssh-config/index.js').then((m) => m.sshConfig),
  },
  stata: {
    label: 'Stata',
    aliases: ['do', 'ado'],
    load: () => import('./stata/index.js').then((m) => m.stata),
  },
  stylus: {
    label: 'Stylus',
    aliases: ['styl'],
    load: () => import('./stylus/index.js').then((m) => m.stylus),
  },
  surrealql: {
    label: 'SurrealQL',
    aliases: ['surql'],
    load: () => import('./surrealql/index.js').then((m) => m.surrealql),
  },
  svelte: {
    label: 'Svelte',
    aliases: [],
    load: () => import('./svelte/index.js').then((m) => m.svelte),
  },
  swift: {
    label: 'Swift',
    aliases: [],
    load: () => import('./swift/index.js').then((m) => m.swift),
  },
  'system-verilog': {
    label: 'SystemVerilog',
    aliases: ['systemverilog', 'sv', 'svh'],
    load: () => import('./system-verilog/index.js').then((m) => m.systemVerilog),
  },
  systemd: {
    label: 'systemd',
    aliases: ['service', 'unit', 'timer', 'socket'],
    load: () => import('./systemd/index.js').then((m) => m.systemd),
  },
  talonscript: {
    label: 'TalonScript',
    aliases: ['talon'],
    load: () => import('./talonscript/index.js').then((m) => m.talonscript),
  },
  tasl: {
    label: 'Tasl',
    aliases: [],
    load: () => import('./tasl/index.js').then((m) => m.tasl),
  },
  tcl: {
    label: 'Tcl',
    aliases: ['tk'],
    load: () => import('./tcl/index.js').then((m) => m.tcl),
  },
  templ: {
    label: 'Templ',
    aliases: [],
    load: () => import('./templ/index.js').then((m) => m.templ),
  },
  terraform: {
    label: 'Terraform',
    aliases: ['tf', 'tfvars', 'opentofu'],
    load: () => import('./terraform/index.js').then((m) => m.terraform),
  },
  toml: {
    label: 'TOML',
    aliases: [],
    load: () => import('./toml/index.js').then((m) => m.toml),
  },
  'ts-tags': {
    label: 'TypeScript with Tags',
    aliases: ['lit'],
    load: () => import('./ts-tags/index.js').then((m) => m.tsTags),
  },
  tsv: {
    label: 'TSV',
    aliases: ['tab'],
    load: () => import('./tsv/index.js').then((m) => m.tsv),
  },
  tsx: {
    label: 'TSX',
    aliases: [],
    load: () => import('./tsx/index.js').then((m) => m.tsx),
  },
  turtle: {
    label: 'Turtle',
    aliases: ['ttl'],
    load: () => import('./turtle/index.js').then((m) => m.turtle),
  },
  twig: {
    label: 'Twig',
    aliases: [],
    load: () => import('./twig/index.js').then((m) => m.twig),
  },
  typescript: {
    label: 'TypeScript',
    aliases: ['ts', 'mts', 'cts'],
    load: () => import('./typescript/index.js').then((m) => m.typescript),
  },
  typespec: {
    label: 'TypeSpec',
    aliases: ['tsp', 'cadl'],
    load: () => import('./typespec/index.js').then((m) => m.typespec),
  },
  typst: {
    label: 'Typst',
    aliases: ['typ'],
    load: () => import('./typst/index.js').then((m) => m.typst),
  },
  v: {
    label: 'V',
    aliases: ['vlang'],
    load: () => import('./v/index.js').then((m) => m.v),
  },
  vala: {
    label: 'Vala',
    aliases: ['vapi'],
    load: () => import('./vala/index.js').then((m) => m.vala),
  },
  vb: {
    label: 'Visual Basic',
    aliases: ['vbnet', 'vb.net', 'visualbasic'],
    load: () => import('./vb/index.js').then((m) => m.vb),
  },
  verilog: {
    label: 'Verilog',
    aliases: ['v', 'sv', 'systemverilog'],
    load: () => import('./verilog/index.js').then((m) => m.verilog),
  },
  vhdl: {
    label: 'VHDL',
    aliases: ['vhd'],
    load: () => import('./vhdl/index.js').then((m) => m.vhdl),
  },
  viml: {
    label: 'Vim Script',
    aliases: ['vim', 'vimscript', 'vimrc'],
    load: () => import('./viml/index.js').then((m) => m.viml),
  },
  vue: {
    label: 'Vue',
    aliases: ['vue-html'],
    load: () => import('./vue/index.js').then((m) => m.vue),
  },
  'vue-vine': {
    label: 'Vue Vine',
    aliases: ['vine'],
    load: () => import('./vue-vine/index.js').then((m) => m.vueVine),
  },
  vyper: {
    label: 'Vyper',
    aliases: ['vy'],
    load: () => import('./vyper/index.js').then((m) => m.vyper),
  },
  wasm: {
    label: 'WebAssembly',
    aliases: ['wat', 'wast'],
    load: () => import('./wasm/index.js').then((m) => m.wasm),
  },
  wenyan: {
    label: 'Wenyan',
    aliases: ['文言'],
    load: () => import('./wenyan/index.js').then((m) => m.wenyan),
  },
  wgsl: {
    label: 'WGSL',
    aliases: [],
    load: () => import('./wgsl/index.js').then((m) => m.wgsl),
  },
  wikitext: {
    label: 'Wikitext',
    aliases: ['mediawiki', 'wiki'],
    load: () => import('./wikitext/index.js').then((m) => m.wikitext),
  },
  wit: {
    label: 'WebAssembly Interface Types',
    aliases: [],
    load: () => import('./wit/index.js').then((m) => m.wit),
  },
  wolfram: {
    label: 'Wolfram',
    aliases: ['wl', 'mathematica', 'wolfram-language'],
    load: () => import('./wolfram/index.js').then((m) => m.wolfram),
  },
  xml: {
    label: 'XML',
    aliases: ['svg', 'plist', 'xsd', 'rss', 'atom', 'xaml', 'csproj', 'wsdl'],
    load: () => import('./xml/index.js').then((m) => m.xml),
  },
  xsl: {
    label: 'XSL',
    aliases: ['xslt'],
    load: () => import('./xsl/index.js').then((m) => m.xsl),
  },
  yaml: {
    label: 'YAML',
    aliases: ['yml'],
    load: () => import('./yaml/index.js').then((m) => m.yaml),
  },
  zenscript: {
    label: 'ZenScript',
    aliases: ['zs'],
    load: () => import('./zenscript/index.js').then((m) => m.zenscript),
  },
  zig: {
    label: 'Zig',
    aliases: [],
    load: () => import('./zig/index.js').then((m) => m.zig),
  },
} satisfies Record<string, LanguageEntry>

export type LanguageId = keyof typeof LANGUAGES

const ALIASES = new Map<string, LanguageId>()
for (const [id, entry] of Object.entries(LANGUAGES) as [LanguageId, LanguageEntry][]) {
  for (const alias of entry.aliases) ALIASES.set(alias, id)
}

/**
 * resolveLanguage turns a fence's language ("TS", "py") into a known
 * language, or undefined for anything else: that code is shown plain.
 */
export function resolveLanguage(name: string | undefined): LanguageId | undefined {
  if (!name) return undefined
  const key = name.trim().toLowerCase()
  if (Object.hasOwn(LANGUAGES, key)) return key as LanguageId
  return ALIASES.get(key)
}

const loaded = new Map<LanguageId, Language>()
const loading = new Map<LanguageId, Promise<Language>>()

/** loadLanguage loads a language once, however many blocks ask for it. */
export function loadLanguage(id: LanguageId): Promise<Language> {
  let p = loading.get(id)
  if (!p) {
    p = LANGUAGES[id].load().then((lang) => {
      loaded.set(id, lang)
      return lang
    })
    // A failed load (offline) can be tried again next time.
    p.catch(() => loading.delete(id))
    loading.set(id, p)
  }
  return p
}

/** loadedLanguage is a language that has already loaded, so a block can color its first paint. */
export function loadedLanguage(id: LanguageId): Language | undefined {
  return loaded.get(id)
}

/**
 * resolveGrammar finds a loaded language's grammar by id or alias, for the
 * languages others embed: a fence's code, a <style>'s CSS.
 */
export function resolveGrammar(name: string): Grammar | undefined {
  const id = resolveLanguage(name)
  return id ? loaded.get(id)?.grammar : undefined
}
