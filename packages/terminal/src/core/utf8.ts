/** Decodes UTF-8 as it arrives: a character may be split between chunks. What isn't valid becomes U+FFFD. */
export class Utf8Decoder {
  private code = 0
  private left = 0
  /** The least code point the current sequence may hold, to refuse overlong forms. */
  private least = 0

  /** Decodes bytes into `out`, which must have room for one more than there are bytes. Returns how many code points. */
  decode(bytes: Uint8Array, out: Uint32Array): number {
    let n = 0
    for (let i = 0; i < bytes.length; i++) {
      const byte = bytes[i]!
      if (this.left > 0) {
        if ((byte & 0xc0) === 0x80) {
          this.code = (this.code << 6) | (byte & 0x3f)
          if (--this.left > 0) continue
          const bad = this.code < this.least || this.code > 0x10ffff || (this.code >= 0xd800 && this.code <= 0xdfff)
          out[n++] = bad ? 0xfffd : this.code
          continue
        }
        // Cut short: what was there is bad, and this byte starts again.
        this.left = 0
        out[n++] = 0xfffd
      }
      if (byte < 0x80) out[n++] = byte
      else if (byte >= 0xc2 && byte < 0xe0) this.begin(byte & 0x1f, 1, 0x80)
      else if (byte >= 0xe0 && byte < 0xf0) this.begin(byte & 0x0f, 2, 0x800)
      else if (byte >= 0xf0 && byte < 0xf5) this.begin(byte & 0x07, 3, 0x10000)
      else out[n++] = 0xfffd
    }
    return n
  }

  reset(): void {
    this.left = 0
  }

  private begin(code: number, left: number, least: number) {
    this.code = code
    this.left = left
    this.least = least
  }
}
