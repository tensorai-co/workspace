// Reference values for the layout check, measured on 2026-11-24 and 25 in a browser (light theme, macOS).
//
// The explorer: the tree below with crates/ui/Cargo.toml selected. Boxes are from the list's top left corner, in CSS pixels.

export const files = {
  'crates/ui/examples/': '',
  'crates/ui/src/': '',
  'crates/ui/tests/': '',
  'crates/ui/Cargo.toml': '',
  'crates/ui-build/': '',
  'crates/ui-cef-sys/': '',
  'crates/ui-pack/': '',
  'examples/': '',
  'packages/': '',
  '.gitignore': '',
  'Cargo.lock': '',
  'Cargo.toml': '',
  LICENSE: '',
  'README.md': '',
}

export interface Row {
  name: string
  /** Left, top, distance from the right, height. */
  row: string
  /** The text itself: left, top, width, height. */
  label: string
  twistie?: string
  icon?: string
  iconColor?: string
  /** Each guide: left, top, width, height, opacity. */
  guides: string
  /** Level, set size, position, expanded, selected. */
  aria: string
}

export const rows: Row[] = [
  { name: 'crates', row: '4,0,4,22', label: '34,3.5,37.8,15', twistie: '15,3,16,16', guides: '', aria: '1,8,1,true,false' },
  { name: 'ui', row: '4,22,4,22', label: '42,25.5,10.65,15', twistie: '23,25,16,16', guides: '20,22,8,22,0', aria: '2,4,1,true,false' },
  { name: 'examples', row: '4,44,4,22', label: '50,47.5,57.32,15', twistie: '31,47,16,16', guides: '20,44,8,22,0;28,44,8,22,1', aria: '3,4,1,false,false' },
  { name: 'src', row: '4,66,4,22', label: '50,69.5,18.62,15', twistie: '31,69,16,16', guides: '20,66,8,22,0;28,66,8,22,1', aria: '3,4,2,false,false' },
  { name: 'tests', row: '4,88,4,22', label: '50,91.5,29.82,15', twistie: '31,91,16,16', guides: '20,88,8,22,0;28,88,8,22,1', aria: '3,4,3,false,false' },
  { name: 'Cargo.toml', row: '4,110,4,22', label: '50,113.5,66.47,15', icon: '28,110,16,22,6', iconColor: 'rgb(98, 115, 121)', guides: '20,110,8,22,0;28,110,8,22,1', aria: '3,4,4,,true' },
  { name: 'ui-build', row: '4,132,4,22', label: '42,135.5,46.38,15', twistie: '23,135,16,16', guides: '20,132,8,22,0', aria: '2,4,2,false,false' },
  { name: 'ui-cef-sys', row: '4,154,4,22', label: '42,157.5,61.68,15', twistie: '23,157,16,16', guides: '20,154,8,22,0', aria: '2,4,3,false,false' },
  { name: 'ui-pack', row: '4,176,4,22', label: '42,179.5,45.84,15', twistie: '23,179,16,16', guides: '20,176,8,22,0', aria: '2,4,4,false,false' },
  { name: 'examples', row: '4,198,4,22', label: '34,201.5,57.32,15', twistie: '15,201,16,16', guides: '', aria: '1,8,2,false,false' },
  { name: 'packages', row: '4,220,4,22', label: '34,223.5,57.97,15', twistie: '15,223,16,16', guides: '', aria: '1,8,3,false,false' },
  { name: '.gitignore', row: '4,242,4,22', label: '34,245.5,57.29,15', icon: '12,242,16,22,6', iconColor: 'rgb(59, 75, 82)', guides: '', aria: '1,8,4,,false' },
  { name: 'Cargo.lock', row: '4,264,4,22', label: '34,267.5,65.12,15', icon: '12,264,16,22,6', iconColor: 'rgb(191, 194, 193)', guides: '', aria: '1,8,5,,false' },
  { name: 'Cargo.toml', row: '4,286,4,22', label: '34,289.5,66.47,15', icon: '12,286,16,22,6', iconColor: 'rgb(98, 115, 121)', guides: '', aria: '1,8,6,,false' },
  { name: 'LICENSE', row: '4,308,4,22', label: '34,311.5,53.05,15', icon: '12,308,16,22,6', iconColor: 'rgb(183, 183, 59)', guides: '', aria: '1,8,7,,false' },
  { name: 'README.md', row: '4,330,4,22', label: '34,333.5,76.02,15', icon: '12,330,16,22,6', iconColor: 'rgb(73, 139, 167)', guides: '', aria: '1,8,8,,false' },
]

