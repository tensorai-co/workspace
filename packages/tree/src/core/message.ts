/** What's wrong (or worth knowing) about the text being typed into a row. Errors stop it from being accepted. */
export interface TreeMessage {
  kind: 'info' | 'warning' | 'error'
  text: string
}
