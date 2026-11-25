/** The numbers of a control sequence. Each may have sub-parameters, which follow it after colons. */
export class Params {
  private readonly values: number[] = []
  private readonly subs = new Map<number, number[]>()

  get length(): number {
    return this.values.length
  }

  /** A parameter, or undefined where it was left out. */
  raw(i: number): number | undefined {
    const value = this.values[i]
    return value === undefined || value < 0 ? undefined : value
  }

  /** A parameter, 0 where it was left out. */
  at(i: number): number {
    const value = this.values[i]
    return value === undefined || value < 0 ? 0 : value
  }

  /** A count: 1 where it was left out, or 0. */
  count(i: number): number {
    return this.at(i) || 1
  }

  /** The sub-parameters of a parameter; -1 marks one left out. */
  sub(i: number): readonly number[] | undefined {
    return this.subs.get(i)
  }

  // ------------------------------------------------------------ building, for the parser

  clear(): void {
    this.values.length = 0
    this.subs.clear()
  }
  /** Starts the next parameter. */
  next(): void {
    if (this.values.length < MAX_PARAMS) this.values.push(-1)
    else this.full = true
  }
  nextSub(): void {
    const last = this.values.length - 1
    if (last < 0 || this.full) return
    const list = this.subs.get(last)
    if (!list) this.subs.set(last, [-1])
    else if (list.length < MAX_PARAMS) list.push(-1)
  }
  digit(d: number): void {
    if (this.full || !this.values.length) return
    const last = this.values.length - 1
    const list = this.subs.get(last) ?? this.values
    const i = list.length - 1
    const value = list[i]!
    list[i] = value < 0 ? d : Math.min(MAX_VALUE, value * 10 + d)
  }
  private full = false
  start(): void {
    this.clear()
    this.full = false
    this.next()
  }
}

const MAX_PARAMS = 32
const MAX_VALUE = 0x7fffffff
/** Payloads longer than this are dropped: nothing a terminal shows needs more. */
const MAX_STRING = 10_000_000

/** What the parser finds. */
export interface ParserHandler {
  /** Printable characters: codes[start..end). */
  print(codes: Uint32Array, start: number, end: number): void
  /** A control character. */
  execute(code: number): void
  /** ESC with a final character, and what came between. */
  esc(intermediates: string, final: string): void
  /** CSI: `prefix` is one of < = > ? or empty. */
  csi(prefix: string, intermediates: string, final: string, params: Params): void
  /** OSC, as "number;data". */
  osc(data: string): void
  /** A device control string, once it has ended. */
  dcs(prefix: string, intermediates: string, final: string, params: Params, data: string): void
}

type State = 'ground' | 'escape' | 'escapeIntermediate' | 'csiEntry' | 'csiParam' | 'csiIntermediate' | 'csiIgnore' | 'osc' | 'dcsEntry' | 'dcsParam' | 'dcsIntermediate' | 'dcsData' | 'dcsIgnore' | 'string'

/** Text gathered piece by piece, up to a limit. */
class Payload {
  private parts: string[] = []
  private length = 0

  start(): void {
    this.parts = []
    this.length = 0
  }
  add(codes: Uint32Array, start: number, end: number): void {
    this.length += end - start
    if (this.length > MAX_STRING) return
    for (let i = start; i < end; i += 4096) this.parts.push(String.fromCodePoint(...codes.subarray(i, Math.min(end, i + 4096))))
  }
  /** The text, or undefined if there was too much. */
  take(): string | undefined {
    const text = this.length > MAX_STRING ? undefined : this.parts.join('')
    this.start()
    return text
  }
}

/**
 * Finds control sequences in terminal output, after the DEC state machine (vt100.net/emu/dec_ansi_parser). It keeps its
 * place between chunks, works on code points, and takes both the 7-bit and the 8-bit forms of the C1 controls.
 */
export class Parser {
  private state: State = 'ground'
  private prefix = ''
  private intermediates = ''
  private final = ''
  private readonly params = new Params()
  private readonly payload = new Payload()

  constructor(private readonly handler: ParserHandler) {}

  reset(): void {
    this.state = 'ground'
    this.payload.start()
  }