/** Where an icon's ink lands in its box, from the font metrics icons are drawn with: left, top, right, bottom. */
export const ink = { 'README.md': '3.7,4.7,15.9,16.9', 'Cargo.lock': '7.7,6.4,15.7,15.1', chevron: '3.0,5.0,13.0,10.5' }

/** Background, outline and twistie color by state. "none" where nothing shows. */
export const states = {
  plain: { bg: 'rgba(0, 0, 0, 0)', outline: 'none', twistie: 'rgb(96, 96, 96)' },
  focusedAndSelected: { bg: 'rgba(0, 0, 0, 0.14)', outline: '1px rgb(0, 95, 184) -1px', twistie: 'rgb(0, 0, 0)' },
  selected: { bg: 'rgba(0, 0, 0, 0.14)', outline: 'none', twistie: 'rgb(0, 0, 0)' },
  focused: { bg: 'rgba(0, 0, 0, 0.14)', outline: '1px rgb(0, 105, 204) -1px', twistie: 'rgb(32, 32, 32)' },
  selectedInactive: { bg: 'rgba(218, 218, 218, 0.6)', outline: 'none', twistie: 'rgb(96, 96, 96)' },
  menuOpen: { bg: 'rgba(218, 218, 218, 0.6)', outline: '1px rgb(0, 105, 204) -1px', twistie: 'rgb(96, 96, 96)' },
}

export const text = { fontSize: '13px', fontWeight: '400', lineHeight: '22px', color: 'rgb(32, 32, 32)', smoothing: 'auto', whiteSpace: 'pre', radius: '4px' }

export const header = {
  box: '4,0,4,28',
  radius: '4px',
  background: 'rgb(250, 250, 253)',
  twistie: '10,7',
  twistieColor: 'rgb(96, 96, 96)',
  title: '28,0',
  titleFont: '12px 600 28px rgb(32, 32, 32)',
  /** Top, distance from the right, width, height. */
  actions: '4,80,20,20;4,56,20,20;4,32,20,20;4,8,20,20',
  listTop: 28,
}

/** The rename box on ui-build (a 245px row), from the row's corner. */
export const edit = { box: '38,0,207,22', input: '39,1,205,20', border: '1px rgba(216, 216, 216, 0.4)', outline: '1px rgb(0, 105, 204) -1px', radius: '4px', background: 'rgb(255, 255, 255)', font: '13px', selection: '0,8' }

/** The message for a bad name, from the box's corner. */
export const message = { left: 0, top: 21, padding: '4.8px', font: '12px 17px', border: '1px rgb(173, 7, 7)', background: 'rgb(253, 237, 237)', color: 'rgb(32, 32, 32)', radius: '0px', boxBorder: '1px rgb(173, 7, 7)', boxOutline: 'none' }

export const menu = {
  border: '1px rgb(228, 229, 230)',
  radius: '8px',
  background: 'rgb(250, 250, 253)',
  shadow: 'rgba(0, 0, 0, 0.14) 0px 0px 12px 0px',
  font: '13px',
  /** First item, from the menu's corner. */
  firstItem: '5,5',
  itemHeight: 24,
  itemRadius: '6px',
  labelPadding: '0px 26px',
  keysOpacity: '0.7',
  /** From the top of one group's last item to the top of the next group's first. */
  groupStep: 35,
  activeBackground: 'rgba(0, 0, 0, 0.08)',
  activeOutline: '1px rgb(0, 105, 204) -1px',
  separator: 'rgb(238, 238, 241)',
}

