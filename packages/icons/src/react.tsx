import { memo } from 'react'
import { codicon, fileIcon, type CodiconName, type Icon } from './index.js'

// Every icon's markup comes from this package's own generated data, never from input.

const svg = (icon: Icon) => <svg viewBox={icon.viewBox} fill="currentColor" aria-hidden="true" dangerouslySetInnerHTML={{ __html: icon.body }} />

/** A UI icon, 16px by default, in the text color. */
export const Codicon = memo(function Codicon({ name, size, className = '' }: { name: CodiconName; size?: number; className?: string }) {
  return (
    <span className={`ws-codicon ${className}`} style={size ? { width: size, height: size } : undefined}>
      {svg(codicon(name))}
    </span>
  )
})

/**
 * A file's Seti icon, as file labels draw it: a 19.5px glyph in a box 16px wide, 22px high and 6px from
 * the text. Its color follows the theme.
 */
export const FileIcon = memo(function FileIcon({ name, languageId, className = '' }: { name: string; languageId?: string; className?: string }) {
  const light = fileIcon(name, { theme: 'light', languageId })
  const dark = fileIcon(name, { theme: 'dark', languageId })
  if (!light) return null
  return (
    <span className={`ws-file-icon ${className}`} style={{ '--ws-icon-light': light.color, '--ws-icon-dark': dark?.color ?? light.color } as React.CSSProperties}>
      {svg(light)}
    </span>
  )
})
