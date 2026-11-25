import type { Clipboard } from '@tensorai-co/workspace/host'

/** A clipboard that keeps the copied text. */
export class MemoryClipboard implements Clipboard {
  text = ''

  async readText(): Promise<string> {
    return this.text
  }

  async writeText(text: string): Promise<void> {
    this.text = text
  }
}