/** The dialog, from its own corner. */
export const dialog = {
  width: 450,
  border: '1px rgb(226, 226, 229)',
  radius: '8px',
  background: 'rgb(250, 250, 253)',
  shadow: 'rgba(0, 0, 0, 0.15) 0px 0px 20px 0px',
  close: '419,9,22,22',
  icon: '13,21,24,24',
  title: '45,23,372',
  titleFont: '13px 600 18.2px',
  detail: '45,57,372',
  detailFont: '13px 20px rgb(96, 96, 96)',
  button: '12px 16px 4px 8px 4px',
  buttonHeight: 26,
  lastButtonRight: 9,
  bottom: 9,
  primary: 'rgb(0, 99, 193) rgb(255, 255, 255) 1px rgb(0, 105, 204) 1px',
  secondary: 'rgb(234, 234, 234) rgb(32, 32, 32)',
}

/**
 * The editor tabs, with [Preview] README.md, Cargo.toml and LICENSE (a preview, and active) in a row 429px wide with four
 * buttons. Boxes are from the row's top left corner.
 */
export const tabs = {
  height: 32,
  strip: 'rgb(234, 234, 234)',
  line: '1px rgb(240, 241, 242)',
  /** Each tab: left, width. */
  boxes: ['-119.5,195.41', '75.91,124.97', '200.88,112.36'],
  text: ['-91.5,8,136.91,15', '103.91,8,66.47,15', '228.88,8,52.86,15'],
  fills: ['-117.5,3.5,191.41,24', '77.91,3.5,120.97,24', '200.88,-1,112.36,33'],
  fillColors: ['rgb(234, 234, 234)', 'rgb(234, 234, 234)', 'rgb(255, 255, 255)'],
  fillRadii: ['4px', '4px', '7px 7px 0px 0px'],
  buttons: ['49.41,5.5,20,20', '174.38,5.5,20,20', '286.74,5.5,20,20'],
  buttonOpacity: ['0', '0', '1'],
  colors: ['rgb(96, 96, 96)', 'rgb(96, 96, 96)', 'rgb(32, 32, 32)'],
  fontStyle: ['normal', 'normal', 'italic'],
  font: '13px 400 24px',
  /** Cargo.toml's icon: left, top, width, height. */
  icon: '81.91,3.5,16,24',
  /** A preview's icon in its tab, and how far from it the name starts. */
  previewIcon: '6,7.5,16,16 22 rgb(66, 66, 66)',
  /** The glyph's em square in it. */
  glyph: '0,2,19.5,19.5',
  divider: '75.91,7.5,1,16 rgb(240, 241, 242)',
  edge: '200.88,-1,112.36,33 1px rgb(240, 241, 242) inset(0px 0px 7px)',
  shoulderAfter: '7px 7px 1px rgb(240, 241, 242) 0px 0px 0px 7px rgb(255, 255, 255) -3.5px 3.5px 0px 3.5px',
  shoulderBefore: '7px 7px 1px rgb(240, 241, 242) 0px 0px 7px rgb(255, 255, 255) 3.5px 3.5px 0px 3.5px',
  lastMargin: '8px',
  /** Each button at the right end. */
  actions: '325,4.5,22,22;351,4.5,22,22;377,4.5,22,22;403,4.5,22,22',
  actionColor: 'rgb(96, 96, 96)',
  actionPadding: '3px',
}

/** The sash between the sidebar (170px wide) and the editors, 4px apart; and the line between groups. */
export const split = {
  sash: '170,0,4',
  cursor: 'col-resize',
  hover: 'rgb(0, 105, 204)',
  radius: '2px',
  grip: '2px 2px rgba(32, 32, 32, 0.4)',
  secondPane: 174,
  line: '1px rgb(229, 229, 229)',
  /** Without a gap, the sash lies over the line. */
  sashOnLine: '198,0,4',
}

