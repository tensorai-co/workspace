import type { Storage } from '@tensorai-workspace/host'

/** Storage that keeps its values in a map. */
export class MemoryStorage implements Storage {
  readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}
