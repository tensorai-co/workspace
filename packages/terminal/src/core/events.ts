/** One kind of event, and who listens for it. */
export class Emitter<T> {
  private readonly listeners = new Set<(value: T) => void>()

  /** Returns a function that stops listening. */
  listen = (listener: (value: T) => void): (() => void) => {
    this.listeners.add(listener)
    return () => void this.listeners.delete(listener)
  }

  emit(value: T): void {
    for (const listener of [...this.listeners]) listener(value)
  }
}