/** The terminal in a 642×214 panel body, and the panel's header (642 wide). Boxes are from its top left corner. */
export const terminal = {
  size: '87x14',
  cell: '7,14',
  grid: '20,8,609,196',
  scrollbar: '632,8,10,196',
  sliderRadius: '4px',
  sliderColor: 'rgba(100, 100, 100, 0.75)',
  background: 'rgb(250, 250, 253)',
  font: '12px Menlo',
  /** The colors programs use, after the minimum contrast of 4.5 on this background. Those that already had it stay. */
  kept: { black: 'rgb(0, 0, 0)', red: 'rgb(205, 49, 49)', green: 'rgb(16, 124, 16)', blue: 'rgb(4, 81, 165)', magenta: 'rgb(188, 5, 188)', white: 'rgb(85, 85, 85)' },
  foreground: 'rgb(59, 59, 59)',
  cursor: 'rgb(32, 32, 32)',
  cursorText: 'rgb(255, 255, 255)',
  selection: 'rgb(213, 228, 246)',
  header: {
    height: 32,
    background: 'rgb(234, 234, 234)',
    line: 'rgb(228, 229, 230) 0px -1px 0px 0px inset',
    /** The "Terminal" tab: 51.44 of text between 16s. */
    tab: '0,83.44',
    text: '16,4,24',
    font: '13px 400 24px rgb(32, 32, 32)',
    fill: '0,-1,83.44,33 7px 7px 0px 0px rgb(250, 250, 253)',
    shoulder: '7px 7px 1px rgb(228, 229, 230) 0px 0px 0px 7px rgb(250, 250, 253) -3.5px 3.5px 0px 3.5px',
    /** Buttons, from the right: width, height, top. */
    button: '22,22,5',
    buttonRight: 4,
    gap: 4,
    single: '24.2,3px,11px',
    singleIcon: '16,4px rgb(96, 96, 96)',
    separator: '1,16 rgb(187, 187, 187)',
    /** From the button before to the separator, and from it to the next. */
    separatorGaps: '8,4',
  },
  size_badge: { padding: '4px 10px', radius: '8px', font: '11px', shadow: 'rgba(0, 0, 0, 0.14) 0px 0px 12px 0px', border: '1px rgb(228, 229, 230)', background: 'rgb(250, 250, 253)' },
}

/**
 * The Markdown preview of markdown.ts, 407.5px wide. Measured from reference styles over the HTML another parser makes of the
 * same text. Boxes: left, top, width, height.
 */