  parse(codes: Uint32Array, length: number): void {
    const { handler, params } = this
    for (let i = 0; i < length; i++) {
      const code = codes[i]!

      // Text, by the run.
      if (this.state === 'ground' && code >= 0x20 && (code < 0x7f || code >= 0xa0)) {
        const start = i
        while (i + 1 < length && codes[i + 1]! >= 0x20 && (codes[i + 1]! < 0x7f || codes[i + 1]! >= 0xa0)) i++
        handler.print(codes, start, i + 1)
        continue
      }
      // Payloads, by the run.
      if ((this.state === 'osc' || this.state === 'dcsData') && code >= 0x20 && code !== 0x7f && (code < 0x80 || code >= 0xa0)) {
        const start = i
        while (i + 1 < length && codes[i + 1]! >= 0x20 && codes[i + 1]! !== 0x7f && (codes[i + 1]! < 0x80 || codes[i + 1]! >= 0xa0)) i++
        this.payload.add(codes, start, i + 1)
        continue
      }

      // From anywhere.
      if (code === 0x18 || code === 0x1a) {
        this.abandon()
        handler.execute(code)
        this.state = 'ground'
        continue
      }
      if (code === 0x1b) {
        this.finish()
        this.intermediates = ''
        this.state = 'escape'
        continue
      }
      if (code >= 0x80 && code < 0xa0) {
        if (code === 0x9c) {
          this.finish()
          this.state = 'ground'
          continue
        }
        this.abandon()
        if (code === 0x90) this.enterDcs()
        else if (code === 0x9b) this.enterCsi()
        else if (code === 0x9d) this.enterOsc()
        else if (code === 0x98 || code === 0x9e || code === 0x9f) this.state = 'string'
        else {
          handler.execute(code)
          this.state = 'ground'
        }
        continue
      }

      switch (this.state) {
        case 'ground':
          if (code < 0x20) handler.execute(code)
          break

        case 'escape':
          if (code < 0x20) handler.execute(code)
          else if (code <= 0x2f) {
            this.intermediates = String.fromCharCode(code)
            this.state = 'escapeIntermediate'
          } else if (code === 0x5b) this.enterCsi()
          else if (code === 0x5d) this.enterOsc()
          else if (code === 0x50) this.enterDcs()
          else if (code === 0x58 || code === 0x5e || code === 0x5f) this.state = 'string'
          else if (code < 0x7f) {
            this.state = 'ground'
            handler.esc('', String.fromCharCode(code))
          } else if (code !== 0x7f) this.state = 'ground'
          break

        case 'escapeIntermediate':
          if (code < 0x20) handler.execute(code)
          else if (code <= 0x2f) this.intermediates += String.fromCharCode(code)
          else if (code < 0x7f) {
            this.state = 'ground'
            handler.esc(this.intermediates, String.fromCharCode(code))
          } else if (code !== 0x7f) this.state = 'ground'
          break

        case 'csiEntry':
        case 'csiParam':
          if (code < 0x20) handler.execute(code)
          else if (code >= 0x30 && code <= 0x39) {
            params.digit(code - 0x30)
            this.state = 'csiParam'
          } else if (code === 0x3b) {
            params.next()
            this.state = 'csiParam'
          } else if (code === 0x3a) {
            params.nextSub()
            this.state = 'csiParam'
          } else if (code >= 0x3c && code <= 0x3f) {
            if (this.state === 'csiEntry') {
              this.prefix = String.fromCharCode(code)
              this.state = 'csiParam'
            } else this.state = 'csiIgnore'
          } else if (code <= 0x2f) {
            this.intermediates += String.fromCharCode(code)
            this.state = 'csiIntermediate'
          } else if (code < 0x7f) this.dispatchCsi(code)
          else if (code !== 0x7f) this.state = 'ground'
          break

        case 'csiIntermediate':
          if (code < 0x20) handler.execute(code)
          else if (code <= 0x2f) this.intermediates += String.fromCharCode(code)
          else if (code <= 0x3f) this.state = 'csiIgnore'
          else if (code < 0x7f) this.dispatchCsi(code)
          else if (code !== 0x7f) this.state = 'ground'
          break

        case 'csiIgnore':
          if (code < 0x20) handler.execute(code)
          else if (code >= 0x40 && code < 0x7f) this.state = 'ground'
          break

        case 'osc':
          // BEL ends it as well as ST. Other controls are left out.
          if (code === 0x07) {
            this.finish()
            this.state = 'ground'
          }
          break

        case 'dcsEntry':
        case 'dcsParam':
          if (code >= 0x30 && code <= 0x39) {
            params.digit(code - 0x30)
            this.state = 'dcsParam'
          } else if (code === 0x3b) {
            params.next()
            this.state = 'dcsParam'
          } else if (code === 0x3a) {
            params.nextSub()
            this.state = 'dcsParam'
          } else if (code >= 0x3c && code <= 0x3f) {
            if (this.state === 'dcsEntry') {
              this.prefix = String.fromCharCode(code)
              this.state = 'dcsParam'
            } else this.state = 'dcsIgnore'
          } else if (code >= 0x20 && code <= 0x2f) {
            this.intermediates += String.fromCharCode(code)
            this.state = 'dcsIntermediate'
          } else if (code >= 0x40 && code < 0x7f) this.beginDcs(code)
          break

        case 'dcsIntermediate':
          if (code >= 0x20 && code <= 0x2f) this.intermediates += String.fromCharCode(code)
          else if (code >= 0x30 && code <= 0x3f) this.state = 'dcsIgnore'
          else if (code >= 0x40 && code < 0x7f) this.beginDcs(code)
          break

        case 'dcsData':
          // Control characters are part of the data.
          if (code !== 0x7f) this.payload.add(codes, i, i + 1)
          break

        case 'dcsIgnore':
        case 'string':
          break
      }
    }
  }

  private enterCsi() {
    this.prefix = ''
    this.intermediates = ''
    this.params.start()
    this.state = 'csiEntry'
  }

  private enterDcs() {
    this.prefix = ''
    this.intermediates = ''
    this.params.start()
    this.state = 'dcsEntry'
  }

  private enterOsc() {
    this.payload.start()
    this.state = 'osc'
  }

  private beginDcs(code: number) {
    this.final = String.fromCharCode(code)
    this.payload.start()
    this.state = 'dcsData'
  }

  private dispatchCsi(code: number) {
    this.state = 'ground'
    this.handler.csi(this.prefix, this.intermediates, String.fromCharCode(code), this.params)
  }

  /** A string sequence has its end. */
  private finish() {
    if (this.state === 'osc') {
      const data = this.payload.take()
      if (data !== undefined) this.handler.osc(data)
    } else if (this.state === 'dcsData') {
      const data = this.payload.take()
      if (data !== undefined) this.handler.dcs(this.prefix, this.intermediates, this.final, this.params, data)
    }
  }

  /** A string sequence was cut off: it doesn't count. */
  private abandon() {
    this.payload.start()
  }
}