export const preview = {
  boxes: `table 0 0 125.41 93
tbody 0.5 0.5 124.41 92
tr 0.5 0.5 124.41 35
th 0.5 0.5 56.63 35
td 57.13 0.5 67.79 35
tr 0.5 35.5 124.41 57
th 0.5 35.5 56.63 57
td 57.13 35.5 67.79 57
ul 70.63 42 40.79 44
li 87.42 42 23.99 22
li 87.42 64 23.99 22
h1 0 109 303.5 44.4
p 0 169.4 303.5 88
strong 114.02 171.9 30.45 16.5
em 152.26 171.9 30.23 16.5
s 190.28 171.9 32.38 16.5
code 230.45 171.4 39.72 18.5
a 0 193.9 33.53 16.5
h2 0 281.4 303.5 33.55
ul 0 330.95 303.5 110
li 40 330.95 263.5 22
li 40 352.95 263.5 66
ul 40 374.95 263.5 44
li 80 374.95 223.5 44
ol 80 396.95 223.5 22
li 120 396.95 183.5 22
li 40 418.95 263.5 22
ol 0 450.74 303.5 44
li 40 450.74 263.5 22
li 40 472.74 263.5 22
ul 0 504.54 303.5 53.8
li 40 504.54 263.5 22
p 40 504.54 263.5 22
li 40 536.34 263.5 22
p 40 536.34 263.5 22
h3 0 582.34 303.5 21.88
blockquote 0 620.21 303.5 60
p 15 620.21 272.5 22
code 103.88 622.21 39.72 18.5
p 15 658.21 272.5 22
h4 0 704.21 303.5 17.5
table 0 737.71 170.61 131
thead 0 737.71 170.61 32.5
tr 0 737.71 170.61 32.5
th 0 737.71 47.36 32.5
th 47.36 737.71 66.59 32.5
th 113.95 737.71 56.66 32.5
tbody 0 770.21 170.61 98.5
tr 0 770.21 170.61 33
td 0 770.21 47.36 33
td 47.36 770.21 66.59 33
td 113.95 770.21 56.66 33
tr 0 803.21 170.61 33
td 0 803.21 47.36 33
td 47.36 803.21 66.59 33
td 113.95 803.21 56.66 33
tr 0 836.21 170.61 32.5
td 0 836.21 47.36 32.5
td 47.36 836.21 66.59 32.5
td 113.95 836.21 56.66 32.5
h5 0 892.71 303.5 15.31
pre 0 924.02 303.5 111.5
code 17 941.02 202.29 76
pre 0 1049.52 303.5 56
code 17 1068.02 67.43 19
h6 0 1129.52 303.5 14.87
hr 0 1160.39 303.5 2
p 0 1169.39 303.5 23.31
kbd 39.58 1171.2 16.43 20.5
sub 74.05 1177.19 7.07 14
sup 106.14 1168.73 7.07 14
a 121.01 1171.89 81.86 16.5
code 121.01 1171.39 81.86 18.5
div 0 1208.7 303.5 0
p 0 1208.7 303.5 22
div 0 1246.7 303.5 0
details 0 1246.7 303.5 44
summary 0 1246.7 303.5 22
p 0 1268.7 303.5 22
div 0 1306.7 303.5 0
p 0 1306.7 303.5 22
div 0 1344.7 303.5 0`,
  /** Color, background, font size, weight, line height, padding, margin, border width, color and radius, alignment, shadow. */
  styles: {
    a: 'rgb(0, 105, 204) | rgba(0, 0, 0, 0) | 14px | 400 | 22px | 0px | 0px | 0px | rgb(0, 105, 204) | 0px | start | none',
    blockquote: 'rgb(32, 32, 32) | rgb(234, 234, 234) | 14px | 400 | 22px | 0px 16px 0px 10px | 0px | 0px 0px 0px 5px | rgb(240, 241, 242) | 2px | start | none',
    code: 'rgb(59, 59, 59) | rgba(0, 0, 0, 0.12) | 14px | 400 | 18.998px | 1px 3px | 0px | 0px | rgb(59, 59, 59) | 4px | start | none',
    h1: 'rgb(32, 32, 32) | rgba(0, 0, 0, 0) | 28px | 600 | 35px | 0px 0px 8.4px | 0px 0px 16px | 0px 0px 1px | rgba(0, 0, 0, 0.18) | 0px | start | none',
    h2: 'rgb(32, 32, 32) | rgba(0, 0, 0, 0) | 21px | 600 | 26.25px | 0px 0px 6.3px | 24px 0px 16px | 0px 0px 1px | rgba(0, 0, 0, 0.18) | 0px | start | none',
    h3: 'rgb(32, 32, 32) | rgba(0, 0, 0, 0) | 17.5px | 600 | 21.875px | 0px | 24px 0px 16px | 0px | rgb(32, 32, 32) | 0px | start | none',
    hr: 'rgb(128, 128, 128) | rgba(0, 0, 0, 0) | 14px | 400 | 22px | 0px | 7px 0px | 0px 0px 1px | rgba(0, 0, 0, 0.18) | 0px | start | none',
    kbd: 'rgb(59, 59, 59) | rgba(221, 221, 221, 0.4) | 14px | 400 | 22px | 1px 3px | 0px | 1px | rgba(204, 204, 204, 0.4) rgba(204, 204, 204, 0.4) rgba(187, 187, 187, 0.4) | 3px | start | rgba(0, 0, 0, 0) 0px -1px 0px 0px inset',
    'a code': 'rgb(59, 59, 59) | rgba(0, 0, 0, 0.12) | 14px | 400 | 18.998px | 1px 3px | 0px | 0px | rgb(59, 59, 59) | 4px | start | none',
    p: 'rgb(32, 32, 32) | rgba(0, 0, 0, 0) | 14px | 400 | 22px | 0px | 0px 0px 16px | 0px | rgb(32, 32, 32) | 0px | start | none',
    pre: 'rgb(32, 32, 32) | rgb(236, 236, 236) | 14px | 400 | 22px | 16px | 0px 0px 14px | 1px | rgb(226, 226, 229) | 3px | start | none',
    'pre code': 'rgb(32, 32, 32) | rgba(0, 0, 0, 0) | 14px | 400 | 18.998px | 0px | 0px | 0px | rgb(32, 32, 32) | 4px | start | none',
    '.ws-md-front th': 'rgb(32, 32, 32) | rgba(0, 0, 0, 0) | 14px | 600 | 22px | 6px 13px | 0px | 1px | rgb(226, 226, 229) | 0px | left | none',
    '.ws-md-front td': 'rgb(32, 32, 32) | rgba(0, 0, 0, 0) | 14px | 400 | 22px | 6px 13px | 0px | 1px | rgb(226, 226, 229) | 0px | left | none',
  },
  /** From the block's top right corner, with its size. */
  copy: [9, 9, 28, 28],
  copyStyle: 'rgb(32, 32, 32) rgb(236, 236, 236) 1px rgb(226, 226, 229) 4px 0',
  padding: '14px 52px 0px',
  /** Of the marks beside a paragraph and a list item: left, width, color. */
  mark: '-12px 3px rgba(0, 0, 0, 0.15)',
  itemMark: '-30px 3px rgba(0, 0, 0, 0.15)',
}

/**
 * The workspace's parts, with the window at 766×575, the sidebar showing
 * the Explorer and the secondary side bar open. Boxes are from the window's top left corner: left, top, width, height.
 */
export const workspace = {
  window: [766, 575],
  titlebar: { box: '0,0,766,35', background: 'rgb(250, 250, 253)', color: 'rgb(96, 96, 96)' },
  back: '211.46,7.5,22,22',
  forward: '237.46,7.5,22,22',
  commandCenter: { box: '263.46,6.5,291.08,24', border: '1px rgba(216, 216, 216, 0.67)', radius: '4px', label: '274.46 12px 22px rgb(32, 32, 32)' },
  toggles: ['662,7.5,22,22', '688,7.5,22,22', '714,7.5,22,22', '740,7.5,22,22'],
  toggle: { color: 'rgb(96, 96, 96)', radius: '4px', icon: 16 },
  activityBar: { box: '4,35,44,508', border: '1px rgb(229, 229, 229)', radius: '8px 0px 0px 8px', background: 'rgb(250, 250, 253)' },
  menu: { box: '8,39,36,36', icon: '16 rgb(96, 96, 96)' },
  item: { box: '8,78,36,36', indicator: '10,80,32,32', checked: 'rgb(214, 214, 214) 4px', icon: '24 rgb(59, 59, 59)' },
  sidebar: { left: 48, top: 35, height: 508, borderLeft: '1px rgba(0, 0, 0, 0)', radius: '0px 8px 8px 0px', title: '61,36,32', titleFont: '12px 600 rgb(32, 32, 32)' },
  card: { border: '1px rgb(228, 229, 230)', radius: '8px' },
  editor: { top: 35, gap: 4, background: 'rgb(255, 255, 255)' },
  panel: { gap: 4, bottom: 543 },
  auxiliaryBar: { right: 762, top: 35, height: 508, gap: 4, tab: '17,5,24', close: '5,6,22,22' },
  statusbar: { box: '0,547,766,28', padding: '2px 12px', font: '12px rgb(96, 96, 96)', first: '12,549', rightEnd: 12 },
  remote: { background: 'rgb(0, 95, 184)', color: 'rgb(255, 255, 255)', padding: '0px 6px', radius: '4px' },
  statusItem: { padding: '0px 5px', margin: '0px 3px', radius: '4px', height: 24 },
}

/**
 * The find widget: "ui" searched in a Cargo.toml. Boxes are from
 * the widget's top left (left, top, width, height), or for things on the right, from its right edge (that distance,
 * top, width, height). It's 2 × the 14px scrollbar in from the editor's right edge.
 */
export const find = {
  widget: { right: 28, top: 4, height: 33, replaceHeight: 62, width: 419 },
  look: 'rgb(250, 250, 253) 1px rgb(226, 226, 229) 8px rgba(0, 0, 0, 0.14) 0px 0px 12px 0px 0px 4px 0px 9px',
  toggleReplace: '6,5,18,23',
  input: { box: '27,4,25', look: 'rgb(255, 255, 255) 1px rgba(216, 216, 216, 0.4) 4px', text: '28,5,23 13px 19px 2px 6px rgb(32, 32, 32)', focus: 'rgb(0, 105, 204) solid 1px' },
  /** Its width at the 414px; ours is 419px, the widget's own width. */
  inputWidth: 216,
  options: ['242,7,20,20', '220,7,20,20', '198,7,20,20'],
  optionLook: '3px rgb(32, 32, 32)',
  checked: 'rgb(214, 214, 214) rgb(240, 241, 242)',
  count: { box: '173,4,69,25', text: '12px 23px 2px 0px 0px 2px rgb(32, 32, 32)', none: 'No results rgb(173, 7, 7)' },
  buttons: ['101,5.5,22,22', '76,5.5,22,22', '52,5.5,22,22'],
  buttonLook: '5px rgb(96, 96, 96)',
  close: '27,6,22,22',
  replace: { input: '27,32,25', option: '198,35,20,20', buttons: ['173,33.5,22,22', '148,33.5,22,22'] },
  matches: { other: 'rgba(0, 105, 204, 0.1)', current: 'rgba(0, 105, 204, 0.25)', height: 18 },
}

/**
 * Folding: line 2 of a Cargo.toml ("members = [", with five
 * lines under it) folded and unfolded. Boxes are from the editor's top left: left, top, width, height.
 */
export const fold = {
  chevron: '42,18,26,18',
  chevronLook: 'rgb(96, 96, 96) 16',
  /** Its opacity, unfolded and away from the gutter, then folded. */
  opacity: '0 1',
  numbers: '1,2,8,9',
  /** "⋯" with its margins: left and width to a tenth of a pixel, and its color. */
  placeholder: '145.5,12 rgb(128, 128, 128) 12px',
  background: '66,18,18 rgba(0, 105, 204, 0.07)',
}

/**
 * The command palette, with the window at 766×575. Boxes are from the widget's top left; "full" is with
 * more commands than fit, and "toggle side" the filter for the rows with keys.
 */
export const quick = {
  widget: '146,6,476.91',
  fullHeight: 272,
  look: 'rgb(250, 250, 253) / rgb(32, 32, 32) / 1px rgb(226, 226, 229) / 8px / rgba(0, 0, 0, 0.15) 0px 0px 20px 0px',
  box: '7,7,462.91,25 rgb(255, 255, 255) / rgba(216, 216, 216, 0.4) / 4px',
  input: '8,8,460.91,23 4px 6px / 13px / rgb(32, 32, 32)',
  firstRow: '7,38,462.91,22',
  name: '16,41.5,15',
  focused: 'rgb(0, 105, 204) / rgb(255, 255, 255) / 4px',
  highlight: 'rgb(0, 105, 204) 700',
  /** The keys of "View: Toggle Primary Side Bar Visibility" (⌘B) and "…Secondary…" (⌥⌘B): left, width, height. */
  keys: { sidebar: '413.91,24,18 441.91,24,18', secondary: '385.91,24,18 413.91,24,18 441.91,24,18' },
  keyLook: 'rgba(221, 221, 221, 0.4) / rgba(204, 204, 204, 0.4) / rgba(187, 187, 187, 0.4) / rgb(59, 59, 59) / 3px 5px / 11px',
}

/**
 * Language features: a TypeScript file with `const total: number = 'x'` and `Math.` on the next line, ⌃Space after the dot, then
 * "lo" typed; the hover over `total`; and a wider editor, for where the list goes when nothing pushes it. Boxes are left, top, width, height.
 */
export const languages = {
  suggest: {
    /** Its top is the cursor line's bottom and its left the cursor's x; it keeps 29px from the window's right edge. */
    rightMargin: 29,
    width: 432,
    /** With 12 rows (its most), 8 and 2. */
    heights: { 12: 218, 8: 148, 2: 40 },
    look: 'rgb(250, 250, 253) / rgb(32, 32, 32) / 1px rgb(228, 229, 230) / 8px / 13px',
    /** Rows from the widget's corner. */
    row: '1,1,430,18',
    rowStep: 18,
    icon: '3,1,16,18',
    /** The label's text: left, top, height; then its font size and color. */
    label: '23,3,14 12px rgb(32, 32, 32)',
    /** The selected row's detail, right-aligned: its right edge, and its font size. */
    detail: '421 10.2px',
    focused: 'rgba(0, 0, 0, 0.14) / rgb(0, 105, 204) 1px solid / 8px 8px 4px 4px',
    /** A method's and a field's icon, then the selected row's. */
    iconColors: 'rgb(101, 45, 144) rgb(0, 122, 204) rgb(32, 32, 32)',
    highlight: 'rgb(0, 105, 204) 700',
  },
  /** The details, under the list when there's no room beside it. */
  details: {
    /** Its top is the list's bottom less 1. */
    overlap: 1,
    look: 'rgb(250, 250, 253) / rgb(32, 32, 32) / 1px rgb(228, 229, 230) / 8px / 12px / 18px',
    /** The type line's text, then its opacity and font. */
    type: '6,7,14 0.7 12px',
    close: '411,7,18,18',
    /** The first paragraph of the docs. */
    docs: '6,39,18',
  },
  hover: {
    look: 'rgb(250, 250, 253) / rgb(32, 32, 32) / 1px rgb(228, 229, 230) / 8px / rgba(0, 0, 0, 0.14) 0px 0px 12px 0px',
    /** Under the line when there's no room over it: its top is the line's bottom. Over it, its bottom is the line's top. */
    below: 0,
    above: 0,
    /**
     * "Type 'string' is not assignable to type 'number'. ts(2322)", and `const total: number` under it. It's its
     * content's width and 2px, rounded: 482 here, and 489 for "…to type 'boolean'." over `const c: boolean`.
     */
    width: 482,
    /**
     * Without the row of actions under them ("View Problem (⌥F8)", "Quick Fix... (⌘.)"), 24.5px with its line,
     * which needs a problems view and quick fixes: 80 with it.
     */
    height: 55,
    marker: { row: '1,1,26', icon: '9,5,16,18 rgb(229, 20, 0)', message: '33,7,14 12px' },
    /** The row with its line above, then its text. */
    code: { row: '1,27,27', text: '9,32,18 12px' },
    rowBorder: '1px rgba(228, 229, 230, 0.5)',
  },
  squiggle: { error: 'rgb(229, 20, 0)', warning: 'rgb(191, 136, 3)', info: 'rgb(0, 99, 211)', height: 18 },
  /** The status bar's problems item with no problems, from its corner. */
  problems: { width: 73.25, icons: '8,4,16,16 38.31,4,16,16', text: '24,14.31 54.31,10.94', color: 'rgb(96, 96, 96)' },
}
